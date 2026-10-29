import "server-only"

import { createHash } from "node:crypto"

import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { cache } from "react"
import * as z from "zod"

import { firestore } from "@/lib/firebase/admin"
import { getFirestoreCollectionName } from "@/lib/firebase/firestore-collection"
import { readActivityAvailability } from "@/modules/event-activities/activity-availability.repository"
import {
  getParticipantSummaryRef,
  incrementParticipantSummary,
} from "@/modules/participant-summary/participant-summary.repository"
import { canReviewMission } from "@/modules/profile/profile.authorization"
import {
  accessRolesSchema,
  storedProfileFieldsSchema,
} from "@/modules/profile/profile.schema"

import {
  completeQrMissionInputSchema,
  type Mission,
  missionFieldsSchema,
} from "./mission.schema"
import { type MissionAttempt, missionAttemptSchema } from "./mission-attempts"
import {
  type MissionCompletion,
  missionCompletionFieldsSchema,
} from "./mission-completion.schema"
import { normalizeKeyword } from "./mission-keyword"
import { countSharedInterestConnections } from "./mission-networking"
import { scoreMissionQuiz } from "./mission-quiz"

const MISSIONS_COLLECTION = getFirestoreCollectionName("missions")
const COMPLETIONS_COLLECTION = getFirestoreCollectionName("activityCompletions")
const PROFILES_COLLECTION = getFirestoreCollectionName("profiles")

const missionDocumentSchema = z.object({
  eventId: missionFieldsSchema.shape.eventId,
  companyId: missionFieldsSchema.shape.companyId,
  qrId: missionFieldsSchema.shape.qrId,
  title: missionFieldsSchema.shape.title,
  description: missionFieldsSchema.shape.description,
  imageUrl: missionFieldsSchema.shape.imageUrl,
  externalUrl: missionFieldsSchema.shape.externalUrl,
  externalLinks: missionFieldsSchema.shape.externalLinks,
  validationType: missionFieldsSchema.shape.validationType,
  quizConfig: missionFieldsSchema.shape.quizConfig,
  keywordConfig: missionFieldsSchema.shape.keywordConfig,
  progressRequirement: missionFieldsSchema.shape.progressRequirement,
  prerequisites: missionFieldsSchema.shape.prerequisites,
  active: missionFieldsSchema.shape.active,
  order: missionFieldsSchema.shape.order,
  xpAwarded: missionFieldsSchema.shape.xpAwarded,
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
})

const missionCompletionDocumentSchema = missionCompletionFieldsSchema
  .omit({ id: true, completedAt: true, validatedAt: true })
  .extend({
    completedAt: z.instanceof(Timestamp),
    validatedAt: z.instanceof(Timestamp).nullable(),
  })

const profileScoreSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  eventId: z.string().trim().min(1).max(128),
  onboardingCompleted: z.boolean(),
  accessRoles: accessRolesSchema.default(["participant"]),
  xp: z.number().int().nonnegative().default(0),
})

const missionReviewerSchema = z.object({
  userId: profileScoreSchema.shape.userId,
  eventId: profileScoreSchema.shape.eventId,
  accessRoles: accessRolesSchema,
  sponsorCompanyId: storedProfileFieldsSchema.shape.sponsorCompanyId,
})

export type CompleteMissionResult =
  | Readonly<{
      status: "completed" | "already-completed"
      mission: Mission
      completion: MissionCompletion
    }>
  | Readonly<{
      status:
        | "disabled"
        | "forbidden"
        | "quiz-not-passed"
        | "invalid-answers"
        | "quiz-changed"
        | "incorrect-answer"
        | "attempts-exhausted"
        | "inactive"
        | "invalid-validation-type"
        | "not-found"
        | "prerequisite-missing"
        | "profile-unavailable"
      attemptsRemaining?: number
      lastScore?: number
      questionCount?: number
    }>

type CachedMission = Omit<Mission, "createdAt" | "updatedAt"> &
  Readonly<{ createdAt: number; updatedAt: number }>

const automaticMissionSummarySchema = z.object({
  eventId: z.string().trim().min(1).max(128),
  participantId: z.string().trim().min(1).max(128),
  connectionsCount: z.number().int().nonnegative().default(0),
  companiesVisitedCount: z.number().int().nonnegative().default(0),
  tagsDiscoveredCount: z.number().int().nonnegative().default(0),
})

function getCompletionId(
  eventId: string,
  participantId: string,
  activityType: "company" | "mission",
  activityId: string
) {
  return createHash("sha256")
    .update(JSON.stringify([eventId, participantId, activityType, activityId]))
    .digest("hex")
}

function parseMissionDocument(id: string, value: unknown): Mission {
  const document = missionDocumentSchema.parse(value)

  return missionFieldsSchema.parse({
    id,
    ...document,
    createdAt: document.createdAt.toDate(),
    updatedAt: document.updatedAt.toDate(),
  })
}

function parseCompletion(id: string, value: unknown): MissionCompletion {
  const document = missionCompletionDocumentSchema.parse(value)

  return missionCompletionFieldsSchema.parse({
    id,
    ...document,
    completedAt: document.completedAt.toDate(),
    validatedAt: document.validatedAt?.toDate() ?? null,
  })
}

async function loadActiveMissions(eventId: string): Promise<CachedMission[]> {
  const validatedEventId =
    completeQrMissionInputSchema.shape.eventId.parse(eventId)
  const snapshots = await firestore
    .collection(MISSIONS_COLLECTION)
    .where("eventId", "==", validatedEventId)
    .get()

  return snapshots.docs
    .map((snapshot) => parseMissionDocument(snapshot.id, snapshot.data()))
    .filter((mission) => mission.active)
    .sort(
      (first, second) =>
        first.order - second.order ||
        first.title.localeCompare(second.title, "pt-BR")
    )
    .map((mission) => ({
      ...mission,
      createdAt: mission.createdAt.getTime(),
      updatedAt: mission.updatedAt.getTime(),
    }))
}

// The admin is a separate application and cannot invalidate this app's data cache.
// Deduplicate within a render, but read current mission links on each request.
const loadCurrentActiveMissions = cache(loadActiveMissions)

export async function findActiveMissions(eventId: string): Promise<Mission[]> {
  const missions = await loadCurrentActiveMissions(eventId)

  return missions.map((mission) => ({
    ...mission,
    createdAt: new Date(mission.createdAt),
    updatedAt: new Date(mission.updatedAt),
  }))
}

// Validation screens must reflect company assignments and activation changes immediately.
export async function findReviewableMissions(
  eventId: string
): Promise<Mission[]> {
  const missions = await loadActiveMissions(eventId)
  return missions
    .filter((mission) => mission.validationType === "reviewer")
    .map((mission) => ({
      ...mission,
      createdAt: new Date(mission.createdAt),
      updatedAt: new Date(mission.updatedAt),
    }))
}

export async function findMissionProgressByParticipant(
  eventId: string,
  participantId: string
): Promise<{
  completions: MissionCompletion[]
  activityKeys: Set<string>
}> {
  const validatedEventId =
    completeQrMissionInputSchema.shape.eventId.parse(eventId)
  const validatedParticipantId =
    profileScoreSchema.shape.userId.parse(participantId)
  const snapshots = await firestore
    .collection(COMPLETIONS_COLLECTION)
    .where("participantId", "==", validatedParticipantId)
    .get()
  const completions: MissionCompletion[] = []
  const activityKeys = new Set<string>()

  for (const snapshot of snapshots.docs) {
    const value = snapshot.data()
    const result = z
      .object({
        eventId: z.string(),
        participantId: z.string(),
        activityType: z.string(),
        activityId: z.string(),
      })
      .safeParse(value)

    if (
      !result.success ||
      result.data.eventId !== validatedEventId ||
      result.data.participantId !== validatedParticipantId
    ) {
      continue
    }

    activityKeys.add(`${result.data.activityType}:${result.data.activityId}`)

    if (result.data.activityType === "mission") {
      completions.push(parseCompletion(snapshot.id, value))
    }
  }

  return { completions, activityKeys }
}

export async function findMissionAttemptsByParticipant(
  eventId: string,
  participantId: string,
  missionIds: string[]
): Promise<Map<string, MissionAttempt>> {
  if (!missionIds.length) return new Map()
  const snapshots = await firestore.getAll(
    ...missionIds.map((missionId) =>
      firestore
        .collection(getFirestoreCollectionName("missionAttempts"))
        .doc(getCompletionId(eventId, participantId, "mission", missionId))
    )
  )
  const attempts = new Map<string, MissionAttempt>()
  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue
    const attempt = missionAttemptSchema.parse(snapshot.data())
    if (
      attempt.eventId !== eventId ||
      attempt.participantId !== participantId ||
      snapshot.id !==
        getCompletionId(eventId, participantId, "mission", attempt.missionId)
    ) {
      throw new Error("Stored mission attempt identity is invalid")
    }
    attempts.set(attempt.missionId, attempt)
  }
  return attempts
}

async function findMissionTarget({
  eventId,
  missionId,
  qrId,
}: {
  eventId: string
  missionId?: string
  qrId?: string
}) {
  if (missionId) {
    const snapshot = await firestore
      .collection(MISSIONS_COLLECTION)
      .doc(missionId)
      .get()

    return snapshot.exists ? { id: snapshot.id, data: snapshot.data() } : null
  }

  const snapshots = await firestore
    .collection(MISSIONS_COLLECTION)
    .where("eventId", "==", eventId)
    .where("qrId", "==", qrId)
    .limit(2)
    .get()

  if (snapshots.size > 1) {
    throw new Error("Public mission QR identifier is not unique")
  }

  return snapshots.empty
    ? null
    : { id: snapshots.docs[0].id, data: snapshots.docs[0].data() }
}

export async function completeMission({
  eventId,
  participantId,
  validationType,
  defaultXpAwarded,
  missionId,
  qrId,
  validatedBy,
  answer,
  answers,
  revision,
}: {
  eventId: string
  participantId: string
  validationType: "qr" | "reviewer" | "keyword" | "quiz"
  defaultXpAwarded: number
  missionId?: string
  qrId?: string
  revision?: number
  answers?: Array<{ questionId: string; optionIndex: number }>
  answer?: string
  validatedBy?: string
}): Promise<CompleteMissionResult> {
  const validatedEventId =
    completeQrMissionInputSchema.shape.eventId.parse(eventId)
  const validatedParticipantId =
    profileScoreSchema.shape.userId.parse(participantId)
  const validatedDefaultXp = z.number().int().positive().parse(defaultXpAwarded)
  const target = await findMissionTarget({
    eventId: validatedEventId,
    missionId,
    qrId,
  })

  if (!target) {
    return { status: "not-found" }
  }

  const initialMission = parseMissionDocument(target.id, target.data)

  if (initialMission.eventId !== validatedEventId) {
    return { status: "not-found" }
  }

  if (!initialMission.active) {
    return { status: "inactive" }
  }

  if (
    initialMission.validationType !== validationType ||
    (validationType === "qr" && initialMission.qrId !== qrId) ||
    (validationType === "reviewer" && !validatedBy)
  ) {
    return { status: "invalid-validation-type" }
  }

  const completionId = getCompletionId(
    validatedEventId,
    validatedParticipantId,
    "mission",
    initialMission.id
  )
  const profileRef = firestore
    .collection(PROFILES_COLLECTION)
    .doc(validatedParticipantId)
  const completionRef = firestore
    .collection(COMPLETIONS_COLLECTION)
    .doc(completionId)
  const attemptRef = firestore
    .collection(getFirestoreCollectionName("missionAttempts"))
    .doc(completionId)
  const prerequisiteRefs = initialMission.prerequisites.map((prerequisite) =>
    firestore
      .collection(COMPLETIONS_COLLECTION)
      .doc(
        getCompletionId(
          validatedEventId,
          validatedParticipantId,
          prerequisite.type,
          prerequisite.activityId
        )
      )
  )

  return firestore.runTransaction(async (transaction) => {
    let mission = initialMission
    const [
      profileSnapshot,
      completionSnapshot,
      attemptSnapshot,
      missionSnapshot,
      ...initialPrerequisiteSnapshots
    ] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(completionRef),
      transaction.get(attemptRef),
      validationType === "quiz" || validationType === "reviewer"
        ? transaction.get(
            firestore.collection(MISSIONS_COLLECTION).doc(mission.id)
          )
        : Promise.resolve(null),
      ...(validationType === "reviewer"
        ? []
        : prerequisiteRefs.map((reference) => transaction.get(reference))),
    ])

    let prerequisiteSnapshots = initialPrerequisiteSnapshots
    if (validationType === "reviewer") {
      if (!missionSnapshot?.exists) return { status: "not-found" }
      const currentMission = parseMissionDocument(
        missionSnapshot.id,
        missionSnapshot.data()
      )
      const reviewerSnapshot = await transaction.get(
        firestore.collection(PROFILES_COLLECTION).doc(validatedBy!)
      )
      const reviewer = missionReviewerSchema.safeParse(reviewerSnapshot.data())
      if (
        !reviewer.success ||
        currentMission.eventId !== validatedEventId ||
        reviewer.data.userId !== validatedBy ||
        !canReviewMission(reviewer.data, currentMission)
      )
        return { status: "forbidden" }
      if (reviewer.data.accessRoles[0] === "sponsor") {
        const company = await transaction.get(
          firestore
            .collection(getFirestoreCollectionName("companies"))
            .doc(reviewer.data.sponsorCompanyId!)
        )
        if (
          !company.exists ||
          company.data()?.eventId !== validatedEventId ||
          company.data()?.active !== true
        )
          return { status: "forbidden" }
      }
      // Rebuild prerequisite reads from the current mission, not the pre-transaction snapshot.
      prerequisiteSnapshots = await Promise.all(
        currentMission.prerequisites.map((prerequisite) =>
          transaction.get(
            firestore
              .collection(COMPLETIONS_COLLECTION)
              .doc(
                getCompletionId(
                  validatedEventId,
                  validatedParticipantId,
                  prerequisite.type,
                  prerequisite.activityId
                )
              )
          )
        )
      )
      mission = currentMission
    }

    if (!profileSnapshot.exists) {
      return { status: "profile-unavailable" }
    }

    const profile = profileScoreSchema.parse(profileSnapshot.data())

    if (
      profile.userId !== validatedParticipantId ||
      profile.eventId !== validatedEventId ||
      !profile.onboardingCompleted ||
      !profile.accessRoles.includes("participant")
    ) {
      return { status: "profile-unavailable" }
    }

    if (completionSnapshot.exists) {
      return {
        status: "already-completed",
        mission,
        completion: parseCompletion(
          completionSnapshot.id,
          completionSnapshot.data()
        ),
      }
    }

    if (
      !(await readActivityAvailability(transaction, validatedEventId))
        .missionsEnabled
    )
      return { status: "disabled" }

    if (attemptSnapshot.data()?.outcome === "failed") {
      return {
        status: "attempts-exhausted",
        attemptsRemaining: 0,
        lastScore: attemptSnapshot.data()?.lastScore,
        questionCount: attemptSnapshot.data()?.questionCount,
      }
    }

    if (prerequisiteSnapshots.some((snapshot) => !snapshot.exists)) {
      return { status: "prerequisite-missing" }
    }

    if (validationType === "quiz") {
      if (!missionSnapshot?.exists) return { status: "not-found" }
      const currentMission = parseMissionDocument(
        missionSnapshot.id,
        missionSnapshot.data()
      )
      if (!currentMission.active) return { status: "inactive" }
      if (
        currentMission.validationType !== "quiz" ||
        !currentMission.quizConfig
      )
        return { status: "invalid-validation-type" }
      if (currentMission.eventId !== validatedEventId)
        return { status: "not-found" }
      if (
        currentMission.updatedAt.getTime() !== revision ||
        currentMission.updatedAt.getTime() !== mission.updatedAt.getTime()
      )
        return { status: "quiz-changed" }
      const config = currentMission.quizConfig!
      const attempts = z
        .number()
        .int()
        .nonnegative()
        .parse(attemptSnapshot.data()?.attempts ?? 0)
      if (attempts >= config.maxAttempts) {
        transaction.set(attemptRef, {
          ...attemptSnapshot.data(),
          outcome: "failed",
          closedAt: Timestamp.now(),
        })
        return {
          status: "attempts-exhausted",
          attemptsRemaining: 0,
          lastScore: attemptSnapshot.data()?.lastScore,
          questionCount: attemptSnapshot.data()?.questionCount,
        }
      }
      const score = scoreMissionQuiz(config, answers ?? [])
      if (score === null) return { status: "invalid-answers" }
      transaction.set(attemptRef, {
        eventId: validatedEventId,
        participantId: validatedParticipantId,
        missionId: mission.id,
        attempts: attempts + 1,
        outcome:
          score >= config.minCorrectAnswers
            ? "completed"
            : attempts + 1 >= config.maxAttempts
              ? "failed"
              : "in-progress",
        lastScore: score,
        questionCount: config.questions.length,
        closedAt:
          score >= config.minCorrectAnswers ||
          attempts + 1 >= config.maxAttempts
            ? Timestamp.now()
            : null,
        updatedAt: Timestamp.now(),
      })
      if (score < config.minCorrectAnswers)
        return {
          status:
            attempts + 1 >= config.maxAttempts
              ? "attempts-exhausted"
              : "quiz-not-passed",
          attemptsRemaining: config.maxAttempts - attempts - 1,
          lastScore: score,
          questionCount: config.questions.length,
        }
    }

    if (validationType === "keyword") {
      const config = mission.keywordConfig!
      const attempts = z
        .number()
        .int()
        .nonnegative()
        .parse(attemptSnapshot.data()?.attempts ?? 0)
      if (attempts >= config.maxAttempts) {
        transaction.set(attemptRef, {
          ...attemptSnapshot.data(),
          outcome: "failed",
          closedAt: Timestamp.now(),
        })
        return {
          status: "attempts-exhausted",
          attemptsRemaining: 0,
          lastScore: attemptSnapshot.data()?.lastScore,
          questionCount: attemptSnapshot.data()?.questionCount,
        }
      }
      const correct = config.acceptedAnswers.some(
        (accepted) =>
          normalizeKeyword(accepted) === normalizeKeyword(answer ?? "")
      )
      transaction.set(attemptRef, {
        eventId: validatedEventId,
        participantId: validatedParticipantId,
        missionId: mission.id,
        attempts: attempts + 1,
        outcome: correct
          ? "completed"
          : attempts + 1 >= config.maxAttempts
            ? "failed"
            : "in-progress",
        closedAt:
          correct || attempts + 1 >= config.maxAttempts
            ? Timestamp.now()
            : null,
        updatedAt: Timestamp.now(),
      })
      if (!correct)
        return {
          status:
            attempts + 1 >= config.maxAttempts
              ? "attempts-exhausted"
              : "incorrect-answer",
          attemptsRemaining: config.maxAttempts - attempts - 1,
        }
    }

    const now = Timestamp.now()
    const xpAwarded = mission.xpAwarded ?? validatedDefaultXp
    const reviewerId = validationType === "reviewer" ? validatedBy! : null

    transaction.create(completionRef, {
      eventId: validatedEventId,
      participantId: validatedParticipantId,
      activityType: "mission",
      activityId: mission.id,
      qrId: mission.qrId,
      validationType,
      validatedBy: reviewerId,
      validatedAt: reviewerId ? now : null,
      xpAwarded,
      completedAt: now,
    })
    transaction.update(profileRef, {
      xp: profile.xp + xpAwarded,
      xpReachedAt: now,
      updatedAt: now,
    })
    incrementParticipantSummary(transaction, {
      eventId: validatedEventId,
      participantId: validatedParticipantId,
      counter: "missionsCompletedCount",
      amount: 1,
      now,
    })

    return {
      status: "completed",
      mission,
      completion: missionCompletionFieldsSchema.parse({
        id: completionId,
        eventId: validatedEventId,
        participantId: validatedParticipantId,
        activityType: "mission",
        activityId: mission.id,
        qrId: mission.qrId,
        validationType,
        validatedBy: reviewerId,
        validatedAt: reviewerId ? now.toDate() : null,
        xpAwarded,
        completedAt: now.toDate(),
      }),
    }
  })
}

export async function completeEligibleAutomaticMissions({
  eventId,
  participantId,
  missions,
  activeCompanyCount,
  activeTagCount = 0,
  defaultXpAwarded,
}: {
  eventId: string
  participantId: string
  missions: Mission[]
  activeCompanyCount: number
  activeTagCount?: number
  defaultXpAwarded: number
}): Promise<number> {
  const validatedEventId =
    completeQrMissionInputSchema.shape.eventId.parse(eventId)
  const validatedParticipantId =
    profileScoreSchema.shape.userId.parse(participantId)
  const validatedCompanyCount = z
    .number()
    .int()
    .nonnegative()
    .parse(activeCompanyCount)
  const validatedTagCount = z.number().int().nonnegative().parse(activeTagCount)
  const validatedDefaultXp = z.number().int().positive().parse(defaultXpAwarded)
  const automaticMissions = missions.filter(
    (mission) =>
      mission.eventId === validatedEventId &&
      mission.active &&
      mission.validationType === "automatic"
  )

  if (automaticMissions.length === 0) return 0

  const profileRef = firestore
    .collection(PROFILES_COLLECTION)
    .doc(validatedParticipantId)
  const summaryRef = getParticipantSummaryRef(
    validatedEventId,
    validatedParticipantId
  )
  const completionRefs = automaticMissions.map((mission) =>
    firestore
      .collection(COMPLETIONS_COLLECTION)
      .doc(
        getCompletionId(
          validatedEventId,
          validatedParticipantId,
          "mission",
          mission.id
        )
      )
  )

  return firestore.runTransaction(async (transaction) => {
    if (
      !(await readActivityAvailability(transaction, validatedEventId))
        .missionsEnabled
    )
      return 0

    const [profileSnapshot, summarySnapshot, ...completionSnapshots] =
      await Promise.all([
        transaction.get(profileRef),
        transaction.get(summaryRef),
        ...completionRefs.map((reference) => transaction.get(reference)),
      ])

    if (!profileSnapshot.exists || !summarySnapshot.exists) return 0

    const profile = profileScoreSchema.parse(profileSnapshot.data())
    const summary = automaticMissionSummarySchema.parse(summarySnapshot.data())

    if (
      profile.userId !== validatedParticipantId ||
      profile.eventId !== validatedEventId ||
      !profile.onboardingCompleted ||
      !profile.accessRoles.includes("participant") ||
      summary.eventId !== validatedEventId ||
      summary.participantId !== validatedParticipantId
    ) {
      return 0
    }

    const interestConnections = automaticMissions.some(
      (mission) => mission.progressRequirement?.type === "shared-interests"
    )
      ? await transaction.get(
          sharedInterestConnectionsQuery(validatedParticipantId)
        )
      : null
    const sharedInterestCount = interestConnections
      ? countSharedInterestConnections(
          validatedEventId,
          validatedParticipantId,
          interestConnections.docs.map((document) => document.data())
        )
      : 0

    const eligibleMissions = automaticMissions.filter((mission, index) => {
      if (completionSnapshots[index].exists || !mission.progressRequirement) {
        return false
      }

      const requirement = mission.progressRequirement
      const target =
        requirement.target === "all"
          ? requirement.type === "tags"
            ? validatedTagCount
            : validatedCompanyCount
          : requirement.target
      const current =
        requirement.type === "connections"
          ? summary.connectionsCount
          : requirement.type === "shared-interests"
            ? sharedInterestCount
            : requirement.type === "tags"
              ? summary.tagsDiscoveredCount
              : summary.companiesVisitedCount

      return target > 0 && current >= target
    })

    if (eligibleMissions.length === 0) return 0

    const now = Timestamp.now()
    const totalXp = eligibleMissions.reduce(
      (sum, mission) => sum + (mission.xpAwarded ?? validatedDefaultXp),
      0
    )

    for (const mission of eligibleMissions) {
      const completionId = getCompletionId(
        validatedEventId,
        validatedParticipantId,
        "mission",
        mission.id
      )
      transaction.create(
        firestore.collection(COMPLETIONS_COLLECTION).doc(completionId),
        {
          eventId: validatedEventId,
          participantId: validatedParticipantId,
          activityType: "mission",
          activityId: mission.id,
          qrId: null,
          validationType: "automatic",
          validatedBy: null,
          validatedAt: null,
          xpAwarded: mission.xpAwarded ?? validatedDefaultXp,
          completedAt: now,
        }
      )
    }

    transaction.update(profileRef, {
      xp: profile.xp + totalXp,
      xpReachedAt: now,
      updatedAt: now,
    })
    transaction.set(
      summaryRef,
      {
        eventId: validatedEventId,
        participantId: validatedParticipantId,
        missionsCompletedCount: FieldValue.increment(eligibleMissions.length),
        updatedAt: now,
      },
      { merge: true }
    )

    return eligibleMissions.length
  })
}

function sharedInterestConnectionsQuery(participantId: string) {
  return firestore
    .collection(getFirestoreCollectionName("connections"))
    .where("participantIds", "array-contains", participantId)
}

export async function findSharedInterestConnectionCount(
  eventId: string,
  participantId: string
): Promise<number> {
  const snapshots = await sharedInterestConnectionsQuery(participantId).get()
  return countSharedInterestConnections(
    eventId,
    participantId,
    snapshots.docs.map((document) => document.data())
  )
}

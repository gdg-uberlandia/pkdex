import "server-only"

import type { Session } from "next-auth"

import { SCORES } from "@/config/scores"
import { env } from "@/env"
import {
  findActiveCompanies,
  findCompanyById,
} from "@/modules/companies/company.repository"
import { findActivityAvailability } from "@/modules/event-activities/activity-availability.repository"
import { findOrInitializeParticipantSummary } from "@/modules/participant-summary/participant-summary.repository"
import {
  canReviewMission,
  hasPermission,
} from "@/modules/profile/profile.authorization"
import {
  getProfileByPublicQrId,
  requireProfileForSession,
} from "@/modules/profile/profile.service"
import { validateUserQrToken } from "@/modules/qr-code/user-qr-token"
import { findActiveTags } from "@/modules/tags/tag.repository"

import {
  completeEligibleAutomaticMissions,
  completeMission,
  findActiveMissions,
  findMissionAttemptsByParticipant,
  findMissionProgressByParticipant,
  findReviewableMissions,
  findSharedInterestConnectionCount,
} from "./mission.repository"
import {
  completeKeywordMissionInputSchema,
  completeQrMissionInputSchema,
  completeQuizMissionInputSchema,
  reviewMissionInputSchema,
} from "./mission.schema"
import { hasExhaustedMissionAttempts } from "./mission-attempts"
import { type PublicMissionQuiz, publicMissionQuiz } from "./mission-quiz"

export type MissionListItem = Readonly<{
  id: string
  title: string
  description: string
  imageUrl: string | null
  externalUrl?: string | null
  validationType: "qr" | "reviewer" | "automatic" | "keyword" | "quiz"
  status: "available" | "blocked" | "completed" | "failed"
  xpAwarded: number
  quiz?: PublicMissionQuiz
  networkingByInterest?: boolean
  attemptsUsed?: number
  lastScore?: number
  questionCount?: number
  keywordMaxAttempts?: number
  completedAt: Date | null
  blockedBy: ReadonlyArray<
    Readonly<{
      type: "company" | "mission" | "progress"
      label: string
    }>
  >
}>

export type MissionOperationResult =
  | Readonly<{
      success: true
      code: "MISSION_COMPLETED" | "MISSION_ALREADY_COMPLETED"
      missionTitle: string
      missionDescription: string
      missionImageUrl: string | null
      participantName?: string
      xpAwarded: number
    }>
  | Readonly<{
      success: false
      code:
        | "QUIZ_NOT_PASSED"
        | "INVALID_ANSWERS"
        | "QUIZ_CHANGED"
        | "INCORRECT_ANSWER"
        | "ATTEMPTS_EXHAUSTED"
        | "FORBIDDEN"
        | "INVALID_EVENT"
        | "INVALID_QR"
        | "MISSIONS_DISABLED"
        | "MISSION_INACTIVE"
        | "MISSION_NOT_FOUND"
        | "PREREQUISITE_MISSING"
        | "PROFILE_UNAVAILABLE"
        | "QR_EXPIRED"
        | "WRONG_VALIDATION_TYPE"
      attemptsRemaining?: number
      lastScore?: number
      questionCount?: number
    }>

export async function listMissionsForSession(
  session: Session
): Promise<MissionListItem[]> {
  const profile = await requireProfileForSession(session)

  if (!hasPermission(profile, "participate")) {
    return []
  }

  const [missions, companies, initialProgress, summary, availability] =
    await Promise.all([
      findActiveMissions(profile.eventId),
      findActiveCompanies(profile.eventId),
      findMissionProgressByParticipant(profile.eventId, profile.userId),
      findOrInitializeParticipantSummary(profile.eventId, profile.userId),
      findActivityAvailability(profile.eventId),
    ])
  const tags = missions.some(
    (mission) => mission.progressRequirement?.type === "tags"
  )
    ? await findActiveTags(profile.eventId)
    : []
  const attemptsByMission = await findMissionAttemptsByParticipant(
    profile.eventId,
    profile.userId,
    missions
      .filter(
        (mission) =>
          mission.validationType === "keyword" ||
          mission.validationType === "quiz"
      )
      .map((mission) => mission.id)
  )
  const sharedInterestCount = missions.some(
    (mission) => mission.progressRequirement?.type === "shared-interests"
  )
    ? await findSharedInterestConnectionCount(profile.eventId, profile.userId)
    : 0
  const completedMissionIds = new Set(
    initialProgress.completions.map((completion) => completion.activityId)
  )
  const eligibleAutomaticMissions = (
    availability.missionsEnabled ? missions : []
  ).filter((mission) => {
    if (
      mission.validationType !== "automatic" ||
      !mission.progressRequirement ||
      completedMissionIds.has(mission.id)
    ) {
      return false
    }

    const requirement = mission.progressRequirement
    const target =
      requirement.target === "all"
        ? requirement.type === "tags"
          ? tags.length
          : companies.length
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
  const automaticCompletions = await completeEligibleAutomaticMissions({
    eventId: profile.eventId,
    participantId: profile.userId,
    missions: eligibleAutomaticMissions,
    activeCompanyCount: companies.length,
    activeTagCount: tags.length,
    defaultXpAwarded: SCORES.MISSION_COMPLETION,
  })
  const progress =
    automaticCompletions > 0
      ? await findMissionProgressByParticipant(profile.eventId, profile.userId)
      : initialProgress
  const { completions, activityKeys } = progress
  const completionByMission = new Map(
    completions.map((completion) => [completion.activityId, completion])
  )
  const companyNames = new Map(
    companies.map((company) => [company.id, company.name])
  )
  const missionNames = new Map(
    missions.map((mission) => [mission.id, mission.title])
  )

  return missions.map((mission) => {
    const completion = completionByMission.get(mission.id)
    const blockedBy: Array<MissionListItem["blockedBy"][number]> =
      mission.prerequisites
        .filter(
          (prerequisite) =>
            !activityKeys.has(`${prerequisite.type}:${prerequisite.activityId}`)
        )
        .map((prerequisite) => ({
          type: prerequisite.type,
          label:
            prerequisite.type === "company"
              ? (companyNames.get(prerequisite.activityId) ??
                "Visita a uma empresa")
              : (missionNames.get(prerequisite.activityId) ??
                "Conclusão de outra missão"),
        }))
    if (!availability.missionsEnabled && !completion)
      blockedBy.push({
        type: "progress",
        label: "Missões temporariamente bloqueadas pela organização",
      })
    const progressRequirement = mission.progressRequirement

    if (progressRequirement && !completion) {
      const target =
        progressRequirement.target === "all"
          ? progressRequirement.type === "tags"
            ? tags.length
            : companies.length
          : progressRequirement.target
      const current =
        progressRequirement.type === "connections"
          ? summary.connectionsCount
          : progressRequirement.type === "shared-interests"
            ? sharedInterestCount
            : progressRequirement.type === "tags"
              ? summary.tagsDiscoveredCount
              : summary.companiesVisitedCount
      const activityLabel =
        progressRequirement.type === "connections"
          ? "conexões"
          : progressRequirement.type === "shared-interests"
            ? "conexões com interesses em comum"
            : progressRequirement.type === "tags"
              ? "tags"
              : "empresas"

      blockedBy.push({
        type: "progress",
        label: `${Math.min(current, target)} de ${target} ${activityLabel}`,
      })
    }

    const attempt = attemptsByMission.get(mission.id)
    const exhausted = hasExhaustedMissionAttempts(
      attempt,
      mission.quizConfig?.maxAttempts ?? mission.keywordConfig?.maxAttempts
    )
    return {
      attemptsUsed: attempt?.attempts ?? 0,
      ...(attempt?.lastScore !== undefined
        ? { lastScore: attempt.lastScore }
        : {}),
      ...(attempt?.questionCount !== undefined
        ? { questionCount: attempt.questionCount }
        : {}),
      id: mission.id,
      title: mission.title,
      description: mission.description,
      imageUrl: mission.imageUrl,
      externalUrl:
        mission.validationType === "reviewer"
          ? (mission.externalUrl ?? null)
          : null,
      validationType: mission.validationType,
      ...(mission.quizConfig
        ? {
            quiz: publicMissionQuiz(
              mission.quizConfig,
              mission.updatedAt.getTime()
            ),
          }
        : {}),
      ...(mission.progressRequirement?.type === "shared-interests"
        ? { networkingByInterest: true }
        : {}),
      ...(mission.keywordConfig
        ? { keywordMaxAttempts: mission.keywordConfig.maxAttempts }
        : {}),
      status: completion
        ? "completed"
        : exhausted
          ? "failed"
          : blockedBy.length === 0
            ? "available"
            : "blocked",
      xpAwarded:
        completion?.xpAwarded ??
        (exhausted ? 0 : (mission.xpAwarded ?? SCORES.MISSION_COMPLETION)),
      completedAt: completion?.completedAt ?? null,
      blockedBy,
    }
  })
}

export async function getMissionReviewContextForSession(session: Session) {
  const reviewer = await requireProfileForSession(session)
  if (
    !hasPermission(reviewer, "review-missions") &&
    !hasPermission(reviewer, "review-company-missions")
  )
    return null
  const sponsor = reviewer.accessRoles[0] === "sponsor"
  const company =
    sponsor && reviewer.sponsorCompanyId
      ? await findCompanyById(reviewer.eventId, reviewer.sponsorCompanyId)
      : null
  const availability = await findActivityAvailability(reviewer.eventId)
  const missions =
    !availability.missionsEnabled || (sponsor && !company)
      ? []
      : await findReviewableMissions(reviewer.eventId)
  return {
    sponsor,
    companyName: company?.name ?? null,
    missionsEnabled: availability.missionsEnabled,
    missions: missions
      .filter((mission) => canReviewMission(reviewer, mission))
      .map((mission) => ({
        id: mission.id,
        title: mission.title,
        description: mission.description,
        xpAwarded: mission.xpAwarded ?? SCORES.MISSION_COMPLETION,
      })),
  }
}

export async function listReviewableMissionsForSession(session: Session) {
  const context = await getMissionReviewContextForSession(session)
  return context?.missions ?? null
}

export async function completeQrMissionForSession(
  session: Session,
  input: unknown
): Promise<MissionOperationResult> {
  const target = completeQrMissionInputSchema.parse(input)
  const participant = await requireProfileForSession(session)

  if (
    target.eventId !== env.EVENT_ID ||
    participant.eventId !== target.eventId
  ) {
    return { success: false, code: "INVALID_EVENT" }
  }

  if (!hasPermission(participant, "participate")) {
    return { success: false, code: "FORBIDDEN" }
  }

  const result = await completeMission({
    eventId: target.eventId,
    qrId: target.qrId,
    participantId: participant.userId,
    validationType: "qr",
    defaultXpAwarded: SCORES.MISSION_COMPLETION,
  })

  return mapCompletionResult(result)
}

export async function reviewMissionForSession(
  session: Session,
  input: unknown
): Promise<MissionOperationResult> {
  const target = reviewMissionInputSchema.parse(input)
  const reviewer = await requireProfileForSession(session)

  if (target.eventId !== env.EVENT_ID || reviewer.eventId !== target.eventId) {
    return { success: false, code: "INVALID_EVENT" }
  }

  if (
    !hasPermission(reviewer, "review-missions") &&
    !hasPermission(reviewer, "review-company-missions")
  ) {
    return { success: false, code: "FORBIDDEN" }
  }

  const tokenResult = validateUserQrToken({
    token: target.token,
    eventId: target.eventId,
    qrId: target.participantQrId,
  })

  if (!tokenResult.valid) {
    return {
      success: false,
      code: tokenResult.code === "QR_EXPIRED" ? "QR_EXPIRED" : "INVALID_QR",
    }
  }

  const participant = await getProfileByPublicQrId(
    target.eventId,
    target.participantQrId
  )

  if (!participant?.onboardingCompleted) {
    return { success: false, code: "PROFILE_UNAVAILABLE" }
  }

  const result = await completeMission({
    eventId: target.eventId,
    missionId: target.missionId,
    participantId: participant.userId,
    validationType: "reviewer",
    validatedBy: reviewer.userId,
    defaultXpAwarded: SCORES.MISSION_COMPLETION,
  })

  const mapped = mapCompletionResult(result)

  return mapped.success
    ? { ...mapped, participantName: participant.displayName }
    : mapped
}

function mapCompletionResult(
  result: Awaited<ReturnType<typeof completeMission>>
): MissionOperationResult {
  switch (result.status) {
    case "quiz-not-passed":
      return {
        success: false,
        code: "QUIZ_NOT_PASSED",
        attemptsRemaining: result.attemptsRemaining,
        lastScore: result.lastScore,
        questionCount: result.questionCount,
      }
    case "invalid-answers":
      return { success: false, code: "INVALID_ANSWERS" }
    case "quiz-changed":
      return { success: false, code: "QUIZ_CHANGED" }
    case "incorrect-answer":
      return {
        success: false,
        code: "INCORRECT_ANSWER",
        attemptsRemaining: result.attemptsRemaining,
      }
    case "attempts-exhausted":
      return {
        success: false,
        code: "ATTEMPTS_EXHAUSTED",
        attemptsRemaining: 0,
        lastScore: result.lastScore,
        questionCount: result.questionCount,
      }
    case "completed":
      return {
        success: true,
        code: "MISSION_COMPLETED",
        missionTitle: result.mission.title,
        missionDescription: result.mission.description,
        missionImageUrl: result.mission.imageUrl,
        xpAwarded: result.completion.xpAwarded,
      }
    case "already-completed":
      return {
        success: true,
        code: "MISSION_ALREADY_COMPLETED",
        missionTitle: result.mission.title,
        missionDescription: result.mission.description,
        missionImageUrl: result.mission.imageUrl,
        xpAwarded: result.completion.xpAwarded,
      }
    case "disabled":
      return { success: false, code: "MISSIONS_DISABLED" }
    case "inactive":
      return { success: false, code: "MISSION_INACTIVE" }
    case "forbidden":
      return { success: false, code: "FORBIDDEN" }
    case "invalid-validation-type":
      return { success: false, code: "WRONG_VALIDATION_TYPE" }
    case "not-found":
      return { success: false, code: "MISSION_NOT_FOUND" }
    case "prerequisite-missing":
      return { success: false, code: "PREREQUISITE_MISSING" }
    case "profile-unavailable":
      return { success: false, code: "PROFILE_UNAVAILABLE" }
  }
}

export async function completeKeywordMissionForSession(
  session: Session,
  input: unknown
): Promise<MissionOperationResult> {
  const target = completeKeywordMissionInputSchema.parse(input)
  const participant = await requireProfileForSession(session)
  if (participant.eventId !== env.EVENT_ID)
    return { success: false, code: "INVALID_EVENT" }
  if (!hasPermission(participant, "participate"))
    return { success: false, code: "FORBIDDEN" }
  return mapCompletionResult(
    await completeMission({
      eventId: participant.eventId,
      participantId: participant.userId,
      missionId: target.missionId,
      answer: target.answer,
      validationType: "keyword",
      defaultXpAwarded: SCORES.MISSION_COMPLETION,
    })
  )
}

export async function completeQuizMissionForSession(
  session: Session,
  input: unknown
): Promise<MissionOperationResult> {
  const target = completeQuizMissionInputSchema.parse(input)
  const participant = await requireProfileForSession(session)
  if (participant.eventId !== env.EVENT_ID)
    return { success: false, code: "INVALID_EVENT" }
  if (!hasPermission(participant, "participate"))
    return { success: false, code: "FORBIDDEN" }
  return mapCompletionResult(
    await completeMission({
      eventId: participant.eventId,
      participantId: participant.userId,
      missionId: target.missionId,
      answers: target.answers,
      revision: target.revision,
      validationType: "quiz",
      defaultXpAwarded: SCORES.MISSION_COMPLETION,
    })
  )
}

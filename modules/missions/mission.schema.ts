import * as z from "zod"

import { missionQuizConfigSchema } from "./mission-quiz"

export const missionValidationTypeSchema = z.enum([
  "qr",
  "reviewer",
  "automatic",
  "keyword",
  "quiz",
])

export const missionProgressRequirementSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("shared-interests"),
      target: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("connections"),
      target: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("tags"),
      target: z.union([z.number().int().positive(), z.literal("all")]),
    })
    .strict(),
  z
    .object({
      type: z.literal("companies"),
      target: z.union([z.number().int().positive(), z.literal("all")]),
    })
    .strict(),
])

export const missionPrerequisiteSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("company"),
      activityId: z.string().trim().min(1).max(128),
    })
    .strict(),
  z
    .object({
      type: z.literal("mission"),
      activityId: z.string().trim().min(1).max(128),
    })
    .strict(),
])

export const missionFieldsSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    eventId: z.string().trim().min(1).max(128),
    companyId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[^/]+$/)
      .nullable()
      .default(null),
    qrId: z.string().uuid().nullable(),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().min(1).max(1_000),
    imageUrl: z.url().nullable(),
    externalUrl: z
      .url()
      .refine((value) => /^https?:\/\//i.test(value), {
        message: "Use an HTTP or HTTPS URL",
      })
      .nullable()
      .optional(),
    validationType: missionValidationTypeSchema,
    quizConfig: missionQuizConfigSchema.nullable().default(null),
    keywordConfig: z
      .object({
        acceptedAnswers: z
          .array(z.string().trim().min(1).max(120))
          .min(1)
          .max(20),
        maxAttempts: z.number().int().min(1).max(100),
      })
      .strict()
      .nullable()
      .default(null),
    progressRequirement: missionProgressRequirementSchema
      .nullable()
      .default(null),
    prerequisites: z.array(missionPrerequisiteSchema).max(20).default([]),
    active: z.boolean(),
    order: z.number().int().nonnegative(),
    xpAwarded: z.number().int().positive().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict()
  .superRefine((mission, context) => {
    if (mission.externalUrl && mission.validationType !== "reviewer")
      context.addIssue({
        code: "custom",
        path: ["externalUrl"],
        message: "Only reviewer missions may define an external link",
      })
    if ((mission.validationType === "quiz") !== Boolean(mission.quizConfig))
      context.addIssue({
        code: "custom",
        path: ["quizConfig"],
        message: "Only quiz missions must define quiz configuration",
      })
    if (mission.validationType === "quiz" && mission.qrId)
      context.addIssue({
        code: "custom",
        path: ["qrId"],
        message: "Quiz missions must not have a QR identifier",
      })
    if (
      (mission.validationType === "keyword") !==
      Boolean(mission.keywordConfig)
    ) {
      context.addIssue({
        code: "custom",
        path: ["keywordConfig"],
        message: "Only keyword missions must define keyword configuration",
      })
    }
    if (mission.validationType === "keyword" && mission.qrId) {
      context.addIssue({
        code: "custom",
        path: ["qrId"],
        message: "Keyword missions must not have a QR identifier",
      })
    }
    if (mission.validationType === "qr" && !mission.qrId) {
      context.addIssue({
        code: "custom",
        path: ["qrId"],
        message: "QR missions must have a public QR identifier",
      })
    }

    if (mission.validationType === "reviewer" && mission.qrId) {
      context.addIssue({
        code: "custom",
        path: ["qrId"],
        message: "Reviewer missions must not have a public QR identifier",
      })
    }

    if (mission.validationType === "automatic" && mission.qrId) {
      context.addIssue({
        code: "custom",
        path: ["qrId"],
        message: "Automatic missions must not have a public QR identifier",
      })
    }

    if (
      mission.validationType === "automatic" &&
      !mission.progressRequirement
    ) {
      context.addIssue({
        code: "custom",
        path: ["progressRequirement"],
        message: "Automatic missions must define a progress requirement",
      })
    }

    if (mission.validationType !== "automatic" && mission.progressRequirement) {
      context.addIssue({
        code: "custom",
        path: ["progressRequirement"],
        message: "Only automatic missions may define a progress requirement",
      })
    }

    if (
      mission.validationType === "automatic" &&
      mission.prerequisites.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["prerequisites"],
        message: "Automatic missions must use only their progress requirement",
      })
    }
  })

export const completeQrMissionInputSchema = z
  .object({
    eventId: z.string().trim().min(1).max(128),
    qrId: z.string().uuid(),
  })
  .strict()

export const reviewMissionInputSchema = z
  .object({
    missionId: z.string().trim().min(1).max(128),
    eventId: z.string().trim().min(1).max(128),
    participantQrId: z.string().uuid(),
    token: z.string().trim().min(1).max(2_048),
  })
  .strict()

export type Mission = z.infer<typeof missionFieldsSchema>
export type MissionPrerequisite = z.infer<typeof missionPrerequisiteSchema>

export const completeKeywordMissionInputSchema = z
  .object({
    missionId: z.string().trim().min(1).max(128),
    answer: z.string().trim().min(1).max(120),
  })
  .strict()

export const completeQuizMissionInputSchema = z
  .object({
    missionId: z.string().trim().min(1).max(128),
    revision: z.number().int().nonnegative(),
    answers: z
      .array(
        z
          .object({
            questionId: z.string().trim().min(1).max(128),
            optionIndex: z.number().int().min(0).max(2),
          })
          .strict()
      )
      .min(1)
      .max(10),
  })
  .strict()

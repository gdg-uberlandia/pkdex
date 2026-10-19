import * as z from "zod"

export const scheduleTrackSchema = z.enum([
  "MINAS",
  "CURADO",
  "CANASTRA",
  "TRANCA",
  "COMUNIDADE",
  "COMUNIDADE_2",
  "LOUNGE_SENIOR",
])

export const scheduleActivitySchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.enum(["talk", "opening_keynote", "closing_keynote"]),
      talkId: z.string().trim().min(1).max(128),
    })
    .strict(),
  z
    .object({
      type: z.enum(["opening", "break", "closing"]),
      title: z.string().trim().min(2).max(120),
    })
    .strict(),
])

export const scheduleFieldsSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    eventId: z.string().trim().min(1).max(128),
    startAt: z.date(),
    endAt: z.date(),
    track: scheduleTrackSchema.nullable(),
    order: z.number().int().min(0).max(6).nullable(),
    activity: scheduleActivitySchema,
    active: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict()
  .refine((schedule) => schedule.endAt > schedule.startAt, {
    path: ["endAt"],
    message: "Schedule end must be after its start",
  })
  .superRefine((schedule, context) => {
    if (schedule.activity.type === "talk" && !schedule.track) {
      context.addIssue({
        code: "custom",
        path: ["track"],
        message: "Palestras na programação precisam de uma trilha",
      })
    }
    if (schedule.activity.type !== "talk" && schedule.track) {
      context.addIssue({
        code: "custom",
        path: ["track"],
        message: "General schedule entries cannot have a track",
      })
    }
  })

export type ScheduleEntry = z.infer<typeof scheduleFieldsSchema>
export type ScheduleTrack = z.infer<typeof scheduleTrackSchema>

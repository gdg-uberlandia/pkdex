import * as z from "zod"

export const activityServiceSchema = z.enum(["tags", "missions"])
export const activityAvailabilitySchema = z.object({
  eventClosed: z.boolean().default(false),
  tagsEnabled: z.boolean().default(true),
  missionsEnabled: z.boolean().default(true),
})
export const activityAvailabilityInputSchema = z
  .object({
    service: activityServiceSchema,
    enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
  })
  .strict()
export type ActivityAvailability = z.infer<typeof activityAvailabilitySchema>
export type ActivityService = z.infer<typeof activityServiceSchema>

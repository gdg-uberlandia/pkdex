"use server"
import { revalidatePath } from "next/cache"

import { requireAuth } from "@/lib/require-auth"

import { activityAvailabilityInputSchema } from "./activity-availability.schema"
import { updateActivityAvailabilityForSession } from "./activity-availability.service"

export async function toggleActivityAvailabilityAction(formData: FormData) {
  const session = await requireAuth()
  const input = activityAvailabilityInputSchema.parse({
    service: formData.get("service"),
    enabled: formData.get("enabled"),
  })
  if (
    !(await updateActivityAvailabilityForSession(
      session,
      input.service,
      input.enabled
    ))
  )
    throw new Error("Operation is not authorized")
  for (const path of [
    "/profile",
    "/missions",
    "/tags",
    "/home",
    "/passport",
    "/operations",
  ])
    revalidatePath(path)
}

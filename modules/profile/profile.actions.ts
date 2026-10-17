"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ZodError } from "zod"

import { requireAuth } from "@/lib/require-auth"
import { getPostOnboardingDestination } from "@/modules/notices/push-config"

import type { ProfileUpdateInput } from "./profile.schema"
import {
  completeProfileForSession,
  updateProfileForSession,
} from "./profile.service"

type ProfileField = keyof ProfileUpdateInput
type ProfileFieldErrors = Partial<Record<ProfileField, string>>
const PROFILE_FIELDS = [
  "displayName",
  "gender",
  "bio",
  "role",
  "company",
  "linkedinUsername",
  "website",
  "skills",
  "interests",
] as const satisfies readonly ProfileField[]

export type UpdateProfileActionResult =
  | {
      success: true
    }
  | {
      success: false
      message: string
      fieldErrors?: ProfileFieldErrors
    }

function getFieldErrors(error: ZodError): ProfileFieldErrors {
  const fieldErrors: ProfileFieldErrors = {}

  for (const issue of error.issues) {
    const field = issue.path[0]
    const profileField = PROFILE_FIELDS.find((candidate) => candidate === field)

    if (profileField && !fieldErrors[profileField]) {
      fieldErrors[profileField] = issue.message
    }
  }

  return fieldErrors
}

export async function updateProfileAction(
  input: unknown
): Promise<UpdateProfileActionResult> {
  const session = await requireAuth()

  try {
    await updateProfileForSession(session, input)
    revalidatePath("/profile")

    return {
      success: true,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Revise os campos destacados.",
        fieldErrors: getFieldErrors(error),
      }
    }

    console.error("Failed to update authenticated profile", error)

    return {
      success: false,
      message: "Não foi possível salvar o perfil. Tente novamente.",
    }
  }
}

export async function completeProfileOnboardingAction(
  input: unknown
): Promise<UpdateProfileActionResult> {
  const session = await requireAuth()

  try {
    await completeProfileForSession(session, input)
    revalidatePath("/home")
    revalidatePath("/profile")
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        message: "Revise os campos destacados.",
        fieldErrors: getFieldErrors(error),
      }
    }

    console.error("Failed to complete authenticated profile onboarding", error)

    return {
      success: false,
      message: "Não foi possível concluir seu perfil. Tente novamente.",
    }
  }

  redirect(getPostOnboardingDestination())
}

import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getSafeCallbackPath } from "@/lib/get-safe-callback-path"
import { requireProfileForSession } from "@/modules/profile/profile.service"

type CompleteAuthenticationPageProps = Readonly<{
  searchParams: Promise<{
    callbackUrl?: string | string[]
  }>
}>

export default async function CompleteAuthenticationPage({
  searchParams,
}: CompleteAuthenticationPageProps) {
  const params = await searchParams
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : undefined
  const redirectTo = getSafeCallbackPath(callbackUrl)

  const session = await auth()

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(redirectTo)}`)
  }

  const profile = await requireProfileForSession(session)

  if (profile.accessRoles[0] === "sponsor") redirect("/missions")

  if (!profile.onboardingCompleted) {
    redirect("/onboarding")
  }

  redirect(redirectTo)
}

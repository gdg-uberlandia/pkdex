import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { AppShell } from "@/components/layout/app-shell"
import { requireAuth } from "@/lib/require-auth"
import { requireProfileForSession } from "@/modules/profile/profile.service"

type OnboardingLayoutProps = Readonly<{
  children: ReactNode
}>

export default async function OnboardingLayout({
  children,
}: OnboardingLayoutProps) {
  const profile = await requireProfileForSession(await requireAuth())
  if (profile.accessRoles[0] === "sponsor") redirect("/missions")
  return <AppShell theme="dark">{children}</AppShell>
}

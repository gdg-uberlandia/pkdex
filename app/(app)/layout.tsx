import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell"
import { requireAuth } from "@/lib/require-auth"
import { findActivityAvailability } from "@/modules/event-activities/activity-availability.repository"
import { requireProfileForSession } from "@/modules/profile/profile.service"

type AuthenticatedLayoutProps = Readonly<{
  children: ReactNode
  modal: ReactNode
}>

export default async function AuthenticatedLayout({
  children,
  modal,
}: AuthenticatedLayoutProps) {
  const session = await requireAuth()
  const profile = await requireProfileForSession(session)

  if (!profile.onboardingCompleted && profile.accessRoles[0] !== "sponsor") {
    redirect("/onboarding")
  }

  const availability = await findActivityAvailability(profile.eventId)

  return (
    <AuthenticatedAppShell accessRoles={profile.accessRoles}>
      {availability.eventClosed && (
        <p role="status" className="rounded-lg border p-4 text-sm">
          Evento encerrado. Novas missões, tags, avaliações e conexões estão
          bloqueadas. Seu histórico permanece disponível.
        </p>
      )}
      {children}
      {modal}
    </AuthenticatedAppShell>
  )
}

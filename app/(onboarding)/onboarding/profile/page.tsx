import type { Metadata } from "next"

import { AppHeader } from "@/components/layout/app-header"
import { requireAuth } from "@/lib/require-auth"
import { signOutCurrentUser } from "@/modules/auth/auth.actions"
import { getPostOnboardingDestination } from "@/modules/notices/push-config"
import { completeProfileOnboardingAction } from "@/modules/profile/profile.actions"
import { requireProfileForSession } from "@/modules/profile/profile.service"
import { ProfileForm } from "@/modules/profile/profile-form"

export const metadata: Metadata = {
  title: "Configure seu perfil",
}

export default async function OnboardingProfilePage() {
  const session = await requireAuth()
  const profile = await requireProfileForSession(session)

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title="Configure seu perfil" showBack backHref="/onboarding" />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-6 space-y-2">
          <h1 className="text-xl font-semibold">Conte um pouco sobre você</h1>
          <p className="text-sm text-muted-foreground">
            Informe seu nome, gênero e selecione suas áreas de interesse. Os
            demais campos são opcionais.
          </p>
        </div>

        <ProfileForm
          defaultValues={{
            displayName: profile.displayName,
            gender: profile.gender ?? "",
            bio: profile.bio ?? "",
            role: profile.role ?? "",
            company: profile.company ?? "",
            linkedinUsername: profile.linkedinUsername ?? "",
            website: profile.website ?? "",
            skills: [],
            interests: [...(profile.interests ?? [])],
          }}
          submitAction={completeProfileOnboardingAction}
          successRedirect={getPostOnboardingDestination()}
          cancelAction={signOutCurrentUser}
        />
      </div>
    </div>
  )
}

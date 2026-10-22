import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { requireAuth } from "@/lib/require-auth"
import { signOutCurrentUser } from "@/modules/auth/auth.actions"
import { findCompanyById } from "@/modules/companies/company.repository"
import { requireProfileForSession } from "@/modules/profile/profile.service"

export default async function SponsorAccountPage() {
  const profile = await requireProfileForSession(await requireAuth())
  if (profile.accessRoles[0] !== "sponsor") redirect("/profile")
  const company = profile.sponsorCompanyId
    ? await findCompanyById(profile.eventId, profile.sponsorCompanyId)
    : null
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Sua conta</h1>
      <p>{profile.displayName}</p>
      <p className="text-sm text-muted-foreground">{profile.email}</p>
      <p>Empresa: {company?.name ?? "Empresa indisponível"}</p>
      <p className="text-sm text-muted-foreground">
        Seu acesso permite confirmar somente as missões presenciais da sua
        empresa. Para ajustar o vínculo, procure a organização.
      </p>
      <form action={signOutCurrentUser}>
        <Button variant="outline" type="submit">
          Sair
        </Button>
      </form>
    </div>
  )
}

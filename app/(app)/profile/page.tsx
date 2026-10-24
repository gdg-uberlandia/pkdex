import {
  ChevronRight,
  ExternalLink,
  Pencil,
  QrCode,
  UsersRound,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { ThemePreferences } from "@/components/theme/theme-preferences"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/require-auth"
import { cn } from "@/lib/utils"
import { signOutCurrentUser } from "@/modules/auth/auth.actions"
import { findActivityAvailability } from "@/modules/event-activities/activity-availability.repository"
import { ActivityAvailabilityControls } from "@/modules/event-activities/activity-availability-controls"
import { PushPreferences } from "@/modules/notices/push-preferences"
import { hasPermission } from "@/modules/profile/profile.authorization"
import { getLinkedinProfileUrl } from "@/modules/profile/profile.schema"
import { requireProfileForSession } from "@/modules/profile/profile.service"
import { ProfileHelp } from "@/modules/profile/profile-help"
import { INTERESTS } from "@/modules/profile/profile-interests"

export const metadata: Metadata = {
  title: "Perfil",
}

function getInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

export default async function ProfilePage() {
  const session = await requireAuth()
  const profile = await requireProfileForSession(session)
  const availability = hasPermission(profile, "manage-event-operations")
    ? await findActivityAvailability(profile.eventId)
    : null

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Mostre quem você é e encontre pessoas com interesses em comum.
        </p>
      </section>

      <section className="flex items-center gap-4 rounded-3xl bg-(image:--gradient-immersive) p-5 text-white shadow-card">
        <Avatar className="size-20 shrink-0 ring-2 ring-white/20">
          {profile.avatarUrl && (
            <AvatarImage
              src={profile.avatarUrl}
              alt={`Foto de ${profile.displayName}`}
            />
          )}

          <AvatarFallback>{getInitials(profile.displayName)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">
            {profile.displayName}
          </h2>

          <p className="mt-1 truncate text-sm text-white/70">
            {[profile.role, profile.company].filter(Boolean).join(" · ") ||
              "Complete suas informações"}
          </p>
        </div>

        <Link
          href="/profile/edit"
          className={cn(
            buttonVariants({ variant: "secondary", size: "icon" }),
            "shrink-0"
          )}
          aria-label="Editar perfil"
        >
          <Pencil aria-hidden="true" />
        </Link>
      </section>

      {profile.bio && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Sobre</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {profile.bio}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Áreas de interesse</CardTitle>
        </CardHeader>
        <CardContent>
          {(profile.interests ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(profile.interests ?? []).map((skill) => (
                <Badge
                  variant="secondary"
                  className="h-8 gap-1.5 border border-primary bg-transparent px-3 py-1 text-sm text-foreground"
                  key={skill}
                >
                  {INTERESTS.find(({ id }) => id === skill)?.label ?? skill}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Adicione áreas de interesse para facilitar novas conexões.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ações do perfil</h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          <ProfileAction
            href="/profile/qr-code"
            icon={<QrCode aria-hidden="true" />}
            title="Mostrar meu QR Code"
            description="Permita que outro participante se conecte com você."
          />
          <ProfileAction
            href="/connections"
            icon={<UsersRound aria-hidden="true" />}
            title="Minhas conexões"
            description="Veja as pessoas que você conheceu no evento."
          />
          {profile.linkedinUsername && (
            <ProfileAction
              href={getLinkedinProfileUrl(profile.linkedinUsername)}
              icon={<ExternalLink aria-hidden="true" />}
              title="Abrir LinkedIn"
              description="Acesse o perfil profissional no LinkedIn."
              external
            />
          )}
          {profile.website && (
            <ProfileAction
              href={profile.website}
              icon={<ExternalLink aria-hidden="true" />}
              title="Abrir website"
              description="Acesse o website informado no perfil."
              external
            />
          )}
        </div>
      </section>

      <ThemePreferences />
      {availability && (
        <ActivityAvailabilityControls availability={availability} />
      )}
      <PushPreferences />
      <ProfileHelp />

      <form action={signOutCurrentUser}>
        <SignOutButton className="w-full" />
      </form>
    </div>
  )
}

function ProfileAction({
  href,
  icon,
  title,
  description,
  external = false,
}: Readonly<{
  href: string
  icon: ReactNode
  title: string
  description: string
  external?: boolean
}>) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary [&>svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </>
  )

  return external ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-18 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      {content}
    </a>
  ) : (
    <Link
      href={href}
      className="flex min-h-18 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      {content}
    </Link>
  )
}

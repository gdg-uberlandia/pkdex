import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { isSponsorRoute } from "@/modules/profile/profile.authorization"
import { getProfileForSession } from "@/modules/profile/profile.service"

export async function requireAuth() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const pathname = (await headers()).get("x-pokedex-pathname")
  const profile = await getProfileForSession(session)
  if (
    profile?.accessRoles[0] === "sponsor" &&
    (!pathname || !isSponsorRoute(pathname))
  ) {
    redirect("/missions")
  }

  return session
}

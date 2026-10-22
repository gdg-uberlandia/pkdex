import type { AccessRole } from "./profile.schema"
import type { Profile } from "./profile.types"

export type AppPermission =
  | "participate"
  | "review-missions"
  | "review-company-missions"
  | "edit-content"
  | "access-staff"
  | "serve-participants"
  | "view-raffle-display"
  | "manage-event-operations"

const PERMISSIONS_BY_ROLE: Record<AccessRole, readonly AppPermission[]> = {
  participant: ["participate"],
  staff: ["access-staff"],
  sponsor: ["review-company-missions"],
  reviewer: [
    "access-staff",
    "review-missions",
    "serve-participants",
    "view-raffle-display",
  ],
  editor: ["access-staff", "edit-content"],
  admin: [
    "access-staff",
    "review-missions",
    "edit-content",
    "serve-participants",
    "view-raffle-display",
    "manage-event-operations",
  ],
}

export function hasAccessRole(
  profile: Pick<Profile, "accessRoles">,
  role: AccessRole
) {
  return profile.accessRoles.includes(role)
}

export function hasPermission(
  profile: Pick<Profile, "accessRoles">,
  permission: AppPermission
) {
  return profile.accessRoles.some((role) =>
    PERMISSIONS_BY_ROLE[role].includes(permission)
  )
}

/** Resource-level authorization; company availability is checked by the caller. */
export function canReviewMission(
  profile: Pick<Profile, "accessRoles" | "sponsorCompanyId" | "eventId">,
  mission: {
    eventId: string
    companyId: string | null
    active: boolean
    validationType: string
  }
) {
  if (
    profile.eventId !== mission.eventId ||
    !mission.active ||
    mission.validationType !== "reviewer"
  )
    return false
  if (hasPermission(profile, "review-missions")) return true
  return (
    hasPermission(profile, "review-company-missions") &&
    Boolean(profile.sponsorCompanyId) &&
    profile.sponsorCompanyId === mission.companyId
  )
}

export function isSponsorRoute(pathname: string) {
  return (
    pathname === "/missions" ||
    pathname.startsWith("/missions/review/") ||
    pathname === "/sponsor/account"
  )
}

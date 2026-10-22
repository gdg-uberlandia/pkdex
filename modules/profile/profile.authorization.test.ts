import { describe, expect, it } from "vitest"

import {
  canReviewMission,
  hasPermission,
  isSponsorRoute,
} from "./profile.authorization"

describe("profile authorization", () => {
  it("allows reviewers and admins to validate missions", () => {
    expect(
      hasPermission({ accessRoles: ["reviewer"] }, "review-missions")
    ).toBe(true)
    expect(hasPermission({ accessRoles: ["admin"] }, "review-missions")).toBe(
      true
    )
  })

  it("does not allow participants or generic staff to validate missions", () => {
    expect(
      hasPermission({ accessRoles: ["participant"] }, "review-missions")
    ).toBe(false)
    expect(hasPermission({ accessRoles: ["staff"] }, "review-missions")).toBe(
      false
    )
  })

  it("separates participant service from operation management", () => {
    expect(
      hasPermission({ accessRoles: ["reviewer"] }, "serve-participants")
    ).toBe(true)
    expect(
      hasPermission({ accessRoles: ["reviewer"] }, "manage-event-operations")
    ).toBe(false)
    expect(
      hasPermission({ accessRoles: ["admin"] }, "manage-event-operations")
    ).toBe(true)
  })

  it("allows reviewers to view the raffle display without managing raffles", () => {
    expect(
      hasPermission({ accessRoles: ["reviewer"] }, "view-raffle-display")
    ).toBe(true)
    expect(
      hasPermission({ accessRoles: ["reviewer"] }, "manage-event-operations")
    ).toBe(false)
    expect(
      hasPermission({ accessRoles: ["admin"] }, "view-raffle-display")
    ).toBe(true)
  })
})

describe("sponsor authorization", () => {
  const sponsor = {
    accessRoles: ["sponsor"] as const,
    sponsorCompanyId: "company-a",
    eventId: "event",
  }
  const profile = { ...sponsor, accessRoles: [...sponsor.accessRoles] }
  const mission = {
    eventId: "event",
    companyId: "company-a",
    active: true,
    validationType: "reviewer",
  }
  it("grants only scoped mission review", () => {
    expect(hasPermission(profile, "review-company-missions")).toBe(true)
    for (const permission of [
      "participate",
      "review-missions",
      "serve-participants",
      "manage-event-operations",
      "view-raffle-display",
      "edit-content",
      "access-staff",
    ] as const)
      expect(hasPermission(profile, permission)).toBe(false)
    expect(canReviewMission(profile, mission)).toBe(true)
  })
  it("rejects other companies, unowned missions, other events and validation formats", () => {
    for (const override of [
      { companyId: "company-b" },
      { companyId: null },
      { eventId: "other" },
      { active: false },
      { validationType: "qr" },
    ])
      expect(canReviewMission(profile, { ...mission, ...override })).toBe(false)
    expect(
      canReviewMission({ ...profile, sponsorCompanyId: null }, mission)
    ).toBe(false)
  })
  it("keeps global review for admins and reviewers", () => {
    for (const role of ["admin", "reviewer"] as const)
      expect(
        canReviewMission(
          { ...profile, accessRoles: [role], sponsorCompanyId: null },
          { ...mission, companyId: null }
        )
      ).toBe(true)
  })
  it("restricts sponsor navigation to review and account routes", () => {
    for (const path of [
      "/missions",
      "/missions/review/mission-a",
      "/sponsor/account",
    ])
      expect(isSponsorRoute(path)).toBe(true)
    for (const path of [
      "/home",
      "/profile",
      "/scan",
      "/tickets",
      "/operations",
      "/ranking",
      "/passport",
      "/missions-other",
      "/missions/reviewer",
    ])
      expect(isSponsorRoute(path)).toBe(false)
  })
})

import type { Session } from "next-auth"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  company: vi.fn(),
  missions: vi.fn(),
  complete: vi.fn(),
  participant: vi.fn(),
  token: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/env", () => ({ env: { EVENT_ID: "event" } }))
vi.mock("@/modules/profile/profile.service", () => ({
  requireProfileForSession: mocks.profile,
  getProfileByPublicQrId: mocks.participant,
}))
vi.mock("@/modules/companies/company.repository", () => ({
  findActiveCompanies: vi.fn(),
  findCompanyById: mocks.company,
}))
vi.mock("@/modules/tags/tag.repository", () => ({ findActiveTags: vi.fn() }))
vi.mock("@/modules/participant-summary/participant-summary.repository", () => ({
  findOrInitializeParticipantSummary: vi.fn(),
}))
vi.mock("@/modules/qr-code/user-qr-token", () => ({
  validateUserQrToken: mocks.token,
}))
vi.mock("./mission.repository", () => ({
  findActiveMissions: vi.fn(),
  findReviewableMissions: mocks.missions,
  completeMission: mocks.complete,
  completeEligibleAutomaticMissions: vi.fn(),
  findMissionAttemptsByParticipant: vi.fn(),
  findMissionProgressByParticipant: vi.fn(),
  findSharedInterestConnectionCount: vi.fn(),
}))
import {
  getMissionReviewContextForSession,
  listReviewableMissionsForSession,
  reviewMissionForSession,
} from "./mission.service"
const session = {} as Session
const mission = {
  id: "activation",
  eventId: "event",
  companyId: "company-a",
  active: true,
  validationType: "reviewer",
  title: "Ativação",
  description: "Experimente",
  xpAwarded: 50,
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.profile.mockResolvedValue({
    userId: "employee",
    eventId: "event",
    accessRoles: ["sponsor"],
    sponsorCompanyId: "company-a",
  })
  mocks.company.mockResolvedValue({ id: "company-a", name: "Empresa A" })
  mocks.missions.mockResolvedValue([
    mission,
    { ...mission, id: "other", companyId: "company-b" },
    { ...mission, id: "organization", companyId: null },
    { ...mission, id: "qr", validationType: "qr" },
  ])
  mocks.token.mockReturnValue({ valid: true })
  mocks.participant.mockResolvedValue({
    userId: "participant",
    onboardingCompleted: true,
    displayName: "Pessoa",
  })
  mocks.complete.mockResolvedValue({ status: "forbidden" })
})
describe("sponsor review service", () => {
  it("lists only the company's onsite missions", async () => {
    expect(
      (await listReviewableMissionsForSession(session))?.map((item) => item.id)
    ).toEqual(["activation"])
  })
  it("lists no missions when the company is unavailable", async () => {
    mocks.company.mockResolvedValue(null)
    expect(await listReviewableMissionsForSession(session)).toEqual([])
  })
  it("loads company and missions once for the review screen", async () => {
    const context = await getMissionReviewContextForSession(session)
    expect(context).toMatchObject({ sponsor: true, companyName: "Empresa A" })
    expect(mocks.profile).toHaveBeenCalledTimes(1)
    expect(mocks.company).toHaveBeenCalledWith("event", "company-a")
    expect(mocks.missions).toHaveBeenCalledTimes(1)
  })
  it("does not load missions for a missing company or missing assignment", async () => {
    mocks.company.mockResolvedValue(null)
    expect(await listReviewableMissionsForSession(session)).toEqual([])
    expect(mocks.missions).not.toHaveBeenCalled()
    mocks.profile.mockResolvedValue({
      userId: "employee",
      eventId: "event",
      accessRoles: ["sponsor"],
      sponsorCompanyId: null,
    })
    expect(await listReviewableMissionsForSession(session)).toEqual([])
    expect(mocks.missions).not.toHaveBeenCalled()
  })
  it("retains organization missions for global reviewers", async () => {
    mocks.profile.mockResolvedValue({
      userId: "reviewer",
      eventId: "event",
      accessRoles: ["reviewer"],
      sponsorCompanyId: null,
    })
    expect(
      (await listReviewableMissionsForSession(session))?.map((item) => item.id)
    ).toEqual(["activation", "other", "organization"])
  })
  it("binds the operator to the session and returns transaction authorization failures", async () => {
    const result = await reviewMissionForSession(session, {
      missionId: "other",
      eventId: "event",
      participantQrId: "c35d5cf6-a3f4-4ae0-9e6f-0bad73cdded6",
      token: "token",
    })
    expect(mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        validatedBy: "employee",
        missionId: "other",
        participantId: "participant",
      })
    )
    expect(result).toEqual({ success: false, code: "FORBIDDEN" })
  })
})

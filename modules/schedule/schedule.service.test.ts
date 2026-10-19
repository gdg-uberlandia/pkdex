import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  published: vi.fn(),
  schedule: vi.fn(),
  talks: vi.fn(),
  speakers: vi.fn(),
}))
vi.mock("@/modules/profile/profile.service", () => ({
  requireProfileForSession: mocks.profile,
}))
vi.mock("./schedule.repository", () => ({
  isSchedulePublished: mocks.published,
  findActiveSchedule: mocks.schedule,
}))
vi.mock("@/modules/talks/talk.repository", () => ({
  findActiveTalks: mocks.talks,
  findVisibleSpeakers: mocks.speakers,
}))
import { listScheduleForSession } from "./schedule.service"

const session = { user: { id: "user" }, expires: "2099-01-01" }
const entry = (
  id: string,
  track: string | null,
  activity: object,
  start = "09:00"
) => ({
  id,
  eventId: "event",
  startAt: new Date(`2026-10-19T${start}:00-03:00`),
  endAt: new Date("2026-10-19T10:00:00-03:00"),
  track,
  activity,
  active: true,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.profile.mockResolvedValue({ eventId: "event" })
  mocks.published.mockResolvedValue(true)
  mocks.talks.mockResolvedValue([
    {
      id: "talk",
      title: "Título",
      description: "Descrição",
      speakerIds: ["speaker", "hidden"],
    },
  ])
  mocks.speakers.mockResolvedValue([{ id: "speaker", name: "Pessoa" }])
})

describe("informative schedule", () => {
  it("does not expose draft entries or load their content", async () => {
    mocks.published.mockResolvedValue(false)
    expect(await listScheduleForSession(session)).toEqual([])
    expect(mocks.schedule).not.toHaveBeenCalled()
    expect(mocks.talks).not.toHaveBeenCalled()
  })
  it("includes general activities, keynotes and all tracks in chronological track order", async () => {
    mocks.schedule.mockResolvedValue([
      entry("lounge", "LOUNGE_SENIOR", { type: "talk", talkId: "talk" }),
      entry("break", null, { type: "break", title: "Coffee break" }, "08:00"),
      entry("arena2", "COMUNIDADE_2", { type: "talk", talkId: "talk" }),
      entry("minas", "MINAS", { type: "talk", talkId: "talk" }),
      entry(
        "keynote",
        null,
        { type: "opening_keynote", talkId: "talk" },
        "07:00"
      ),
    ])
    const result = await listScheduleForSession(session)
    expect(result.map((item) => item.id)).toEqual([
      "keynote",
      "break",
      "minas",
      "arena2",
      "lounge",
    ])
    expect(result[0]).toMatchObject({
      title: "Título",
      description: "Descrição",
      speakerNames: ["Pessoa"],
    })
    expect(result[1]).toMatchObject({
      title: "Coffee break",
      description: null,
      speakerNames: [],
    })
    expect(mocks.schedule).toHaveBeenCalledWith("event")
  })
  it("keeps the time and location when a linked talk is unavailable", async () => {
    mocks.schedule.mockResolvedValue([
      entry("missing", "CURADO", { type: "talk", talkId: "missing" }),
    ])
    expect((await listScheduleForSession(session))[0]).toMatchObject({
      title: "Palestra indisponível",
      track: "CURADO",
      speakerNames: [],
    })
  })
})

import { describe, expect, it } from "vitest"

import { speakerFieldsSchema } from "./speaker.schema"
import { normalizeStoredTalkFormat, talkFieldsSchema } from "./talk.schema"

const NOW = new Date("2026-07-30T12:00:00.000Z")

describe("talk schemas", () => {
  it.each(["opening_keynote", "closing_keynote"])(
    "normalizes the transitional %s value to keynote",
    (format) => {
      expect(normalizeStoredTalkFormat(format)).toBe("keynote")
    }
  )
  it("keeps speaker identity separate from talk content", () => {
    const speaker = speakerFieldsSchema.parse({
      id: "speaker-a",
      eventId: "devfest-2026",
      name: "Ada Lovelace",
      company: "Analytical Engines",
      title: "Software Engineer",
      miniBio: "Pioneer in computer programming.",
      photoUrl: "https://example.com/ada.png",
      socialMedia: {
        instagram: null,
        linkedIn: "https://www.linkedin.com/in/ada",
      },
      isVisible: true,
      createdAt: NOW,
      updatedAt: NOW,
    })

    expect(speaker).not.toHaveProperty("talkIds")
    expect(speaker).not.toHaveProperty("evaluationStatus")
  })

  it.each(["panel", "workshop"] as const)(
    "accepts %s with multiple speakers and manual evaluation state",
    (format) => {
      const talk = talkFieldsSchema.parse({
        id: "panel-a",
        eventId: "devfest-2026",
        title: "The future of software",
        description: "A conversation about the next generation of software.",
        category: "Community",
        format,
        speakerIds: ["speaker-a", "speaker-b", "speaker-c"],
        evaluationStatus: "locked",
        isActive: true,
        createdAt: NOW,
        updatedAt: NOW,
      })

      expect(talk).toMatchObject({
        format,
        evaluationStatus: "locked",
      })
    }
  )

  it("rejects duplicated speakers in the same talk", () => {
    const result = talkFieldsSchema.safeParse({
      id: "talk-a",
      eventId: "devfest-2026",
      title: "Reliable systems",
      description: "How to design reliable systems.",
      category: null,
      format: "talk",
      speakerIds: ["speaker-a", "speaker-a"],
      evaluationStatus: "open",
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    })

    expect(result.success).toBe(false)
  })

  it("rejects automatic evaluation timestamps", () => {
    const result = talkFieldsSchema.safeParse({
      id: "talk-a",
      eventId: "devfest-2026",
      title: "Reliable systems",
      description: "How to design reliable systems.",
      category: null,
      format: "talk",
      speakerIds: ["speaker-a"],
      evaluationStatus: "locked",
      evaluationStartTime: NOW,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    })

    expect(result.success).toBe(false)
  })
})

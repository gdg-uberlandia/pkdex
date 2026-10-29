import { describe, expect, it } from "vitest"

import { missionFieldsSchema } from "./mission.schema"

const baseMission = {
  id: "mission-1",
  eventId: "event-1",
  title: "Complete o desafio",
  description: "Apresente o resultado para a organização.",
  imageUrl: null,
  prerequisites: [],
  active: true,
  order: 1,
  xpAwarded: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("mission schema", () => {
  it("accepts a fixed QR mission", () => {
    expect(
      missionFieldsSchema.safeParse({
        ...baseMission,
        validationType: "qr",
        qrId: "c35d5cf6-a3f4-4ae0-9e6f-0bad73cdded6",
      }).success
    ).toBe(true)
  })

  it("accepts a reviewer mission without its own QR code", () => {
    expect(
      missionFieldsSchema.safeParse({
        ...baseMission,
        validationType: "reviewer",
        qrId: null,
      }).success
    ).toBe(true)
  })

  it("accepts an automatic progress mission without a QR code", () => {
    const result = missionFieldsSchema.safeParse({
      ...baseMission,
      validationType: "automatic",
      progressRequirement: { type: "connections", target: 10 },
      qrId: null,
    })

    expect(result.success).toBe(true)
  })

  it("requires a progress target for automatic missions", () => {
    expect(
      missionFieldsSchema.safeParse({
        ...baseMission,
        validationType: "automatic",
        qrId: null,
      }).success
    ).toBe(false)
  })

  it("rejects inconsistent validation configuration", () => {
    expect(
      missionFieldsSchema.safeParse({
        ...baseMission,
        validationType: "reviewer",
        qrId: "c35d5cf6-a3f4-4ae0-9e6f-0bad73cdded6",
      }).success
    ).toBe(false)
  })
})

it.each(["companies", "tags"] as const)("accepts all %s", (type) => {
  expect(
    missionFieldsSchema.safeParse({
      ...baseMission,
      qrId: null,
      validationType: "automatic",
      progressRequirement: { type, target: "all" },
    }).success
  ).toBe(true)
})

describe("reviewer activity links", () => {
  const reviewer = { ...baseMission, validationType: "reviewer", qrId: null }

  it("keeps legacy missions valid and preserves optional links", () => {
    expect(missionFieldsSchema.parse(reviewer).externalUrl).toBeUndefined()
    expect(
      missionFieldsSchema.parse({ ...reviewer, externalUrl: null }).externalUrl
    ).toBeNull()
    expect(
      missionFieldsSchema.parse({
        ...reviewer,
        externalUrl: "https://example.com/activity",
      }).externalUrl
    ).toBe("https://example.com/activity")
  })

  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "ftp://example.com/file",
    "invalid",
  ])("rejects unsafe or invalid links: %s", (externalUrl) => {
    expect(
      missionFieldsSchema.safeParse({ ...reviewer, externalUrl }).success
    ).toBe(false)
  })

  it("accepts legacy links on other mission types", () => {
    expect(
      missionFieldsSchema.safeParse({
        ...reviewer,
        validationType: "qr",
        qrId: "c35d5cf6-a3f4-4ae0-9e6f-0bad73cdded6",
        externalUrl: "https://example.com/activity",
      }).success
    ).toBe(true)
  })
})

describe("additional mission links", () => {
  const links = [1, 2, 3].map((n) => ({
    label: `Botão ${n}`,
    url: `https://example.com/${n}`,
  }))
  const configs = [
    { validationType: "reviewer", qrId: null },
    { validationType: "qr", qrId: "c35d5cf6-a3f4-4ae0-9e6f-0bad73cdded6" },
    {
      validationType: "automatic",
      qrId: null,
      progressRequirement: { type: "connections", target: 2 },
    },
    {
      validationType: "keyword",
      qrId: null,
      keywordConfig: { acceptedAnswers: ["answer"], maxAttempts: 3 },
    },
    {
      validationType: "quiz",
      qrId: null,
      quizConfig: {
        questions: [
          {
            id: "q1",
            prompt: "Question",
            options: ["A", "B"],
            correctOptionIndex: 0,
          },
        ],
        minCorrectAnswers: 1,
        maxAttempts: 3,
      },
    },
  ]
  it.each(configs)(
    "preserves three labeled links for $validationType missions",
    (config) => {
      expect(
        missionFieldsSchema.parse({
          ...baseMission,
          ...config,
          externalLinks: links,
        }).externalLinks
      ).toEqual(links)
    }
  )
  it.each(
    [
      [...links, links[0]],
      [{ label: "", url: "https://example.com" }],
      [{ label: "Label", url: "javascript:alert(1)" }],
      [{ label: "Label", url: "" }],
    ].map((externalLinks) => ({ externalLinks }))
  )("rejects invalid or excessive links", ({ externalLinks }) => {
    expect(
      missionFieldsSchema.safeParse({
        ...baseMission,
        ...configs[0],
        externalLinks,
      }).success
    ).toBe(false)
  })
})

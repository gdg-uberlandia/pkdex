import { createElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const dialog = vi.hoisted(() => ({ open: false }))
vi.mock("@/components/ui/dialog", () => {
  const wrapper = ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children)
  return {
    Dialog: wrapper,
    DialogContent: ({ children }: { children?: ReactNode }) =>
      dialog.open ? createElement("div", null, children) : null,
    DialogTrigger: ({ render }: { render: ReactElement }) => render,
    DialogClose: wrapper,
    DialogDescription: wrapper,
    DialogFooter: wrapper,
    DialogHeader: wrapper,
    DialogTitle: wrapper,
  }
})

vi.mock("./mission-keyword-form", () => ({ MissionKeywordForm: () => null }))
vi.mock("./mission-quiz-form", () => ({ MissionQuizForm: () => null }))

import type { MissionListItem } from "./mission.service"
import { MissionParticipantExperience } from "./mission-participant-experience"

const base: MissionListItem = {
  id: "mission",
  title: "Missão exemplo",
  description: "Descrição",
  imageUrl: null,
  validationType: "reviewer",
  status: "available",
  xpAwarded: 25,
  completedAt: null,
  blockedBy: [],
  externalLinks: [1, 2, 3].map((n) => ({
    label: `Recurso ${n}`,
    url: `https://example.com/${n}`,
  })),
}
const render = (mission: MissionListItem) =>
  renderToStaticMarkup(
    createElement(MissionParticipantExperience, { missions: [mission] })
  )

describe("mission links only inside details", () => {
  it("does not show links on the featured card or mission list while details are closed", () => {
    dialog.open = false
    const html = render(base)
    for (const link of base.externalLinks!)
      expect(html).not.toContain(`href="${link.url}"`)
  })
  for (const status of [
    "available",
    "blocked",
    "completed",
    "failed",
  ] as const) {
    it.each(["qr", "reviewer", "automatic", "keyword", "quiz"] as const)(
      `shows registered links in ${status} %s mission details`,
      (validationType) => {
        dialog.open = true
        const html = render({ ...base, status, validationType })
        for (const link of base.externalLinks!) {
          expect(html).toContain(`href="${link.url}"`)
          expect(html).toContain(link.label)
        }
        expect(html).toContain("grid-cols-3")
        expect(html).toContain('target="_blank"')
      }
    )
  }
  it("preserves legacy links and explicit removal", () => {
    dialog.open = true
    const legacy = {
      ...base,
      externalLinks: undefined,
      externalUrl: "https://example.com/legacy",
    }
    expect(render(legacy)).toContain('href="https://example.com/legacy"')
    expect(render({ ...legacy, externalLinks: [] })).not.toContain(
      'href="https://example.com/legacy"'
    )
  })
})

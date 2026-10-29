import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ readFile: vi.fn() }))
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }))
import { loadQrPrintEnvironment } from "@/scripts/lib/qr-print-environment.mjs"
const production =
  'DEVMODE=FALSE\nNEXT_PUBLIC_APP_URL="https://pokedex.example.com"\nEVENT_ID=event\nFB_ADMIN_PROJECT_ID=devfest-triangulo-2026\nFB_ADMIN_CLIENT_EMAIL=test@example.com\nFB_ADMIN_PRIVATE_KEY=fixture-key'
const local =
  "DEVMODE=true\nNEXT_PUBLIC_APP_URL=http://localhost:3001\nEVENT_ID=test-event\nFB_ADMIN_PROJECT_ID=devdex-22728\nFB_ADMIN_CLIENT_EMAIL=test@example.com\nFB_ADMIN_PRIVATE_KEY=fixture-key"
beforeEach(() => {
  vi.clearAllMocks()
  mocks.readFile.mockImplementation(async (file: string) =>
    file.endsWith(".env.local") ? local : production
  )
})

describe("QR print environment", () => {
  it("uses .env values even when the shell inherited a local environment", async () => {
    const result = await loadQrPrintEnvironment({
      directory: "/project",
      inherited: { DEVMODE: "true", NEXT_PUBLIC_APP_URL: "http://wrong:3001" },
    })
    expect(result.NEXT_PUBLIC_APP_URL).toBe("https://pokedex.example.com")
    expect(result.DEVMODE).toBe("false")
    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith(
      "/project/.env",
      "utf8"
    )
  })
  it("loads only .env.local for --local, including its URL, mode and project", async () => {
    const result = await loadQrPrintEnvironment({
      directory: "/project",
      local: true,
      inherited: { NEXT_PUBLIC_APP_URL: "https://wrong.example" },
    })
    expect(result.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3001")
    expect(result.DEVMODE).toBe("true")
    expect(result.FB_ADMIN_PROJECT_ID).toBe("devdex-22728")
    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith(
      "/project/.env.local",
      "utf8"
    )
  })
  it.each([
    production.replace("DEVMODE=FALSE", ""),
    production.replace('NEXT_PUBLIC_APP_URL="https://pokedex.example.com"', ""),
    production.replace("devfest-triangulo-2026", "devdex-22728"),
    production.replace("https://pokedex.example.com", "ftp://example.com"),
  ])("rejects ambiguous or invalid configuration", async (content) => {
    mocks.readFile.mockResolvedValue(content)
    await expect(loadQrPrintEnvironment({ inherited: {} })).rejects.toThrow()
  })
  it("rejects production in .env.local", async () => {
    mocks.readFile.mockResolvedValue(production)
    await expect(
      loadQrPrintEnvironment({ local: true, inherited: {} })
    ).rejects.toThrow("Produção deve usar .env")
  })
})

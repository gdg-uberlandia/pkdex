import { execFile } from "node:child_process"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { promisify } from "node:util"

import { loadQrPrintEnvironment } from "./lib/qr-print-environment.mjs"

const execFileAsync = promisify(execFile)
const useLocal = process.argv.includes("--local")
const useMobile = process.argv.includes("--mobile")

if (useLocal && useMobile) {
  throw new Error("Use apenas um dos flags: --local ou --mobile")
}

const scriptPath = path.resolve("scripts/generate-event-qr-images-png.mjs")
const qrDirectory = path.resolve("artifacts/qr")

async function cleanQrDirectory() {
  await rm(qrDirectory, { recursive: true, force: true })
  await mkdir(qrDirectory, { recursive: true })
}

async function main() {
  const selectedEnv = await loadQrPrintEnvironment({
    local: useLocal,
    mobile: useMobile,
  })
  console.log(
    JSON.stringify({
      mode: selectedEnv.DEVMODE === "true" ? "teste" : "produção",
      project: selectedEnv.FB_ADMIN_PROJECT_ID,
      eventId: selectedEnv.EVENT_ID,
      origin: new URL(selectedEnv.NEXT_PUBLIC_APP_URL).origin,
    })
  )
  await cleanQrDirectory()

  const { stdout, stderr } = await execFileAsync("node", [scriptPath], {
    stdio: ["inherit", "pipe", "pipe"],
    env: selectedEnv,
  })

  if (stdout) {
    process.stdout.write(stdout)
  }

  if (stderr) {
    process.stderr.write(stderr)
  }
}

main().catch((error) => {
  process.stderr.write(String(error) + "\n")
  process.exit(1)
})

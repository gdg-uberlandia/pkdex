/** Local or explicitly selected Vercel preview benchmark. Preserves existing test data. */
import { spawn } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { performance } from "node:perf_hooks"

import { Timestamp } from "firebase-admin/firestore"
import { encode } from "next-auth/jwt"

import {
  deleteReferences,
  getFirestoreCollectionName,
  initializeFirestore,
  isDevMode,
  loadLocalEnvironment,
  requireEnvironment,
} from "./lib/firestore-admin.mjs"

await loadLocalEnvironment(".env.local", { override: true })
if (!isDevMode()) throw new Error("Requires DEVMODE=true in .env.local")
const apply = process.argv.includes("--apply")
const durationArgument = process.argv.find((arg) =>
  arg.startsWith("--stage-seconds=")
)
const stageSeconds = durationArgument
  ? Number(durationArgument.split("=")[1])
  : 0
if (!Number.isInteger(stageSeconds) || stageSeconds < 0 || stageSeconds > 300) {
  throw new Error("--stage-seconds must be an integer between 0 and 300")
}
const runId = `perf-${randomUUID()}`
const targetArgument = process.argv.find((arg) => arg.startsWith("--target="))
const remote = Boolean(targetArgument)
const target = new URL(
  targetArgument
    ? targetArgument.slice("--target=".length)
    : "http://127.0.0.1:3107"
)
if (
  remote &&
  (target.protocol !== "https:" ||
    !target.hostname.endsWith(".vercel.app") ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== "/")
) {
  throw new Error(
    "Remote target must be an explicit HTTPS Vercel preview origin"
  )
}
const baseUrl = target.origin
const requestHeaders =
  remote && apply
    ? {
        "x-vercel-protection-bypass": requireEnvironment(
          "VERCEL_AUTOMATION_BYPASS_SECRET"
        ),
      }
    : {}
const cookieName = remote
  ? "__Secure-authjs.session-token"
  : "authjs.session-token"
const participants = 1020
const activeParticipants = 850
const routes = [
  "/home",
  "/passport",
  "/ranking",
  "/companies",
  "/tags",
  "/connections",
]
const plan = {
  participants,
  activeParticipants,
  concurrency: [1, 10, 25, 50],
  stageSeconds,
  remote,
  routes,
  baseUrl,
}
console.log(JSON.stringify(plan, null, 2))
if (!apply) {
  console.log(
    "Run with --apply after pnpm build. Adds temporary test data and removes it in finally."
  )
  process.exit(0)
}
if (!remote) {
  await readFile(".next/BUILD_ID", "utf8")
  await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once("error", reject)
    probe.listen(3107, "127.0.0.1", () => probe.close(resolve))
  })
} else {
  const sub = "perf-session-probe"
  const token = await encode({
    secret: requireEnvironment("AUTH_SECRET"),
    salt: cookieName,
    token: {
      sub,
      name: "Performance probe",
      email: "performance-probe@example.test",
    },
    maxAge: 120,
  })
  const response = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { ...requestHeaders, cookie: `${cookieName}=${token}` },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  })
  const session = await response.json().catch(() => null)
  if (response.status !== 200 || session?.user?.id !== sub)
    throw new Error(
      "Preview access or synthetic session rejected; no seed created"
    )
}
const eventId = requireEnvironment("EVENT_ID")
const { firestore } = initializeFirestore()
firestore.settings({ preferRest: true })
const collection = (name) =>
  firestore.collection(getFirestoreCollectionName(name))
const hash = (parts) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex")
const now = Timestamp.now()
const docs = []
const cookies = []
let server
let logHandle
const report = {
  ...plan,
  runId,
  startedAt: new Date().toISOString(),
  stages: [],
  limitations: [
    remote
      ? "Vercel preview with remote test Firestore; preview configuration may differ from production"
      : "Local server and remote test Firestore; not production hosting capacity",
    "Synthetic authenticated sessions; excludes Google OAuth",
    "Full HTML reads only; excludes browser rendering, assets, and mutation concurrency",
    "Closed-loop concurrency without think time; not a count of simultaneous people",
    "Firestore read billing not measured",
  ],
}
const add = (name, id, data) =>
  docs.push({ ref: collection(name).doc(id), data })
let stopping = false
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true
  })
try {
  const catalogs = await Promise.all(
    ["companies", "tags"].map(async (name) => {
      const snapshot = await collection(name)
        .where("eventId", "==", eventId)
        .get()
      return snapshot.docs
        .filter((doc) => doc.data().active)
        .slice(0, name === "companies" ? 4 : 8)
    })
  )
  if (catalogs.some((items) => items.length === 0)) {
    throw new Error("Requires active companies and tags in the test catalog")
  }
  report.catalogItemsPerActiveParticipant = catalogs.map(
    (items) => items.length
  )
  report.existingParticipants = (
    await collection("profiles").where("eventId", "==", eventId).count().get()
  ).data().count
  const ids = Array.from({ length: participants }, (_, i) => `${runId}-${i}`)
  for (const [i, id] of ids.entries()) {
    const active = i < activeParticipants
    let xp = active ? 10 : 0
    for (const [group, items] of catalogs.entries()) {
      if (!active) continue
      const activityType = group === 0 ? "company" : "tag"
      for (const item of items) {
        const xpAwarded = item.data().xpAwarded ?? (group === 0 ? 50 : 25)
        xp += xpAwarded
        add("activityCompletions", hash([eventId, id, activityType, item.id]), {
          eventId,
          participantId: id,
          activityType,
          activityId: item.id,
          qrId: item.data().qrId,
          xpAwarded,
          completedAt: now,
        })
      }
    }
    add("profiles", id, {
      userId: id,
      eventId,
      displayName: `Performance ${i}`,
      email: `${id}@example.test`,
      avatarUrl: null,
      gender: "Prefiro não me identificar",
      bio: null,
      role: null,
      company: null,
      linkedinUsername: null,
      website: null,
      skills: ["javascript", "typescript", "react"],
      accessRoles: ["participant"],
      ticketBalance: 1,
      convertedXp: 0,
      onboardingTicketGranted: true,
      qrId: randomUUID(),
      onboardingCompleted: true,
      xp,
      xpReachedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    add("participantSummaries", hash([eventId, id, "summary"]), {
      eventId,
      participantId: id,
      connectionsCount: active ? 2 : 0,
      companiesVisitedCount: active ? catalogs[0].length : 0,
      tagsDiscoveredCount: active ? catalogs[1].length : 0,
      missionsCompletedCount: 0,
      initializedAt: now,
      updatedAt: now,
    })
    if (active) {
      const pair = [id, ids[(i + 1) % activeParticipants]].sort()
      const connectionId = hash([eventId, ...pair])
      add("connections", connectionId, {
        eventId,
        participantIds: pair,
        requesterId: pair[0],
        recipientId: pair[1],
        status: "accepted",
        requestCount: 1,
        xpAwardedPerParticipant: 5,
        firstRequestedAt: now,
        lastRequestedAt: now,
        acceptedAt: now,
        rejectedAt: null,
        removedAt: null,
        removedBy: null,
        xpGrantedAt: now,
        xpRevokedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }
    const token = await encode({
      secret: requireEnvironment("AUTH_SECRET"),
      salt: cookieName,
      token: { sub: id, name: `Performance ${i}`, email: `${id}@example.test` },
      maxAge: 3600,
    })
    cookies.push(`${cookieName}=${token}`)
  }
  // Keep only document paths, never credentials or session cookies, for interrupted-run recovery.
  await writeFile(
    `/tmp/${runId}-cleanup.json`,
    JSON.stringify(docs.map(({ ref }) => ref.path)),
    { mode: 0o600 }
  )
  report.temporaryDocuments = docs.length
  for (let offset = 0; offset < docs.length; offset += 400) {
    if (stopping) throw new Error("Interrupted")
    const batch = firestore.batch()
    for (const { ref, data } of docs.slice(offset, offset + 400))
      batch.create(ref, data)
    await batch.commit()
    console.log(`Seed: ${Math.min(offset + 400, docs.length)}/${docs.length}`)
  }
  if (!remote) {
    console.log(
      `Created ${docs.length} temporary documents; starting production server.`
    )
    const { open } = await import("node:fs/promises")
    logHandle = await open(`/tmp/${runId}-server.log`, "w", 0o600)
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3107",
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          AUTH_URL: baseUrl,
          NEXT_PUBLIC_APP_URL: baseUrl,
          AUTH_TRUST_HOST: "true",
        },
        stdio: ["ignore", logHandle.fd, logHandle.fd],
      }
    )
    let ready = false
    for (let i = 0; i < 60; i++) {
      if (server.exitCode !== null || stopping)
        throw new Error("Server stopped before readiness")
      try {
        const response = await fetch(`${baseUrl}/login`, {
          signal: AbortSignal.timeout(1000),
        })
        await response.text()
        if (response.ok) {
          ready = true
          break
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    if (!ready) throw new Error("Server did not become ready")
  }
  const measure = async (route, participantIndex) => {
    const start = performance.now()
    try {
      const response = await fetch(baseUrl + route, {
        headers: { ...requestHeaders, cookie: cookies[participantIndex] },
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      })
      const body = await response.text()
      const failed =
        response.status !== 200 ||
        /NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|"digest":"\d+"/.test(
          body.replaceAll('\\"', '"')
        )
      return {
        route,
        ms: Math.round(performance.now() - start),
        failed,
        status: response.status,
      }
    } catch {
      return {
        route,
        ms: Math.round(performance.now() - start),
        failed: true,
        status: 0,
      }
    }
  }
  if (remote) {
    const probe = await fetch(`${baseUrl}/api/profile/qr-code`, {
      headers: { ...requestHeaders, cookie: cookies[0] },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    })
    const qr = await probe.json().catch(() => null)
    const expected = docs.find(
      ({ ref }) => ref.id === `${runId}-0` && ref.parent.id === "test_profiles"
    )?.data.qrId
    const code = qr?.value
      ? new URL(qr.value).pathname.match(/^\/q\/([A-Za-z0-9_-]{22})$/)?.[1]
      : null
    const reference = code
      ? collection("userQrReferences").doc(
          createHash("sha256").update(code).digest("hex")
        )
      : null
    const storedReference = reference ? await reference.get() : null
    if (
      probe.status !== 200 ||
      !expected ||
      storedReference?.data()?.qrId !== expected ||
      storedReference?.data()?.eventId !== eventId
    )
      throw new Error(
        "Preview did not return the QR of the seeded test profile; load cancelled"
      )
    if (reference) docs.push({ ref: reference, data: storedReference.data() })
    report.remoteSeedVerified = true
  }
  const smoke = await measure("/home", 0)
  if (smoke.failed)
    throw new Error(`Authenticated smoke failed: HTTP ${smoke.status}`)
  report.coldHomeMs = smoke.ms
  for (const concurrency of plan.concurrency) {
    if (stopping) throw new Error("Interrupted")
    const results = []
    const count = concurrency === 1 ? 18 : 180
    let next = 0
    const stageStart = performance.now()
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (
          (next < count ||
            performance.now() - stageStart < stageSeconds * 1000) &&
          !stopping
        ) {
          const index = next++
          results.push(
            await measure(
              routes[index % routes.length],
              (index * 17 + concurrency) % participants
            )
          )
        }
      })
    )
    const percentile = (values, p) =>
      values.toSorted((a, b) => a - b)[
        Math.max(0, Math.ceil(values.length * p) - 1)
      ]
    const summarize = (values) => ({
      requests: values.length,
      errors: values.filter((r) => r.failed).length,
      p50Ms: percentile(
        values.map((r) => r.ms),
        0.5
      ),
      p95Ms: percentile(
        values.map((r) => r.ms),
        0.95
      ),
      maxMs: Math.max(...values.map((r) => r.ms)),
    })
    const stage = {
      concurrency,
      ...summarize(results),
      durationSeconds: Math.round((performance.now() - stageStart) / 100) / 10,
      routes: Object.fromEntries(
        routes.map((route) => [
          route,
          summarize(results.filter((r) => r.route === route)),
        ])
      ),
    }
    if (stopping) throw new Error("Interrupted; partial stage discarded")
    if (stage.errors > 0) process.exitCode = 1
    report.stages.push(stage)
    console.log(JSON.stringify(stage))
    if (stage.errors > stage.requests * 0.05) {
      report.stoppedEarly = "Error rate exceeded 5%"
      break
    }
  }
} catch (error) {
  report.error = error.message
  process.exitCode = 1
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM")
    await new Promise((resolve) => {
      server.once("exit", resolve)
      setTimeout(() => {
        server.kill("SIGKILL")
        resolve()
      }, 5000).unref()
    })
  }
  try {
    await deleteReferences(
      firestore,
      docs.map(({ ref }) => ref)
    )
    report.cleanup = "completed"
  } catch {
    report.cleanup = `failed; recover using /tmp/${runId}-cleanup.json`
    process.exitCode = 1
  }
  report.finishedAt = new Date().toISOString()
  await writeFile(`/tmp/${runId}-report.json`, JSON.stringify(report, null, 2))
  await logHandle?.close()
  await firestore.terminate()
  console.log(`Report: /tmp/${runId}-report.json; cleanup: ${report.cleanup}`)
  if (report.error) console.error(report.error)
}

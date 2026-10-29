/** Opt-in HTTP integration checks against an explicitly selected test preview. */
import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import https from "node:https"
import { performance } from "node:perf_hooks"
import { Readable } from "node:stream"

import { Timestamp } from "firebase-admin/firestore"
import rsc from "next/dist/compiled/react-server-dom-webpack/client.node.js"
import { encode } from "next-auth/jwt"

import {
  deleteReferences,
  getFirestoreCollectionName,
  initializeFirestore,
  isDevMode,
  loadLocalEnvironment,
  requireEnvironment,
} from "./lib/firestore-admin.mjs"
import { buildStaticQrPath } from "./lib/static-qr-code.mjs"

await loadLocalEnvironment(".env.local", { override: true })
assert(isDevMode(), "Requires DEVMODE=true")
const target = new URL(
  process.argv.find((arg) => arg.startsWith("--target="))?.slice(9) ??
    "http://invalid"
)
assert(
  target.protocol === "https:" &&
    target.hostname.endsWith(".vercel.app") &&
    !target.username &&
    !target.password &&
    !target.search &&
    !target.hash &&
    target.pathname === "/",
  "Provide --target=https://your-preview.vercel.app"
)
if (!process.argv.includes("--apply")) {
  console.log(
    "Plan: 22 temporary profiles; authenticated Server Actions; concurrency up to 20; exact-profile cleanup. Add --apply to execute."
  )
  process.exit(0)
}
const origin = target.origin
const headers = {
  "x-vercel-protection-bypass": requireEnvironment(
    "VERCEL_AUTOMATION_BYPASS_SECRET"
  ),
}
const eventId = requireEnvironment("EVENT_ID")
const runId = `perf-http-${randomUUID()}`
const ids = Array.from({ length: 22 }, (_, i) => `${runId}-${i}`)
const cookieName = "__Secure-authjs.session-token"
const cookies = []
const qrIds = ids.map(() => randomUUID())
const { firestore } = initializeFirestore()
firestore.settings({ preferRest: true })
const col = (name) => firestore.collection(getFirestoreCollectionName(name))
const hash = (parts) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex")
const refs = []
const report = {
  runId,
  origin,
  startedAt: new Date().toISOString(),
  actionTransport: "node:https with dedicated pool of up to 50 sockets",
  groups: [],
  checks: [],
  limitations: [
    "Synthetic sessions; Google OAuth is not exercised",
    "Short integration test, not sustained write capacity",
    "Uses Server Action references and RSC encoding of the deployed Next.js app",
  ],
}
const actions = new Map()
const chunks = new Map()
const actionAgent = new https.Agent({ keepAlive: true, maxSockets: 50 })

// Dedicated sockets avoid the serialized POST scheduling observed with fetch
// in this runner. Request handles multipart boundaries for React FormData.
async function postAction(url, options) {
  const request = new Request(url, options)
  const body = Buffer.from(await request.arrayBuffer())
  return new Promise((resolve, reject) => {
    const outgoing = https.request(
      url,
      {
        method: "POST",
        agent: actionAgent,
        headers: {
          ...Object.fromEntries(request.headers),
          "content-length": String(body.byteLength),
        },
      },
      (incoming) => {
        const headers = new Headers()
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value))
            for (const item of value) headers.append(key, item)
          else if (value !== undefined) headers.set(key, value)
        }
        incoming.once("end", () => clearTimeout(timer))
        incoming.once("error", () => clearTimeout(timer))
        resolve(
          new Response(Readable.toWeb(incoming), {
            status: incoming.statusCode,
            headers,
          })
        )
      }
    )
    const timer = setTimeout(
      () => outgoing.destroy(new Error("Action timeout")),
      20000
    )
    outgoing.once("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    outgoing.end(body)
  })
}
let seedStarted = false

async function get(path, index = 0) {
  return fetch(origin + path, {
    headers: { ...headers, cookie: cookies[index] },
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  })
}
async function discover(path, action) {
  if (actions.has(action)) return actions.get(action)
  const response = await get(path)
  assert.equal(response.status, 200, `Action page ${path}`)
  const html = await response.text()
  for (const match of html.matchAll(/src="([^" ]+\.js[^" ]*)"/g)) {
    const url = new URL(match[1], origin)
    if (url.origin !== origin) continue
    if (!chunks.has(url.href)) {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000),
      })
      assert.equal(response.status, 200)
      chunks.set(url.href, await response.text())
    }
    const js = chunks.get(url.href)
    const pattern =
      /createServerReference\)\("([a-f0-9]+)"[^;]{0,250}?"([A-Za-z0-9]+Action)"\)/g
    for (const reference of js.matchAll(pattern))
      actions.set(reference[2], reference[1])
  }
  assert(
    actions.has(action),
    `Could not discover ${action}; deployment format may differ`
  )
  return actions.get(action)
}
async function call(path, action, index, args, { anonymous = false } = {}) {
  const started = performance.now()
  const body = await rsc.encodeReply(args)
  const response = await postAction(origin + path, {
    method: "POST",
    headers: {
      ...headers,
      origin,
      "next-action": actions.get(action),
      accept: "text/x-component",
      ...(anonymous ? {} : { cookie: cookies[index] }),
      ...(typeof body === "string"
        ? { "content-type": "text/plain;charset=UTF-8" }
        : {}),
    },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  })
  const redirect =
    response.headers.get("x-action-redirect") ??
    response.headers.get("location")
  if (anonymous && redirect?.includes("/login")) {
    await response.arrayBuffer()
    return { success: false, code: "AUTH_REQUIRED" }
  }
  if (response.status !== 200) {
    await response.arrayBuffer()
    throw new Error(`HTTP ${response.status} from ${action}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ""
  let result
  let resultReadyMs
  let responseBytes = 0
  const parseLine = (line) => {
    if (result) return
    const match = line.match(/^[a-f0-9]+:(\{.*\})$/)
    if (!match) return
    try {
      const value = JSON.parse(match[1])
      if (typeof value.success === "boolean") {
        result = value
        resultReadyMs = Math.round(performance.now() - started)
      }
    } catch {}
  }
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    responseBytes += value.byteLength
    pending += decoder.decode(value, { stream: true })
    let newline
    while ((newline = pending.indexOf("\n")) !== -1) {
      parseLine(pending.slice(0, newline))
      pending = pending.slice(newline + 1)
    }
  }
  parseLine(pending + decoder.decode())
  if (result) return { ...result, resultReadyMs, responseBytes }
  throw new Error(
    `No action result from ${action}; response format or deployment changed`
  )
}

async function batch(label, calls) {
  const start = performance.now()
  const results = await Promise.all(
    calls.map(async (fn) => {
      const start = performance.now()
      try {
        const result = await fn()
        return { ...result, ms: Math.round(performance.now() - start) }
      } catch (error) {
        return {
          success: false,
          code: "TRANSPORT_OR_PROTOCOL_ERROR",
          error: error.message,
          ms: Math.round(performance.now() - start),
        }
      }
    })
  )
  const times = results.map((r) => r.ms).sort((a, b) => a - b)
  const resultTimes = results
    .map((r) => r.resultReadyMs)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  report.groups.push({
    label,
    operations: results.length,
    durationMs: Math.round(performance.now() - start),
    p95Ms: times[Math.ceil(times.length * 0.95) - 1],
    maxMs: times.at(-1),
    p95ResultReadyMs:
      resultTimes[Math.ceil(resultTimes.length * 0.95) - 1] ?? null,
    maxResultReadyMs: resultTimes.at(-1) ?? null,
    maxResponseBytes: Math.max(...results.map((r) => r.responseBytes ?? 0)),
    statuses: Object.fromEntries(
      [
        ...new Set(
          results.map((r) => r.code ?? (r.success ? "success" : "rejected"))
        ),
      ].map((code) => [
        code,
        results.filter(
          (r) => (r.code ?? (r.success ? "success" : "rejected")) === code
        ).length,
      ])
    ),
  })
  console.log(JSON.stringify(report.groups.at(-1)))
  assert(
    !results.some((r) => r.code === "TRANSPORT_OR_PROTOCOL_ERROR"),
    results.find((r) => r.error)?.error
  )
  return results
}
try {
  for (let i = 0; i < ids.length; i++)
    cookies.push(
      `${cookieName}=${await encode({ secret: requireEnvironment("AUTH_SECRET"), salt: cookieName, token: { sub: ids[i], name: `HTTP Test ${i}`, email: `${ids[i]}@example.test` }, maxAge: 3600 })}`
    )
  const session = await get("/api/auth/session")
  assert.equal(
    (await session.json())?.user?.id,
    ids[0],
    "Preview session rejected before seed"
  )
  const catalogs = await Promise.all(
    ["companies", "tags", "missions"].map(async (name) => {
      const snapshot = await col(name).where("eventId", "==", eventId).get()
      const doc = snapshot.docs.find(
        (d) =>
          d.data().active &&
          d.data().qrId &&
          (name !== "missions" ||
            (d.data().validationType === "qr" &&
              !(d.data().prerequisites ?? []).length))
      )
      assert(doc, `No eligible ${name}`)
      return { id: doc.id, ...doc.data() }
    })
  )
  const [company, tag, mission] = catalogs
  const now = Timestamp.now()
  const seed = firestore.batch()
  for (let i = 0; i < ids.length; i++) {
    const profile = col("profiles").doc(ids[i])
    const summary = col("participantSummaries").doc(
      hash([eventId, ids[i], "summary"])
    )
    refs.push(profile, summary)
    seed.create(profile, {
      userId: ids[i],
      eventId,
      displayName: `HTTP Test ${i}`,
      email: `${ids[i]}@example.test`,
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
      qrId: qrIds[i],
      onboardingCompleted: true,
      xp: i >= 20 ? 500 : 0,
      xpReachedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    seed.create(summary, {
      eventId,
      participantId: ids[i],
      connectionsCount: 0,
      companiesVisitedCount: 0,
      tagsDiscoveredCount: 0,
      missionsCompletedCount: 0,
      initializedAt: now,
      updatedAt: now,
    })
  }
  await writeFile(
    `/tmp/${runId}-cleanup.json`,
    JSON.stringify({ ids, refs: refs.map((r) => r.path) }),
    { mode: 0o600 }
  )
  seedStarted = true
  await seed.commit()
  const qr = await (await get("/api/profile/qr-code")).json()
  const referenceCode = new URL(qr.value).pathname.match(
    /^\/q\/([A-Za-z0-9_-]{22})$/
  )?.[1]
  assert(referenceCode, "Expected a short participant QR Code")
  const reference = col("userQrReferences").doc(
    createHash("sha256").update(referenceCode).digest("hex")
  )
  const storedReference = await reference.get()
  assert.equal(
    storedReference.data()?.qrId,
    qrIds[0],
    "Preview is not reading the seeded test profile"
  )
  assert.equal(storedReference.data()?.eventId, eventId)
  refs.push(reference)
  report.remoteSeedVerified = true
  const companyPath = buildStaticQrPath("company", company.qrId)
  const tagPath = buildStaticQrPath("tag", tag.qrId)
  const missionPath = buildStaticQrPath("mission", mission.qrId)
  for (const [path, action] of [
    [companyPath, "visitCompanyAction"],
    [tagPath, "discoverTagAction"],
    [missionPath, "completeQrMissionAction"],
    ["/scan", "connectFromScanAction"],
    ["/tickets", "convertXpAction"],
  ])
    await discover(path, action)
  assert.equal(
    (
      await call(
        companyPath,
        "visitCompanyAction",
        0,
        [{ eventId, qrId: company.qrId }],
        { anonymous: true }
      )
    ).code,
    "AUTH_REQUIRED"
  )
  assert.equal(
    (
      await col("activityCompletions")
        .where("participantId", "==", ids[0])
        .get()
    ).size,
    0
  )
  report.checks.push(
    "Unauthenticated HTTP action rejected without recording activity"
  )
  for (const [kind, path, action, qrId, fresh, repeated] of [
    [
      "company",
      companyPath,
      "visitCompanyAction",
      company.qrId,
      "COMPANY_VISITED",
      "COMPANY_ALREADY_VISITED",
    ],
    [
      "tag",
      tagPath,
      "discoverTagAction",
      tag.qrId,
      "TAG_DISCOVERED",
      "TAG_ALREADY_DISCOVERED",
    ],
    [
      "mission",
      missionPath,
      "completeQrMissionAction",
      mission.qrId,
      "MISSION_COMPLETED",
      "MISSION_ALREADY_COMPLETED",
    ],
  ]) {
    const results = await batch(
      `20 fresh ${kind} HTTP actions`,
      ids
        .slice(0, 20)
        .map((_, i) => () => call(path, action, i, [{ eventId, qrId }]))
    )
    assert(
      results.every((r) => r.success && r.code === fresh),
      `Unexpected ${kind} result`
    )
    const replay = await batch(
      `20 repeated ${kind} HTTP actions`,
      ids
        .slice(0, 20)
        .map((_, i) => () => call(path, action, i, [{ eventId, qrId }]))
    )
    assert(
      replay.every((r) => r.success && r.code === repeated),
      `Unexpected repeated ${kind} result`
    )
  }
  const qrs = await Promise.all(
    ids
      .slice(0, 20)
      .map(
        async (_, i) =>
          new URL((await (await get("/api/profile/qr-code", i)).json()).value)
      )
  )
  const requests = ids.slice(0, 20).map(
    (_, i) => () =>
      call("/scan", "connectFromScanAction", i, [
        {
          eventId,
          targetQrId: qrIds[i % 2 === 0 ? i + 1 : i - 1],
          token: qrs[i % 2 === 0 ? i + 1 : i - 1].searchParams.get("token"),
        },
      ])
  )
  const pairs = await batch("10 bidirectional HTTP connection pairs", requests)
  assert.equal(pairs.filter((r) => r.code === "CONNECTION_CREATED").length, 10)
  assert.equal(pairs.filter((r) => r.code === "ALREADY_CONNECTED").length, 10)
  const invalid = await call("/scan", "connectFromScanAction", 0, [
    { eventId, targetQrId: qrIds[19], token: "invalid-test-token" },
  ])
  assert(!invalid.success)
  report.checks.push("Invalid signed participant QR rejected")
  const expectedXp =
    (company.xpAwarded ?? 50) +
    (tag.xpAwarded ?? 75) +
    (mission.xpAwarded ?? 50) +
    5
  for (const id of ids.slice(0, 20)) {
    const [profile, summary, completions] = await Promise.all([
      col("profiles").doc(id).get(),
      col("participantSummaries")
        .doc(hash([eventId, id, "summary"]))
        .get(),
      col("activityCompletions").where("participantId", "==", id).get(),
    ])
    assert.equal(profile.data().xp, expectedXp)
    assert.equal(completions.size, 3)
    for (const counter of [
      "connectionsCount",
      "companiesVisitedCount",
      "tagsDiscoveredCount",
      "missionsCompletedCount",
    ])
      assert.equal(summary.data()[counter], 1)
  }
  report.checks.push(
    `20 participants: ${expectedXp} XP each, three completions and one connection, no duplicate rewards`
  )
  const conversion = async (i, key) => {
    const form = new FormData()
    form.set("ticketAmount", "2")
    form.set("idempotencyKey", key)
    return call("/tickets", "convertXpAction", i, [{ success: false }, form])
  }
  const key = randomUUID()
  const conversions = await batch(
    "8 repeated HTTP ticket conversions",
    Array.from({ length: 8 }, () => () => conversion(20, key))
  )
  assert(conversions.every((r) => r.success))
  const distinct = await batch(
    "8 HTTP ticket conversions competing for balance",
    Array.from({ length: 8 }, () => () => conversion(21, randomUUID()))
  )
  assert.equal(distinct.filter((r) => r.success).length, 1)
  for (const id of ids.slice(20)) {
    const p = (await col("profiles").doc(id).get()).data()
    assert.equal(p.xp, 500)
    assert.equal(p.ticketBalance, 3)
    assert.equal(p.convertedXp, 400)
    assert.equal(
      (await col("ticketTransactions").where("participantId", "==", id).get())
        .size,
      1
    )
  }
  report.checks.push(
    "HTTP ticket conversions preserve ranking XP and cannot spend the same balance twice"
  )
} catch (error) {
  report.error = error.message
  process.exitCode = 1
  console.log("HTTP validation stopped:", error.message)
} finally {
  try {
    if (seedStarted) {
      for (const [name, field] of [
        ["activityCompletions", "participantId"],
        ["ticketTransactions", "participantId"],
        ["connections", "requesterId"],
      ]) {
        const snapshot = await col(name).where(field, "in", ids).get()
        refs.push(...snapshot.docs.map((d) => d.ref))
      }
      await deleteReferences(firestore, refs)
    }
    report.cleanup = "completed"
    report.deletedReferences = seedStarted ? refs.length : 0
  } catch {
    report.cleanup = `failed; use /tmp/${runId}-cleanup.json`
    process.exitCode = 1
  }
  actionAgent.destroy()
  report.finishedAt = new Date().toISOString()
  await writeFile(`/tmp/${runId}-report.json`, JSON.stringify(report, null, 2))
  await firestore.terminate()
  console.log(`Report: /tmp/${runId}-report.json; cleanup: ${report.cleanup}`)
}

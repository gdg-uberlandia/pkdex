/** Reset do cenário reduzido de testes. Simula por padrão; use --apply para gravar. */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { access, writeFile } from "node:fs/promises"

import { getAuth } from "firebase-admin/auth"
import { Timestamp } from "firebase-admin/firestore"

import { createCatalogFixture } from "./fixtures/event-test-data.mjs"
import {
  deleteReferences,
  initializeFirestore,
  loadLocalEnvironment,
  requireEnvironment,
  writeDocuments,
} from "./lib/firestore-admin.mjs"

await loadLocalEnvironment(".env.local", { override: true })
assert.equal(process.env.DEVMODE?.toLowerCase(), "true")
const { firestore, projectId } = initializeFirestore()
assert.equal(
  projectId,
  "devdex-22728",
  "Este reset é exclusivo do projeto de testes"
)
const eventId = requireEnvironment("EVENT_ID")
// Imagens compartilhadas pelo painel não podem depender do servidor local.
const appOrigin = new URL(
  process.env.TEST_ASSET_ORIGIN ?? "https://pokedex.devfesttriangulo.com.br"
)
const now = Timestamp.now()
const apply = process.argv.includes("--apply")
const identities = [
  ["heldsonluiz@gmail.com", "admin"],
  ["h3lforge@gmail.com", "participant"],
  ["ofuscablog@gmail.com", "sponsor"],
]
const preserved = new Set([
  "test_talks",
  "test_speakers",
  "test_schedule",
  "test_schedule_publications",
])
const existing = []
async function collect(ref) {
  const snapshot = await ref.get()
  existing.push(...snapshot.docs)
  for (let offset = 0; offset < snapshot.size; offset += 20) {
    await Promise.all(
      snapshot.docs.slice(offset, offset + 20).map(async (doc) => {
        for (const child of await doc.ref.listCollections())
          await collect(child)
      })
    )
  }
  console.log(`Lida ${ref.path}: ${snapshot.size} documentos`)
}
for (const ref of await firestore.listCollections()) {
  if (ref.id.startsWith("test_") && !preserved.has(ref.id)) await collect(ref)
}
const fixture = createCatalogFixture({ eventId, appOrigin, now })
const select = (collection, count) =>
  fixture.filter((d) => d.collection === collection).slice(0, count)
const companies = select("companies", 4)
const companyId = companies[0].id
const documents = [
  ...companies,
  ...select("tags", 10),
  ...select("rewards", 8),
  ...select("raffles", 2),
]
const types = [
  ["qr", "escanear QR code da missão"],
  ["reviewer", "validação presencial"],
  ["automatic", "automática"],
  ["keyword", "palavra chave"],
  ["quiz", "quiz"],
]
let number = 0
for (const [type, label] of types) {
  const source = fixture.find(
    (d) => d.collection === "missions" && d.data.validationType === type
  )
  assert.ok(source)
  for (let index = 0; index < 3; index++) {
    number++
    const id = `missao-${String(number).padStart(2, "0")}-${type}`
    const data = {
      ...source.data,
      id,
      companyId: null,
      title: `Missão ${number} - ${label}`,
      description: `Missão de teste: ${label}.`,
      order: number - 1,
      qrId: type === "qr" ? randomUUID() : null,
      prerequisites: [],
      keywordConfig: null,
      quizConfig: null,
      progressRequirement: null,
    }
    if (type === "keyword") {
      data.keywordConfig = { acceptedAnswers: ["missão"], maxAttempts: 10 }
      data.description = 'Informe a palavra chave "missão".'
    }
    if (type === "quiz")
      data.quizConfig = {
        questions: [
          {
            id: "q1",
            prompt: "O JavaScript pode ser executado no navegador.",
            options: ["verdadeiro", "falso"],
            correctOptionIndex: 0,
          },
          {
            id: "q2",
            prompt: "Compartilhar senhas publicamente é uma prática segura.",
            options: ["verdadeiro", "falso"],
            correctOptionIndex: 1,
          },
          {
            id: "q3",
            prompt: "Testes automatizados ajudam a identificar regressões.",
            options: ["verdadeiro", "falso"],
            correctOptionIndex: 0,
          },
        ],
        minCorrectAnswers: 3,
        maxAttempts: 10,
      }
    if (type === "automatic") {
      data.progressRequirement = [
        { type: "tags", target: 1 },
        { type: "companies", target: 1 },
        { type: "tags", target: "all" },
      ][index]
      data.description = [
        "Descubra uma tag.",
        "Visite uma empresa.",
        "Descubra todas as tags.",
      ][index]
    }
    documents.push({ collection: "missions", id, data })
  }
}
for (let index = 0; index < 2; index++) {
  number++
  const source = documents.find(
    (d) => d.collection === "missions" && d.data.validationType === "reviewer"
  )
  const id = `missao-${number}-empresa`
  documents.push({
    collection: "missions",
    id,
    data: {
      ...source.data,
      id,
      companyId,
      title: `Missão ${number} - validação presencial na empresa`,
      description: `Visite ${companies[0].data.name} e peça ao sponsor para validar esta missão.`,
      order: number - 1,
    },
  })
}
for (const [email, role] of identities) {
  const matches = existing.filter(
    (d) =>
      d.ref.parent.id === "test_profiles" &&
      d.data().email?.toLowerCase() === email
  )
  assert.ok(matches.length <= 1, `Perfis duplicados para ${email}`)
  const previous = matches[0]
  const auth =
    role === "admin" || !previous
      ? await getAuth().getUserByEmail(email)
      : { uid: previous.id }
  const id = previous?.id ?? auth.uid
  documents.push({
    collection: "profiles",
    id,
    data: {
      ...(previous?.data() ?? {}),
      userId: id,
      eventId,
      email,
      displayName:
        previous?.data().displayName || auth.displayName || email.split("@")[0],
      avatarUrl: previous?.data().avatarUrl ?? auth.photoURL ?? null,
      gender: previous?.data().gender ?? "Prefiro não me identificar",
      bio: previous?.data().bio ?? null,
      role: previous?.data().role ?? null,
      company: role === "sponsor" ? companies[0].data.name : null,
      linkedinUsername: previous?.data().linkedinUsername ?? null,
      website: previous?.data().website ?? null,
      skills: previous?.data().skills ?? [],
      interests: previous?.data().interests ?? [],
      accessRoles: [role],
      sponsorCompanyId: role === "sponsor" ? companyId : null,
      ticketBalance: role === "participant" ? 1 : 0,
      convertedXp: 0,
      onboardingTicketGranted: role === "participant",
      onboardingCompleted: true,
      qrId: previous?.data().qrId ?? randomUUID(),
      xp: 0,
      xpReachedAt: now,
      createdAt: previous?.data().createdAt ?? now,
      updatedAt: now,
    },
  })
  if (role === "admin")
    documents.push({
      collection: "adminUsers",
      id: auth.uid,
      data: {
        email,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    })
}
documents.push({
  collection: "eventOperations",
  id: eventId,
  data: {
    eventId,
    ticketConversionEnabled: true,
    rewardRedemptionEnabled: true,
    raffleClosureStatus: "open",
    raffleClosureCursor: null,
    raffleProcessedParticipants: 0,
    raffleSkippedParticipants: 0,
    raffleSnapshotAt: null,
    raffleClosedAt: null,
    updatedAt: now,
    updatedBy: "focused-test-reset",
  },
})
for (const doc of documents.filter((d) =>
  ["tags", "missions"].includes(d.collection)
)) {
  await access(`public${new URL(doc.data.imageUrl).pathname}`)
}
const counts = Object.fromEntries(
  [...new Set(documents.map((d) => d.collection))].map((name) => [
    name,
    documents.filter((d) => d.collection === name).length,
  ])
)
console.log(
  JSON.stringify(
    {
      apply,
      projectId,
      eventId,
      deleteDocuments: existing.length,
      preserved: [...preserved],
      counts,
      users: identities,
      sponsorCompany: companies[0].data.name,
    },
    null,
    2
  )
)
if (!apply) process.exit(0)
const backup = `/tmp/devdex-test-backup-${Date.now()}.json`
await writeFile(
  backup,
  JSON.stringify(existing.map((d) => ({ path: d.ref.path, data: d.data() }))),
  { mode: 0o600 }
)
console.log(`Backup: ${backup}`)
await deleteReferences(
  firestore,
  existing
    .map((d) => d.ref)
    .sort((a, b) => b.path.split("/").length - a.path.split("/").length)
)
await writeDocuments(firestore, documents)
for (const [name, count] of Object.entries(counts)) {
  assert.equal(
    (await firestore.collection(`test_${name}`).count().get()).data().count,
    count
  )
}
console.log("Reset aplicado e contagens verificadas.")

/**
 * Recria integralmente o Firestore com a massa de testes do projeto.
 *
 * O script apaga todas as coleções e subcoleções, esvazia public/images/qr e
 * artifacts e cria participantes, conexões, empresas, tags, missões,
 * palestrantes, palestras e programação. Não remove contas do Firebase
 * Authentication nem arquivos do Storage.
 *
 * Simular, sem apagar ou gravar documentos:
 * Produção, carregando .env:
 *   pnpm db:seed
 *
 * Local, carregando .env.local:
 *   pnpm db:seed --local
 *
 * Ao final da simulação, o terminal exibirá o comando completo para recriar a
 * base. Confira projeto e evento e então copie e execute a linha inteira, que
 * incluirá --apply e uma confirmação exclusiva dessa operação.
 *
 * A limpeza e o seed não são uma única transação. Não interrompa o processo
 * após confirmar; se houver uma falha, corrija a causa e execute-o novamente.
 */
import { createHash, randomUUID } from "node:crypto"

import { Timestamp } from "firebase-admin/firestore"

import {
  createCatalogFixture,
  getTestParticipantInterests,
  getTestSharedInterests,
} from "./fixtures/event-test-data.mjs"
import {
  applyDatabaseCleanup,
  assertDestructiveConfirmation,
  createDatabaseCleanupPlan,
  initializeFirestore,
  loadLocalEnvironment,
  parseArguments,
  requireEnvironment,
  writeDocuments,
} from "./lib/firestore-admin.mjs"

const args = parseArguments(process.argv.slice(2), {
  booleanArguments: ["apply", "local"],
})
const environmentFile = args.local ? ".env.local" : ".env"
await loadLocalEnvironment(environmentFile, { override: true })
const eventId = requireEnvironment("EVENT_ID")
const appOrigin = new URL(requireEnvironment("NEXT_PUBLIC_APP_URL"))
const localHostnames = new Set(["localhost", "127.0.0.1", "::1"])

if (!args.local && localHostnames.has(appOrigin.hostname)) {
  throw new Error(
    `Seed de produção recusado: NEXT_PUBLIC_APP_URL em ${environmentFile} aponta para ${appOrigin.origin}`
  )
}

const now = Timestamp.now()
const documents = createCatalogFixture({ eventId, appOrigin, now })
const legacyScheduleDocuments = documents.filter(
  (item) => item.collection === "scheduleSlots"
)

if (legacyScheduleDocuments.length > 0) {
  throw new Error(
    `A fixture ainda contém ${legacyScheduleDocuments.length} documento(s) na coleção legada scheduleSlots.`
  )
}

const scheduleDocuments = documents.filter(
  (item) => item.collection === "schedule"
)

if (scheduleDocuments.length === 0) {
  throw new Error("A fixture não gerou documentos para a coleção schedule.")
}
const invalidCatalogAsset = documents.find(
  (item) =>
    (item.collection === "tags" || item.collection === "missions") &&
    item.data.imageUrl &&
    new URL(item.data.imageUrl).origin !== appOrigin.origin
)

if (invalidCatalogAsset) {
  throw new Error(
    `URL de imagem inválida em ${invalidCatalogAsset.collection}/${invalidCatalogAsset.id}: ${invalidCatalogAsset.data.imageUrl}`
  )
}

console.log(
  `Ambiente: ${args.local ? "local" : "produção"} | arquivo: ${environmentFile} | origem: ${appOrigin.origin}`
)

const { firestore, projectId } = initializeFirestore()
console.log("Mapeando documentos do Firestore...")
const cleanupPlan = await createDatabaseCleanupPlan(firestore, {
  onCollectionRead: ({ scope, current, total, name, documents }) =>
    console.log(
      `${scope === "root" ? "Coleção" : "Subcoleção de simulação"} ${current}/${total}: ${name} (${documents} documentos).`
    ),
})
const expected = `RESET_AND_SEED:${projectId}:${eventId}`

console.log(
  JSON.stringify(
    {
      mode: args.apply ? "APLICAÇÃO" : "SIMULAÇÃO (nenhuma gravação)",
      environment: args.local ? "local" : "produção",
      environmentFile,
      appOrigin: appOrigin.origin,
      projectId,
      eventId,
      existingDocumentsToDelete: cleanupPlan.references.length,
      generatedFilesToDelete: Object.fromEntries(
        cleanupPlan.generatedDirectories.map((item) => [
          item.displayPath,
          item.files,
        ])
      ),
      seed: {
        participants: 150,
        companies: 8,
        missions: documents.filter((item) => item.collection === "missions")
          .length,
        missionTypes: Object.fromEntries(
          ["qr", "reviewer", "automatic", "keyword", "quiz"].map((type) => [
            type,
            documents.filter(
              (item) =>
                item.collection === "missions" &&
                item.data.validationType === type
            ).length,
          ])
        ),
        raffles: 6,
        rewards: documents.filter((item) => item.collection === "rewards")
          .length,
        tags: 22,
        talks: 24,
        schedule: scheduleDocuments.length,
      },
    },
    null,
    2
  )
)

if (
  !assertDestructiveConfirmation({
    args,
    expected,
    action: "Recriação da base de testes",
  })
) {
  console.log(
    `\nPara aplicar: pnpm db:seed${args.local ? " --local" : ""} --apply --confirm "${expected}"`
  )
  process.exit(0)
}

const skills = [
  "javascript",
  "python",
  "java",
  "react",
  "typescript",
  "nodejs",
  "flutter",
  "docker",
]
const participants = []
for (let index = 1; index <= 150; index += 1) {
  const id = `test-participant-${String(index).padStart(3, "0")}`
  const xp = (index * 137) % 4300
  const profile = {
    userId: id,
    eventId,
    displayName: `Participante Teste ${String(index).padStart(3, "0")}`,
    email: `participante.${String(index).padStart(3, "0")}@example.test`,
    avatarUrl: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${id}`,
    gender: "Prefiro não me identificar",
    bio: "Perfil fictício criado exclusivamente para testes.",
    role: "Participante",
    company: null,
    linkedinUsername: null,
    website: null,
    skills: [
      skills[index % skills.length],
      skills[(index + 2) % skills.length],
      skills[(index + 4) % skills.length],
    ],
    interests: getTestParticipantInterests(index),
    accessRoles: ["participant"],
    ticketBalance: index % 11,
    convertedXp: (index % 8) * 200,
    onboardingTicketGranted: true,
    qrId: randomUUID(),
    onboardingCompleted: true,
    xp,
    xpReachedAt: now,
    createdAt: now,
    updatedAt: now,
  }
  participants.push(profile)
  documents.push({ collection: "profiles", id, data: profile })
  const summaryId = createHash("sha256")
    .update(JSON.stringify([eventId, id, "summary"]))
    .digest("hex")
  documents.push({
    collection: "participantSummaries",
    id: summaryId,
    data: {
      eventId,
      participantId: id,
      connectionsCount: 0,
      companiesVisitedCount: 0,
      tagsDiscoveredCount: 0,
      missionsCompletedCount: 0,
      initializedAt: now,
      updatedAt: now,
    },
  })
}

// Um anel e conexões extras criam uma rede reproduzível sem duplicar pares.
const pairs = new Set()
for (let index = 0; index < participants.length; index += 1) {
  for (const distance of [1, 7, 19]) {
    const pair = [
      participants[index].userId,
      participants[(index + distance) % participants.length].userId,
    ].sort()
    pairs.add(JSON.stringify(pair))
  }
}
const participantById = new Map(
  participants.map((participant) => [participant.userId, participant])
)
const connectionCounts = new Map(participants.map((item) => [item.userId, 0]))
for (const serialized of pairs) {
  const pair = JSON.parse(serialized)
  const id = createHash("sha256")
    .update(JSON.stringify([eventId, ...pair]))
    .digest("hex")
  documents.push({
    collection: "connections",
    id,
    data: {
      id,
      eventId,
      participantIds: pair,
      requesterId: pair[0],
      recipientId: pair[1],
      sharedInterests: getTestSharedInterests(
        participantById.get(pair[0]).interests,
        participantById.get(pair[1]).interests
      ),
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
    },
  })
  for (const id of pair) connectionCounts.set(id, connectionCounts.get(id) + 1)
}
for (const document of documents.filter(
  (item) => item.collection === "participantSummaries"
)) {
  document.data.connectionsCount = connectionCounts.get(
    document.data.participantId
  )
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
    updatedBy: "test-seed",
  },
})

// A massa inteira é construída antes da primeira operação destrutiva. Assim,
// erros de configuração ou de geração falham enquanto a base original existe.
await applyDatabaseCleanup(firestore, cleanupPlan, {
  onDeleteBatch: ({ deleted, total }) =>
    console.log(`Firestore: ${deleted}/${total} documentos removidos.`),
  onDirectoryCleared: ({ displayPath }) =>
    console.log(`Diretório esvaziado: ${displayPath}.`),
})
await writeDocuments(firestore, documents, {
  onBatchCommitted: ({ written, total }) =>
    console.log(`Seed: ${written}/${total} documentos gravados.`),
})
console.log(`Base de testes recriada: ${documents.length} documentos gravados.`)

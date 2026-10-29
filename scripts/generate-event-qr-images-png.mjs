/**
 * Gera uma arte PNG individual em tamanho A6 para cada QR Code público ativo
 * de empresa, tag e missão com validação por QR do EVENT_ID configurado.
 *
 * O comando apenas consulta o Firestore; ele não altera documentos. Os PNGs
 * são salvos em artifacts/qr com nomes como empresa-nome.png,
 * tag-nome.png e missao-nome.png. O arquivo qr-links.json contém as URLs curtas
 * dos itens ativos desta geração.
 *
 * Para executar com as variáveis de .env.local:
 *   node --env-file=.env.local scripts/generate-event-qr-images-png.mjs
 *
 * Antes de imprimir, confira no resumo exibido pelo terminal a origem formada
 * por NEXT_PUBLIC_APP_URL e teste ao menos um QR Code de cada categoria.
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { cert, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import QRCode from "qrcode"
import sharp from "sharp"

import { EVENT_QR_PRINT_STYLE } from "./lib/event-qr-print-style.mjs"
import { getFirestoreCollectionName } from "./lib/firestore-admin.mjs"
import { buildStaticQrPath } from "./lib/static-qr-code.mjs"

const OUTPUT_DIRECTORY = path.resolve("artifacts/qr")
const LINKS_FILE = path.join(OUTPUT_DIRECTORY, "qr-links.json")
const PAGE_WIDTH = 1050
const PAGE_HEIGHT = 1480
const PAGE_BORDER = 36
const INNER_INSET = 18
const QR_MAX_SIZE = 760
const QR_QUIET_ZONE = 4

function requireEnvironment(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function slugify(value) {
  return value
    .replace(/\s*\(Teste\)\s*$/iu, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function drawQrCode(value) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" })
  const moduleCount = qr.modules.size
  const totalModules = moduleCount + QR_QUIET_ZONE * 2
  const moduleSize = Math.floor(QR_MAX_SIZE / totalModules)
  const renderedSize = totalModules * moduleSize
  const offsetX = Math.floor((PAGE_WIDTH - renderedSize) / 2)
  const offsetY = 330
  const rectangles = []

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (!qr.modules.get(row, column)) continue
      const x = offsetX + (column + QR_QUIET_ZONE) * moduleSize
      const y = offsetY + (row + QR_QUIET_ZONE) * moduleSize
      rectangles.push(
        `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}"/>`
      )
    }
  }

  return {
    markup: rectangles.join(""),
    background: {
      x: offsetX,
      y: offsetY,
      size: renderedSize,
    },
  }
}

function buildSvg({ label, name, url }) {
  const qr = drawQrCode(url)
  const titleSize = name.length > 34 ? 48 : name.length > 24 ? 56 : 64
  const style = EVENT_QR_PRINT_STYLE

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="105mm" height="148mm" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">\n` +
    `  <rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="${style.background}"/>\n` +
    `  <rect x="${PAGE_BORDER}" y="${PAGE_BORDER}" width="${PAGE_WIDTH - PAGE_BORDER * 2}" height="${PAGE_HEIGHT - PAGE_BORDER * 2}" rx="32" fill="none" stroke="${style.primary}" stroke-width="12"/>\n` +
    `  <rect x="${PAGE_BORDER + INNER_INSET}" y="${PAGE_BORDER + INNER_INSET}" width="${PAGE_WIDTH - (PAGE_BORDER + INNER_INSET) * 2}" height="${PAGE_HEIGHT - (PAGE_BORDER + INNER_INSET) * 2}" rx="24" fill="none" stroke="${style.secondary}" stroke-width="4"/>\n\n` +
    `  <text x="${PAGE_WIDTH / 2}" y="142" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" letter-spacing="5" fill="${style.primary}">${escapeXml(label.toUpperCase())}</text>\n` +
    `  <text x="${PAGE_WIDTH / 2}" y="235" text-anchor="middle" font-family="Arial, sans-serif" font-size="${titleSize}" font-weight="700" fill="${style.text}">${escapeXml(name)}</text>\n\n` +
    `  <rect x="${qr.background.x}" y="${qr.background.y}" width="${qr.background.size}" height="${qr.background.size}" rx="16" fill="${style.background}"/>\n` +
    `  <g fill="${style.qr}" shape-rendering="crispEdges">${qr.markup}</g>\n\n` +
    `  <text x="${PAGE_WIDTH / 2}" y="1260" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="${style.text}">Escaneie com o app</text>\n` +
    `  <text x="${PAGE_WIDTH / 2}" y="1320" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" fill="${style.mutedText}">DevFest Triângulo 2026</text>\n` +
    `</svg>\n`
  )
}

const eventId = requireEnvironment("EVENT_ID")
const appUrl = new URL(requireEnvironment("NEXT_PUBLIC_APP_URL"))

if (!["http:", "https:"].includes(appUrl.protocol)) {
  throw new Error(
    `NEXT_PUBLIC_APP_URL must use HTTP or HTTPS: ${appUrl.toString()}`
  )
}

const firebaseApp = initializeApp({
  credential: cert({
    projectId: requireEnvironment("FB_ADMIN_PROJECT_ID"),
    clientEmail: requireEnvironment("FB_ADMIN_CLIENT_EMAIL"),
    privateKey: requireEnvironment("FB_ADMIN_PRIVATE_KEY").replace(
      /\\n/g,
      "\n"
    ),
  }),
})
const firestore = getFirestore(firebaseApp)

async function loadGroup({
  collection,
  routeType,
  fileType,
  label,
  titleField,
  filter = () => true,
}) {
  const snapshots = await firestore
    .collection(getFirestoreCollectionName(collection))
    .where("eventId", "==", eventId)
    .get()

  return snapshots.docs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((item) => item.active && item.qrId && filter(item))
    .sort((first, second) =>
      String(first[titleField]).localeCompare(
        String(second[titleField]),
        "pt-BR"
      )
    )
    .map((item) => {
      const name = String(item[titleField])
      const url = new URL(
        buildStaticQrPath(routeType, item.qrId),
        appUrl
      ).toString()

      return {
        id: item.id,
        type: routeType,
        label,
        name,
        url,
        filename: `${fileType}-${slugify(name)}.png`,
      }
    })
}

const groups = await Promise.all([
  loadGroup({
    collection: "companies",
    routeType: "company",
    fileType: "empresa",
    label: "Empresa",
    titleField: "name",
  }),
  loadGroup({
    collection: "tags",
    routeType: "tag",
    fileType: "tag",
    label: "Tag",
    titleField: "name",
  }),
  loadGroup({
    collection: "missions",
    routeType: "mission",
    fileType: "missao",
    label: "Missão",
    titleField: "title",
    filter: (mission) => mission.validationType === "qr",
  }),
])

const items = groups.flat()
const uniqueUrls = new Set(items.map((item) => item.url))
const uniqueFilenames = new Set(items.map((item) => item.filename))

if (uniqueUrls.size !== items.length) {
  throw new Error("Duplicate QR Code URLs were found")
}

if (uniqueFilenames.size !== items.length) {
  throw new Error("Duplicate QR Code filenames were found")
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true })

for (const item of items) {
  const svg = buildSvg(item)
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
  await writeFile(path.join(OUTPUT_DIRECTORY, item.filename), pngBuffer)
}

const links = items.map(({ id, type, name, filename, url }) => ({
  id,
  type,
  name,
  filename,
  url,
}))

await writeFile(LINKS_FILE, `${JSON.stringify(links, null, 2)}\n`, "utf8")

console.log(
  JSON.stringify(
    {
      outputDirectory: OUTPUT_DIRECTORY,
      appUrl: appUrl.origin,
      generated: items.length,
      counts: groups.map((group) => group.length),
    },
    null,
    2
  )
)

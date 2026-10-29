import { readFile } from "node:fs/promises"
import path from "node:path"
import { parseEnv } from "node:util"

/**
 * @param {{ directory?: string, local?: boolean, mobile?: boolean, inherited?: Record<string, string | undefined> }} [options]
 * @returns {Promise<Record<string, string | undefined>>}
 */
export async function loadQrPrintEnvironment({
  directory = process.cwd(),
  local = false,
  mobile = false,
  inherited = process.env,
} = {}) {
  if (local && mobile)
    throw new Error("Use apenas um dos flags: --local ou --mobile")
  const files = mobile
    ? [".env.local", ".env.mobile"]
    : [local ? ".env.local" : ".env"]
  const selected = {}
  for (const file of files)
    Object.assign(
      selected,
      parseEnv(await readFile(path.join(directory, file), "utf8"))
    )
  const mode = selected.DEVMODE?.trim().toLowerCase()
  if (mode !== "true" && mode !== "false")
    throw new Error(
      "Defina DEVMODE=true ou DEVMODE=false explicitamente no arquivo selecionado"
    )
  if ((local || mobile) && mode !== "true")
    throw new Error("Produção deve usar .env, sem mesclar .env.local")
  for (const name of [
    "NEXT_PUBLIC_APP_URL",
    "EVENT_ID",
    "FB_ADMIN_PROJECT_ID",
    "FB_ADMIN_CLIENT_EMAIL",
    "FB_ADMIN_PRIVATE_KEY",
  ]) {
    if (!selected[name]?.trim())
      throw new Error(`Defina ${name} no arquivo selecionado`)
  }
  if (
    mode === "false" &&
    selected.FB_ADMIN_PROJECT_ID !== "devfest-triangulo-2026"
  )
    throw new Error("O projeto de produção deve ser devfest-triangulo-2026")
  const url = new URL(selected.NEXT_PUBLIC_APP_URL)
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "NEXT_PUBLIC_APP_URL deve ser uma URL HTTP ou HTTPS sem credenciais, parâmetros ou fragmento"
    )
  return { ...inherited, ...selected, DEVMODE: mode }
}

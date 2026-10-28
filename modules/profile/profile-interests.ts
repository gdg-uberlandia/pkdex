import * as z from "zod"

import { skills } from "@/data/skills"

const AREA_INTERESTS = [
  { id: "ai", label: "Inteligência artificial" },
  { id: "cloud", label: "Cloud" },
  { id: "web", label: "Desenvolvimento web" },
  { id: "mobile", label: "Mobile" },
  { id: "data", label: "Dados" },
  { id: "security", label: "Segurança" },
  { id: "accessibility", label: "Acessibilidade" },
  { id: "career", label: "Carreira" },
  { id: "open-source", label: "Open source" },
  { id: "entrepreneurship", label: "Empreendedorismo" },
  { id: "design", label: "Design e produto" },
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "devops", label: "DevOps e SRE" },
  { id: "testing", label: "QA (Testes e qualidade)" },
  { id: "architecture", label: "Arquitetura de software" },
  { id: "databases", label: "Bancos de dados" },
  { id: "generative-ai", label: "IA generativa" },
  { id: "machine-learning", label: "Machine learning" },
  { id: "iot", label: "Internet das coisas" },
  { id: "games", label: "Desenvolvimento de jogos" },
  { id: "automation", label: "Automação" },
  { id: "leadership", label: "Liderança técnica" },
  { id: "communities", label: "Comunidades de tecnologia" },
  { id: "education", label: "Educação e mentoria" },
  { id: "agile", label: "Métodos ágeis" },
  { id: "observability", label: "Observabilidade" },
  { id: "performance", label: "Performance" },
  { id: "privacy", label: "Privacidade e proteção de dados" },
] as const

export const MAX_PROFILE_INTERESTS = 10

const LEGACY_EQUIVALENTS: Record<string, string> = {
  "front-end": "frontend",
  "back-end": "backend",
  "banco-de-dados": "databases",
  "inteligencia-artificial": "ai",
  dados: "data",
  qa: "testing",
  "testes-de-software": "testing",
  "ui-ux": "design",
  automacao: "automation",
  lideranca: "leadership",
  "metodologias-ageis": "agile",
  observability: "observability",
}

export const INTERESTS: readonly { id: string; label: string }[] = [
  ...AREA_INTERESTS,
  ...skills
    .filter(
      ({ slug }) =>
        !LEGACY_EQUIVALENTS[slug] &&
        !AREA_INTERESTS.some(({ id }) => id === slug)
    )
    .map(({ slug, name }) => ({ id: slug, label: name })),
]

export function getProfileInterests(profile: {
  interests?: readonly string[]
  skills?: readonly string[]
}): string[] {
  return [
    ...new Set(
      [...(profile.interests ?? []), ...(profile.skills ?? [])]
        .map((id) => LEGACY_EQUIVALENTS[id] ?? id)
        .filter((id) => INTERESTS.some((interest) => interest.id === id))
    ),
  ]
}

export const interestsSchema = z
  .array(
    z
      .string()
      .refine(
        (id) => INTERESTS.some((interest) => interest.id === id),
        "Selecione um interesse válido"
      )
  )
  .max(MAX_PROFILE_INTERESTS, "Selecione no máximo 10 áreas de interesse")
  .refine(
    (items) => new Set(items).size === items.length,
    "Não repita interesses"
  )

export function sharedInterests(
  first: string[] = [],
  second: string[] = []
): string[] {
  return INTERESTS.filter(
    ({ id }) => first.includes(id) && second.includes(id)
  ).map(({ id }) => id)
}

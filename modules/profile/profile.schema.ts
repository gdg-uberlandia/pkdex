import * as z from "zod"

import { interestsSchema } from "./profile-interests"
import { isValidSkillSlug } from "./profile-skills"

export const ACCESS_ROLES = [
  "participant",
  "staff",
  "reviewer",
  "sponsor",
  "editor",
  "admin",
] as const

export const accessRoleSchema = z.enum(ACCESS_ROLES)

export const accessRolesSchema = z
  .array(accessRoleSchema)
  .length(1, "Cada perfil deve ter exatamente um papel")

export const GENDER_OPTIONS = [
  "Mulher cis",
  "Homem cis",
  "Mulher trans",
  "Homem trans",
  "Pessoa não-binária",
  "Prefiro não me identificar",
] as const

export const genderSchema = z.enum(GENDER_OPTIONS, {
  error: "Selecione uma opção de gênero",
})

const profileGenderInputSchema = z
  .union([genderSchema, z.literal("")])
  .refine((value) => value !== "", "Selecione uma opção de gênero")
  .transform((value) => genderSchema.parse(value))

export const profileIdentitySchema = z.object({
  userId: z.string().trim().min(1),
  eventId: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  email: z.string().trim().email(),
  avatarUrl: z.string().url().nullable(),
})

const optionalBioSchema = z
  .union([
    z.string().trim().max(200, "A biografia deve ter no máximo 200 caracteres"),
    z.null(),
  ])
  .transform((value) => value || null)

const optionalRoleSchema = z
  .union([
    z
      .string()
      .trim()
      .max(80, "O cargo ou atuação deve ter no máximo 80 caracteres"),
    z.null(),
  ])
  .transform((value) => value || null)

const optionalCompanySchema = z
  .union([
    z.string().trim().max(100, "A empresa deve ter no máximo 100 caracteres"),
    z.null(),
  ])
  .transform((value) => value || null)

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)

    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const linkedinUsernameSchema = z
  .string()
  .trim()
  .max(100, "O usuário do LinkedIn deve ter no máximo 100 caracteres")
  .regex(
    /^[a-zA-Z0-9-]+$/,
    "Informe apenas o nome do usuário, sem a URL do LinkedIn"
  )

const optionalLinkedinUsernameSchema = z
  .union([z.literal(""), linkedinUsernameSchema, z.null()])
  .transform((value) => value || null)

function normalizeWebsite(value: string) {
  const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
    ? value
    : `https://${value}`

  return isHttpUrl(normalized) ? normalized : null
}

const optionalWebsiteSchema = z
  .union([z.string().trim(), z.null()])
  .refine((value) => !value || normalizeWebsite(value) !== null, {
    message: "Informe um endereço de website válido",
  })
  .transform((value) => (value ? normalizeWebsite(value) : null))

const skillSchema = z
  .string()
  .trim()
  .refine(isValidSkillSlug, "Selecione uma habilidade válida")

const storedSkillsSchema = z
  .array(skillSchema)
  .max(5)
  .refine(
    (selectedSkills) =>
      selectedSkills.length === 0 || selectedSkills.length >= 3,
    "Stored profile must have no skills or at least 3 skills"
  )
  .refine(
    (selectedSkills) => new Set(selectedSkills).size === selectedSkills.length,
    "Stored profile contains duplicated skills"
  )

export const profileUpdateSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(3, "O nome deve ter no mínimo 3 caracteres"),
    gender: profileGenderInputSchema,
    bio: optionalBioSchema,
    role: optionalRoleSchema,
    company: optionalCompanySchema,
    linkedinUsername: optionalLinkedinUsernameSchema,
    website: optionalWebsiteSchema,
    skills: z.array(skillSchema).max(5).default([]),
    interests: interestsSchema.min(
      1,
      "Selecione pelo menos uma área de interesse"
    ),
  })
  .strict()

export const storedProfileFieldsSchema = z.object({
  gender: genderSchema.nullable().default(null),
  bio: z.string().trim().max(200).nullable().default(null),
  role: z.string().trim().max(80).nullable().default(null),
  company: z.string().trim().max(100).nullable().default(null),
  linkedinUsername: linkedinUsernameSchema.nullable().default(null),
  website: z
    .url()
    .refine(isHttpUrl, "Stored website must use HTTP or HTTPS")
    .nullable()
    .default(null),
  skills: storedSkillsSchema.default([]),
  interests: interestsSchema.optional(),
  accessRoles: accessRolesSchema.default(["participant"]),
  sponsorCompanyId: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[^/]+$/)
    .nullable()
    .default(null),
  ticketBalance: z.number().int().nonnegative().default(0),
  convertedXp: z.number().int().nonnegative().default(0),
  onboardingTicketGranted: z.boolean().default(false),
})

export type StoredProfileFields = z.infer<typeof storedProfileFieldsSchema>

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>

export type ProfileIdentity = z.infer<typeof profileIdentitySchema>
export type AccessRole = z.infer<typeof accessRoleSchema>

export function getLinkedinProfileUrl(username: string) {
  return `https://www.linkedin.com/in/${encodeURIComponent(username)}/`
}

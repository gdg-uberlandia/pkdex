import { describe, expect, it } from "vitest"

import {
  accessRolesSchema,
  profileUpdateSchema,
  storedProfileFieldsSchema,
} from "./profile.schema"

const baseProfile = {
  displayName: "Pessoa Participante",
  gender: "Pessoa não-binária",
  bio: "",
  role: "",
  company: "",
  linkedinUsername: "",
  website: "",
  skills: ["javascript", "typescript", "react"],
  interests: ["frontend", "react"],
}

describe("profile update schema", () => {
  it("accepts a single interest without requiring skills", () => {
    const { skills: _skills, ...input } = baseProfile
    expect(
      profileUpdateSchema.parse({ ...input, interests: ["career"] }).skills
    ).toEqual([])
    expect(
      profileUpdateSchema.safeParse({ ...input, interests: [] }).success
    ).toBe(false)
  })
  it("requires a gender option", () => {
    expect(
      profileUpdateSchema.safeParse({ ...baseProfile, gender: "" }).success
    ).toBe(false)
  })

  it("accepts only the LinkedIn username", () => {
    expect(
      profileUpdateSchema.safeParse({
        ...baseProfile,
        linkedinUsername: "heldsonluiz",
      }).success
    ).toBe(true)
    expect(
      profileUpdateSchema.safeParse({
        ...baseProfile,
        linkedinUsername: "https://www.linkedin.com/in/heldsonluiz",
      }).success
    ).toBe(false)
  })

  it("adds HTTPS to a website without a protocol", () => {
    const result = profileUpdateSchema.parse({
      ...baseProfile,
      website: "www.meu-website.com",
    })

    expect(result.website).toBe("https://www.meu-website.com")
  })
})

it("requires exactly one role and prevents public updates of sponsor affiliation", () => {
  expect(accessRolesSchema.parse(["sponsor"])).toEqual(["sponsor"])
  expect(accessRolesSchema.safeParse(["sponsor", "reviewer"]).success).toBe(
    false
  )
  expect(
    profileUpdateSchema.safeParse({
      ...baseProfile,
      sponsorCompanyId: "company-a",
    }).success
  ).toBe(false)
  expect(
    profileUpdateSchema.safeParse({ ...baseProfile, accessRoles: ["sponsor"] })
      .success
  ).toBe(false)
  expect(storedProfileFieldsSchema.parse({}).sponsorCompanyId).toBeNull()
})

import { describe, expect, it } from "vitest"

import {
  noticeInputSchema,
  noticeSchema,
  pushSubscriptionSchema,
} from "./notice.schema"

const input = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  title: "Aviso do evento",
  body: "Avaliações liberadas",
  link: "/talks",
  sendPush: true,
}
describe("notice contracts", () => {
  it("reads published notices without exposing delivery metadata", () => {
    const notice = noticeSchema.parse({
      ...input,
      eventId: "event",
      createdAt: "2026-10-17T12:00:00.000Z",
      createdBy: "admin",
      pushStatus: "completed",
      sent: 10,
    })
    expect(notice.title).toBe(input.title)
    expect(notice).not.toHaveProperty("createdBy")
    expect(notice).not.toHaveProperty("sent")
  })
  it("accepts internal destinations and optional links", () => {
    expect(noticeInputSchema.parse(input).link).toBe("/talks")
    expect(noticeInputSchema.parse({ ...input, link: "" }).link).toBe("")
  })
  it("rejects external destinations, invalid ids and privileged fields", () => {
    for (const link of [
      "https://example.com",
      "//example.com",
      "/\\example.com",
      "/talks /detail",
    ]) {
      expect(noticeInputSchema.safeParse({ ...input, link }).success).toBe(
        false
      )
    }
    expect(
      noticeInputSchema.safeParse({ ...input, eventId: "another-event" })
        .success
    ).toBe(false)
    expect(
      noticeInputSchema.safeParse({ ...input, id: "../profile" }).success
    ).toBe(false)
  })
  it("only accepts subscriptions to supported HTTPS push providers", () => {
    const keys = { p256dh: "a".repeat(87), auth: "b".repeat(22) }
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
    ])
      expect(pushSubscriptionSchema.safeParse({ endpoint, keys }).success).toBe(
        true
      )
    for (const endpoint of [
      "http://fcm.googleapis.com/abc",
      "https://localhost/abc",
      "https://fcm.googleapis.com.evil.test/abc",
      "https://user@fcm.googleapis.com/abc",
      "https://fcm.googleapis.com:8080/abc",
    ])
      expect(pushSubscriptionSchema.safeParse({ endpoint, keys }).success).toBe(
        false
      )
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/abc",
        keys,
        userId: "other",
      }).success
    ).toBe(false)
  })
})

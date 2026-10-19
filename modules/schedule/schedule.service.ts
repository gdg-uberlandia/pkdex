import "server-only"

import type { Session } from "next-auth"

import { requireProfileForSession } from "@/modules/profile/profile.service"
import {
  findActiveTalks,
  findVisibleSpeakers,
} from "@/modules/talks/talk.repository"

import { findActiveSchedule, isSchedulePublished } from "./schedule.repository"
import { type ScheduleEntry, scheduleTrackSchema } from "./schedule.schema"

export type ScheduleItem = ScheduleEntry & {
  title: string
  description: string | null
  speakerNames: string[]
}

export async function listScheduleForSession(
  session: Session
): Promise<ScheduleItem[]> {
  const profile = await requireProfileForSession(session)
  if (!(await isSchedulePublished(profile.eventId))) return []
  const [schedule, talks, speakers] = await Promise.all([
    findActiveSchedule(profile.eventId),
    findActiveTalks(profile.eventId),
    findVisibleSpeakers(profile.eventId),
  ])
  const talkMap = new Map(talks.map((talk) => [talk.id, talk]))
  const speakerMap = new Map(
    speakers.map((speaker) => [speaker.id, speaker.name])
  )
  return schedule
    .map((entry) => {
      const talk =
        "talkId" in entry.activity
          ? talkMap.get(entry.activity.talkId)
          : undefined
      return {
        ...entry,
        title:
          "title" in entry.activity
            ? entry.activity.title
            : (talk?.title ?? "Palestra indisponível"),
        description: talk?.description ?? null,
        speakerNames:
          talk?.speakerIds.flatMap((id) =>
            speakerMap.has(id) ? [speakerMap.get(id)!] : []
          ) ?? [],
      }
    })
    .sort(
      (a, b) =>
        a.startAt.getTime() - b.startAt.getTime() ||
        a.endAt.getTime() - b.endAt.getTime() ||
        (a.track === null ? -1 : scheduleTrackSchema.options.indexOf(a.track)) -
          (b.track === null ? -1 : scheduleTrackSchema.options.indexOf(b.track))
    )
}

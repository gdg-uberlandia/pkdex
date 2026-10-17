import { redirect } from "next/navigation"

import { isPushEnabled } from "@/modules/notices/push-config"
import { PushOnboardingPrompt } from "@/modules/notices/push-onboarding-prompt"

export const metadata = { title: "Permitir notificações" }
export default function EnableNotificationsPage() {
  if (!isPushEnabled() || !process.env.VAPID_PUBLIC_KEY) redirect("/home")
  return <PushOnboardingPrompt />
}

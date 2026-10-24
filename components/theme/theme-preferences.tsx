import { Palette } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { ThemeSelector } from "./theme-selector"

export function ThemePreferences() {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-5 text-primary" aria-hidden="true" />
          Aparência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">
          Escolha como o aplicativo deve aparecer neste dispositivo.
        </p>
        <ThemeSelector />
      </CardContent>
    </Card>
  )
}

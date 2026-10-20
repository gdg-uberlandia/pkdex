import { Ghost, Sparkles } from "lucide-react"
import type { ReactNode } from "react"

import { IS_HALLOWEEN } from "@/config/seasonal-theme"

import styles from "./halloween.module.css"
import {
  HalloweenBat,
  HalloweenGhost,
  HalloweenPumpkin,
  HalloweenSkeleton,
  HalloweenWeb,
} from "./halloween-ornaments"

export function SeasonalLabel() {
  if (!IS_HALLOWEEN) return null
  return (
    <div className={styles.seasonLabel}>
      <span>
        <Sparkles className="size-3" aria-hidden="true" />
        Edição Halloween
      </span>
      <HalloweenBat className={styles.bat} />
    </div>
  )
}
export function SeasonalCardDecoration() {
  if (!IS_HALLOWEEN) return null
  return <HalloweenWeb className={styles.web} />
}
export function SeasonalNotificationDecoration() {
  if (!IS_HALLOWEEN) return null
  return <Ghost className={styles.headerGhost} aria-hidden="true" />
}
export function SeasonalNavigation({ children }: { children: ReactNode }) {
  if (!IS_HALLOWEEN) return children
  return (
    <div className="relative">
      <HalloweenBat className={styles.scannerBat} />
      {children}
    </div>
  )
}

export function SeasonalPageDecorations() {
  if (!IS_HALLOWEEN) return null
  return (
    <div className={styles.pageAccent} aria-hidden="true">
      <HalloweenGhost className={styles.pageGhost} />
      <HalloweenBat className={styles.pageBat} />
      <span />
      <HalloweenPumpkin className={styles.pagePumpkin} />
      <HalloweenBat className={styles.pageBatSmall} />
      <HalloweenWeb className={styles.pageWeb} />
    </div>
  )
}

export function SeasonalDivider() {
  if (!IS_HALLOWEEN) return null
  return (
    <div className={styles.divider} aria-hidden="true">
      <span />
      <HalloweenSkeleton className={styles.dividerSkeleton} />
      <HalloweenGhost className={styles.dividerGhost} />
      <HalloweenPumpkin className={styles.dividerPumpkin} />
      <span />
    </div>
  )
}

export function SeasonalPageFooter() {
  if (!IS_HALLOWEEN) return null
  return (
    <div className={styles.pageFooter} aria-hidden="true">
      <HalloweenBat className={styles.pageBatSmall} />
      <HalloweenSkeleton className={styles.footerSkeleton} />
      <HalloweenPumpkin className={styles.dividerPumpkin} />
      <HalloweenGhost className={styles.dividerGhost} />
      <HalloweenBat className={styles.pageBatSmall} />
    </div>
  )
}

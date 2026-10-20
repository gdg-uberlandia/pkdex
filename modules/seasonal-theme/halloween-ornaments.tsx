export function HalloweenBat({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 50"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M43 18 46 8l5 6 5-6 3 10C76 7 90 13 99 30c-12-4-18 0-21 10-10-7-20-5-27 6-8-11-18-13-28-6-3-10-9-14-21-10C11 13 25 7 43 18Z" />
    </svg>
  )
}
export function HalloweenWeb({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      className={className}
      aria-hidden="true"
    >
      <path d="M100 0 0 100M100 0 0 42M100 0 58 100M100 0v100M100 0H0M77 0q0 24 23 23M53 0q0 48 47 47M29 0q0 72 71 71M5 0q0 96 95 95M78 9q-17 6-14 27M56 18q-25 12-20 46M33 28Q0 48 9 91M91 22q-5 19-27 14M82 44q-11 29-46 20M72 66Q55 108 9 91" />
    </svg>
  )
}

export function HalloweenGhost({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 56 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 29C10 4 46 4 46 29v25l-9-6-9 8-9-8-9 6V29Z"
        fill="#EDE4FF"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <ellipse cx="22" cy="29" rx="3" ry="4" fill="currentColor" />
      <ellipse cx="35" cy="29" rx="3" ry="4" fill="currentColor" />
      <path
        d="M25 39q4 4 8 0M11 34 5 30m40 4 6-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function HalloweenPumpkin({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M31 16q-5-10 5-13"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M32 17C7 5-2 46 19 55q7 3 13-1c6 4 11 3 16 0 20-12 10-49-16-37Z"
        fill="#FF8A25"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M28 17c-10 9-10 26 0 37m8-37c10 9 10 26 0 37"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity=".45"
      />
      <path
        d="m14 31 11-3-2 8Zm36 0-11-3 2 8ZM19 42l8 4 5-3 5 3 8-4-5 9H24Z"
        fill="#3A183A"
      />
    </svg>
  )
}

export function HalloweenSkeleton({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M18 18C18 1 46 1 46 18q0 10-8 12v7H26v-7q-8-2-8-12Z"
        fill="#EDE4FF"
      />
      <circle cx="26" cy="19" r="3" fill="currentColor" stroke="none" />
      <circle cx="38" cy="19" r="3" fill="currentColor" stroke="none" />
      <path d="m32 24-2 3h4Zm-3 7v5m6-5v5M32 38v30M23 42q9 7 18 0M21 49q11 8 22 0M24 57q8 6 16 0M23 66l9 8 9-8M22 41 10 51 5 43m37-2 12 10 5-8M26 73l-7 13 3 10m16-23 7 13-3 10M16 97h10m12 0h10" />
    </svg>
  )
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
})
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Sao_Paulo",
})

export function NoticeTimestamp({ value }: { value: string }) {
  const date = new Date(value)
  const fullDate = date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  })
  return (
    <time
      dateTime={value}
      title={fullDate}
      aria-label={fullDate}
      className="text-tiny font-medium tabular-nums"
    >
      {dateFormatter.format(date)} · {timeFormatter.format(date)}
    </time>
  )
}

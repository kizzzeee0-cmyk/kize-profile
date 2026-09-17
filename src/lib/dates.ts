export const toDateKey = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const monthLabel = (date: Date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`

export const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export const formatShortDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export const formatTime = (value: string | null) => value ? value.slice(0, 5) : '-'

export const getMonthGrid = (month: Date) => {
  const y = month.getFullYear()
  const m = month.getMonth()
  const first = new Date(y, m, 1)
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cellsNeeded = first.getDay() + daysInMonth
  // Do not add a needless sixth week. Only months that genuinely require it use 42 cells.
  const cellCount = cellsNeeded <= 35 ? 35 : 42
  const start = new Date(y, m, 1 - first.getDay())
  return Array.from({ length: cellCount }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return date
  })
}

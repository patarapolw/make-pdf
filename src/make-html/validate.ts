import dayjs from 'dayjs'

export function validateTag (tag: string[]): string[] | null {
  if (Array.isArray(tag) && tag.every((t) => typeof t === 'string')) {
    return tag
  }

  return null
}

export function validateDate (date: string): string | null {
  if (typeof date !== 'string') return null
  if (/^\d+(\.\d+)?$/.test(date)) return null

  const dateFormat = 'YYYY-MM-DDTHH:mm:ssZ'
  // const dateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZ'
  let d: dayjs.Dayjs

  d = dayjs(date, [
    'YYYY-MM-DD',
    'YYYY-MM-DD H:mm',
    'YYYY-MM-DD HH:mm',
    'YYYY-MM-DDTHH:mm'
  ])

  if (d.isValid()) {
    return d
      .subtract(new Date().getTimezoneOffset(), 'minute')
      .format(dateFormat)
  }

  d = dayjs(date)

  if (d.isValid()) return d.format(dateFormat)

  return null
}

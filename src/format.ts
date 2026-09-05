const dtCache = new Map<string, Intl.DateTimeFormat>()
const numCache = new Map<string, Intl.NumberFormat>()

function cacheKey(locale: string, options?: object): string {
  return locale + '\u0000' + (options ? JSON.stringify(options) : '')
}

/**
 * 区域化日期格式化（Intl 实例按 locale + 选项缓存）
 */
export function formatDate(date: Date | number, locale: string, options?: Intl.DateTimeFormatOptions): string {
  const key = cacheKey(locale, options)
  let fmt = dtCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options)
    dtCache.set(key, fmt)
  }
  return fmt.format(date)
}

/**
 * 区域化数字格式化（Intl 实例按 locale + 选项缓存）
 */
export function formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  const key = cacheKey(locale, options)
  let fmt = numCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options)
    numCache.set(key, fmt)
  }
  return fmt.format(value)
}

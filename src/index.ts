import { signal } from "compelem";
import { each, isObject, isString } from "myfx";
import { registerI18nDevtools } from "./devtools";
import { formatDate, formatNumber } from "./format";
import { interpolate, localeChain, resolvePlural, resolveString } from "./message";
import type { I18nOptions, LocaleMessages, MessageSchema, Path } from "./types";

export type { I18nOptions, LocaleMessages, MessageSchema, Path } from "./types";

export const version = __APP_VERSION__

/** 语言切换回调参数：(newLocale, oldLocale) */
export type LocaleChangeCallback = (locale: string, oldLocale: string) => void

/** t() 的参数：数字触发 ICU 复数；对象做 {name} 插值，含 count 属性时同时触发复数 */
export type TranslateParams = Record<string, unknown>

// 非打包器环境下不产生 dev 警告；打包器场景遵循 process.env.NODE_ENV（主流库惯例）
const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'

function warn(msg: string) {
  if (isDev) console.warn(msg)
}

function defaultLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  return 'en'
}

function deepMergeMessage(target: LocaleMessages, src: LocaleMessages) {
  each(src, (v, k) => {
    const t = (target as Record<string, unknown>)[k]
    if (isObject(v) && !isString(v) && isObject(t) && !isString(t)) {
      deepMergeMessage(t as LocaleMessages, v as LocaleMessages)
    } else {
      ; (target as Record<string, unknown>)[k] = v
    }
  })
}

/**
 * i18n 实例
 */
export class I18n<S extends MessageSchema = MessageSchema> {
  #localeSig = signal(defaultLocale())
  #fallbackLocale?: string
  #messages: Record<string, LocaleMessages>
  #datetimeFormats: Record<string, Record<string, Intl.DateTimeFormatOptions>>
  #numberFormats: Record<string, Record<string, Intl.NumberFormatOptions>>
  #syncDocumentLang: boolean
  #listeners = new Set<LocaleChangeCallback>()

  constructor(options: I18nOptions<S>) {
    this.#messages = (options.messages ?? {}) as Record<string, LocaleMessages>
    this.#fallbackLocale = options.fallbackLocale
    this.#datetimeFormats = options.datetimeFormats ?? {}
    this.#numberFormats = options.numberFormats ?? {}
    this.#syncDocumentLang = options.syncDocumentLang !== false
    if (options.locale) this.#localeSig.value = options.locale
    if (this.#syncDocumentLang && typeof document !== 'undefined') {
      document.documentElement.lang = this.#localeSig.value
    }
  }

  /** 当前语言。赋值等价于 setLocale() */
  get locale(): string {
    return this.#localeSig.value
  }

  set locale(v: string) {
    this.setLocale(v)
  }

  get fallbackLocale(): string | undefined {
    return this.#fallbackLocale
  }

  get availableLocales(): string[] {
    return Object.keys(this.#messages)
  }

  /**
   * 翻译
   * @param key 消息键，点路径与嵌套对象等价
   * @param params 数字触发 ICU 复数；对象做 {name} 插值，含 count 属性时同时触发复数
   * @returns 翻译结果；键完全未命中时返回 key 本身（dev 下告警）
   */
  t(key: Path<S> | (string & {}), params?: TranslateParams | number): string {
    return this.#translate(key as string, params)
  }

  /** 区域化日期，格式键取自 datetimeFormats[locale] */
  d(date: Date | number, formatKey?: string): string {
    return formatDate(date, this.#localeSig.value, this.#getFormat(this.#datetimeFormats, formatKey, 'datetime'))
  }

  /** 区域化数字，格式键取自 numberFormats[locale] */
  n(value: number, formatKey?: string): string {
    return formatNumber(value, this.#localeSig.value, this.#getFormat(this.#numberFormats, formatKey, 'number'))
  }

  /**
   * 切换语言
   */
  setLocale(locale: string) {
    if (!locale || locale === this.#localeSig.value) return
    const old = this.#localeSig.value
    this.#localeSig.value = locale
    this.#listeners.forEach(cbk => cbk(locale, old))
    if (this.#syncDocumentLang && typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }

  /** 懒加载：深合并语言包（fetch 后调用即可） */
  mergeLocaleMessage(locale: string, messages: LocaleMessages) {
    if (!locale || !messages) return
    let target = this.#messages[locale]
    if (!target) {
      target = this.#messages[locale] = {}
    }
    deepMergeMessage(target, messages)
  }

  getLocaleMessage(locale: string): LocaleMessages {
    return this.#messages[locale] ?? {}
  }

  /** 监听语言切换，返回取消监听函数 */
  onLocaleChange(cbk: LocaleChangeCallback): () => void {
    this.#listeners.add(cbk)
    return () => this.#listeners.delete(cbk)
  }

  #getFormat(
    map: Record<string, Record<string, any>>,
    formatKey: string | undefined,
    kind: string
  ): Record<string, any> | undefined {
    if (!formatKey) return undefined
    const chain = localeChain(this.#localeSig.value, this.#fallbackLocale)
    for (const loc of chain) {
      const opts = map[loc]?.[formatKey]
      if (opts) return opts
    }
    warn(`[compelem-i18n] ${kind} format '${formatKey}' not found for locale '${this.#localeSig.value}'`)
    return undefined
  }

  #translate(key: string, params?: TranslateParams | number): string {
    let count: number | undefined
    let interp: TranslateParams | undefined
    if (typeof params === 'number') {
      count = params
    } else if (params) {
      interp = params
      if (typeof params.count === 'number') count = params.count
    }
    if (count !== undefined) {
      interp = { ...interp, count }
    }

    const chain = localeChain(this.#localeSig.value, this.#fallbackLocale)
    let msg: string | undefined
    if (count !== undefined) {
      for (const loc of chain) {
        msg = resolvePlural(this.#messages[loc], key, count, loc)
        if (msg !== undefined) break
      }
    } else {
      for (const loc of chain) {
        msg = resolveString(this.#messages[loc], key)
        if (msg !== undefined) break
      }
    }

    if (msg === undefined) {
      warn(`[compelem-i18n] message not found: '${key}' (locale: ${this.#localeSig.value})`)
      return key
    }
    return interpolate(msg, interp)
  }
}

/**
 * 创建 i18n 实例。
 * 传入泛型 S（消息 schema 类型）可获得 t() 键名的点路径自动补全与拼写检查，
 * 未指定时 key 保持 string 全兼容。
 */
export function createI18n<S extends MessageSchema = MessageSchema>(options: I18nOptions<S>): I18n<S> {
  const instance = new I18n<S>(options)
  // devtools 接入点：未安装 devtools 时这里只是往 globalThis 挂一个惰性 provider
  registerI18nDevtools(instance)
  return instance
}

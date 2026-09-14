/**
 * compelem-i18n × compelem-devtools 接入点。
 *
 * 设计约束（与 compelem-store / compelem-router 的接入点保持同一套约定）：
 * - **零依赖、零副作用**：未安装 devtools 时这里只是往 globalThis 上挂一个对象，
 *   不注册监听、不持有额外引用。
 * - **无环依赖**：本文件只 import `./message` 与 `./types`，**不 import `./index`**。
 *   接入对象以结构化类型描述（`I18nDevtoolsLike`），由 `createI18n` 传入实例，
 *   因此 index.ts → devtools.ts → message.ts 单向，不构成循环。
 * - **零开销**：只有被读取时才走 `getLocaleMessage()` 等公开接口；订阅走公开的
 *   `onLocaleChange()`，面板没打开时 `#listeners` 始终为空。
 * - **不改动 t() 语义**：`resolve()` 用包内 `localeChain` / `resolveString` /
 *   `resolvePlural` / `interpolate` **复刻**查找链，只回报命中在回退链的哪一环，
 *   不 patch 实例方法、不产生额外订阅。
 *
 * 契约：`globalThis.__COMPELEM_ECOSYSTEM__.i18n`
 * 三个生态库共用同一个 globalThis 槽位，各自占一个命名空间键。
 */

import { interpolate, localeChain, resolvePlural, resolveString } from "./message";
import type { LocaleMessages } from "./types";

export const ECOSYSTEM_KEY = '__COMPELEM_ECOSYSTEM__'

/**
 * 接入点只需要实例的这几个公开成员。
 * 用结构化类型而非 import I18n，既解耦又避免循环依赖。
 */
export interface I18nDevtoolsLike {
  readonly locale: string
  readonly fallbackLocale: string | undefined
  readonly availableLocales: string[]
  getLocaleMessage(locale: string): LocaleMessages
  setLocale(locale: string): void
  mergeLocaleMessage(locale: string, messages: LocaleMessages): void
  onLocaleChange(cb: (locale: string, oldLocale: string) => void): () => void
}

/** 一次 key 解析的结果，含回退链定位信息 */
export interface I18nResolveResult {
  key: string
  /** 参与解析的语言（默认取实例当前 locale） */
  locale: string
  /** 完整回退链，如 ['zh-CN', 'zh', 'en'] */
  chain: string[]
  /** 是否命中 */
  found: boolean
  /** 命中的语言；未命中为 undefined —— 这就是"这个 key 在哪个语言包里缺了" */
  foundIn?: string
  /** 插值后的结果 */
  value?: string
  /** 插值前的原始模板（保留 {name} 占位符，便于排查缺参） */
  raw?: string
  /** 本次命中的 ICU 复数类别（仅在传入 number / 含 count 时给出） */
  pluralCategory?: string
}

export interface I18nDevtoolsEntry {
  /** 实例 id（i18n#1 / i18n#2 …），同一实例重复登记保持稳定 */
  id: string
  locale: () => string
  fallbackLocale: () => string | undefined
  /** 可用语言列表 */
  locales: () => string[]
  /** 某语言的原始消息树 */
  messages: (locale: string) => LocaleMessages
  setLocale: (locale: string) => void
  /** 深合并语言包（用于联调懒加载） */
  mergeMessages: (locale: string, messages: LocaleMessages) => void
  /**
   * 解析 key 并回报回退链定位。**读操作，无副作用**。
   * @param params 数字触发 ICU 复数；对象做 {name} 插值，含 count 时同时触发复数
   * @param locale 指定语言解析；缺省用实例当前 locale
   */
  resolve: (key: string, params?: any, locale?: string) => I18nResolveResult
  /** 语言切换订阅，返回退订函数 */
  subscribe: (cb: (locale: string, oldLocale: string) => void) => () => void
}

export interface I18nDevtoolsProvider {
  /** 全部已登记实例的 id */
  list(): string[]
  /** 按 id 取接入项 */
  entry(id: string): I18nDevtoolsEntry | undefined
  /** 便捷取第一个实例（单实例场景） */
  active(): I18nDevtoolsEntry | undefined
}

/**
 * 单例注册表：模块级 Map 而非 globalThis，保证多入口（ESM / UMD）下也只有一个。
 * devtools 只通过 provider 的方法访问它。
 */
const entries = new Map<string, I18nDevtoolsEntry>()
/** 实例 → id 记忆，保证同一实例重复 create 时 id 稳定 */
const idOf = new WeakMap<object, string>()
let seq = 0

function safePluralCategory(locale: string, count: number): string {
  try {
    return new Intl.PluralRules(locale).select(count)
  } catch {
    return 'other'
  }
}

/** 复刻 I18n#translate 的查找链，但不写入任何实例状态 */
function resolveIn(inst: I18nDevtoolsLike, key: string, params?: any, locale?: string): I18nResolveResult {
  const loc = locale || inst.locale
  const chain = localeChain(loc, inst.fallbackLocale)

  let count: number | undefined
  let interp: Record<string, unknown> | undefined
  if (typeof params === 'number') {
    count = params
  } else if (params) {
    interp = params
    if (typeof params.count === 'number') count = params.count
  }
  if (count !== undefined) interp = { ...interp, count }

  let raw: string | undefined
  let foundIn: string | undefined
  let pluralCategory: string | undefined

  if (count !== undefined) {
    for (const l of chain) {
      raw = resolvePlural(inst.getLocaleMessage(l), key, count, l)
      if (raw !== undefined) {
        foundIn = l
        pluralCategory = safePluralCategory(l, count)
        break
      }
    }
  } else {
    for (const l of chain) {
      raw = resolveString(inst.getLocaleMessage(l), key)
      if (raw !== undefined) {
        foundIn = l
        break
      }
    }
  }

  if (raw === undefined) return { key, locale: loc, chain, found: false }
  return {
    key,
    locale: loc,
    chain,
    found: true,
    foundIn,
    raw,
    value: interpolate(raw, interp),
    pluralCategory,
  }
}

/**
 * 取得（必要时创建）provider 并挂到 globalThis。
 * 保留已存在的 `__COMPELEM_ECOSYSTEM__` 对象（store / router 可能先挂上来了）。
 */
function provider(): I18nDevtoolsProvider {
  const g = globalThis as any
  const eco = (g[ECOSYSTEM_KEY] = g[ECOSYSTEM_KEY] || {})
  if (!eco.i18n) {
    const p: I18nDevtoolsProvider = {
      list: () => Array.from(entries.keys()),
      entry: (id: string) => entries.get(id),
      active: () => entries.values().next().value,
    }
    Object.defineProperty(eco, 'i18n', {
      value: p,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  return eco.i18n
}

/** 由 createI18n 内部调用：登记一个 i18n 实例 */
export function registerI18nDevtools(inst: I18nDevtoolsLike): I18nDevtoolsEntry {
  let id = idOf.get(inst as object)
  if (!id) {
    id = `i18n#${++seq}`
    idOf.set(inst as object, id)
  }
  const entry: I18nDevtoolsEntry = {
    id,
    locale: () => inst.locale,
    fallbackLocale: () => inst.fallbackLocale,
    locales: () => inst.availableLocales,
    messages: (locale: string) => inst.getLocaleMessage(locale),
    setLocale: (locale: string) => inst.setLocale(locale),
    mergeMessages: (locale: string, messages: LocaleMessages) => inst.mergeLocaleMessage(locale, messages),
    resolve: (key: string, params?: any, locale?: string) => resolveIn(inst, key, params, locale),
    subscribe: (cb: (locale: string, oldLocale: string) => void) => inst.onLocaleChange(cb),
  }
  entries.set(id, entry)
  provider()
  return entry
}

/** 摘除登记 */
export function unregisterI18nDevtools(id: string): void {
  entries.delete(id)
}

/** 清空登记 */
export function clearI18nDevtools(): void {
  entries.clear()
}

/** 供控制台 / 测试直接读取全部登记项 */
export function getI18nDevtoolsEntries(): I18nDevtoolsEntry[] {
  return Array.from(entries.values())
}

/**
 * 模块加载期即把 provider 挂到 globalThis。
 *
 * 目的是让 devtools 能区分两种「没有 i18n」：
 * - **本库未加载** → `__COMPELEM_ECOSYSTEM__.i18n` 不存在；
 * - **本库已加载但尚未 createI18n** → 命名空间在、`list()` 为空。
 *
 * 若只在 `registerI18nDevtools` 里懒挂，两者对外完全同形，面板无法给出准确提示。
 * 这里只挂一个惰性 provider 对象（不注册监听、不持有额外引用、`list()` 才求值），
 * 因此「零副作用 / 零开销」的约束依然成立。
 */
provider()

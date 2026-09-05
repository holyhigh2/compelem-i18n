import { get, isObject, isString } from "myfx";
import type { LocaleMessages } from "./types";

/** {name} 参数占位符 */
const EXP_PARAM = /\{([^{}]+)\}/g

/**
 * 按键解析消息节点：字面量键优先，其次按点路径逐级取嵌套属性
 * @param messages 语言消息表
 * @param key 消息键，如 'apple' 或 'cart.item.title'
 */
export function resolveMessage(messages: LocaleMessages | undefined, key: string): string | LocaleMessages | undefined {
  if (!messages) return undefined
  const direct = (messages as Record<string, unknown>)[key]
  if (direct !== undefined) return direct as string | LocaleMessages
  return get(messages, key) as string | LocaleMessages | undefined
}

/**
 * 解析普通字符串消息（命中嵌套对象视为未命中，交由复数逻辑处理）
 */
export function resolveString(messages: LocaleMessages | undefined, key: string): string | undefined {
  const v = resolveMessage(messages, key)
  return isString(v) ? v : undefined
}

/**
 * 语言回退链：zh-CN → zh（主标签）→ fallbackLocale → 其主标签
 */
export function localeChain(locale: string, fallbackLocale?: string): string[] {
  const chain: string[] = []
  const push = (l?: string) => {
    if (!l) return
    if (!chain.includes(l)) chain.push(l)
    const main = l.split('-')[0]
    if (main && main !== l && !chain.includes(main)) chain.push(main)
  }
  push(locale)
  push(fallbackLocale)
  return chain
}

/**
 * 按 Intl.PluralRules 选择复数消息（ICU 后缀键）。
 * 优先嵌套对象形式 `{ apple: { one, other } }`，其次平铺后缀键 `apple_one`；
 * 当前类别缺失时回退 other；键本身为普通字符串时直接使用。
 * @param locale 用于选择复数类别的语言标签
 */
export function resolvePlural(
  messages: LocaleMessages | undefined,
  key: string,
  count: number,
  locale: string
): string | undefined {
  let category = 'other'
  try {
    category = new Intl.PluralRules(locale).select(count)
  } catch {
    // 非法 locale 时保持 other
  }
  const candidates = [category, 'other']
  const node = resolveMessage(messages, key)
  if (isString(node)) return node
  if (isObject(node)) {
    for (const cat of candidates) {
      const v = (node as Record<string, unknown>)[cat]
      if (isString(v)) return v
    }
  }
  for (const cat of candidates) {
    const v = resolveMessage(messages, `${key}_${cat}`)
    if (isString(v)) return v
  }
  return undefined
}

/**
 * {name} 插值；参数键支持点路径；未提供的参数保留占位符便于排查
 */
export function interpolate(tpl: string, params?: Record<string, unknown>): string {
  if (!params) return tpl
  return tpl.replace(EXP_PARAM, (matched, name) => {
    const v = get(params, String(name).trim())
    return v === undefined || v === null ? matched : String(v)
  })
}

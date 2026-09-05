/**
 * 消息结构：叶子为字符串，中间节点为嵌套对象。
 * 复数消息采用 ICU 后缀键（zero/one/two/few/many/other），
 * 支持 `{ apple: { one: '...', other: '...' } }` 嵌套对象
 * 或 `apple_one` / `apple_other` 平铺两种书写形式。
 */
export type LocaleMessages = { [key: string]: string | LocaleMessages }

/** 用户声明的消息 schema（用于 TS 键名提示），缺省为任意结构 */
export type MessageSchema = Record<string, any>

/**
 * 递归提取嵌套 schema 的点路径联合类型（TS 键名自动补全用）。
 * 中间节点（复数对象等）本身也是合法的 t() 键。
 * `0 extends (1 & S)` 为 isAny 惯用判断：schema 为 any 时退化为 string。
 */
export type Path<S> = 0 extends 1 & S
  ? string
  : S extends Record<string, any>
  ? { [K in keyof S & string]: S[K] extends string ? K : K | `${K}.${Path<S[K]>}` }[keyof S & string]
  : string

export interface I18nOptions<S extends MessageSchema = MessageSchema> {
  /** 当前语言，缺省取 navigator.language，仍缺省时为 'en' */
  locale?: string
  /** 兜底语言，未命中时依次回退 */
  fallbackLocale?: string
  /** 各语言的消息表 */
  messages: Record<string, S>
  /** 各语言的日期格式表，键为格式名（供 d() 使用） */
  datetimeFormats?: Record<string, Record<string, Intl.DateTimeFormatOptions>>
  /** 各语言的数字格式表，键为格式名（供 n() 使用） */
  numberFormats?: Record<string, Record<string, Intl.NumberFormatOptions>>
  /** 切换语言时同步 document.documentElement.lang，默认 true */
  syncDocumentLang?: boolean
}

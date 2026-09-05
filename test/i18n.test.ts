import { describe, expect, it, vi } from 'vitest'
import { createI18n } from '../src/index'

const messages = {
  en: {
    hello: 'Hello {name}!',
    tip: 'Tip',
    apple: { one: '{count} apple', other: '{count} apples' },
    car_one: 'a car',
    car_other: '{count} cars',
    deep: { nested: { greet: 'Hi {user.name}' } },
  },
  'zh-CN': {
    hello: '你好，{name}！',
    apple: { one: '{count} 个苹果', other: '{count} 个苹果' },
  },
  fr: {
    hello: 'Bonjour {name} !',
  },
}

describe('translation engine', () => {
  it('interpolates {name} params', () => {
    const i18n = createI18n({ locale: 'en', messages })
    expect(i18n.t('hello', { name: 'Ken' })).toBe('Hello Ken!')
  })

  it('keeps the placeholder when a param is missing', () => {
    const i18n = createI18n({ locale: 'en', messages })
    expect(i18n.t('hello')).toBe('Hello {name}!')
  })

  it('supports dot-path keys and dot-path params', () => {
    const i18n = createI18n({ locale: 'en', messages })
    expect(i18n.t('deep.nested.greet', { user: { name: 'A' } })).toBe('Hi A')
  })

  it('selects ICU plural by count (number param or count param)', () => {
    const i18n = createI18n({ locale: 'en', messages })
    expect(i18n.t('apple', 1)).toBe('1 apple')
    expect(i18n.t('apple', 5)).toBe('5 apples')
    expect(i18n.t('apple', { count: 3 })).toBe('3 apples')
  })

  it('supports flat plural suffix keys', () => {
    const i18n = createI18n({ locale: 'en', messages })
    expect(i18n.t('car', 1)).toBe('a car')
    expect(i18n.t('car', 2)).toBe('2 cars')
  })

  it('falls back along the locale chain (locale → 主标签 → fallbackLocale)', () => {
    const i18n = createI18n({ locale: 'zh-TW', fallbackLocale: 'fr', messages })
    expect(i18n.t('hello', { name: 'Léa' })).toBe('Bonjour Léa !')
  })

  it('returns the key itself when totally missing', () => {
    const i18n = createI18n({ locale: 'en', messages })
    expect(i18n.t('nope.missing')).toBe('nope.missing')
  })

  it('a plain string message also works for plural calls', () => {
    const i18n = createI18n({ locale: 'en', messages: { en: { banana: 'bananas x{count}' } } })
    expect(i18n.t('banana', 2)).toBe('bananas x2')
  })
})

describe('locale switching', () => {
  it('setLocale / locale setter switch translations and notify listeners', () => {
    const i18n = createI18n({ locale: 'zh-CN', fallbackLocale: 'en', messages })
    expect(i18n.t('apple', 1)).toBe('1 个苹果')
    const cbk = vi.fn()
    const stop = i18n.onLocaleChange(cbk)
    i18n.locale = 'en'
    expect(i18n.locale).toBe('en')
    expect(cbk).toHaveBeenCalledWith('en', 'zh-CN')
    stop()
    i18n.setLocale('zh-CN')
    expect(cbk).toHaveBeenCalledTimes(1)
    expect(i18n.t('apple', 1)).toBe('1 个苹果')
  })

  it('mergeLocaleMessage supports lazy loading with deep merge', () => {
    const i18n = createI18n({ locale: 'en', messages })
    i18n.mergeLocaleMessage('ja', { hello: 'こんにちは {name}' })
    i18n.setLocale('ja')
    expect(i18n.t('hello', { name: 'ケン' })).toBe('こんにちは ケン')
    expect(i18n.availableLocales).toContain('ja')
    expect(i18n.getLocaleMessage('ja').hello).toBe('こんにちは {name}')
  })

  it('ignores empty or same-locale switches', () => {
    const i18n = createI18n({ locale: 'en', messages })
    const cbk = vi.fn()
    i18n.onLocaleChange(cbk)
    i18n.setLocale('en')
    i18n.setLocale('')
    expect(cbk).not.toHaveBeenCalled()
  })
})

describe('formatters', () => {
  it('d()/n() localize date and number', () => {
    const i18n = createI18n({
      locale: 'en',
      messages,
      datetimeFormats: {
        en: { long: { year: 'numeric', month: 'long', day: 'numeric' } },
        'zh-CN': { long: { year: 'numeric', month: 'long', day: 'numeric' } },
      },
      numberFormats: {
        en: { currency: { style: 'currency', currency: 'USD' } },
        'zh-CN': { currency: { style: 'currency', currency: 'CNY' } },
      },
    })
    const date = new Date(2026, 8, 4)
    expect(i18n.d(date, 'long')).toContain('2026')
    expect(i18n.n(1234.5, 'currency')).toContain('$')
    i18n.setLocale('zh-CN')
    expect(i18n.d(date, 'long')).toContain('2026')
    expect(i18n.n(1234.5, 'currency')).toMatch(/[¥￥]/)
  })
})

describe('document lang sync', () => {
  it('syncs <html lang> by default and respects syncDocumentLang: false', () => {
    const i18n = createI18n({ locale: 'zh-CN', messages, syncDocumentLang: true })
    expect(document.documentElement.lang).toBe('zh-CN')
    i18n.setLocale('en')
    expect(document.documentElement.lang).toBe('en')

    const i18n2 = createI18n({ locale: 'en', messages, syncDocumentLang: false })
    i18n2.setLocale('zh-CN')
    expect(document.documentElement.lang).toBe('en')
  })
})

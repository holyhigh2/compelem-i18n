/**
 * devtools 接入点回归测试（`src/devtools.ts`）。
 *
 * 跑法（在 compelem-i18n 仓库内）：`npx vitest run`
 *
 * 目标：验证 provider 契约 + `resolve()` 与真实 `t()` 的**语义等价**，
 * 以及回退链定位（foundIn）的正确性 —— 这是面板"这个 key 在哪个语言包里缺了"
 * 这一能力的唯一依据。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from '../src/index'
import {
  clearI18nDevtools,
  getI18nDevtoolsEntries,
  registerI18nDevtools,
} from '../src/devtools'

const KEY = '__COMPELEM_ECOSYSTEM__' as const

/** 刻意造出「只有 zh 有、zh-CN 没有」的 key，用来验证主标签回退 */
const messages = {
  en: {
    hello: 'Hello {name}!',
    tip: 'Tip',
    apple: { one: '{count} apple', other: '{count} apples' },
    car_one: 'a car',
    car_other: '{count} cars',
    deep: { nested: { greet: 'Hi {user.name}' } },
    onlyEn: 'english only',
  },
  'zh-CN': {
    hello: '你好，{name}！',
    apple: { one: '{count} 个苹果', other: '{count} 个苹果' },
  },
  zh: {
    tip: '提示（主标签）',
  },
  fr: {
    hello: 'Bonjour {name} !',
  },
}

function make() {
  return createI18n({ locale: 'zh-CN', fallbackLocale: 'en', messages })
}

function provider() {
  return (globalThis as any)[KEY].i18n
}

beforeEach(() => {
  clearI18nDevtools()
})

describe('devtools 接入点', () => {
  it('T1 createI18n 后 globalThis 上出现 i18n provider', () => {
    const i18n = make()
    expect(i18n).toBeTruthy()
    const p = provider()
    expect(typeof p).toBe('object')
    expect(typeof p.list).toBe('function')
    expect(typeof p.entry).toBe('function')
    expect(typeof p.active).toBe('function')
  })

  it('T1b 区分「库未加载」与「库已加载无实例」：clear 后命名空间仍在', () => {
    // 面板右侧「未启用 compelem-i18n 依赖」的判定完全依赖这条契约：
    //   命名空间不存在       → 库没加载
    //   命名空间在、list() 空 → 库加载了但还没 createI18n
    // 所以 provider 必须在模块加载期就挂上，而不是等到第一次 createI18n。
    expect(provider()).toBeTruthy()
    expect(provider().list()).toEqual([])

    make()
    expect(provider().list().length).toBe(1)

    clearI18nDevtools()
    expect(provider()).toBeTruthy()      // 命名空间不随实例清空而消失
    expect(provider().list()).toEqual([])
  })

  it('T2 list 返回实例 id，entry 可取回接入项，active 取第一个', () => {    make()
    const p = provider()
    const ids = p.list()
    expect(ids.length).toBe(1)
    const e = p.entry(ids[0])
    expect(e).toBeTruthy()
    expect(p.active().id).toBe(ids[0])
    expect(p.entry('nope')).toBeUndefined()
  })

  it('T3 locale / fallbackLocale / locales 如实暴露', () => {
    make()
    const e = provider().active()
    expect(e.locale()).toBe('zh-CN')
    expect(e.fallbackLocale()).toBe('en')
    expect(e.locales().sort()).toEqual(['en', 'fr', 'zh', 'zh-CN'])
  })

  it('T4 messages() 返回该语言原始消息树', () => {
    make()
    const e = provider().active()
    const m = e.messages('en')
    expect(m.hello).toBe('Hello {name}!')
    expect((m.apple as any).one).toBe('{count} apple')
    // 不存在的语言返回空对象（getLocaleMessage 的既有语义）
    expect(e.messages('de')).toEqual({})
  })

  it('T5 resolve 命中当前语言 → foundIn 为当前语言', () => {
    make()
    const e = provider().active()
    const r = e.resolve('hello', { name: 'Ken' })
    expect(r.found).toBe(true)
    expect(r.foundIn).toBe('zh-CN')
    expect(r.value).toBe('你好，Ken！')
    expect(r.raw).toBe('你好，{name}！')
    expect(r.locale).toBe('zh-CN')
  })

  it('T6 当前语言缺失时回退到 fallbackLocale，foundIn 指向它', () => {
    make()
    const e = provider().active()
    const r = e.resolve('onlyEn')
    expect(r.found).toBe(true)
    expect(r.foundIn).toBe('en')
    expect(r.value).toBe('english only')
  })

  it('T7 回退链含"主标签"：zh-CN 缺失 → 命中 zh', () => {
    make()
    const e = provider().active()
    const r = e.resolve('tip')
    expect(r.chain).toEqual(['zh-CN', 'zh', 'en'])
    expect(r.foundIn).toBe('zh')
    expect(r.value).toBe('提示（主标签）')
  })

  it('T8 全链未命中 → found:false 且无 foundIn / value', () => {
    make()
    const e = provider().active()
    const r = e.resolve('does.not.exist')
    expect(r.found).toBe(false)
    expect(r.foundIn).toBeUndefined()
    expect(r.value).toBeUndefined()
    expect(r.chain).toEqual(['zh-CN', 'zh', 'en'])
  })

  it('T9 传入数字触发 ICU 复数，并回报命中类别与原始模板', () => {
    make()
    const e = provider().active()
    // 注意：复数类别由**命中语言**的 Intl.PluralRules 决定，天然与语言相关。
    // 中文只有 other 一个类别，英文才有 one/other。
    const zh1 = e.resolve('apple', 1)
    expect(zh1.found).toBe(true)
    expect(zh1.foundIn).toBe('zh-CN')
    expect(zh1.pluralCategory).toBe('other')
    expect(zh1.raw).toBe('{count} 个苹果')
    expect(zh1.value).toBe('1 个苹果')
    expect(e.resolve('apple', 5).value).toBe('5 个苹果')
  })

  it('T9b 复数类别随语言变化：同一 key 在 en 下是 one/other', () => {
    make()
    const e = provider().active()
    const en1 = e.resolve('apple', 1, 'en')
    expect(en1.foundIn).toBe('en')
    expect(en1.pluralCategory).toBe('one')
    expect(en1.raw).toBe('{count} apple')
    expect(en1.value).toBe('1 apple')

    const en5 = e.resolve('apple', 5, 'en')
    expect(en5.pluralCategory).toBe('other')
    expect(en5.value).toBe('5 apples')
  })

  it('T10 对象参数带 count 时同样触发复数，其余键参与插值', () => {
    make()
    const e = provider().active()
    const r = e.resolve('apple', { count: 0, extra: 'x' })
    expect(r.found).toBe(true)
    expect(r.value).toBe('0 个苹果')
  })

  it('T11 平铺后缀键形式（car_one / car_other）在 zh-CN 未命中→回退 en 命中', () => {
    make()
    const e = provider().active()
    const r = e.resolve('car', 1)
    expect(r.found).toBe(true)
    expect(r.foundIn).toBe('en')
    expect(r.value).toBe('a car')
    expect(e.resolve('car', 3).value).toBe('3 cars')
  })

  it('T12 点路径 key 与点路径参数都能解析', () => {
    make()
    const e = provider().active()
    const r = e.resolve('deep.nested.greet', { user: { name: 'A' } })
    expect(r.found).toBe(true)
    expect(r.value).toBe('Hi A')
    expect(r.foundIn).toBe('en')
  })

  it('T13 resolve 指定 locale 只影响本次解析，不改实例当前语言（无副作用）', () => {
    make()
    const e = provider().active()
    const before = e.locale()
    const r = e.resolve('hello', { name: 'X' }, 'fr')
    expect(r.locale).toBe('fr')
    expect(r.value).toBe('Bonjour X !')
    expect(e.locale()).toBe(before)
  })

  it('T14 resolve 与真实 t() 语义等价（同一批 key/参数逐一对齐）', () => {
    const i18n = make()
    const e = provider().active()
    const cases: Array<[string, any]> = [
      ['hello', { name: 'Ken' }],
      ['hello', undefined],
      ['tip', undefined],
      ['onlyEn', undefined],
      ['apple', 1],
      ['apple', 2],
      ['apple', { count: 7 }],
      ['car', 1],
      ['car', 4],
      ['deep.nested.greet', { user: { name: 'Z' } }],
      ['missing.key', undefined],
    ]
    for (const [key, params] of cases) {
      const viaT = (i18n as any).t(key, params)
      const viaR = e.resolve(key, params)
      expect(viaR.found ? viaR.value : key).toBe(viaT)
    }
  })

  it('T15 resolve 之后 t() 仍然正常（未污染内部状态）', () => {
    const i18n = make()
    const e = provider().active()
    e.resolve('deep.nested.greet', { user: { name: 'Q' } })
    e.resolve('apple', 9)
    expect((i18n as any).t('hello', { name: 'A' })).toBe('你好，A！')
    expect(e.locale()).toBe('zh-CN')
  })

  it('T16 setLocale 经接入点切换语言并触发 onLocaleChange', () => {
    make()
    const e = provider().active()
    const seen: any[] = []
    const off = e.subscribe((loc: string, old: string) => seen.push([loc, old]))
    e.setLocale('en')
    expect(e.locale()).toBe('en')
    expect(seen).toEqual([['en', 'zh-CN']])
    // 取消订阅后不再收到
    off()
    e.setLocale('fr')
    expect(seen.length).toBe(1)
    expect(e.locale()).toBe('fr')
  })

  it('T17 mergeMessages 深合并语言包（懒加载联调）', () => {
    make()
    const e = provider().active()
    e.mergeMessages('en', { lazy: { a: 'A' }, extra: 'E' })
    const m = e.messages('en') as any
    expect(m.lazy.a).toBe('A')
    expect(m.extra).toBe('E')
    // 既有 key 不被清除
    expect(m.hello).toBe('Hello {name}!')
    expect(e.resolve('lazy.a', undefined, 'en').value).toBe('A')
    // 深合并不覆盖同名中间节点，而是合并进去
    e.mergeMessages('en', { deep: { nested: { more: 'M' } } })
    const m2 = e.messages('en') as any
    expect(m2.deep.nested.more).toBe('M')
    expect(m2.deep.nested.greet).toBe('Hi {user.name}')
  })

  it('T18 多实例各自独立登记，id 互不相同', () => {
    const a = createI18n({ locale: 'en', messages })
    const b = createI18n({ locale: 'fr', messages })
    const ids = provider().list()
    expect(ids.length).toBe(2)
    const ea = provider().active()
    const eb = getI18nDevtoolsEntries().find(e => e !== ea)!
    expect(ea.id).not.toBe(eb.id)
    expect(ea.locale()).not.toBe(eb.locale())
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
  })

  it('T19 同一实例重复登记保持稳定 id（不重复占位）', () => {
    const inst = createI18n({ locale: 'en', messages })
    const first = getI18nDevtoolsEntries()[0].id
    registerI18nDevtools(inst as any)
    registerI18nDevtools(inst as any)
    expect(provider().list()).toEqual([first])
  })

  it('T20 接入点不破坏其它生态命名空间（store / router 共存）', () => {
    ;(globalThis as any)[KEY] = { store: { sentinel: 1 }, router: { sentinel: 2 } }
    make()
    const eco = (globalThis as any)[KEY]
    expect(eco.store.sentinel).toBe(1)
    expect(eco.router.sentinel).toBe(2)
    expect(typeof eco.i18n.list).toBe('function')
  })

  it('T21 globalThis 上完全没有生态槽位时也能正常建立（冷启动）', () => {
    delete (globalThis as any)[KEY]
    expect(() => make()).not.toThrow()
    expect(provider().list().length).toBe(1)
  })
})

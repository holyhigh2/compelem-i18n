import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

// 构建产物冒烟：dist 缺失时自动跳过（先 npm run build 再跑）
// 注意用 cwd 定位而非 import.meta.url —— vitest 模块作用域中的 import.meta.url 会被 vite 改写
const distPath = resolve(process.cwd(), 'dist/index.js')

describe.skipIf(!existsSync(distPath))('dist build', () => {
  it('exports a working createI18n with only compelem/myfx as externals', async () => {
    const mod = await import(/* @vite-ignore */ pathToFileURL(distPath).href)
    expect(typeof mod.createI18n).toBe('function')
    expect(typeof mod.version).toBe('string')
    const i18n = mod.createI18n({
      locale: 'en',
      messages: { en: { hi: 'Hi {n}', apple: { one: '{count} apple', other: '{count} apples' } } },
    })
    expect(i18n.t('hi', { n: 1 })).toBe('Hi 1')
    expect(i18n.t('apple', 2)).toBe('2 apples')
    expect(i18n.locale).toBe('en')
  })
})

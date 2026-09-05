import { createI18n } from '../src/index'

// demo 共享实例：语言包结构与类型提示见 README
export const i18n = createI18n({
  locale: 'zh-CN',
  fallbackLocale: 'en',
  messages: {
    'zh-CN': {
      current: '当前语言',
      title: '购物车示例',
      hello: '你好，{name}！',
      tip: '切换语言后所有组件自动更新',
      extra: '这是 ifElse 条件渲染的文本',
      apple: { one: '{count} 个苹果', other: '{count} 个苹果' },
      cherry: { one: '{count} 颗樱桃', other: '{count} 颗樱桃' },
      banana: '{count} 根香蕉',
    },
    en: {
      current: 'Current locale',
      title: 'Cart demo',
      hello: 'Hello, {name}!',
      tip: 'All subscribed components update automatically on locale switch',
      extra: 'This text is rendered by ifElse',
      apple: { one: '{count} apple', other: '{count} apples' },
      cherry: { one: '{count} cherry', other: '{count} cherries' },
      banana: '{count} banana(s)',
    },
  },
  datetimeFormats: {
    'zh-CN': { long: { year: 'numeric', month: 'long', day: 'numeric' } },
    en: { long: { year: 'numeric', month: 'long', day: 'numeric' } },
  },
  numberFormats: {
    'zh-CN': { currency: { style: 'currency', currency: 'CNY' } },
    en: { currency: { style: 'currency', currency: 'USD' } },
  },
})

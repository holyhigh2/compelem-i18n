# compelem-i18n

Standalone i18n plugin for [CompElem](https://github.com/holyhigh2/compelem) — reactive translations for web components


## Features

- **Reactive `t()`** — every component that renders translations is subscribed automatically; `setLocale()` re-renders them all in one batched microtask update
- **`{name}` interpolation** with dot-path parameter access
- **ICU pluralization** via `Intl.PluralRules` — nested (`apple: { one, other }`) or flat suffix (`apple_one` / `apple_other`) message forms
- **Locale fallback chain**: `locale → language primary subtag (zh-CN → zh) → fallbackLocale (and its subtag) → key`
- **`d()` / `n()`** localized date/number formatting via `Intl.DateTimeFormat` / `Intl.NumberFormat`
- **Lazy loading** with `mergeLocaleMessage()`, plus `onLocaleChange()` listeners
- **`<html lang>` sync** on locale switch (a11y/SEO best practice, optional)
- **TypeScript key autocompletion** — declare a message schema type and `t()` keys are checked

## Install

```bash
npm install compelem-i18n
```

Peer dependency: `compelem 0.27 +`. Runtime dependency: `myfx` (shared with compelem).

## Usage

```ts
import { CompElem, tag, h } from 'compelem'
import { createI18n } from 'compelem-i18n'

export const i18n = createI18n({
  locale: 'zh-CN',            // defaults to navigator.language, then 'en'
  fallbackLocale: 'en',
  messages: {
    'zh-CN': {
      hello: '你好，{name}！',
      apple: { one: '{count} 个苹果', other: '{count} 个苹果' },
    },
    en: {
      hello: 'Hello, {name}!',
      apple: { one: '{count} apple', other: '{count} apples' },
    },
  },
  datetimeFormats: { en: { long: { year: 'numeric', month: 'long', day: 'numeric' } } },
  numberFormats: { en: { currency: { style: 'currency', currency: 'USD' } } },
  syncDocumentLang: true,     // sync <html lang> on switch, default true
})

@tag('my-comp')
class MyComp extends CompElem {
  render() {
    return h`
      <p title="${i18n.t('tip')}">${i18n.t('hello', { name: 'Ken' })}</p>
      <p>${i18n.t('apple', 5)}</p>
      <p>${i18n.d(Date.now(), 'long')} ${i18n.n(1234.5, 'currency')}</p>`
  }
}
```

Switch the locale anywhere — all subscribed components update automatically:

```ts
i18n.setLocale('en')      // or i18n.locale = 'en'
i18n.mergeLocaleMessage('ja', jaDict)  // lazy-load after fetch
const stop = i18n.onLocaleChange((locale, oldLocale) => { /* side effects */ })
```

## API

### `createI18n<S>(options: I18nOptions<S>): I18n<S>`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `locale` | `string` | `navigator.language` → `'en'` | Current locale |
| `fallbackLocale` | `string` | — | Fallback locale |
| `messages` | `Record<string, LocaleMessages>` | required | Message tables per locale |
| `datetimeFormats` | `Record<string, Record<string, Intl.DateTimeFormatOptions>>` | — | Named date formats for `d()` |
| `numberFormats` | `Record<string, Record<string, Intl.NumberFormatOptions>>` | — | Named number formats for `n()` |
| `syncDocumentLang` | `boolean` | `true` | Sync `document.documentElement.lang` |

### `I18n` instance

| Member | Description |
| --- | --- |
| `t(key, params?)` | Translate. `params` as number → ICU plural; as object → `{name}` interpolation; object containing `count` → both. Missing key falls back along the chain, finally returns the key itself (dev warning) |
| `d(date, formatKey?)` | Localized date, format key from `datetimeFormats[locale]` |
| `n(value, formatKey?)` | Localized number, format key from `numberFormats[locale]` |
| `locale` | Get/set current locale (setter ≙ `setLocale`) |
| `setLocale(locale)` | Switch locale, notify listeners, update subscribed components |
| `fallbackLocale` / `availableLocales` | Getters |
| `mergeLocaleMessage(locale, messages)` | Deep-merge a message table (lazy loading) |
| `getLocaleMessage(locale)` | Get a message table |
| `onLocaleChange(cbk)` | Listen for switches; returns an unsubscribe function |

### TypeScript key hints

```ts
const messages = { en: { cart: { title: 'Cart' }, apple: { one: '{count} apple', other: '{count} apples' } } }
export const i18n = createI18n<typeof messages.en>({ locale: 'en', messages })

i18n.t('cart.title')   // ✓ autocompleted
i18n.t('cart.titl')    // ✗ type error
i18n.t('apple', 5)     // intermediate (plural object) keys are valid too
```

Omit the generic and keys stay plain `string`-compatible.

## Message format

- **Keys**: dot paths and nested objects are equivalent (`t('a.b')` ≙ `messages[locale].a.b`); a literal key containing dots takes precedence.
- **Params**: `{name}` placeholders; missing params keep the placeholder. Dot-path params work: `t('hi', { user: { name: 'Ken' } })` with `'Hi {user.name}'`.
- **Plural**: `t(key, n)` or `t(key, { count: n })` selects via `Intl.PluralRules(locale)` — categories `zero/one/two/few/many/other`, falling back to `other`, then to `fallbackLocale`. `{count}` is injected automatically. Both nested and flat suffix forms are supported; a plain string message is used as-is.

## Reactivity notes & limitations

- `t()` is reactive **inside `render()`** (and inside directives such as `forEach`/`ifElse` templates) — the component subscribes automatically on first render.
- Called in event handlers or lifecycle hooks, `t()` returns the current translation without subscribing.
- `t()` inside `@computed` getters does **not** re-evaluate on locale switch (computed deps only track component state); use `onLocaleChange` if needed.
- A component must render `t()` at least once during its first render to subscribe. Keys that only appear later inside conditional sub-views (`ifElse`/`when` branches initially hidden) update via sub-view dependencies.
- On locale switch, subscribed components re-render as a whole; updates are batched by CompElem's `Queue` into one microtask.

## Development

```bash
npm install
npm run dev         # demo at http://localhost:8818 (two-locale toggle, plural, d/n, forEach/ifElse)
npm test            # vitest: engine + instance API + dist smoke
npm run typecheck   # tsc --noEmit
npm run build       # vite library mode → dist/index.js (ESM) + dist/index.d.ts
npm run lint
```

## License

[MIT](./LICENSE)

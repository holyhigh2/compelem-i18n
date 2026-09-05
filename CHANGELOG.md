# Changelog

## 0.1.0 (2026-09-05)

Initial release.

- `createI18n()` / `I18n` class: `t()` / `d()` / `n()`, `locale`, `setLocale()`, `mergeLocaleMessage()`, `getLocaleMessage()`, `onLocaleChange()`, `availableLocales`, `fallbackLocale`
- Reactive locale switching built on CompElem public APIs (`getCurrentRenderComponent` + `makeState` + native Queue batching), zero framework modification
- `{name}` interpolation with dot-path params, ICU pluralization (`Intl.PluralRules`), locale fallback chain
- Localized date/number formatting with `Intl` instance caching
- `<html lang>` synchronization, lazy message merging, `onLocaleChange` listeners
- TypeScript message-key autocompletion via schema generics
- Vite library-mode build (ESM-only, `compelem`/`myfx` external), vitest suite, browser demo on :8818

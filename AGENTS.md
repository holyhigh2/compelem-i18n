# AGENTS.md

## Project Overview

compelem-i18n is an internationalization (i18n) plugin for CompElem web components. It provides reactive translations with automatic component re-rendering on locale changes.

## Development Commands

```bash
# Development server
npm run dev

# Build library
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Lint
npm run lint
```

## Project Structure

```
src/
├── index.ts          # Main entry point, exports createI18n
├── types.ts          # TypeScript type definitions
├── message.ts        # Message parsing and interpolation
├── format.ts         # Date/number formatting utilities
└── env.d.ts          # Environment type declarations
test/
└── *.test.ts         # Vitest tests
```

## Tech Stack

- **TypeScript** with strict mode
- **Vite** for build and dev server
- **Vitest** for testing
- **Peer dependency**: compelem >= 0.27.0
- **Runtime dependency**: myfx

## Coding Conventions

- Use TypeScript strict mode
- All functions must have complete type definitions
- JSDoc comments for exported functions
- Pure functions preferred

## Key Concepts

1. **Reactive t()**: Translation function subscribes components automatically in render()
2. **Locale fallback chain**: locale → language subtag → fallbackLocale → key
3. **ICU pluralization**: Uses Intl.PluralRules for plural forms
4. **Interpolation**: {name} parameter syntax with dot-path support

## Constraints

- Do NOT break backward compatibility
- Do NOT add external dependencies
- Do NOT modify package.json version without explicit instruction
- Ask first before changing public API signatures

# k6s — Claude Code Context

## Project overview

`@cloudtooling/k6s` is a TypeScript helper library for [k6](https://k6.io) load tests.
It ships as a Docker image (`cloudtooling/k6s`) and provides:

- **JWT client-assertion flow** (`src/jwt.ts`) — RS256-signed JWT generation and an OAuth2 `client_credentials` token fetch using that JWT as the `client_assertion`.
- **JUnit report generation** — re-exported from `k6-junit`.

The library is consumed inside k6 scripts (which run in the k6 JS runtime, not Node.js).

## Key files

| Path | Purpose |
|---|---|
| `src/jwt.ts` | Only source module. Exports `getBearerTokenWithClientAssertion`. |
| `src/index.ts` | Public re-exports (`getBearerTokenWithClientAssertion`, `generateJunitReport`). |
| `src/__mocks__/k6.ts` | Jest mock for `k6` (`check`, `fail`). |
| `src/__mocks__/k6/encoding.ts` | Jest mock for `k6/encoding` (`b64encode`, `b64decode`) using Node `Buffer`. |
| `src/__mocks__/k6/http.ts` | Jest mock for `k6/http` (`http.post`). |
| `src/__mocks__/k6/crypto.ts` | No-op mock for the `import 'k6/crypto'` side-effect. |
| `src/jwt.test.ts` | 19 Jest unit tests for `getBearerTokenWithClientAssertion`. |
| `jest.config.js` | Jest config: ts-jest preset, `moduleNameMapper` for k6 mocks, `module: commonjs` override. |
| `tsconfig.json` | TypeScript config targeting ES2020. `module: ES2020` (overridden to `commonjs` for Jest). |

## Build & test commands

```bash
npm run build   # tsc → dist/
npm test        # jest
npm run lint    # eslint src/**
npm run format  # prettier --write src/**
```

## Testing approach

k6 modules (`k6`, `k6/encoding`, `k6/http`, `k6/crypto`) cannot run in Node.js.
Jest's `moduleNameMapper` in `jest.config.js` redirects them to hand-written mocks under `src/__mocks__/`.
`crypto.subtle` (Web Crypto) is mocked per-test via `Object.defineProperty(globalThis, 'crypto', ...)`.

The test file pattern is `src/*.test.ts` (or `src/*.spec.ts`).

## Important constraints

- Source files import k6 APIs — do **not** add Node.js-only imports to `src/jwt.ts` or `src/index.ts`.
- `tsconfig.json` has `noUnusedLocals: true` and `noImplicitReturns: true`; the jest transform overrides these for test files.
- `@types/jest` is pinned to `^24.x` — use `as unknown as jest.Mock` when casting k6-typed functions to jest mocks.

# AGENTS.md — OtobaAI UI

Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript strict. Single app, not a monorepo.

## Stack & Entrypoints
- `src/app/layout.tsx`: root layout — fonts (`Outfit`, `JetBrains_Mono` via `next/font`), `Providers` → `ErrorBoundary` → `AppShell`. `AppShell` (`src/components/layout/app-shell.tsx`) is the global shell.
- `src/app/providers.tsx`: `ThemeProvider` (next-themes, `attribute="class"`) wraps `QueryProvider` wraps `Toaster` (sonner).
- `src/providers/query-provider.tsx`: `QueryClient` defaults `staleTime 60s`, `retry:1`, `refetchOnWindowFocus:false`, `MutationCache.onError` → `notify.error` (global toast on any mutation failure).
- `src/app/*`: routes `agents/` (`new`, `[id]`, `[id]/configure`), `batches/`, `calls/`, `graphs/`, `library/`, `playground/`, `settings/`, `workflows/` + `error.tsx`, `loading.tsx`, `not-found.tsx`, `globals.css`. `/setup/**` are thin `redirect()` shims to `/agents/*` — do not add logic there.
- Deep links: `/playground?agent=:id`, `/playground?agent=:id&mode=talk|chat`, `/calls?agent=:id`, `/batches?agent=:id&new=1`. Legacy `?mode=live|simulate` normalize to `talk`. Read via `useSearchParams` inside a `Suspense` boundary; derive `override ?? param ?? default` — never `setState` in an `effect` (lint `react-hooks/set-state-in-effect` fails the build).
- Playground (nav label; route `/playground`): Talk (`LiveTalk`) + Chat (`ChatTalk`) only — simulation UI was removed, but `useSimulateCall` + `POST /calls/simulate` + its tests stay (backend feature, still used by E2E). Talk hidden for `text` agents (no audio path); chat served for all types. Socket: `WS_BASE_URL/chat/v1/:id` JSON frames (`init`/`audio` base64 16k PCM in; `ack`/`audio` 24k PCM / `text`+`role` / `mark` / `clear` out; echo marks, stop playback on `clear`, skip `<beginning_of_stream>`/`<end_of_stream>` sentinel texts). The capture worklet MUST connect through a muted gain to destination or the graph is optimized away and no mic audio is sent. Backend browser-leg requirements (all in `../voiceai`): `task_manager` default-IO normalization + async `DefaultOutputHandler.set_stream_sid` + transcript forwarding + `_s2s_text_loop`/`send_text` + browser-leg `_listen_llm_input_queue` + reply-text forwarding in `__store_into_history` drain + text-agent synth guards; valid `OPENAI_API_KEY` in backend `.env` (container reads it at start — recreate after changing). Turn state must never assume socket lifetime (Phase-2 SSE seam).
- UI: `src/components/{common,dashboard,layout,builders,playground,settings,batches,library}`. No `src/components/ui/` checked in yet — shadcn registry (`components.json`).
- Services: `src/services/api.ts` (agents) + `src/services/platform/*` (namespaced platform APIs). `src/lib/*` holds `api-client.ts`, `env.ts`, `utils.ts` (cn), `notify.ts`, `format.ts`, schemas.

## Commands (npm only — no pnpm/yarn lock)
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` / `npm start` — production build/serve
- `npm run lint` — ESLint (`eslint-config-next` core-web-vitals + typescript; ignores `.next/`, `out/`, `build/`, `next-env.d.ts`)
- `npx tsc --noEmit` — typecheck (no `typecheck` script; `strict:true`, `moduleResolution:bundler`, `jsx:react-jsx`)
- `npm test` — Jest (via `next/jest`, jsdom, `jest.setup.ts`, `coverageProvider:v8`)
  - Single file: `npm test -- __tests__/lib/format.test.ts` or `npx jest __tests__/lib/format.test.ts`
  - Single suite by name: `npx jest -t "<test name>"`
  - Verify before finishing: `npm run lint && npx tsc --noEmit && npm test`

## Config & Env
- Path alias: `@/*` → `src/*` (`tsconfig.json` + `jest.config.ts` `moduleNameMapper`). shadcn aliases in `components.json`: `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`.
- Tailwind v4: no `tailwind.config.*`. Uses `@tailwindcss/postcss` in `postcss.config.mjs` and `@import "tailwindcss"` in `src/app/globals.css`. Theme via `@theme`/`@theme inline` and CSS variables. `components.json` points `tailwind.css` to `src/app/globals.css`, `style:"base-nova"`, `baseColor:"neutral"`, `cssVariables:true`.
- Env: `src/lib/env.ts` Zod-validates `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_BASE_URL` (defaults `http://localhost:5001` / `ws://localhost:5001`). Throws on invalid. `.env*` is gitignored; copy `.env.example`. Consume via `env` or `API_BASE_URL`/`WS_BASE_URL` from `src/lib/api-client.ts` — never hardcode URLs.
- `next.config.ts` is empty (no custom rewrites/headers yet). `eslint.config.mjs` extends `eslint-config-next`. No `opencode.json`, no `.github/` workflows, no `.opencode/` — no CI to check.

## Data & Validation Rules
- TanStack Query only for remote data: `useQuery`/`useMutation` in `src/services/*`. Do not use `useEffect`+`fetch` for loading. Use `queryKeys` objects for invalidation (see `src/services/api.ts`).
- Agents: `useAgents()` (list, `GET /all`) is for the directory only. Detail/overview/configure must use `useAgent(id)` (`GET /agent/:id`). Never list+`.find()`. Create/update/delete go through `toCreateAgentPayload` — never hand-roll payloads.
- Telemetry split: `/agents` list uses ONE unfiltered `useExecutions()` aggregate. Detail pages use `useExecutions({agent_id})` + `useExecutionStats(id)` + `useLatencyStats(id)`. Never N+1 per-card queries.
- Config save ownership: global Save = core `PUT /agent/:id` only (persona/transcriber/synthesizer/llm/conversation/telephony/s2s). Tools → `/tools`, voices → `/voices`, KB → `/knowledgebases` + `/agents/:id/vector-config`, inbound → `/inbound/:id` + `/phone-numbers`, webhooks → `/webhooks` — each saves via its own button/endpoint.
- Configure tabs are type-gated (`src/components/settings/sections.ts`): transcriber = voice-only, llm = voice/text, voice tab = TTS for voice / S2S-block-only for s2s. Never show pipeline sections the record can't carry (`transcriber: null` on s2s) — edits there are dropped by the transform.
- Backend truths (verified in `../voiceai`: `local_setup/quickstart_server.py`, `voiceai/models.py`): `PUT /agent/:id` fully **overwrites** the record + prompts file — transforms must round-trip every field. `GET /agent/:id` returns the raw record with **no `agent_id`** (`useAgent` injects it); stored prompts come from **`GET /agent/:id/prompts`** (`useAgentPrompts`, parsed by `parseStoredPrompts` which accepts task_1-nested and flat shapes). S2S field set = `OpenAIRealtimeConfig`/`GeminiLiveConfig` + `welcome_audio_gate_ms`; writes are provider-conditional.
- Central client: `src/lib/api-client.ts` `apiClient<T>(endpoint, options)` — prefixes `API_BASE_URL`, throws `ApiError` with `detail`/`message` handling, returns `{}` on 204.
- Validation: `zod` + `react-hook-form` + `@hookform/resolvers`. Schemas in `src/lib/schemas/{agent,platform,builders}.ts`. `SelectInput`/`TextInput` (`form-controls.tsx`) map empty → `undefined` via `setValueAs` and the select placeholder stays selectable — never `disabled`, or untouched selects submit phantom first-option values and cleared numbers submit `NaN`.
- Auth (self-hosted, enforced server-side): `apiClient` sends `credentials:"include"` (httpOnly `otoba_session` cookie); 401s redirect to `/login?next=` (public: `/login`, `/accept-invite` — also bypassed in `AppShell` + `middleware.ts` cookie gate). No `/signup` route (owner exists; new accounts join by invite). Session/roles via `src/services/auth.ts` (`useSession`); UI gating via `src/lib/rbac.ts` (`useCan`, mirror of backend `ROLE_SCOPES` — UI only, backend re-checks). Voice sockets attach a single-use `POST /auth/ws-ticket` `?token=` (`fetchWsTicket`) with cookie fallback. Backend auth lives in `../voiceai` (`platform/auth.py`, `platform/auth_router.py`): PBKDF2 passwords, Redis sessions, scoped Bearer keys, owner/admin/member/viewer, first-user-becomes-owner then invite-only, auth collections survive `/organization/reset`.
- No `zustand` installed despite old docs mentioning it — do not add without confirming need. State is Query + `next-themes` + local state.

## Testing
- Jest via `next/jest` loading `next.config.ts` + `.env`. `testEnvironment:jsdom`, `setupFilesAfterEnv: jest.setup.ts` (`@testing-library/jest-dom`). Tests live in `__tests__/{components,lib,services}` mirroring `src/`. Coverage at `/coverage` (gitignored).

## Gotchas
- Repo is **not yet a git repo** (`git status` fails) — init/commit flow will not work until `git init` is done.
- `src/config/` exists but is empty; canonical env is `src/lib/env.ts`.
- Artifacts `.next/`, `out/`, `build/`, `*.tsbuildinfo`, `next-env.d.ts` are gitignored/generated — do not edit or commit.
- `CLAUDE.md` is just `@AGENTS.md` — keep them in sync if you change this file.

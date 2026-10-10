# Backend response envelope — what changed and what the UI has to do

## The one-paragraph version

The backend serves **two response shapes on the same app**. Module routers answer
with the envelope from `voiceai/common/responses.py`; the frozen routers in
`voiceai/platform/router.py` still answer flat. **The UI needs no call-site change**
— `apiClient` already unwraps both. This note exists so nobody "fixes" a call site
by hand, and so the split is written down instead of folklore.

## The two shapes

```
module route (enveloped)            frozen platform route (flat)
{ "ok": true,                        { "numbers": [...] }
  "data": { "numbers": [...] },      { "executions": [...] }
  "message": null,                   ...
  "meta": { "request_id": "...",
            "pagination": {...} } }
```

Errors are already envelope-shaped everywhere and always were:

```
{ "ok": false,
  "detail": "public message",
  "error": { "code", "error_id", "retryable", "details": {...} } }
```

`apiClient` throws before it ever looks at the body, so error handling needs nothing.

## Who owns what

Mount order is modules first, then the frozen platform routers, **first match wins**
(`voiceai/core/app_factory.py:331-342`), so a module handler owns any path it
declares. The authoritative table is `tests/arch/test_route_inventory.py` in the
backend — it pins all 138 `METHOD PATH` entries. If the two repos ever disagree
about a path, that file is the truth, not this one.

### Module-owned → enveloped

| Family | Routes | Retired into module in |
|---|---|---|
| phone numbers | `/phone-numbers*` | spec 0074 |
| knowledge bases | `/knowledgebases*`, `/agents/{id}/vector-config` | spec 0075 |
| webhooks | `/webhooks*` | spec 0076 |
| integrations | `/integrations*`, `/integration-templates*`, `/partner-*`, `/talko/partners*`, `/mcp`, `/oauth/*` | spec 0077 |
| graphs | `/graphs*` | spec 0078 |
| tools | `/tools*` | — |
| voices | `/voices*` | — |
| auth | `/auth/*` | — |
| catalog | `/catalog/*` | — |
| chat | `GET /chat/sessions`, `POST /chat/{agent_id}` | — |
| voice | `POST /calls/place`, `POST /calls/simulate`, `POST /voice/inbound/twilio`, `WS /chat/v1/{agent_id}` | — |
| privacy | `/privacy/*` | — |
| wallet | `/wallet*` | — |
| templates | `/templates*` | — |
| health | `/health*` | — |

### Frozen platform-owned → still flat

`simulate` (superseded by the module `POST /calls/simulate`), `/executions*`,
`/batches*`, `/inbound/{agent_id}`, `/agent*` (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`),
`/all`, `/sub-accounts*`, `/workflows*`, `/workflow-runs*`, `/workflow-campaigns*`,
`/organization*`, `/api-keys*`.

Each of these retires into its module eventually. When it does, **it gets enveloped**
and this UI keeps working untouched — that is the point of the interceptor below.

## What the UI does

`src/lib/api-client.ts` unwraps once, centrally:

```ts
if (isSuccessEnvelope(json)) return json.data;
return json;
```

`isSuccessEnvelope` requires a literal boolean `ok === true` **and** the presence of
`data`. The strictness matters: a flat payload is only misread as an envelope if it
happens to carry both `ok: true` and a `data` key. No route on either side does.

`__tests__/lib/api-client.test.ts` → "apiClient envelope tolerance" locks all six
cases: object payload, bare-list payload (paginated routes put items directly in
`data`), `data: null`, a flat body passing through, a body with a bare `ok` key, and
a body whose `ok` is not boolean `true`.

### Rules

1. **Never add `.data` at a call site.** If a service looks wrong, the bug is in the
   interceptor or in the zod schema — not in the missing unwrap.
2. **Every route goes through `apiClient`.** The two raw `fetch` calls in the UI are
   both deliberate: `EngineStatus` (`/auth/me`) reads only the HTTP status and never
   parses the body, and `src/services/platform/chat.ts` reads an SSE stream, which
   has no envelope.
3. **Zod schemas stay flat.** `kbListSchema`, `webhookListSchema`,
   `integrationListSchema` and friends model the payload *inside* `data`, not the
   envelope. Do not add `z.object({ ok: ..., data: ... })` wrappers.
4. **Pagination arrives in `meta.pagination`**, which the interceptor drops. Nothing
   in this UI paginates server-side yet; if something starts to, it needs a way to
   reach `meta` — say so rather than silently getting page 1 forever.

## Documentation status (as of this note)

`API.md`, `API_REFERENCE.md` and `openapi.yaml` in the backend are stale —
`openapi.yaml` predates the module work and pins only legacy paths. None of the
migrated families above were ever documented there. **Do not build a client against
those files.** The pinned route inventory test is the contract; `/docs` on a running
backend serves the real, current schema.
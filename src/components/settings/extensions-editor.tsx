"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { conversationSchema } from "@/lib/schemas/agent";

// ============================================================================
// ExtensionsEditor — spec 0043 custom conversation extensions.
//
// Bound form path: `agent_config.conversation.extensions`
// (Record<string, unknown>, mirrors backend ConversationConfig.extensions).
//
// DELETION-TRACKING CONVENTION (loud, by design — read before touching save):
// deletions are PLAIN KEY REMOVALS from the `extensions` object in form
// state. This component keeps NO separate deleted-keys list and writes NO
// phantom `__deletedExtensions` field. The save layer derives PATCH
// `clear_extensions` by DIFFING current form keys against the initially
// loaded (server) keys: any initial key absent from the form was deleted.
// Rationale: PUT fully overwrites so absence already deletes there; a
// phantom tracking field would leak into the PUT payload and the zod schema,
// while diffing keeps form state exactly equal to the desired end state and
// survives form resets (a tracking list would go stale on reset).
//
// Validation here is FAST FEEDBACK ONLY — the server is authoritative on key
// syntax, forbidden names, and all byte/count bounds. Never rely on these
// client checks for safety.
// ============================================================================

/** Form path this editor owns. Nothing else in the form writes here. */
const EXTENSIONS_FIELD = "agent_config.conversation.extensions";

/** Mirrors backend EXTENSION_KEY_PATTERN (spec 0043, Slice A). */
const EXTENSION_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/** Mirrors backend EXTENSION_FORBIDDEN_NAMES — prototype-pollution guard. */
const EXTENSION_FORBIDDEN_NAMES: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/** Mirrors backend MAX_EXTENSION_KEYS — display only, server enforces. */
const MAX_EXTENSION_KEYS = 32;

/** Mirrors backend MAX_EXTENSION_VALUE_BYTES — warning only, server enforces. */
const MAX_EXTENSION_VALUE_BYTES = 4096;

/** First-class conversation field names. An extension key matching one of
 *  these triggers a client-side warning: the namespaces are separate on the
 *  wire and the SERVER WINS SILENTLY (the first-class field carries runtime
 *  meaning; the extension key is inert data). Derived from the zod shape so
 *  the list can never drift from the form schema. */
const FIRST_CLASS_CONVERSATION_FIELDS: readonly string[] = Object.keys(
  conversationSchema.shape,
).filter((key) => key !== "extensions");

type ExtensionsMap = Record<string, unknown>;

function readExtensions(getValues: (name: string) => unknown): ExtensionsMap {
  const raw = getValues(EXTENSIONS_FIELD);
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as ExtensionsMap;
  }
  return {};
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    const text = JSON.stringify(value, null, 2);
    return typeof text === "string" ? text : String(value);
  } catch {
    return String(value);
  }
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

function validateKey(key: string, existingKeys: readonly string[]): string | undefined {
  if (key.length === 0) return "Key is required.";
  if (!EXTENSION_KEY_PATTERN.test(key)) {
    return "Letters, digits, underscore only; must start with a letter; max 64 chars.";
  }
  if (EXTENSION_FORBIDDEN_NAMES.has(key)) {
    return `"${key}" is reserved and cannot be used.`;
  }
  if (existingKeys.includes(key)) {
    return `"${key}" already exists — delete it first to replace it.`;
  }
  if (existingKeys.length >= MAX_EXTENSION_KEYS) {
    return `Server allows at most ${MAX_EXTENSION_KEYS} keys.`;
  }
  return undefined;
}

export function ExtensionsEditor() {
  const { control, setValue, getValues } = useFormContext();
  const watched = useWatch({ control, name: EXTENSIONS_FIELD }) as
    | ExtensionsMap
    | undefined;
  const extensions: ExtensionsMap =
    watched !== null && typeof watched === "object" && !Array.isArray(watched)
      ? watched
      : {};
  const keys = Object.keys(extensions);

  // Local-only UI state: raw textarea drafts + inline errors. Drafts are
  // NEVER form state — the form only ever holds parsed JSON values, so an
  // invalid edit cannot leak into a save payload.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [valueErrors, setValueErrors] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState<string>("");
  const [newValue, setNewValue] = useState<string>("");
  const [newKeyError, setNewKeyError] = useState<string | undefined>(undefined);
  const [newValueError, setNewValueError] = useState<string | undefined>(undefined);

  function clearRowState(key: string): void {
    setDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setValueErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function commitValue(key: string): void {
    const draft = drafts[key];
    if (draft === undefined) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      // Invalid JSON is NEVER written to the form — draft stays so the
      // user can fix it, and the last good value is untouched.
      setValueErrors((prev) => ({ ...prev, [key]: "Invalid JSON — fix it or the last saved value stays." }));
      return;
    }
    const current = readExtensions(getValues);
    // Computed key (never the `__proto__:` literal form) so even a
    // reserved name would land as an own property; validation forbids
    // those names from ever reaching here anyway.
    setValue(EXTENSIONS_FIELD, { ...current, [key]: parsed }, {
      shouldDirty: true,
      shouldTouch: true,
    });
    clearRowState(key);
  }

  function handleDelete(key: string): void {
    const current = readExtensions(getValues);
    const next = { ...current };
    delete next[key];
    // Plain key removal — see the DELETION-TRACKING CONVENTION above. The
    // PATCH save layer diffs against the initially loaded keys to derive
    // `clear_extensions`; PUT needs nothing (full overwrite).
    setValue(EXTENSIONS_FIELD, next, { shouldDirty: true, shouldTouch: true });
    clearRowState(key);
  }

  function handleAdd(): void {
    const key = newKey.trim();
    const current = readExtensions(getValues);
    const keyError = validateKey(key, Object.keys(current));
    setNewKeyError(keyError);
    let parsed: unknown;
    try {
      parsed = JSON.parse(newValue);
    } catch {
      setNewValueError("Invalid JSON — value was not added. Quote plain strings.");
      parsed = undefined;
    }
    if (keyError !== undefined || newValue === "" || parsed === undefined) {
      if (newValue === "" && newValueError === undefined) {
        setNewValueError("Value is required (JSON — quote plain strings).");
      }
      return;
    }
    setValue(EXTENSIONS_FIELD, { ...current, [key]: parsed }, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setNewKey("");
    setNewValue("");
    setNewKeyError(undefined);
    setNewValueError(undefined);
  }

  return (
    <div className="col-span-1 lg:col-span-2 flex flex-col gap-4 min-w-0">
      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom extensions yet. Add tenant-specific flags, thresholds, or experiment knobs below.
        </p>
      ) : (
        keys.map((key) => {
          const display = drafts[key] ?? stringifyValue(extensions[key]);
          const collides = FIRST_CLASS_CONVERSATION_FIELDS.includes(key);
          const committedBytes = utf8Bytes(JSON.stringify(extensions[key] ?? null));
          return (
            <motion.div
              key={key}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              className="rounded-xl border border-border bg-muted/50 p-4 flex flex-col gap-2 min-w-0"
            >
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-sm text-foreground truncate">{key}</code>
                <button
                  type="button"
                  onClick={() => handleDelete(key)}
                  aria-label={`Delete extension ${key}`}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Delete
                </button>
              </div>
              {collides && (
                <p className="text-xs text-amber-500">
                  Warning: “{key}” matches a built-in conversation setting — the built-in wins on the
                  server (namespaces are separate). Rename your key unless this shadowing is intended.
                </p>
              )}
              {committedBytes > MAX_EXTENSION_VALUE_BYTES && (
                <p className="text-xs text-amber-500">
                  Value is ~{committedBytes} bytes — over the {MAX_EXTENSION_VALUE_BYTES}-byte server cap
                  and will be rejected on save.
                </p>
              )}
              <textarea
                value={display}
                rows={3}
                spellCheck={false}
                onChange={(event) => {
                  const text = event.target.value;
                  setDrafts((prev) => ({ ...prev, [key]: text }));
                }}
                onBlur={() => commitValue(key)}
                placeholder={'JSON value, e.g. {"threshold": 0.8} or "us-east"'}
                aria-label={`Value for extension ${key} (JSON)`}
                className={cn(
                  "w-full font-mono text-sm bg-muted/50 border border-border rounded-xl px-4 py-2.5",
                  "text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2",
                  "focus:ring-ember-400/50 focus:border-ember-400/50 transition-all shadow-inner resize-y",
                )}
              />
              {valueErrors[key] ? (
                <p className="text-xs text-destructive">{valueErrors[key]}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  JSON — parsed on blur. Invalid JSON is never saved; quote plain strings.
                </p>
              )}
            </motion.div>
          );
        })
      )}

      <motion.div
        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
        className="rounded-xl border border-dashed border-border p-4 flex flex-col gap-2 min-w-0"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">Add extension</span>
          <span className="text-xs text-muted-foreground">
            {keys.length} / {MAX_EXTENSION_KEYS} keys
          </span>
        </div>
        <label htmlFor="extensions-new-key" className="text-sm font-medium text-foreground">
          Key
        </label>
        <input
          id="extensions-new-key"
          value={newKey}
          onChange={(event) => {
            setNewKey(event.target.value);
            if (newKeyError !== undefined) setNewKeyError(undefined);
          }}
          placeholder="e.g. vendor_mode"
          className="w-full font-mono text-sm bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all shadow-inner"
        />
        {newKeyError ? (
          <p className="text-xs text-destructive">{newKeyError}</p>
        ) : (
          newKey.trim().length > 0 &&
          FIRST_CLASS_CONVERSATION_FIELDS.includes(newKey.trim()) && (
            <p className="text-xs text-amber-500">
              Warning: “{newKey.trim()}” matches a built-in conversation setting — the built-in wins
              on the server.
            </p>
          )
        )}
        <label htmlFor="extensions-new-value" className="text-sm font-medium text-foreground">
          Value (JSON)
        </label>
        <textarea
          id="extensions-new-value"
          value={newValue}
          rows={2}
          spellCheck={false}
          onChange={(event) => {
            setNewValue(event.target.value);
            if (newValueError !== undefined) setNewValueError(undefined);
          }}
          placeholder={'e.g. "fast" or {"retries": 3}'}
          className="w-full font-mono text-sm bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all shadow-inner resize-y"
        />
        {newValueError && <p className="text-xs text-destructive">{newValueError}</p>}
        <div>
          <button
            type="button"
            onClick={handleAdd}
            className="h-9 px-3 rounded-xl text-xs font-semibold bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            Add key
          </button>
        </div>
      </motion.div>
    </div>
  );
}

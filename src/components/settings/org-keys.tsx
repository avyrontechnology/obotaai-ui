"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { useCreateApiKey, useDeleteApiKey, useApiKeys } from "@/services/platform/api-keys";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";


export function OrgKeys() {
  const { data: keys, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();

  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [freshSecret, setFreshSecret] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Give the key a name first.");
      return;
    }
    try {
      const created = await createKey.mutateAsync(name.trim());
      setFreshSecret({ name: created.name, key: created.key });
      setName("");
      setShowForm(false);
    } catch {
      setError("Could not create the key. Is the backend running?");
    }
  };

  const copySecret = async () => {
    if (!freshSecret) return;
    try {
      await navigator.clipboard.writeText(freshSecret.key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">API Keys</h3>
          <p className="text-sm text-muted-foreground mt-1">Authenticate external requests. Secrets show once.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> New key
          </button>
        )}
      </div>

      {freshSecret && (
        <div className="p-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {freshSecret.name} created — copy it now, it will never show again.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 min-w-0 truncate h-11 px-4 flex items-center bg-card border border-border rounded-2xl font-mono text-xs text-foreground">
              {freshSecret.key}
            </code>
            <button
              onClick={() => void copySecret()}
              aria-label="Copy secret key"
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                setFreshSecret(null);
                setCopied(false);
              }}
              className="h-11 px-4 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate().catch(() => undefined);
              }
            }}
            placeholder="Key name, e.g. Production Gateway"
            aria-label="API key name"
            className={cn(fieldStyles.fieldMuted, "flex-1")}
          />
          <button
            onClick={() => void handleCreate().catch(() => undefined)}
            disabled={createKey.isPending}
            className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
          >
            {createKey.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </button>
        </div>
      )}
      {error && (
        <p className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      {isLoading ? (
        <div className="h-32 rounded-3xl bg-card border border-border animate-pulse" />
      ) : (keys ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-8 text-center">
          No API keys yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {(keys ?? []).map((key) => (
            <div
              key={key.key_id}
              className="flex items-center justify-between gap-4 p-5 bg-muted/40 border border-border rounded-3xl"
            >
              <div className="min-w-0">
                <h4 className="font-medium text-sm text-foreground truncate">{key.name}</h4>
                <p className="text-xs font-mono text-muted-foreground mt-1 truncate">
                  {key.prefix}•••• · created {timeAgo(key.created_at)}
                </p>
              </div>
              <button
                onClick={() => void deleteKey.mutateAsync(key.key_id)}
                aria-label={`Revoke ${key.name}`}
                className="px-4 h-9 rounded-xl text-xs font-medium text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

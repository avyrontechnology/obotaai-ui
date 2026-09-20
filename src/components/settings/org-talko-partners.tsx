"use client";

import { useState } from "react";
import { AlertCircle, Check, KeyRound, Loader2, Phone, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  useConnectTalkoPartner,
  useDeleteTalkoPartner,
  usePreviewTalkoPartner,
  useRefreshTalkoPartnerDids,
  useTalkoPartners,
  useUpdateTalkoPartner,
} from "@/services/platform/talko-partners";
import type { TalkoPartner, TalkoPartnerPreview } from "@/lib/schemas/platform";
import { Modal } from "@/components/common/modal";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

function DidChips({ dids, defaultDid }: { dids: string[]; defaultDid?: string | null }) {
  if (dids.length === 0) {
    return <p className="text-xs font-mono text-muted-foreground">No DIDs fetched yet — refresh below.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {dids.map((did) => (
        <span
          key={did}
          title={did === defaultDid ? `${did} (default caller ID)` : did}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums border",
            did === defaultDid
              ? "bg-primary/10 text-ember-700 dark:text-ember-300 border-primary/20"
              : "bg-muted text-muted-foreground border-border"
          )}
        >
          <Phone className="w-3 h-3" aria-hidden="true" />
          {did}
          {did === defaultDid && <span aria-hidden="true">· default</span>}
        </span>
      ))}
    </div>
  );
}

function ConnectModal({ onClose }: { onClose: () => void }) {
  const preview = usePreviewTalkoPartner();
  const connect = useConnectTalkoPartner();
  const [apiKey, setApiKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [manualPartnerId, setManualPartnerId] = useState("");
  const [result, setResult] = useState<TalkoPartnerPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!apiKey.trim() || preview.isPending) return;
    setError(null);
    setResult(null);
    try {
      const fetched = await preview.mutateAsync({ talko_api_key: apiKey.trim() });
      setResult(fetched);
      if (!displayName.trim() && fetched.partner_id) setDisplayName(`Partner ${fetched.partner_id}`);
    } catch {
      setError("Could not validate that key. Check it and retry.");
    }
  };

  const handleConnect = async () => {
    if (!apiKey.trim() || connect.isPending) return;
    setError(null);
    try {
      await connect.mutateAsync({
        talko_api_key: apiKey.trim(),
        display_name: displayName.trim() || (result?.partner_id ? `Partner ${result.partner_id}` : ""),
        partner_id: manualPartnerId.trim() || undefined,
      });
      onClose();
    } catch {
      setError("Could not connect. The key may be invalid or the service unreachable.");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      label="Connect Talko partner"
      title={<h4 className="font-semibold text-foreground">Connect Talko partner</h4>}
      className="max-w-md space-y-3"
    >
      <label className="flex flex-col gap-1.5 min-w-0">
        <span className="text-xs font-medium text-foreground">Talko partner API key</span>
        <input
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          type="password"
          placeholder="tkp_live_…"
          aria-label="Talko partner API key"
          autoComplete="off"
          className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
        />
      </label>
      <button
        onClick={handleFetch}
        disabled={!apiKey.trim() || preview.isPending}
        className="w-full h-11 rounded-2xl border border-border text-sm font-semibold hover:bg-muted/50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
      >
        {preview.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        Fetch DIDs
      </button>

      {result && (
        <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Key valid
            {result.partner_id ? (
              <>
                {" "}for partner <span className="font-mono text-foreground">{result.partner_id}</span>
              </>
            ) : (
              " — but no DIDs came back"
            )}
            . {result.dids.length > 0 && "Pick nothing — all DIDs attach on connect."}
          </p>
          <DidChips dids={result.dids} defaultDid={result.dids[0] ?? null} />
          {result.partner_id === null && (
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="text-xs font-medium text-foreground">
                Partner ID <span className="text-muted-foreground">(no DIDs found — enter it manually)</span>
              </span>
              <input
                value={manualPartnerId}
                onChange={(event) => setManualPartnerId(event.target.value)}
                placeholder="2"
                aria-label="Partner ID"
                inputMode="numeric"
                autoComplete="off"
                className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs font-medium text-foreground">Display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={result.partner_id ? `Partner ${result.partner_id}` : "Acme Corp"}
              aria-label="Display name"
              autoComplete="off"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
            />
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      <button
        onClick={handleConnect}
        disabled={!apiKey.trim() || connect.isPending}
        className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
      >
        {connect.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Plus className="w-4 h-4" aria-hidden="true" />
        )}
        Connect{result && result.dids.length > 0 ? ` · ${result.dids.length} DID${result.dids.length === 1 ? "" : "s"}` : ""}
      </button>
      <p className="text-[11px] text-muted-foreground">
        The key is stored for dialing and never shown again. DIDs refresh anytime from the card.
      </p>
    </Modal>
  );
}

function RotateKeyModal({ partner, onClose }: { partner: TalkoPartner; onClose: () => void }) {
  const updatePartner = useUpdateTalkoPartner();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open
      onClose={onClose}
      label={`Rotate key for partner ${partner.partner_id}`}
      title={<h4 className="font-semibold text-foreground">Rotate key</h4>}
      className="max-w-md space-y-3"
    >
      <label className="flex flex-col gap-1.5 min-w-0">
        <span className="text-xs font-medium text-foreground">New Talko API key</span>
        <input
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          type="password"
          placeholder="tkp_live_…"
          aria-label="New Talko API key"
          autoComplete="off"
          className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
        />
      </label>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}
      <button
        onClick={() => {
          if (!apiKey.trim()) return;
          void updatePartner
            .mutateAsync({ id: partner.partner_id, talko_api_key: apiKey.trim() })
            .then(() => onClose())
            .catch(() => setError("Could not save. Is the backend running?"));
        }}
        disabled={!apiKey.trim() || updatePartner.isPending}
        className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
      >
        {updatePartner.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        Save new key
      </button>
    </Modal>
  );
}

function PartnerCard({ partner }: { partner: TalkoPartner }) {
  const refreshDids = useRefreshTalkoPartnerDids();
  const deletePartner = useDeleteTalkoPartner();
  const [rotating, setRotating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const actionError = refreshDids.isError || deletePartner.isError;

  return (
    <div className="p-5 md:p-6 bg-card border border-border rounded-3xl min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4 text-ember-700 dark:text-ember-300" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-foreground tracking-tight truncate" title={partner.display_name || partner.partner_id}>
              {partner.display_name || `Partner ${partner.partner_id}`}
            </h4>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground truncate" title={`partner ${partner.partner_id}`}>
              partner {partner.partner_id}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border shrink-0",
            partner.key_configured
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
          )}
          title={partner.key_configured ? "API key stored" : "No API key — dials with this partner fail"}
        >
          {partner.key_configured && <Check className="w-3 h-3" aria-hidden="true" />}
          {partner.key_configured ? "Key set" : "No key"}
        </span>
      </div>

      <div className="mb-3 space-y-2 min-w-0">
        <DidChips dids={partner.dids ?? []} defaultDid={partner.default_did} />
        {partner.key_hint && (
          <p className="text-xs font-mono text-muted-foreground truncate tabular-nums" title={`Key ending ${partner.key_hint}`}>
            key: <span className="text-foreground">••••{partner.key_hint}</span>
          </p>
        )}
      </div>

      {actionError && (
        <p className="flex items-center gap-2 text-xs text-destructive mb-3 min-w-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate" title="Could not save. Is the backend running?">
            Could not save. Is the backend running?
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2 min-w-0">
        {confirmingDelete ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <p className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
              Delete partner {partner.partner_id}?
            </p>
            <button
              onClick={() => {
                void deletePartner.mutateAsync(partner.partner_id).catch(() => undefined);
                setConfirmingDelete(false);
              }}
              disabled={deletePartner.isPending}
              aria-label={`Confirm delete partner ${partner.partner_id}`}
              className="flex items-center gap-1 px-2.5 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" /> Delete
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              aria-label="Cancel delete"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted text-muted-foreground border border-border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => void refreshDids.mutateAsync(partner.partner_id).catch(() => undefined)}
              disabled={refreshDids.isPending}
              title="Re-fetch DIDs with the stored key"
              className="flex-1 min-w-[100px] h-9 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none truncate px-2 inline-flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshDids.isPending && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
              Refresh DIDs
            </button>
            <button
              onClick={() => setRotating(true)}
              className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none shrink-0"
            >
              Rotate key
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete partner ${partner.partner_id}`}
              title={`Delete partner ${partner.partner_id}`}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {rotating && <RotateKeyModal partner={partner} onClose={() => setRotating(false)} />}
    </div>
  );
}

export function OrgTalkoPartners() {
  const { data: partners, isLoading } = useTalkoPartners();
  const [connecting, setConnecting] = useState(false);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h3 className="font-semibold text-foreground tracking-tight">Talko partners</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Connect with a partner API key — DIDs fetch themselves. One partner, many caller IDs.
          </p>
        </div>
        <button
          onClick={() => setConnecting(true)}
          className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Connect
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : (partners ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          No partners connected yet. Connect with a Talko API key to start dialing.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
          {(partners ?? []).map((partner) => (
            <PartnerCard key={partner.partner_id} partner={partner} />
          ))}
        </div>
      )}

      {connecting && <ConnectModal onClose={() => setConnecting(false)} />}
    </section>
  );
}

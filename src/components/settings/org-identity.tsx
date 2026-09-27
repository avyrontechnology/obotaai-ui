"use client";

import { useState } from "react";
import { AlertCircle, Building2, Check, Loader2, Lock } from "lucide-react";
import { useSession } from "@/services/auth";
import { ApiError } from "@/lib/api-client";
import {
  useCreateOrganization,
  useCreateTenant,
} from "@/services/platform/identity";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/common/section-header";

/** Tenant/org administration (spec 0041 Slice A).
 *
 *  Owner-gating reads `session.user.role` directly: tenant/org creation is
 *  a global owner grant, not a team grant, and no new RBAC action exists
 *  for it (`rbac.ts` is owned by Slice B). The backend re-checks
 *  everything. The acting tenant always rides the session
 *  (`session.user.tenant_id`) — there is intentionally no tenant picker
 *  or switcher. The team list lives in `org-team.tsx` and is not
 *  duplicated here.
 */

function TenantContextSection({
  tenantId,
  orgId,
}: {
  tenantId: string | null;
  orgId: string | undefined;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Workspace identity"
        description="The tenant your session belongs to. Sessions resolve from the user row — the UI never switches tenants."
        className="mb-6"
      />
      {tenantId ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 md:px-5 bg-muted/40 border border-border rounded-3xl min-w-0">
          <div
            className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <Building2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground font-mono truncate" title={tenantId}>
              {tenantId}
            </p>
            <p className="text-xs text-muted-foreground truncate" title={orgId ?? "No organization context"}>
              {orgId ? `org ${orgId}` : "No organization context"}
            </p>
          </div>
          <span
            className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400 shrink-0"
            title="This session resolved, so the tenant is not suspended"
          >
            active
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          Tenant context unavailable — this backend predates identity (pre-identity user rows
          omit tenant_id).
        </p>
      )}
    </section>
  );
}

function OrganizationCreateSection({
  tenantId,
  isOwner,
}: {
  tenantId: string | null;
  isOwner: boolean;
}) {
  const createOrganization = useCreateOrganization();
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOwner) {
    return (
      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <SectionHeader
          title="Organization"
          description="Organizations group teams under your tenant. Read-only — requires the owner role."
          className="mb-6"
        />
        <p className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Read-only — organization management needs the owner role.</span>
        </p>
      </section>
    );
  }

  const handleCreate = () => {
    setFormError(null);
    setNotice(null);
    if (!name.trim()) {
      setFormError("Give the organization a name.");
      return;
    }
    if (!tenantId) {
      setFormError("Sign in with a tenant-scoped session to create an organization.");
      return;
    }
    createOrganization.mutate(
      { tenant_id: tenantId, name: name.trim() },
      {
        onSuccess: (org) => {
          setNotice(`Created organization ${org.name}.`);
          setName("");
        },
        onError: (e) =>
          setFormError(
            e instanceof ApiError && e.status === 404
              ? "Unknown tenant — the acting tenant no longer exists."
              : e instanceof ApiError && e.status >= 500
                ? "Organization management unavailable on this backend."
                : e instanceof Error
                  ? e.message
                  : "Create failed."
          ),
      }
    );
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Organization"
        description="Create an organization under the acting tenant — the tenant rides your session, never a picker."
        className="mb-6"
      />
      <div className="flex flex-col sm:flex-row gap-2 min-w-0">
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setFormError(null);
            setNotice(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleCreate();
            }
          }}
          placeholder="New organization name, e.g. Acme EU"
          aria-label="New organization name"
          disabled={createOrganization.isPending}
          className={cn(fieldStyles.fieldSm, "flex-1 min-w-0 disabled:opacity-50")}
        />
        <button
          onClick={handleCreate}
          disabled={createOrganization.isPending}
          className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          {createOrganization.isPending && (
            <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
          Create organization
        </button>
      </div>
      {formError && (
        <p className="mt-3 flex items-center gap-2 text-xs text-destructive min-w-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{" "}
          <span className="truncate" title={formError}>
            {formError}
          </span>
        </p>
      )}
      {notice && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 min-w-0">
          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{" "}
          <span className="truncate" title={notice}>
            {notice}
          </span>
        </p>
      )}
    </section>
  );
}

function TenantCreateSection() {
  const createTenant = useCreateTenant();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCreate = () => {
    setFormError(null);
    setNotice(null);
    if (!slug.trim() || !name.trim()) {
      setFormError("Give the tenant a slug and a name.");
      return;
    }
    createTenant.mutate(
      { slug: slug.trim(), name: name.trim() },
      {
        onSuccess: (tenant) => {
          setNotice(`Created tenant ${tenant.slug}.`);
          setSlug("");
          setName("");
        },
        onError: (e) =>
          setFormError(
            e instanceof ApiError && e.status === 409
              ? "Slug already taken — pick another."
              : e instanceof ApiError && e.status >= 500
                ? "Tenant management unavailable on this backend."
                : e instanceof Error
                  ? e.message
                  : "Create failed."
          ),
      }
    );
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Tenant"
        description="Bootstrap provisioning for sessions without tenant context. Shown only until a tenant exists — never a switcher."
        className="mb-6"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
        <input
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setFormError(null);
            setNotice(null);
          }}
          placeholder="Tenant slug, e.g. acme"
          aria-label="New tenant slug"
          disabled={createTenant.isPending}
          className={cn(fieldStyles.fieldSm, "min-w-0 font-mono text-xs disabled:opacity-50")}
        />
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setFormError(null);
            setNotice(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleCreate();
            }
          }}
          placeholder="Tenant name, e.g. Acme Inc"
          aria-label="New tenant name"
          disabled={createTenant.isPending}
          className={cn(fieldStyles.fieldSm, "min-w-0 disabled:opacity-50")}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-2 min-w-0">
        <button
          onClick={handleCreate}
          disabled={createTenant.isPending}
          className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          {createTenant.isPending && (
            <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
          Create tenant
        </button>
      </div>
      {formError && (
        <p className="mt-3 flex items-center gap-2 text-xs text-destructive min-w-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{" "}
          <span className="truncate" title={formError}>
            {formError}
          </span>
        </p>
      )}
      {notice && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 min-w-0">
          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{" "}
          <span className="truncate" title={notice}>
            {notice}
          </span>
        </p>
      )}
    </section>
  );
}

export function OrgIdentity() {
  const { data: session } = useSession();
  const tenantId = session?.user.tenant_id ?? null;
  const isOwner = session?.user.role === "owner";

  return (
    <div className="space-y-6 min-w-0">
      <TenantContextSection tenantId={tenantId} orgId={session?.user.org_id} />
      <OrganizationCreateSection tenantId={tenantId} isOwner={isOwner} />
      {!tenantId && isOwner && <TenantCreateSection />}
    </div>
  );
}

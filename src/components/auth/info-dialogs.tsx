"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  Headset,
  KeyRound,
  LifeBuoy,
  Lock,
  Shield,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/common/modal";
import { cn } from "@/lib/utils";

/* Auth surfaces are always light, so these dialogs pin the light palette
   (bg-white/ink) instead of the theme tokens Modal defaults to. */
const LIGHT_PANEL = "bg-white border-[#F6E8C8] text-[#1F2937] shadow-[0_32px_80px_-24px_rgba(17,24,39,0.35)]";

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close dialog"
      className="p-2 rounded-xl text-[#6B7280] hover:text-[#111827] hover:bg-[#FFF6E8] transition-colors shrink-0"
    >
      <X className="w-5 h-5" />
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Coming soon                                                              */
/* ------------------------------------------------------------------------ */

export type ComingSoonTopic = "docs" | "support" | "api" | "google" | "sso";

interface Feature {
  title: string;
  detail: string;
}

interface ComingSoonContent {
  icon: LucideIcon;
  title: string;
  tagline: string;
  /** 0–100: how far along the roadmap item is (drives the progress bar). */
  progress: number;
  features: Feature[];
}

const COMING_SOON: Record<ComingSoonTopic, ComingSoonContent> = {
  docs: {
    icon: BookOpen,
    title: "Documentation",
    tagline: "Guides, recipes and a full API reference for building voice agents on OtobaAI.",
    progress: 70,
    features: [
      {
        title: "Quickstart guides",
        detail: "Create your first agent, test it in the Playground and place a call in under ten minutes.",
      },
      {
        title: "Agent configuration reference",
        detail: "Every transcriber, LLM, synthesizer and speech-to-speech option explained with defaults and limits.",
      },
      {
        title: "REST & WebSocket API reference",
        detail: "Endpoints under /api/v1, auth with scoped API keys, and the realtime call socket protocol.",
      },
      {
        title: "Telephony recipes",
        detail: "Step-by-step setup for Twilio, Plivo and Talko numbers, inbound routing and batch campaigns.",
      },
    ],
  },
  support: {
    icon: Headset,
    title: "Enterprise Support",
    tagline: "Dedicated help for teams running voice agents in production.",
    progress: 45,
    features: [
      {
        title: "Priority response SLAs",
        detail: "Guaranteed first-response times for production incidents, around the clock.",
      },
      {
        title: "Named solutions engineer",
        detail: "A single point of contact for architecture reviews, rollout planning and tuning latency.",
      },
      {
        title: "Private onboarding",
        detail: "Hands-on workspace setup, SSO, carrier integration and migration of existing agents.",
      },
      {
        title: "Shared incident channel",
        detail: "A private channel with our engineering team plus proactive status updates.",
      },
    ],
  },
  api: {
    icon: FileText,
    title: "Public API v2.4",
    tagline: "A versioned, documented public API for agents, calls, batches and telemetry.",
    progress: 60,
    features: [
      { title: "OpenAPI specification", detail: "A downloadable spec you can generate typed clients from." },
      { title: "Scoped API keys", detail: "Create keys limited to exactly the scopes an integration needs." },
      { title: "Webhooks", detail: "Signed callbacks for call lifecycle, transcripts and batch progress." },
    ],
  },
  google: {
    icon: Sparkles,
    title: "Google sign-in",
    tagline: "One-click sign-in with your Google Workspace account.",
    progress: 35,
    features: [
      { title: "Workspace domain restriction", detail: "Only accounts from your verified domain can join." },
      { title: "Invite-aware linking", detail: "Pending invites link automatically to the matching Google account." },
    ],
  },
  sso: {
    icon: KeyRound,
    title: "SAML / Okta SSO",
    tagline: "Enterprise single sign-on with your identity provider.",
    progress: 25,
    features: [
      { title: "SAML 2.0", detail: "Works with Okta, Azure AD / Entra ID, OneLogin and other SAML IdPs." },
      { title: "SCIM provisioning", detail: "Create, update and deactivate members automatically from your IdP." },
      { title: "Role mapping", detail: "Map IdP groups to owner, admin, member and viewer roles." },
    ],
  },
};

export function ComingSoonDialog({ topic, onClose }: { topic: ComingSoonTopic | null; onClose: () => void }) {
  const content = topic ? COMING_SOON[topic] : null;
  return (
    <Modal
      open={content !== null}
      onClose={onClose}
      label={content ? `${content.title} — coming soon` : "Coming soon"}
      className={cn(LIGHT_PANEL, "max-w-lg p-0 overflow-hidden")}
      header={<></>}
    >
      {/* Keyed so expanded state resets each time a different topic opens. */}
      {content && <ComingSoonBody key={topic} content={content} onClose={onClose} />}
    </Modal>
  );
}

function ComingSoonBody({ content, onClose }: { content: ComingSoonContent; onClose: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const Icon = content.icon;
  return (
    <div>
      <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-[#FFF6E8] via-[#FFFBF0] to-white border-b border-[#F6E8C8]">
        <div className="flex items-start justify-between gap-4">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E73F1E] to-[#FB6C00] text-white shadow-md">
            <Icon className="w-6 h-6" aria-hidden="true" />
          </span>
          <CloseButton onClose={onClose} />
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white border border-[#F3D9A8] text-[12px] font-bold tracking-wide text-[#C2410C]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FB6C00] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FB6C00]" />
          </span>
          COMING SOON
        </span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#111827]">{content.title}</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-[#4B5563]">{content.tagline}</p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-[12px] font-medium text-[#6B7280] mb-1.5">
            <span>Roadmap progress</span>
            <span className="font-mono text-[#C2410C]">{content.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#F6E8C8] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${content.progress}%` }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
              className="h-full rounded-full bg-gradient-to-r from-[#E73F1E] via-[#FB6C00] to-[#F9B637]"
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        <p className="text-[12px] font-bold tracking-widest text-[#6B7280] mb-3">WHAT&apos;S ON THE WAY</p>
        <ul className="space-y-2">
          {content.features.map((feature, index) => {
            const open = expanded === index;
            return (
              <li key={feature.title}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : index)}
                  aria-expanded={open}
                  className={cn(
                    "w-full text-left rounded-2xl border px-4 py-3 transition-colors",
                    open ? "border-[#F3D9A8] bg-[#FFFBF0]" : "border-[#F1F1F1] hover:border-[#F3D9A8] hover:bg-[#FFFBF0]/60"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full shrink-0 transition-colors",
                        open ? "bg-[#E73F1E] text-white" : "bg-[#FFF6E8] text-[#C2410C]"
                      )}
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-[14px] font-semibold text-[#111827]">{feature.title}</span>
                    <ChevronDown
                      className={cn("w-4 h-4 text-[#9CA3AF] transition-transform", open && "rotate-180")}
                      aria-hidden="true"
                    />
                  </span>
                  {open && (
                    <motion.span
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="block pl-9 pt-2 text-[13px] leading-relaxed text-[#4B5563]"
                    >
                      {feature.detail}
                    </motion.span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full h-11 rounded-2xl bg-gradient-to-r from-[#E73F1E] to-[#FB6C00] text-white font-semibold text-[15px] shadow-md hover:brightness-105 transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Legal & security documents                                               */
/* ------------------------------------------------------------------------ */

export type LegalDoc = "privacy" | "terms" | "security";

interface DocSection {
  id: string;
  title: string;
  body: ReactNode;
}

interface DocContent {
  icon: LucideIcon;
  title: string;
  summary: string;
  sections: DocSection[];
}

const LAST_UPDATED = "October 4, 2026";

function P({ children }: { children: ReactNode }) {
  return <p className="text-[14px] leading-relaxed text-[#374151]">{children}</p>;
}

function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-[14px] leading-relaxed text-[#374151]">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#FB6C00] shrink-0" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const DOCS: Record<LegalDoc, DocContent> = {
  privacy: {
    icon: Lock,
    title: "Privacy Policy",
    summary:
      "How OtobaAI Platform Inc. collects, uses and protects personal data when you use the OtobaAI console, APIs and voice agents.",
    sections: [
      {
        id: "scope",
        title: "1. Scope",
        body: (
          <P>
            This policy covers the OtobaAI web console, public and private APIs, and voice agents operated on the
            OtobaAI platform (together, the &quot;Service&quot;). When a business deploys voice agents to talk with
            its own customers, that business is the data controller for those conversations and OtobaAI acts as its
            processor.
          </P>
        ),
      },
      {
        id: "collect",
        title: "2. Information we collect",
        body: (
          <UL
            items={[
              <><strong>Account data</strong> — name, email address, role and workspace membership. Passwords are never stored in plain text.</>,
              <><strong>Agent configuration</strong> — prompts, voices, tools, knowledge-base documents and telephony settings you create.</>,
              <><strong>Call and chat data</strong> — audio streams, transcripts, timing and latency metrics, and call outcomes generated when agents run.</>,
              <><strong>Usage and device data</strong> — request logs, IP address, browser type and timestamps used for security and reliability.</>,
              <><strong>Billing data</strong> — plan, credit balance and invoices. Card details are handled by our payment processor, not stored by us.</>,
            ]}
          />
        ),
      },
      {
        id: "use",
        title: "3. How we use information",
        body: (
          <UL
            items={[
              "To provide, operate and maintain the Service, including running calls and storing their results.",
              "To authenticate users, enforce role-based permissions and protect against abuse.",
              "To monitor performance, debug issues and improve latency and quality.",
              "To communicate about your account, security notices and changes to the Service.",
              "To meet legal obligations and enforce our Terms of Service.",
            ]}
          />
        ),
      },
      {
        id: "ai",
        title: "4. AI providers and model training",
        body: (
          <P>
            To run an agent, audio and text are sent to the speech-recognition, language-model and speech-synthesis
            providers configured on that agent, under their API terms. We do not use your conversations or
            configuration to train our own models, and we select provider API terms that do not permit training on
            your data where such options are offered.
          </P>
        ),
      },
      {
        id: "sharing",
        title: "5. Sharing",
        body: (
          <>
            <P>We do not sell personal data. We share it only with:</P>
            <UL
              items={[
                "Sub-processors that host or operate the Service (cloud infrastructure, database, AI and telephony providers).",
                "Your workspace administrators, who can see members, calls and agent activity in that workspace.",
                "Authorities when required by law, or to protect the rights and safety of users and the public.",
                "A successor entity in a merger or acquisition, subject to this policy.",
              ]}
            />
          </>
        ),
      },
      {
        id: "retention",
        title: "6. Retention",
        body: (
          <P>
            Account data is kept while your account is active. Call recordings, transcripts and logs are kept for the
            period configured by your workspace, then deleted. Zero-retention options are available for workloads
            that must not store conversation content. Backups roll off on a fixed schedule.
          </P>
        ),
      },
      {
        id: "rights",
        title: "7. Your rights",
        body: (
          <P>
            Depending on where you live, you may have the right to access, correct, export or delete your personal
            data, and to object to or restrict certain processing. Contact your workspace owner or OtobaAI support to
            make a request; we respond within the time required by applicable law (for example GDPR, UK GDPR, CCPA
            and India&apos;s DPDP Act).
          </P>
        ),
      },
      {
        id: "security",
        title: "8. Security",
        body: (
          <P>
            We protect data with encryption in transit, hashed credentials, short-lived tokens, role-based access and
            audit logging. See the Security Architecture document for details.
          </P>
        ),
      },
      {
        id: "transfers",
        title: "9. International transfers",
        body: (
          <P>
            Data may be processed in countries other than yours. Where required, we rely on appropriate safeguards
            such as Standard Contractual Clauses.
          </P>
        ),
      },
      {
        id: "changes",
        title: "10. Changes and contact",
        body: (
          <P>
            We will post updates here and change the &quot;last updated&quot; date; material changes are announced in
            the console. Questions can be directed to OtobaAI Platform Inc. through your workspace owner or our
            support channel.
          </P>
        ),
      },
    ],
  },
  terms: {
    icon: FileText,
    title: "Terms of Service",
    summary: "The agreement between you and OtobaAI Platform Inc. governing use of the OtobaAI Service.",
    sections: [
      {
        id: "acceptance",
        title: "1. Acceptance",
        body: (
          <P>
            By creating an account, accepting an invite or using the Service you agree to these Terms. If you use the
            Service on behalf of an organization, you confirm you are authorized to bind it, and &quot;you&quot;
            refers to that organization.
          </P>
        ),
      },
      {
        id: "accounts",
        title: "2. Accounts and workspaces",
        body: (
          <UL
            items={[
              "The first account in a workspace becomes its owner; further members join by invitation.",
              "Owners and admins control member roles (owner, admin, member, viewer) and are responsible for their workspace.",
              "Keep credentials and API keys confidential. You are responsible for activity under your account and keys.",
              "Tell us promptly about any unauthorized access.",
            ]}
          />
        ),
      },
      {
        id: "acceptable-use",
        title: "3. Acceptable use",
        body: (
          <>
            <P>You must not use the Service to:</P>
            <UL
              items={[
                "Place calls or send messages that violate telemarketing, consent, do-not-call or recording laws (e.g. TCPA, TRAI, Ofcom rules).",
                "Impersonate a person or organization, or deceive people about talking to an AI where disclosure is required.",
                "Collect sensitive data unlawfully, harass, defraud or threaten anyone.",
                "Interfere with, probe or overload the Service, or bypass its security or usage limits.",
                "Generate content that is illegal or infringes others' rights.",
              ]}
            />
          </>
        ),
      },
      {
        id: "customer-data",
        title: "4. Your content",
        body: (
          <P>
            You keep all rights to your prompts, documents, recordings and transcripts (&quot;Customer Data&quot;).
            You grant us a limited licence to host and process Customer Data only to provide the Service. You are
            responsible for having the rights and consents needed for the data you upload and the calls you make.
          </P>
        ),
      },
      {
        id: "third-party",
        title: "5. Third-party providers",
        body: (
          <P>
            Agents may use third-party AI and telephony providers you select. Their availability, output and pricing
            are outside our control, and your use of them may also be subject to their terms. AI output can be
            inaccurate — review it before relying on it for important decisions.
          </P>
        ),
      },
      {
        id: "billing",
        title: "6. Plans, credits and billing",
        body: (
          <P>
            Paid usage is billed according to your plan and credit balance. Fees are exclusive of taxes and are
            non-refundable except where required by law. We may suspend workspaces with overdue balances after notice.
          </P>
        ),
      },
      {
        id: "availability",
        title: "7. Availability and changes",
        body: (
          <P>
            We aim for high availability but the Service is provided without a guaranteed uptime unless you have a
            written SLA. We may add, change or retire features; we will give reasonable notice before removing
            functionality you rely on.
          </P>
        ),
      },
      {
        id: "termination",
        title: "8. Suspension and termination",
        body: (
          <P>
            You may stop using the Service at any time. We may suspend or terminate access for material breach of
            these Terms, legal requirements or risk to the Service or others. On termination you can export Customer
            Data for a limited period, after which it is deleted.
          </P>
        ),
      },
      {
        id: "liability",
        title: "9. Disclaimers and liability",
        body: (
          <P>
            To the extent permitted by law, the Service is provided &quot;as is&quot;, and our total liability for any
            claim is limited to the fees you paid in the twelve months before the claim. Neither party is liable for
            indirect or consequential losses.
          </P>
        ),
      },
      {
        id: "general",
        title: "10. General",
        body: (
          <P>
            These Terms are the entire agreement on this subject unless replaced by a signed order form. If a
            provision is unenforceable the rest remains in effect. We may update these Terms; continued use after
            the effective date means you accept the update.
          </P>
        ),
      },
    ],
  },
  security: {
    icon: Shield,
    title: "Security Architecture",
    summary:
      "How OtobaAI protects accounts, data and live voice traffic — from authentication to storage and telephony.",
    sections: [
      {
        id: "overview",
        title: "1. Platform overview",
        body: (
          <P>
            OtobaAI runs as a single API application (every route under <code>/api/v1</code>) backed by MongoDB as
            the system of record, with Redis used only as a short-lived cache. The web console is a separate
            front-end that talks to the API over HTTPS and secure WebSockets.
          </P>
        ),
      },
      {
        id: "identity",
        title: "2. Identity and sessions",
        body: (
          <UL
            items={[
              "Passwords are hashed with PBKDF2-SHA256 and a unique random salt; plain-text passwords are never stored or logged.",
              "Sign-in issues an httpOnly, SameSite session cookie — never readable by page scripts.",
              "Sessions last 7 days, or 30 days when “Remember me” is selected. Signing out revokes the session server-side.",
              "API access uses RS256-signed access tokens (15-minute lifetime) with rotating refresh tokens; revoked tokens are denylisted.",
              "Repeated login attempts are rate-limited per IP address.",
            ]}
          />
        ),
      },
      {
        id: "access",
        title: "3. Authorization",
        body: (
          <UL
            items={[
              "Role-based access control with owner, admin, member and viewer roles, enforced on the server for every request.",
              "Programmatic API keys are scoped to specific permissions (for example calls:write) and can be revoked at any time.",
              "Every record is bound to its organization; queries are tenant-scoped so one workspace cannot read another's data.",
              "Suspended workspaces lose access immediately across the console, API and voice sockets.",
            ]}
          />
        ),
      },
      {
        id: "voice",
        title: "4. Realtime voice security",
        body: (
          <UL
            items={[
              "Live calls stream over a secure WebSocket that requires a single-use, short-lived ticket minted for that call.",
              "Tickets cannot be replayed: each is consumed on connection and expires after 60 seconds if unused.",
              "Inbound carrier webhooks (e.g. Twilio) are verified by request signature; unsigned requests are rejected.",
              "The voice route can be disabled per deployment with a feature flag, keeping the socket dark when not in use.",
            ]}
          />
        ),
      },
      {
        id: "network",
        title: "5. Network and browser protections",
        body: (
          <UL
            items={[
              "TLS for all traffic in production; Secure cookies are enforced outside development.",
              "CORS is restricted to an explicit allow-list of console origins — no wildcards.",
              "Error responses are deliberately opaque so they do not leak internal details or record existence.",
            ]}
          />
        ),
      },
      {
        id: "data",
        title: "6. Data protection",
        body: (
          <UL
            items={[
              "Data is encrypted at rest by the managed database and object storage providers.",
              "Provider credentials and secrets are kept in server-side environment configuration, never shipped to the browser.",
              "Zero-retention options avoid storing conversation content for sensitive workloads.",
              "Backups are encrypted and access to production data is limited to authorized personnel.",
            ]}
          />
        ),
      },
      {
        id: "monitoring",
        title: "7. Monitoring and audit",
        body: (
          <P>
            Authentication events, role changes and administrative actions are recorded in an audit log available to
            workspace owners. Health and readiness probes continuously check the API, database and cache, and
            request IDs are attached to every response for traceability.
          </P>
        ),
      },
      {
        id: "sdlc",
        title: "8. Secure development",
        body: (
          <P>
            Every change passes linting, strict type checks, automated tests and static security analysis before
            release. Dependencies are pinned and reviewed, and architecture boundaries are enforced automatically.
          </P>
        ),
      },
      {
        id: "disclosure",
        title: "9. Responsible disclosure",
        body: (
          <P>
            If you believe you have found a vulnerability, please report it privately to OtobaAI support with steps to
            reproduce. Please do not access other users&apos; data or disrupt the Service while testing.
          </P>
        ),
      },
    ],
  },
};

const DOC_ORDER: LegalDoc[] = ["privacy", "terms", "security"];

export function LegalDialog({
  doc,
  onChange,
  onClose,
}: {
  doc: LegalDoc | null;
  onChange: (doc: LegalDoc) => void;
  onClose: () => void;
}) {
  const content = doc ? DOCS[doc] : null;
  return (
    <Modal
      open={content !== null}
      onClose={onClose}
      label={content?.title ?? "Legal"}
      className={cn(LIGHT_PANEL, "max-w-4xl p-0 overflow-hidden flex flex-col h-[min(85dvh,760px)]")}
      header={<></>}
    >
      {doc && content && <LegalBody key={doc} doc={doc} content={content} onChange={onChange} onClose={onClose} />}
    </Modal>
  );
}

function LegalBody({
  doc,
  content,
  onChange,
  onClose,
}: {
  doc: LegalDoc;
  content: DocContent;
  onChange: (doc: LegalDoc) => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(content.sections[0]?.id);
  const Icon = content.icon;

  const jumpTo = (id: string) => {
    setActive(id);
    const container = scrollRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (container && target) container.scrollTo({ top: target.offsetTop - 16, behavior: "smooth" });
  };

  // Highlight whichever section is nearest the top while the reader scrolls.
  const onScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-section]"));
    const current = sections.filter((section) => section.offsetTop - container.scrollTop <= 48).pop();
    if (current?.dataset.section) setActive(current.dataset.section);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-[#F6E8C8] bg-gradient-to-r from-[#FFF6E8] to-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E73F1E] to-[#FB6C00] text-white shrink-0">
            <Icon className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-[#111827] truncate">{content.title}</h2>
            <p className="text-[12px] text-[#6B7280]">Last updated {LAST_UPDATED}</p>
          </div>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <div className="flex gap-1 px-6 pt-3 border-b border-[#F6E8C8] shrink-0 overflow-x-auto" role="tablist">
        {DOC_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === doc}
            onClick={() => onChange(key)}
            className={cn(
              "px-3 pb-2.5 text-[14px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              key === doc ? "border-[#E73F1E] text-[#C2410C]" : "border-transparent text-[#6B7280] hover:text-[#111827]"
            )}
          >
            {DOCS[key].title}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">
        <nav className="hidden md:block w-56 shrink-0 border-r border-[#F6E8C8] p-4 overflow-y-auto" aria-label="Sections">
          <p className="text-[11px] font-bold tracking-widest text-[#9CA3AF] mb-2 px-2">ON THIS PAGE</p>
          <ul className="space-y-0.5">
            {content.sections.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(section.id)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-lg text-[13px] transition-colors",
                    active === section.id
                      ? "bg-[#FFF6E8] text-[#C2410C] font-semibold"
                      : "text-[#4B5563] hover:bg-[#FFFBF0] hover:text-[#111827]"
                  )}
                >
                  {section.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 min-w-0 overflow-y-auto custom-scrollbar px-6 py-5">
          <p className="text-[15px] leading-relaxed text-[#4B5563] rounded-2xl bg-[#FFFBF0] border border-[#F6E8C8] px-4 py-3 mb-6">
            {content.summary}
          </p>
          <div className="space-y-6 pb-4">
            {content.sections.map((section) => (
              <section key={section.id} data-section={section.id} className="space-y-2.5">
                <h3 className="text-[16px] font-bold text-[#111827]">{section.title}</h3>
                {section.body}
              </section>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[12px] text-[#6B7280] border-t border-[#F6E8C8] pt-4">
            <LifeBuoy className="w-4 h-4 text-[#C2410C]" aria-hidden="true" />
            OtobaAI Platform Inc. · Questions? Reach out through your workspace owner or OtobaAI support.
          </div>
        </div>
      </div>
    </>
  );
}

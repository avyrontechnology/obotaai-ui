"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCreateAgent, useUpdateAgent, Agent } from "@/services/api";
import { ArrowRight, ArrowLeft, Loader2, Save, Lightbulb, Cpu, Sparkles, Mic, Terminal } from "lucide-react";
import { firstErrorMessage } from "@/components/settings/form-controls";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

import { agentSchema, AgentData as WizardData } from "@/lib/schemas/agent";

interface AgentWizardProps {
  initialData?: Agent;
}

const STEPS = [
  { id: "identity", title: "Identity", icon: Sparkles },
  { id: "persona", title: "Persona", icon: Lightbulb },
  { id: "toolchain", title: "Toolchain", icon: Cpu },
];

// Cream fields in light mode, theme surfaces in dark mode.
const FIELD_CLASS =
  "w-full bg-[#FFFBF0] dark:bg-muted/50 border border-[#EFE3C8] dark:border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all shadow-sm";
const FIELD_LABEL_CLASS =
  "block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest";

const TYPE_CARDS = [
  {
    value: "voice",
    kicker: "voice",
    title: "Voice Agent",
    description: "Optimized for real-time telephony & audio streams.",
    icon: Mic,
  },
  {
    value: "text",
    kicker: "chat",
    title: "Text Assistant",
    description: "Standard LLM chatbot for web and mobile widgets.",
    icon: Terminal,
  },
  {
    value: "s2s",
    kicker: "bolt",
    title: "Realtime S2S",
    description: "Ultra low latency bidirectional speech-to-speech.",
    icon: Cpu,
  },
] as const;

export function AgentWizard({ initialData }: AgentWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const createMutation = useCreateAgent();
  const updateMutation = useUpdateAgent();

  const isEditing = !!initialData;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<WizardData>({
    resolver: zodResolver(agentSchema),
    defaultValues: initialData ? {
      agent_name: initialData.agent_name,
      agent_type: initialData.agent_type,
      agent_prompts: {
        system_prompt: initialData.agent_prompts?.system_prompt || "",
        welcome_message: initialData.agent_prompts?.welcome_message || "",
      },
      agent_config: {
        llm_provider: initialData.agent_config?.llm_provider || initialData.agent_config?.llm?.provider || "openai",
        asr_provider: initialData.agent_config?.asr_provider || initialData.agent_config?.transcriber?.provider || "deepgram",
        tts_provider: initialData.agent_config?.tts_provider || initialData.agent_config?.synthesizer?.provider || "elevenlabs",
        s2s: initialData.agent_config?.s2s || { provider: "openai_realtime" },
      },
    } : {
      agent_name: "",
      agent_type: "voice",
      agent_prompts: {
        system_prompt: "You are a helpful AI assistant.",
        welcome_message: "Hello! How can I help you today?",
      },
      agent_config: {
        llm_provider: "openai",
        asr_provider: "deepgram",
        tts_provider: "elevenlabs",
        s2s: { provider: "openai_realtime" },
      },
    },
  });

  const agentType = form.watch("agent_type");

  const onSubmit = async (data: WizardData) => {
    try {
      if (isEditing && initialData) {
        await updateMutation.mutateAsync({ id: initialData.agent_id, data });
        notify.success("Agent updated", { description: data.agent_name });
        router.push(`/agents/${initialData.agent_id}/configure`);
      } else {
        const created = await createMutation.mutateAsync(data);
        notify.success("Agent deployed", { description: data.agent_name });
        router.push(`/agents/${created.agent_id}/configure`);
      }
    } catch (error) {
      notify.error("Failed to save agent", error);
    }
  };

  const nextStep = async () => {
    let fieldsToValidate: ("agent_name" | "agent_type" | "agent_prompts.system_prompt" | "agent_prompts.welcome_message")[] = [];
    if (currentStep === 0) {
      fieldsToValidate = ["agent_name", "agent_type"];
    } else if (currentStep === 1) {
      fieldsToValidate = ["agent_prompts.system_prompt", "agent_prompts.welcome_message"];
    }

    const isStepValid = await form.trigger(fieldsToValidate);
    if (isStepValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const goToStep = (idx: number) => {
    if (idx < currentStep) setCurrentStep(idx);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-10">
      {/* Stepper Header */}
      <div className="flex items-start justify-between mb-8 relative" role="list" aria-label="Setup progress">
        <div className="absolute top-6 left-12 right-12 h-px bg-border" aria-hidden="true" />
        {STEPS.map((step, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          const Icon = step.icon;

          return (
            <div key={step.id} role="listitem" aria-current={isActive ? "step" : undefined} className="flex flex-col items-center gap-2 px-4 relative">
              <motion.button
                type="button"
                onClick={() => goToStep(idx)}
                disabled={!isActive && !isCompleted}
                aria-label={`${step.title}${isCompleted ? " (completed, go back)" : ""}`}
                animate={{
                  backgroundColor: isActive
                    ? "var(--card)"
                    : isCompleted
                      ? "rgba(249, 182, 55, 0.12)"
                      : "var(--card)",
                  borderColor: isActive
                    ? "rgba(231, 63, 30, 0.6)"
                    : isCompleted
                      ? "rgba(249, 182, 55, 0.35)"
                      : "var(--border)",
                  color: isActive ? "#e73f1e" : isCompleted ? "#8b5a2b" : "#64748b",
                }}
                className={cn(
                  "w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-colors",
                  isActive && "shadow-[0_0_24px_rgba(231,63,30,0.25)]",
                  (isActive || isCompleted) ? "cursor-pointer" : "cursor-default"
                )}
              >
                <Icon className="w-5 h-5" />
              </motion.button>
              <span className={cn(
                "text-xs font-mono tracking-widest",
                isActive ? "text-ember-700 dark:text-ember-300 font-semibold" : isCompleted ? "text-ember-700/80 dark:text-ember-400" : "text-muted-foreground"
              )}>
                {step.title.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Form Container */}
      <div className="bg-card backdrop-blur-xl border border-border rounded-[2rem] p-6 md:p-10 shadow-[0_32px_80px_-24px_rgba(17,24,39,0.25)]">
        <form onSubmit={form.handleSubmit(
          onSubmit,
          (errors) =>
            notify.error("Cannot continue yet", new Error(firstErrorMessage(errors as Record<string, unknown>)))
        )} noValidate className="flex flex-col gap-8 min-h-[300px]">

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              {/* Step 1: Identity */}
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight text-foreground mb-1">Agent Identity</h3>
                      <p className="text-sm text-muted-foreground">Name your agent and pick its architecture.</p>
                    </div>
                    <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20">
                      Step 1 of 3
                    </span>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label htmlFor="agent_name" className={FIELD_LABEL_CLASS}>Agent Name</label>
                      <input
                        id="agent_name"
                        {...form.register("agent_name")}
                        aria-invalid={form.formState.errors.agent_name ? true : undefined}
                        className={FIELD_CLASS}
                        placeholder="e.g. Support Concierge"
                      />
                      {form.formState.errors.agent_name && (
                        <p role="alert" className="text-red-700 dark:text-red-400 text-xs mt-2">{form.formState.errors.agent_name.message}</p>
                      )}
                    </div>

                    <fieldset>
                      <legend className={FIELD_LABEL_CLASS}>Agent Architecture / Type</legend>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" role="radiogroup" aria-label="Agent architecture">
                        {TYPE_CARDS.map((card) => {
                          const CardIcon = card.icon;
                          const selected = agentType === card.value;
                          return (
                            <label key={card.value} className="relative flex cursor-pointer">
                              <input
                                type="radio"
                                value={card.value}
                                {...form.register("agent_type")}
                                className="peer sr-only"
                              />
                              <div className="flex-1 p-5 rounded-2xl border bg-[#FFFBF0] dark:bg-muted/50 border-[#EFE3C8] dark:border-border peer-checked:border-ember-600 dark:peer-checked:border-ember-400/60 peer-checked:bg-primary/5 peer-checked:shadow-[0_0_0_1px_rgba(231,63,30,0.4)] peer-focus-visible:ring-2 peer-focus-visible:ring-ember-400/50 transition-all">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="font-mono text-sm text-ember-600 dark:text-ember-400">{card.kicker}</span>
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      "w-2 h-2 rounded-full transition-colors",
                                      selected ? "bg-ember-600 dark:bg-ember-400" : "bg-transparent"
                                    )}
                                  />
                                </div>
                                <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
                                  <CardIcon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                  {card.title}
                                </div>
                                <div className="text-[13px] leading-relaxed text-muted-foreground">{card.description}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>
                </div>
              )}

              {/* Step 2: Persona */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight text-foreground mb-1">Agent Persona &amp; Identity</h3>
                      <p className="text-sm text-muted-foreground">Configure core settings, agent type, and conversational behavior.</p>
                    </div>
                    <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20">
                      Step 2 of 3
                    </span>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label htmlFor="system_prompt" className={FIELD_LABEL_CLASS}>System Prompt</label>
                      <textarea
                        id="system_prompt"
                        {...form.register("agent_prompts.system_prompt")}
                        aria-invalid={form.formState.errors.agent_prompts?.system_prompt ? true : undefined}
                        rows={7}
                        className={cn(FIELD_CLASS, "resize-y font-mono text-sm leading-relaxed")}
                        placeholder="You are a helpful AI assistant specialized in customer support."
                      />
                      {form.formState.errors.agent_prompts?.system_prompt && (
                        <p role="alert" className="text-red-700 dark:text-red-400 text-xs mt-2">{form.formState.errors.agent_prompts.system_prompt.message}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="welcome_message" className={FIELD_LABEL_CLASS}>Welcome Message</label>
                      <input
                        id="welcome_message"
                        {...form.register("agent_prompts.welcome_message")}
                        className={FIELD_CLASS}
                        placeholder="Hello! How can I assist you today?"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Toolchain (unchanged) */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight text-foreground mb-1">Neural Toolchain</h3>
                      <p className="text-sm text-muted-foreground">Select the model providers for this agent.</p>
                    </div>
                    <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20">
                      Step 3 of 3
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {agentType === "s2s" ? (
                      <>
                        <div>
                          <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">Realtime Provider</label>
                          <select
                            {...form.register("agent_config.s2s.provider")}
                            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 appearance-none"
                          >
                            <option value="openai_realtime">OpenAI Realtime</option>
                            <option value="gemini_live">Gemini Live</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">Model</label>
                          <input
                            {...form.register("agent_config.s2s.model")}
                            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 transition-all"
                            placeholder="e.g. gpt-realtime-2.1"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">Voice</label>
                          <input
                            {...form.register("agent_config.s2s.voice")}
                            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 transition-all"
                            placeholder="e.g. marin, Kore"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                    <div>
                      <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">LLM Provider</label>
                      <select
                        {...form.register("agent_config.llm_provider")}
                        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 appearance-none"
                      >
                        <option value="openai">OpenAI (GPT-4o)</option>
                        <option value="anthropic">Anthropic (Claude 3.5)</option>
                        <option value="meta">Meta (Llama 3)</option>
                      </select>
                    </div>

                    {agentType === "voice" && (
                      <>
                        <div>
                          <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">ASR Provider (Speech-to-Text)</label>
                          <select
                            {...form.register("agent_config.asr_provider")}
                            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 appearance-none"
                          >
                            <option value="deepgram">Deepgram</option>
                            <option value="assembly">AssemblyAI</option>
                            <option value="openai">OpenAI</option>
                            <option value="sarvam">Sarvam</option>
                            <option value="gladia">Gladia</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">TTS Provider (Text-to-Speech)</label>
                          <select
                            {...form.register("agent_config.tts_provider")}
                            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 appearance-none"
                          >
                            <option value="elevenlabs">ElevenLabs</option>
                            <option value="openai">OpenAI</option>
                            <option value="cartesia">Cartesia</option>
                            <option value="sarvam">Sarvam</option>
                            <option value="smallest">Smallest</option>
                          </select>
                        </div>
                      </>
                    )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 0 || isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted text-muted-foreground font-medium hover:bg-muted/80 disabled:opacity-30 disabled:hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            
            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
              >
                {currentStep === 1 ? "Continue to Toolchain" : "Continue"} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-lg shadow-primary/20 transition-all"
              >
                {isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {isEditing ? "Update Agent" : "Deploy Agent"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

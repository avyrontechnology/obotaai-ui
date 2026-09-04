"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCreateAgent, useUpdateAgent, Agent } from "@/services/api";
import { ArrowRight, ArrowLeft, Loader2, Save, Brain, Cpu, Sparkles } from "lucide-react";
import { firstErrorMessage } from "@/components/settings/form-controls";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

import { agentSchema, AgentData as WizardData } from "@/lib/schemas/agent";

interface AgentWizardProps {
  initialData?: Agent;
}

const STEPS = [
  { id: "identity", title: "Identity", icon: Sparkles },
  { id: "persona", title: "Persona", icon: Brain },
  { id: "toolchain", title: "Toolchain", icon: Cpu },
];

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

  return (
    <div className="w-full max-w-3xl mx-auto mt-12">
      {/* Stepper Header */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-border -z-10" />
        {STEPS.map((step, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2 bg-background px-4">
              <motion.div
                animate={{
                  backgroundColor: isActive ? "rgba(231, 63, 30, 0.12)" : isCompleted ? "rgba(249, 182, 55, 0.12)" : "rgba(100, 116, 139, 0.12)",
                  borderColor: isActive ? "rgba(231, 63, 30, 0.4)" : isCompleted ? "rgba(249, 182, 55, 0.35)" : "rgba(100, 116, 139, 0.3)",
                  color: isActive ? "#a82d11" : isCompleted ? "#8b5a2b" : "#64748b",
                }}
                className="w-10 h-10 rounded-xl border flex items-center justify-center transition-colors"
              >
                <Icon className="w-5 h-5" />
              </motion.div>
              <span className={cn(
                "text-xs font-mono tracking-wider",
                isActive ? "text-ember-700 dark:text-ember-300" : isCompleted ? "text-ember-700/80 dark:text-ember-400" : "text-muted-foreground"
              )}>
                {step.title.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Form Container */}
      <div className="bg-card/60 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_40px_-15px_rgba(0,0,0,0.5)]">
        <form onSubmit={form.handleSubmit(
          onSubmit,
          (errors) =>
            notify.error("Cannot continue yet", new Error(firstErrorMessage(errors as Record<string, unknown>)))
        )} className="flex flex-col gap-8 min-h-[300px]">
          
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
                  <div>
                    <h3 className="text-xl font-medium text-foreground mb-1">Agent Identity</h3>
                    <p className="text-sm text-muted-foreground">Define the core identity of your neural agent.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="agent_name" className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">Agent Name</label>
                      <input
                        id="agent_name"
                        {...form.register("agent_name")}
                        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all"
                        placeholder="e.g. Nexus-7"
                      />
                      {form.formState.errors.agent_name && (
                        <p className="text-red-400 text-xs mt-2">{form.formState.errors.agent_name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">Agent Type</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="relative flex cursor-pointer">
                          <input type="radio" value="voice" {...form.register("agent_type")} className="peer sr-only" />
                          <div className="flex-1 p-4 rounded-xl border border-border bg-muted/50 peer-checked:border-ember-400/50 peer-checked:bg-ember-400/10 transition-all">
                            <div className="font-medium text-foreground mb-1">Voice Agent</div>
                            <div className="text-xs text-muted-foreground">Full duplex ASR/TTS pipeline</div>
                          </div>
                        </label>
                        <label className="relative flex cursor-pointer">
                          <input type="radio" value="text" {...form.register("agent_type")} className="peer sr-only" />
                          <div className="flex-1 p-4 rounded-xl border border-border bg-muted/50 peer-checked:border-ember-400/50 peer-checked:bg-ember-400/10 transition-all">
                            <div className="font-medium text-foreground mb-1">Text Agent</div>
                            <div className="text-xs text-muted-foreground">Standard text-based LLM chat</div>
                          </div>
                        </label>
                        <label className="relative flex cursor-pointer">
                          <input type="radio" value="s2s" {...form.register("agent_type")} className="peer sr-only" />
                          <div className="flex-1 p-4 rounded-xl border border-border bg-muted/50 peer-checked:border-ember-400/50 peer-checked:bg-ember-400/10 transition-all">
                            <div className="font-medium text-foreground mb-1">Realtime (S2S)</div>
                            <div className="text-xs text-muted-foreground">Single multimodal model hears & speaks</div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Persona */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-medium text-foreground mb-1">Agent Persona</h3>
                    <p className="text-sm text-muted-foreground">Configure behavior and conversational style.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="system_prompt" className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">System Prompt</label>
                      <textarea
                        id="system_prompt"
                        {...form.register("agent_prompts.system_prompt")}
                        rows={5}
                        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all resize-none"
                        placeholder="You are a..."
                      />
                      {form.formState.errors.agent_prompts?.system_prompt && (
                        <p className="text-red-400 text-xs mt-2">{form.formState.errors.agent_prompts.system_prompt.message}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="welcome_message" className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">Welcome Message</label>
                      <input
                        id="welcome_message"
                        {...form.register("agent_prompts.welcome_message")}
                        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all"
                        placeholder="Hello, how can I help?"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Toolchain */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-medium text-foreground mb-1">Neural Toolchain</h3>
                    <p className="text-sm text-muted-foreground">Select the model providers for this agent.</p>
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
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 font-medium hover:bg-primary/20 shadow-[0_0_20px_rgba(251,108,0,0.15)] hover:shadow-[0_0_30px_rgba(251,108,0,0.25)] transition-all"
              >
                Continue <ArrowRight className="w-4 h-4" />
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

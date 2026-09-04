"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { FormSection, TextInput, TextareaInput } from "./form-controls";

const SUGGESTED_LANGUAGES = ["hi", "ta", "te", "mr", "bn", "kn", "ml", "gu", "hinglish"];

export function PersonaConfigForm() {
  const { control, setValue } = useFormContext();
  const languages = useWatch({ control, name: "agent_config.persona.languages" }) as string[] | undefined;
  const [newLang, setNewLang] = useState("");

  const active = languages ?? [];

  const addLanguage = (code: string) => {
    const normalized = code.trim().toLowerCase();
    if (!normalized || active.includes(normalized)) return;
    setValue("agent_config.persona.languages", [...active, normalized], { shouldDirty: true });
    setNewLang("");
  };

  const removeLanguage = (code: string) => {
    setValue(
      "agent_config.persona.languages",
      active.filter((lang) => lang !== code),
      { shouldDirty: true }
    );
  };

  return (
    <div className="space-y-10">
      <FormSection
        title="Persona"
        description="The default voice and behavior of the agent, used when no language-specific prompt matches."
      >
        <div className="col-span-1 md:col-span-2">
          <TextareaInput
            name="agent_config.persona.system_prompt"
            label="System Prompt"
            rows={5}
            placeholder="You are a helpful assistant…"
            description="Loaded from the stored prompts; saving writes it back"
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <TextInput
            name="agent_config.persona.welcome_message"
            label="Welcome Message"
            placeholder="Hello! How can I help you today?"
          />
        </div>
      </FormSection>

      <FormSection
        title="Multilingual Prompts"
        description="Per-language prompts. The engine switches to these when it detects the caller language."
      >
        <div className="col-span-1 md:col-span-2 flex flex-wrap gap-2">
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground">No extra languages yet — add one below.</p>
          )}
          {active.map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 text-xs font-mono"
            >
              {lang}
              <button
                type="button"
                onClick={() => removeLanguage(lang)}
                aria-label={`Remove ${lang}`}
                className="hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="col-span-1 md:col-span-2 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_LANGUAGES.filter((lang) => !active.includes(lang)).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => addLanguage(lang)}
                className="px-2.5 py-1 rounded-full text-xs font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                + {lang}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newLang}
              onChange={(event) => setNewLang(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addLanguage(newLang);
                }
              }}
              placeholder="code, e.g. pa"
              aria-label="Add language code"
              className="h-9 w-32 px-3 bg-muted/50 border border-border rounded-xl text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50"
            />
            <button
              type="button"
              onClick={() => addLanguage(newLang)}
              aria-label="Add language"
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {active.map((lang) => (
          <div key={lang} className="col-span-1 md:col-span-2 grid grid-cols-1 gap-4 rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Prompts · {lang}
            </p>
            <TextareaInput
              name={`agent_config.persona.multilingual_prompts.${lang}.system_prompt`}
              label="System Prompt"
              rows={3}
              placeholder={`Instructions in ${lang}…`}
            />
            <TextInput
              name={`agent_config.persona.multilingual_prompts.${lang}.welcome_message`}
              label="Welcome Message"
              placeholder={`Greeting in ${lang}…`}
            />
          </div>
        ))}
      </FormSection>
    </div>
  );
}

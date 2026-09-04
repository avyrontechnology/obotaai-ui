import { FormSection, TextInput, SelectInput, SwitchInput } from "./form-controls";

export function LLMConfigForm() {
  return (
    <div className="space-y-10">
      <FormSection
        title="Model Settings"
        description="Configure the primary language model powering the agent."
      >
        <SelectInput
          name="agent_config.llm.provider"
          label="Provider"
          options={[
            { label: "OpenAI", value: "openai" },
            { label: "Anthropic", value: "anthropic" },
            { label: "Groq", value: "groq" },
            { label: "Together AI", value: "together" },
            { label: "Anyscale", value: "anyscale" },
          ]}
        />
        <TextInput
          name="agent_config.llm.model"
          label="Model"
          placeholder="e.g., gpt-4o"
          description="Specific model identifier"
        />
        <TextInput
          name="agent_config.llm.max_tokens"
          label="Max Tokens"
          type="number"
          placeholder="500"
          description="Maximum length of the generated response"
        />
        <SelectInput
          name="agent_config.llm.reasoning_effort"
          label="Reasoning Effort"
          options={[
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" },
          ]}
          description="For O-series models (e.g. o1, o3-mini) to dictate reasoning depth"
        />
      </FormSection>

      <FormSection
        title="Output Parameters"
        description="Fine-tune how the LLM generates its responses."
      >
        <TextInput
          name="agent_config.llm.temperature"
          label="Temperature"
          type="number"
          placeholder="0.7"
          description="Creativity vs Determinism (0.0 to 2.0)"
        />
        <TextInput
          name="agent_config.llm.top_p"
          label="Top P"
          type="number"
          placeholder="0.9"
          description="Nucleus sampling threshold (0.0 to 1.0)"
        />
        <TextInput
          name="agent_config.llm.frequency_penalty"
          label="Frequency Penalty"
          type="number"
          placeholder="0.0"
          description="Penalizes new tokens based on their existing frequency (-2.0 to 2.0)"
        />
        <TextInput
          name="agent_config.llm.presence_penalty"
          label="Presence Penalty"
          type="number"
          placeholder="0.0"
          description="Penalizes new tokens if they appear in the text so far (-2.0 to 2.0)"
        />
      </FormSection>

      <FormSection
        title="Advanced"
        description="Specialized response configurations."
      >
        <SwitchInput
          name="agent_config.llm.request_json"
          label="Request JSON"
          description="Forces the model to output a valid JSON object."
        />
      </FormSection>
    </div>
  );
}

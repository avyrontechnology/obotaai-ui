import { FormSection, TextInput, SelectInput, SwitchInput } from "./form-controls";

export function TranscriberConfigForm() {
  return (
    <div className="space-y-10">
      <FormSection
        title="Core Settings"
        description="Select the speech-to-text provider and primary language."
      >
        <SelectInput
          name="agent_config.transcriber.provider"
          label="Provider"
          options={[
            { label: "Deepgram", value: "deepgram" },
            { label: "OpenAI", value: "openai" },
            { label: "Azure", value: "azure" },
            { label: "Sarvam", value: "sarvam" },
            { label: "AssemblyAI", value: "assembly" },
            { label: "Google Cloud", value: "google" },
            { label: "Pixa", value: "pixa" },
            { label: "Gladia", value: "gladia" },
            { label: "ElevenLabs", value: "elevenlabs" },
            { label: "Smallest", value: "smallest" },
            { label: "Soniox", value: "soniox" },
            { label: "Gemini", value: "gemini" },
          ]}
        />
        <TextInput
          name="agent_config.transcriber.model"
          label="Model"
          placeholder="e.g., nova-2"
          description="Specific model to use (provider dependent)"
        />
        <TextInput
          name="agent_config.transcriber.language"
          label="Language"
          placeholder="e.g., en, es, fr"
          description="ISO 639-1 language code"
        />
        <SelectInput
          name="agent_config.transcriber.encoding"
          label="Encoding"
          options={[
            { label: "Linear16 (PCM)", value: "linear16" },
            { label: "Mulaw", value: "mulaw" },
            { label: "Opus", value: "opus" },
          ]}
        />
        <TextInput
          name="agent_config.transcriber.sampling_rate"
          label="Sampling Rate"
          type="number"
          placeholder="16000"
          description="Audio sampling rate in Hz (e.g., 16000, 8000)"
        />
      </FormSection>

      <FormSection
        title="Advanced Detection"
        description="Fine-tune endpointing and speech detection parameters."
      >
        <TextInput
          name="agent_config.transcriber.endpointing"
          label="Endpointing (ms)"
          type="number"
          placeholder="400"
          description="Wait time in ms after speech ends to finalize transcript."
        />
        <TextInput
          name="agent_config.transcriber.vad_threshold"
          label="VAD Threshold"
          type="number"
          placeholder="0.5"
          description="Voice activity detection sensitivity (0.0 to 1.0)"
        />
        <TextInput
          name="agent_config.transcriber.eot_threshold"
          label="EOT Threshold"
          type="number"
          description="End of thought threshold for interruption"
        />
        <TextInput
          name="agent_config.transcriber.eager_eot_threshold"
          label="Eager EOT Threshold"
          type="number"
          description="Aggressive interruption threshold"
        />
        <TextInput
          name="agent_config.transcriber.eot_timeout_ms"
          label="EOT Timeout (ms)"
          type="number"
          placeholder="3000"
        />
      </FormSection>

      <FormSection
        title="Enhancements"
        description="Enable real-time streaming, noise reduction, and keyword boosting."
      >
        <TextInput
          name="agent_config.transcriber.keywords"
          label="Keywords"
          placeholder="e.g., OtobaAI, hello, React"
          description="Comma-separated list of words to boost recognition."
          className="md:col-span-2"
        />
        <SwitchInput
          name="agent_config.transcriber.stream"
          label="Streaming Audio"
          description="Process audio in real-time chunks."
        />
        <SwitchInput
          name="agent_config.transcriber.noise_reduction"
          label="Noise Reduction"
          description="Apply background noise suppression."
        />
      </FormSection>
    </div>
  );
}

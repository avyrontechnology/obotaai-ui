"use client";

import { useFormContext } from "react-hook-form";
import { FormSection, TextInput, SelectInput, SwitchInput } from "./form-controls";
import { motion, AnimatePresence } from "framer-motion";

const TELEPHONY_PROVIDERS = [
  { label: "Twilio", value: "twilio" },
  { label: "Plivo", value: "plivo" },
  { label: "Exotel", value: "exotel" },
  { label: "Vobiz", value: "vobiz" },
  { label: "Talko (Tata Tele)", value: "talko" },
  { label: "SIP Trunk", value: "sip-trunk" },
];

const AUDIO_FORMATS = [
  { label: "WAV", value: "wav" },
  { label: "PCM (Linear16)", value: "pcm" },
  { label: "MuLaw", value: "mulaw" },
];

export function CallBehaviorConfigForm() {
  const { watch } = useFormContext();
  const checkUserOnline = watch("agent_config.conversation.check_if_user_online");
  const voicemailEnabled = watch("agent_config.conversation.voicemail");

  return (
    <div className="space-y-10">
      <FormSection
        title="Interaction Dynamics"
        description="Control how the agent paces the conversation and handles interruptions."
      >
        <TextInput
          name="agent_config.conversation.incremental_delay"
          label="Incremental Delay (ms)"
          type="number"
          placeholder="100"
          description="Added delay per sentence to sound more natural"
        />
        <TextInput
          name="agent_config.conversation.number_of_words_for_interruption"
          label="Words for Interruption"
          type="number"
          placeholder="3"
          description="Words required from user to trigger an interruption"
        />
        <TextInput
          name="agent_config.conversation.interruption_backoff_period"
          label="Interruption Backoff (ms)"
          type="number"
          placeholder="1000"
          description="Pause duration after the agent is interrupted"
        />
        <TextInput
          name="agent_config.conversation.hangup_after_silence"
          label="Hangup Silence (s)"
          type="number"
          placeholder="20"
          description="Disconnect call after this many seconds of silence"
        />
      </FormSection>

      <FormSection
        title="Conversational Realism"
        description="Settings to make the AI sound more human-like."
      >
        <SwitchInput
          name="agent_config.conversation.optimize_latency"
          label="Optimize Latency"
          description="Prioritize speed over complex processing"
        />
        <SwitchInput
          name="agent_config.conversation.ambient_noise"
          label="Ambient Noise"
          description="Play subtle background noise during silence"
        />
        <SwitchInput
          name="agent_config.conversation.use_fillers"
          label="Use Fillers"
          description="Insert 'um', 'ah' during processing delays"
        />
        <SwitchInput
          name="agent_config.conversation.backchanneling"
          label="Backchanneling"
          description="Agent says 'mhm', 'yeah' while user is speaking"
        />
      </FormSection>

      <FormSection
        title="User Presence"
        description="How the agent handles silent or disconnected users."
      >
        <div className="col-span-1 md:col-span-2">
          <SwitchInput
            name="agent_config.conversation.check_if_user_online"
            label="Check if User Online"
            description="Agent will proactively ask if the user is still there."
          />
        </div>

        <AnimatePresence>
          {checkUserOnline && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
              className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
            >
              <TextInput
                name="agent_config.conversation.trigger_user_online_message_after"
                label="Trigger After (s)"
                type="number"
                placeholder="10"
                description="Seconds of silence before checking"
              />
              <TextInput
                name="agent_config.conversation.check_user_online_message"
                label="Check Message"
                placeholder="Are you still there?"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </FormSection>

      <FormSection
        title="Voicemail Detection"
        description="Configure how the agent behaves if a voicemail system answers."
      >
        <div className="col-span-1 md:col-span-2">
          <SwitchInput
            name="agent_config.conversation.voicemail"
            label="Detect Voicemail"
            description="Attempt to detect if answering machine picked up."
          />
        </div>

        <AnimatePresence>
          {voicemailEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
              className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
            >
              <TextInput
                name="agent_config.conversation.voicemail_detection_duration"
                label="Detection Duration (s)"
                type="number"
                placeholder="30"
                description="How long to listen for a beep, in seconds"
              />
              <TextInput
                name="agent_config.conversation.voicemail_check_interval"
                label="Check Interval (s)"
                type="number"
                placeholder="7"
                description="Seconds between interim voicemail checks"
              />
              <TextInput
                name="agent_config.conversation.voicemail_min_transcript_length"
                label="Min Transcript Length"
                type="number"
                placeholder="5"
                description="Required words to count as a human greeting"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </FormSection>
      <FormSection
        title="Call Limits & Termination"
        description="Hard boundaries for call duration and goal completion."
      >
        <TextInput
          name="agent_config.conversation.call_terminate"
          label="Max Call Duration (s)"
          type="number"
          placeholder="90"
          description="Force-terminate calls exceeding this length"
        />
        <TextInput
          name="agent_config.conversation.call_cancellation_prompt"
          label="Cancellation Prompt"
          placeholder="e.g. cancel my booking"
          description="Phrase that signals the caller wants to end the task"
        />
        <SwitchInput
          name="agent_config.conversation.hangup_after_LLMCall"
          label="Hang Up After Goal"
          description="Disconnect automatically once the LLM completes its primary goal"
        />
      </FormSection>

      <FormSection
        title="Keypad & Telephony"
        description="DTMF input and the telephony handlers carrying call audio. Leave providers unset to keep default engine routing."
      >
        <SwitchInput
          name="agent_config.conversation.dtmf_enabled"
          label="DTMF Input"
          description="Let callers answer with phone keypad digits"
        />
        <SelectInput
          name="agent_config.telephony.input_provider"
          label="Input Provider"
          options={TELEPHONY_PROVIDERS}
        />
        <SelectInput
          name="agent_config.telephony.input_format"
          label="Input Format"
          options={AUDIO_FORMATS}
        />
        <SelectInput
          name="agent_config.telephony.output_provider"
          label="Output Provider"
          options={TELEPHONY_PROVIDERS}
        />
        <SelectInput
          name="agent_config.telephony.output_format"
          label="Output Format"
          options={AUDIO_FORMATS}
        />
      </FormSection>
    </div>
  );
}

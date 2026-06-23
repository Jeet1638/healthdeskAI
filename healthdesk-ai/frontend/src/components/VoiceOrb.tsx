"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Mic } from "lucide-react";
import { useRef, useState } from "react";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendVoiceTranscript } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ChatResponse } from "@/types/api";

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "escalated";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  }
}

const labels: Record<VoiceState, string> = {
  idle: "Ready when you are",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
  escalated: "Escalated for staff review",
};

const orbClasses: Record<VoiceState, string> = {
  idle: "bg-gradient-to-br from-[#0F766E] to-[#0D9488]",
  listening: "bg-gradient-to-br from-[#0D9488] to-[#2563EB]",
  thinking: "bg-[#64748B]",
  speaking: "bg-gradient-to-br from-[#2563EB] to-[#7C3AED]",
  escalated: "bg-[#EF4444]",
};

export function VoiceOrb({ clinicId }: { clinicId: string }) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [typedTranscript, setTypedTranscript] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  );

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (state === "listening") {
      setState("idle");
    }
  };

  const speakResponse = (text: string) => {
    if (!window.speechSynthesis) {
      setState("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";
    utterance.onend = () => setState("idle");
    window.speechSynthesis.speak(utterance);
  };

  const handleFinalTranscript = async (finalTranscript: string) => {
    setTranscript(finalTranscript);
    setInterimTranscript("");
    setState("thinking");
    try {
      const result: ChatResponse = await sendVoiceTranscript({
        clinic_id: clinicId,
        transcript: finalTranscript,
        conversation_id: conversationId,
      });
      setConversationId(result.conversation_id);
      setResponse(result.response);
      if (result.urgency === "emergency") {
        window.speechSynthesis?.cancel();
        setState("escalated");
        return;
      }
      setState("speaking");
      speakResponse(result.response);
    } catch {
      setResponse("The assistant could not connect to the voice endpoint. Please try again.");
      setState("idle");
    }
  };

  const messageForSpeechError = (error: string) => {
    if (error === "not-allowed" || error === "service-not-allowed") {
      return "Microphone access was blocked. Allow microphone permission in your browser, then press Start again.";
    }
    if (error === "no-speech") {
      return "I did not hear anything. Please try again, speak a little closer to the microphone, or type what you said below.";
    }
    if (error === "audio-capture") {
      return "No microphone was detected. Check your microphone connection or type what you said below.";
    }
    if (error === "network") {
      return "Browser speech recognition could not connect. Chrome or Edge usually works best, or you can type what you said below.";
    }
    return "Voice recognition stopped unexpectedly. Please try again or type what you said below.";
  };

  const startListening = () => {
    if (!supported) {
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      return;
    }

    window.speechSynthesis?.cancel();
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) {
        setInterimTranscript(interim);
      }
      if (finalText.trim()) {
        recognition.stop();
        recognitionRef.current = null;
        void handleFinalTranscript(finalText.trim());
      }
    };
    recognition.onerror = (event) => {
      setResponse(messageForSpeechError(event.error));
      setState("idle");
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setState((current) => (current === "listening" ? "idle" : current));
    };
    recognitionRef.current = recognition;
    setResponse("");
    setTranscript("");
    setInterimTranscript("");
    setState("listening");
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setState("idle");
      setResponse("Voice recognition could not start. Refresh the page or type what you said below.");
    }
  };

  if (!supported) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center text-[#64748B]">
        Voice assistant not supported in this browser. Please use Chrome.
      </div>
    );
  }

  const activeTranscript = transcript || interimTranscript;

  return (
    <div className="relative flex flex-col items-center gap-5">
      {state === "listening" || state === "escalated" ? (
        <motion.div
          className={cn(
            "absolute h-40 w-40 rounded-full border-4",
            state === "escalated" ? "border-[#EF4444]" : "border-[#0D9488]",
          )}
          animate={{ scale: [1, state === "escalated" ? 1.16 : 1.2], opacity: [1, 0] }}
          transition={{ duration: state === "escalated" ? 0.8 : 1.5, repeat: Infinity }}
        />
      ) : null}

      <motion.div
        animate={
          state === "speaking"
            ? { scale: [1, 1.08, 1] }
            : state === "escalated"
              ? { scale: [1, 1.12, 1] }
              : { scale: 1 }
        }
        transition={{ duration: state === "escalated" ? 0.8 : 1.5, repeat: state === "speaking" || state === "escalated" ? Infinity : 0 }}
        className={cn("relative flex h-40 w-40 items-center justify-center rounded-full shadow-xl", orbClasses[state])}
      >
        <motion.div
          animate={state === "thinking" ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 1.2, repeat: state === "thinking" ? Infinity : 0, ease: "linear" }}
        >
          <Mic className="h-12 w-12 text-white" />
        </motion.div>
      </motion.div>

      <p className="text-sm italic text-[#64748B]">{labels[state]}</p>

      <Button
        type="button"
        className={cn(
          "h-11 rounded-xl px-6 text-white",
          state === "listening" ? "bg-[#EF4444] hover:bg-[#DC2626]" : "bg-[#0F766E] hover:bg-[#0D9488]",
        )}
        onClick={state === "listening" ? stopListening : startListening}
        disabled={state === "thinking" || state === "speaking"}
      >
        {state === "thinking" ? <LoadingSpinner label="Thinking" /> : state === "listening" ? "Stop" : "Start"}
      </Button>

      <div className="w-full rounded-2xl border border-[#E2E8F0] bg-white p-4 text-left">
        <p className="text-sm font-semibold text-[#0F172A]">Microphone fallback</p>
        <p className="mt-1 text-sm text-[#64748B]">
          If browser voice recognition is blocked, type the spoken request here
          and send it through the same voice workflow.
        </p>
        <Textarea
          value={typedTranscript}
          onChange={(event) => setTypedTranscript(event.target.value)}
          className="mt-3 min-h-20 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]"
          placeholder="I want to book an appointment..."
        />
        <Button
          type="button"
          className="mt-3 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]"
          disabled={!typedTranscript.trim() || state === "thinking" || state === "speaking"}
          onClick={() => {
            const text = typedTranscript.trim();
            setTypedTranscript("");
            void handleFinalTranscript(text);
          }}
        >
          Send Transcript
        </Button>
      </div>

      {activeTranscript ? (
        <div className="w-full rounded-2xl border border-[#E2E8F0] bg-white p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-medium text-[#64748B]">You said:</p>
          <p className={cn("mt-2 text-[#0F172A]", interimTranscript && !transcript && "italic text-[#64748B]")}>
            {activeTranscript}
          </p>
        </div>
      ) : null}

      {response ? (
        <div className="w-full rounded-2xl border border-[#0F766E] bg-[#F0FDFA] p-5 text-left">
          <p className="text-sm font-bold text-[#0F766E]">HealthDesk AI:</p>
          <p className="mt-2 leading-6 text-[#0F172A]">{response}</p>
        </div>
      ) : null}

      {state === "escalated" ? (
        <div className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#EF4444] bg-[#FEE2E2] p-4 text-center font-bold text-[#991B1B]">
          <AlertTriangle className="h-5 w-5" />
          If this is an emergency, please call 911 immediately.
        </div>
      ) : null}
    </div>
  );
}

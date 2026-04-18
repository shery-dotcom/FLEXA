import { useState, useRef, useCallback, useEffect } from "react";

/**
 * useSpeechRecognition
 *
 * A lightweight hook that wraps the Web Speech API (SpeechRecognition /
 * webkitSpeechRecognition). It exposes a simple start/stop interface and
 * appends the recognised transcript to the caller-supplied setter.
 *
 * @param {object} options
 * @param {(text: string) => void} options.onResult   Called with the final transcript string.
 * @param {(err: string)  => void} options.onError    Called with a human-readable error string.
 * @param {string}                 options.lang       BCP-47 language tag, e.g. "en-US" or "ur-PK".
 *
 * @returns {{ isListening: boolean, isSupported: boolean, startListening: () => void, stopListening: () => void }}
 */
export default function useSpeechRecognition({
  onResult,
  onError,
  lang = "en-US",
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Detect browser support once
  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const isSupported = Boolean(SpeechRecognitionAPI);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      onError?.(
        "Speech recognition is not supported in this browser. Try Chrome or Edge.",
      );
      return;
    }

    // Abort any existing session
    recognitionRef.current?.abort();

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = lang;
    recognition.interimResults = false; // fire only on final result
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // stop automatically after a pause

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) onResult?.(transcript);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      const msgMap = {
        "not-allowed":
          "Microphone permission denied. Please allow access in your browser settings.",
        "no-speech": "No speech detected. Please try again.",
        network: "Network error during speech recognition.",
        aborted: null, // user-initiated, no need to surface
      };
      const msg =
        msgMap[event.error] ?? `Speech recognition error: ${event.error}`;
      if (msg) onError?.(msg);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      setIsListening(false);
      onError?.("Could not start speech recognition. Please try again.");
    }
  }, [isSupported, lang, onResult, onError, SpeechRecognitionAPI]);

  return { isListening, isSupported, startListening, stopListening };
}



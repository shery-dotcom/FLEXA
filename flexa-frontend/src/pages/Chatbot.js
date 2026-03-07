import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import FlexorAvatar from "../components/FlexorAvatar";
import ChatBubble, { TypingIndicator } from "../components/ChatBubble";
import { FiSend, FiTrash2, FiRefreshCw, FiMic } from "react-icons/fi";
import { TbRobot } from "react-icons/tb";
import FlexorVideoIntro from "../components/FlexorVideoIntro";
import useSpeechRecognition from "../hooks/useSpeechRecognition";

// ─── API helpers (shared axios instance — token auto-attached via interceptor) ─

async function apiPost(endpoint, body) {
  const res = await api.post(endpoint, body);
  return res.data;
}

async function apiGet(endpoint) {
  const res = await api.get(endpoint);
  return res.data;
}

async function apiDelete(endpoint) {
  await api.delete(endpoint);
  return true;
}

// ─── Quick-action chips ───────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: "My workout plan",
    text: "Give me a personalized workout plan for this week",
  },
  {
    label: "Diet suggestions",
    text: "What should I eat today based on my goals?",
  },
  {
    label: "Check my BMI",
    text: "Analyze my current BMI and what it means for my fitness",
  },
  {
    label: "Motivation boost",
    text: "I'm feeling unmotivated. Give me a pep talk!",
  },
  {
    label: "Pakistani meal ideas",
    text: "Suggest healthy Pakistani meals for muscle building",
  },
  {
    label: "میرا پلان",
    text: "میرے لیے ایک ہفتے کا ورزش اور خوراک کا پلان بنائیں",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Chatbot() {
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [avatarState, setAvatarState] = useState({
    avatarClass: "fit",
    animation: "idle",
    streakDays: 0,
    badge: null,
    personalityMode: "coach",
    bmi: null,
    bmiCategory: "Normal weight",
  });
  const [language, setLanguage] = useState("en");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileTab, setMobileTab] = useState("chat"); // "chat" | "avatar"

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Speech-to-text
  const speechLang = language === "ur" ? "ur-PK" : "en-US";
  const {
    isListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    lang: speechLang,
    onResult: (transcript) => {
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      inputRef.current?.focus();
    },
    onError: (msg) => setError(msg),
  });

  const handleMicClick = () => {
    if (isListening) stopListening();
    else startListening();
  };

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Load history + avatar on mount
  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiGet("/chatbot/history?limit=50").catch(() => ({
        messages: [],
      })),
      apiGet("/chatbot/avatar").catch(() => null),
    ])
      .then(([history, avatar]) => {
        if (history?.messages?.length) {
          setMessages(
            history.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.created_at,
              language: "en",
            })),
          );
        } else {
          // Welcome message
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                "Hey! I'm FLEXOR 💪 — your AI fitness companion. Ask me anything about workouts, nutrition, or your personal goals. آپ اردو میں بھی بات کر سکتے ہیں!",
              timestamp: new Date().toISOString(),
              language: "en",
            },
          ]);
        }
        if (avatar) {
          setAvatarState({
            avatarClass: avatar.avatar_class || "fit",
            animation: "idle",
            streakDays: avatar.streak_days || 0,
            badge: null,
            personalityMode: avatar.personality_mode || "coach",
            bmi: avatar.bmi,
            bmiCategory: avatar.bmi_category || "Normal weight",
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  // Send message
  const handleSend = useCallback(
    async (text = input) => {
      const msg = text.trim();
      if (!msg || isTyping) return;

      // Detect language from input for UI purposes
      const hasUrdu = /[\u0600-\u06FF]/.test(msg);
      const msgLang = hasUrdu ? "ur" : "en";
      setLanguage(msgLang);

      // Optimistic UI
      const userMsg = {
        id: `user-${Date.now()}`,
        role: "user",
        content: msg,
        timestamp: new Date().toISOString(),
        language: msgLang,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);
      setError("");

      try {
        const resp = await apiPost("/chatbot/message", { message: msg });

        // Update avatar animation from response
        const ae = resp.avatar_event;
        setAvatarState((prev) => ({
          ...prev,
          avatarClass: ae.avatar_class,
          animation: ae.animation,
          streakDays: ae.streak_days,
          badge: ae.badge,
          personalityMode: ae.personality_mode,
        }));

        // Revert animation to idle after 3s (after celebrate/sleep)
        if (ae.animation !== "idle") {
          setTimeout(() => {
            setAvatarState((prev) => ({ ...prev, animation: "idle" }));
          }, 3000);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: resp.reply,
            timestamp: resp.timestamp,
            language: resp.language,
          },
        ]);
        setLanguage(resp.language);
      } catch (err) {
        setError(err.message || "Failed to send message. Please try again.");
      } finally {
        setIsTyping(false);
        inputRef.current?.focus();
      }
    },
    [input, isTyping, user],
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Clear all chat history?")) return;
    await apiDelete("/chatbot/history");
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Chat cleared! Let's start fresh 💪 How can I help you today?",
        timestamp: new Date().toISOString(),
        language: "en",
      },
    ]);
    setAvatarState((prev) => ({ ...prev, animation: "idle" }));
  };

  const handleRefreshAvatar = async () => {
    const avatar = await apiPost("/chatbot/avatar/refresh", {}).catch(
      () => null,
    );
    if (avatar) {
      setAvatarState((prev) => ({
        ...prev,
        avatarClass: avatar.avatar_class,
        streakDays: avatar.streak_days,
        personalityMode: avatar.personality_mode,
        bmi: avatar.bmi,
        bmiCategory: avatar.bmi_category,
        animation: "celebrate",
      }));
      setTimeout(
        () => setAvatarState((prev) => ({ ...prev, animation: "idle" })),
        3000,
      );
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      <FlexorVideoIntro />
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <TbRobot size={24} color="#D4AF37" />
          <span style={styles.headerTitle}>FLEXOR</span>
          <span style={styles.headerSub}>AI Fitness Companion</span>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.iconBtn}
            onClick={handleRefreshAvatar}
            title="Refresh avatar from latest progress"
          >
            <FiRefreshCw size={16} />
          </button>
          <button
            style={{ ...styles.iconBtn, color: "#EF4444" }}
            onClick={handleClearHistory}
            title="Clear chat history"
          >
            <FiTrash2 size={16} />
          </button>
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div style={styles.mobileTabs}>
        <button
          style={{
            ...styles.mobileTab,
            ...(mobileTab === "chat" ? styles.mobileTabActive : {}),
          }}
          onClick={() => setMobileTab("chat")}
        >
          Chat
        </button>
        <button
          style={{
            ...styles.mobileTab,
            ...(mobileTab === "avatar" ? styles.mobileTabActive : {}),
          }}
          onClick={() => setMobileTab("avatar")}
        >
          Avatar
        </button>
      </div>

      {/* Main layout */}
      <div style={styles.main}>
        {/* Left panel — Avatar */}
        <div
          style={{
            ...styles.avatarPanel,
            display: mobileTab === "avatar" ? "flex" : undefined,
          }}
        >
          <FlexorAvatar
            avatarClass={avatarState.avatarClass}
            animation={avatarState.animation}
            streakDays={avatarState.streakDays}
            badge={avatarState.badge}
            personalityMode={avatarState.personalityMode}
            bmi={avatarState.bmi}
            bmiCategory={avatarState.bmiCategory}
          />

          {/* Quick actions */}
          <div style={styles.quickActionsLabel}>Quick Actions</div>
          <div style={styles.quickActions}>
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                style={styles.chip}
                onClick={() => handleSend(qa.text)}
                disabled={isTyping}
              >
                {qa.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — Chat */}
        <div
          style={{
            ...styles.chatPanel,
            display: mobileTab === "chat" ? "flex" : undefined,
          }}
        >
          {/* Messages */}
          <div style={styles.messages}>
            {isLoading ? (
              <div style={styles.centerMsg}>Loading chat history…</div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.timestamp}
                    language={msg.language}
                  />
                ))}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Error */}
          {error && <div style={styles.errorBar}>{error}</div>}

          {/* Input */}
          <div style={styles.inputRow}>
            <textarea
              ref={inputRef}
              style={{
                ...styles.textarea,
                direction: /[\u0600-\u06FF]/.test(input) ? "rtl" : "ltr",
              }}
              placeholder={
                language === "ur"
                  ? "یہاں پیغام لکھیں…"
                  : "Ask FLEXOR anything… (Urdu & English)"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={2000}
              disabled={isTyping}
            />
            {isSpeechSupported && (
              <button
                title={isListening ? "Stop listening" : "Speak your message"}
                style={{
                  ...styles.micBtn,
                  background: isListening
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(255,255,255,0.07)",
                  border: isListening
                    ? "1px solid rgba(239,68,68,0.5)"
                    : "1px solid rgba(255,255,255,0.1)",
                  color: isListening ? "#ef5350" : "rgba(255,255,255,0.6)",
                  animation: isListening
                    ? "micPulse 1.2s ease-in-out infinite"
                    : "none",
                }}
                onClick={handleMicClick}
                disabled={isTyping}
                aria-label={
                  isListening ? "Stop recording" : "Start voice input"
                }
                aria-pressed={isListening}
              >
                <FiMic size={17} />
              </button>
            )}
            <button
              style={{
                ...styles.sendBtn,
                opacity: !input.trim() || isTyping ? 0.5 : 1,
                cursor: !input.trim() || isTyping ? "not-allowed" : "pointer",
              }}
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
            >
              <FiSend size={18} />
            </button>
          </div>

          <div style={styles.hint}>
            {isListening
              ? "🎙 Listening… speak now"
              : "Press Enter to send · Shift+Enter for new line · اردو میں لکھ سکتے ہیں"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#e8e8e8",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid rgba(212,175,55,0.15)",
    background: "rgba(10,10,10,0.95)",
    backdropFilter: "blur(10px)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#D4AF37",
    letterSpacing: 2,
  },
  headerSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginLeft: 4,
  },
  headerActions: {
    display: "flex",
    gap: 8,
  },
  iconBtn: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.6)",
    padding: "6px 10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    transition: "all 0.2s",
  },
  mobileTabs: {
    display: "none",
    "@media (max-width: 768px)": { display: "flex" },
  },
  mobileTab: {
    flex: 1,
    padding: "10px",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  mobileTabActive: {
    color: "#D4AF37",
    borderBottomColor: "#D4AF37",
  },
  main: {
    display: "flex",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  avatarPanel: {
    width: 280,
    minWidth: 280,
    background: "rgba(255,255,255,0.03)",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflowY: "auto",
    padding: "16px 12px",
  },
  quickActionsLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 16,
    marginBottom: 8,
    alignSelf: "flex-start",
    paddingLeft: 4,
  },
  quickActions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
  },
  chip: {
    background: "rgba(212,175,55,0.08)",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: 8,
    color: "#D4AF37",
    padding: "7px 10px",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s",
    fontFamily: "inherit",
  },
  chatPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 0 8px",
    display: "flex",
    flexDirection: "column",
  },
  centerMsg: {
    textAlign: "center",
    color: "rgba(255,255,255,0.3)",
    marginTop: 60,
    fontSize: 14,
  },
  errorBar: {
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#FCA5A5",
    padding: "8px 16px",
    fontSize: 13,
    margin: "0 12px 8px",
    borderRadius: 8,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    padding: "8px 12px",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    color: "#e8e8e8",
    padding: "10px 14px",
    fontSize: 14,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
    maxHeight: 120,
    overflowY: "auto",
    transition: "border-color 0.2s",
  },
  sendBtn: {
    background: "linear-gradient(135deg, #D4AF37, #B8962E)",
    border: "none",
    borderRadius: 12,
    color: "#0a0a0a",
    width: 42,
    height: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.2s",
    boxShadow: "0 2px 8px rgba(212,175,55,0.3)",
  },
  hint: {
    fontSize: 10,
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
    padding: "4px 12px 10px",
  },
  micBtn: {
    border: "none",
    borderRadius: 12,
    width: 42,
    height: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    transition: "background 0.2s, color 0.2s, border 0.2s",
  },
};

// Inject pulse keyframes once into the document
if (typeof document !== "undefined") {
  const STYLE_ID = "flexa-mic-pulse-style";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes micPulse {
        0%   { box-shadow: 0 0 0 0   rgba(239,68,68,0.55); }
        60%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        100% { box-shadow: 0 0 0 0   rgba(239,68,68,0); }
      }
    `;
    document.head.appendChild(style);
  }
}

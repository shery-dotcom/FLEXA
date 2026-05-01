import React from "react";

/**
 * ChatBubble — renders a single chat message bubble.
 *
 * Props:
 *   role:      "user" | "assistant"
 *   content:   string message
 *   timestamp: ISO string (optional)
 *   language:  "en" | "ur" (optional — flips text direction for Urdu)
 */
export default function ChatBubble({
  role,
  content,
  timestamp,
  language = "en",
}) {
  const isUser = role === "user";
  const isUrdu = language === "ur";

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: "12px",
        padding: "0 8px",
      }}
    >
      {/* Assistant avatar dot */}
      {!isUser && <div style={styles.assistantDot}>F</div>}

      <div
        style={{
          maxWidth: "72%",
          display: "flex",
          flexDirection: "column",
          alignItems: isUser ? "flex-end" : "flex-start",
        }}
      >
        <div
          style={{
            ...styles.bubble,
            ...(isUser ? styles.userBubble : styles.assistantBubble),
            direction: isUrdu ? "rtl" : "ltr",
            fontFamily: isUrdu
              ? "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif"
              : "inherit",
          }}
        >
          {/* Render newlines as <br> */}
          {content.split("\n").map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < content.split("\n").length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>

        {formattedTime && <span style={styles.timestamp}>{formattedTime}</span>}
      </div>

      {/* User avatar dot */}
      {isUser && <div style={styles.userDot}>U</div>}
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
export function TypingIndicator() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-start",
        marginBottom: "12px",
        padding: "0 8px",
      }}
    >
      <div style={styles.assistantDot}>F</div>
      <div
        style={{
          ...styles.bubble,
          ...styles.assistantBubble,
          padding: "12px 16px",
        }}
      >
        <div className="typing-dot" style={styles.typingDots}>
          <span />
          <span />
          <span />
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        .typing-dot span {
          display: inline-block;
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #FF6B35;
          margin: 0 2px;
          animation: bounce 1.2s infinite ease-in-out;
        }
        .typing-dot span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  bubble: {
    padding: "10px 15px",
    borderRadius: "18px",
    fontSize: "14px",
    lineHeight: "1.55",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  userBubble: {
    background: "linear-gradient(135deg, #FF6B35, #FF5520)",
    color: "#ffffff",
    borderBottomRightRadius: "4px",
    boxShadow: "0 2px 8px rgba(255,107,53,0.3)",
  },
  assistantBubble: {
    background: "rgba(255,255,255,0.07)",
    color: "#e8e8e8",
    border: "1px solid rgba(255,255,255,0.1)",
    borderBottomLeftRadius: "4px",
  },
  assistantDot: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #FF6B35, #E85A2B)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
    marginRight: 8,
    marginTop: 4,
  },
  userDot: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    color: "#FF6B35",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
    marginLeft: 8,
    marginTop: 4,
  },
  timestamp: {
    fontSize: "10px",
    color: "rgba(255,255,255,0.35)",
    marginTop: "3px",
    paddingLeft: "4px",
    paddingRight: "4px",
  },
  typingDots: {
    display: "flex",
    alignItems: "center",
  },
};

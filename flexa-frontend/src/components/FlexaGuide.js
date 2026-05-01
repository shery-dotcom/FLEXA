import React, { useEffect, useState } from "react";
import FlexaAvatar from "./FlexaAvatar";

/**
 * FlexaGuide — Large contextual onboarding card shown once per page.
 * Features the FLEXA SVG avatar on the left side explaining the section.
 *
 * Usage:  <FlexaGuide pageKey="dashboard" />
 * Supported pageKeys: dashboard | workouts | diet | progress | calories
 *
 * Dismissed state stored in localStorage: flexa_guide_<pageKey>
 */
const GUIDE_MESSAGES = {
  dashboard: {
    emoji: "👋",
    title: "Welcome to your Dashboard!",
    lines: [
      "This is your home base, champ.",
      "Here you'll find your daily calorie target, workout split, streak tracker, and all your key health stats.",
      "Every section of FLEXA is built around YOUR goals — let's crush it together!",
    ],
    avatarClass: "fit",
  },
  workouts: {
    emoji: "🏋️",
    title: "Workout Planner",
    lines: [
      "Your personalized workout plan is right here.",
      "Each day shows exercises, sets, and reps tailored to your goal and fitness level.",
      "Mark sessions done to keep your streak alive — don't break the chain!",
    ],
    avatarClass: "athletic",
  },
  diet: {
    emoji: "🥗",
    title: "Diet Planner",
    lines: [
      "Tell me your preferences — region, diet type, allergies — and I'll generate a full 7-day meal plan.",
      "Pakistani dishes included. Desi gains are REAL gains! 🍛",
      "You can also log your daily meals here and track your macros.",
    ],
    avatarClass: "fit",
  },
  progress: {
    emoji: "📊",
    title: "Progress Tracker",
    lines: [
      "Log your weight and body measurements here.",
      "I'll calculate your BMI, track trends over time, and celebrate every milestone with you!",
      "Consistency beats intensity. Let's see those numbers move. 📈",
    ],
    avatarClass: "slim",
  },
  calories: {
    emoji: "📸",
    title: "Calorie Estimator",
    lines: [
      "Snap a photo of your food and I'll analyse the calories and macros using AI.",
      "Works great for desi meals — biryani, halwa puri, you name it. ☕",
      "Detected meals can be logged directly to your daily diary.",
    ],
    avatarClass: "fit",
  },
};

export default function FlexaGuide({ pageKey }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!pageKey) return;
    if (!localStorage.getItem(`flexa_guide_${pageKey}`)) {
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, [pageKey]);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(`flexa_guide_${pageKey}`, "1");
    }, 400);
  };

  const info = GUIDE_MESSAGES[pageKey];
  if (!visible || !info) return null;

  return (
    <>
      {/* Dim backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1199,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(5px)",
          animation: leaving
            ? "fg-bg-out 0.4s ease forwards"
            : "fg-bg-in 0.3s ease",
        }}
      />

      {/* Main card — centered */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1200,
          width: isMobile ? "94vw" : "min(700px, 92vw)",
          maxHeight: "92dvh",
          overflowY: "auto",
          background: "linear-gradient(155deg, #13111a 0%, #0c0a12 100%)",
          border: "1px solid rgba(212,175,55,0.28)",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow:
            "0 32px 100px rgba(0,0,0,0.88), 0 0 0 1px rgba(255,255,255,0.04)",
          animation: leaving
            ? "fg-card-out 0.4s cubic-bezier(.4,0,1,1) forwards"
            : "fg-card-in 0.5s cubic-bezier(.2,.8,.3,1)",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          minHeight: isMobile ? 0 : 360,
        }}
      >
        {/* ── Left column — avatar ────────────────────────────── */}
        <div
          style={{
            width: isMobile ? "100%" : 200,
            flexShrink: 0,
            background: "linear-gradient(160deg, #1a1628 0%, #100e18 100%)",
            borderRight: isMobile ? "none" : "1px solid rgba(212,175,55,0.12)",
            borderBottom: isMobile ? "1px solid rgba(212,175,55,0.12)" : "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "16px 12px" : "28px 12px 20px",
            gap: isMobile ? 8 : 12,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Radial glow behind avatar */}
          <div
            style={{
              position: "absolute",
              top: "42%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 170,
              height: 170,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <FlexaAvatar
            avatarClass={info.avatarClass}
            animation="idle"
            personalityMode="coach"
            size={isMobile ? 128 : 190}
          />

          {/* "FLEXA says" badge */}
          <div
            style={{
              background: "rgba(212,175,55,0.14)",
              border: "1px solid rgba(212,175,55,0.35)",
              borderRadius: 20,
              padding: "5px 14px",
              fontSize: 10,
              color: "#D4AF37",
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              position: "relative",
            }}
          >
            FLEXA says
          </div>
        </div>

        {/* ── Right column — content ─────────────────────────── */}
        <div
          style={{
            flex: 1,
            padding: isMobile ? "16px 14px 14px" : "30px 28px 24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Emoji + section label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 30 }}>{info.emoji}</span>
            <span
              style={{
                fontSize: isMobile ? 9 : 10,
                fontWeight: 700,
                letterSpacing: 3,
                color: "rgba(212,175,55,0.6)",
                textTransform: "uppercase",
              }}
            >
              {pageKey}
            </span>
          </div>

          {/* Title */}
          <h2
            style={{
              margin: "0 0 20px 0",
              fontSize: isMobile ? 19 : 22,
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.2,
            }}
          >
            {info.title}
          </h2>

          {/* Numbered lines */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 28,
            }}
          >
            {info.lines.map((line, i) => (
              <div
                key={i}
                style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    marginTop: 2,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(212,175,55,0.15)",
                    border: "1px solid rgba(212,175,55,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    color: "#FF6B35",
                    fontWeight: 900,
                  }}
                >
                  {i + 1}
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: isMobile ? 13 : 14,
                    color: "rgba(255,255,255,0.82)",
                    lineHeight: 1.65,
                  }}
                >
                  {line}
                </p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
              Click outside to close
            </span>
            <button
              onClick={handleDismiss}
              style={{
                padding: isMobile ? "11px 20px" : "11px 30px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, #FF6B35 0%, #FF5520 100%)",
                color: "#ffffff",
                fontWeight: 900,
                fontSize: 14,
                width: isMobile ? "100%" : "auto",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(212,175,55,0.45)",
                letterSpacing: 0.5,
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow =
                  "0 6px 28px rgba(212,175,55,0.65)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 4px 20px rgba(212,175,55,0.45)";
              }}
            >
              Got it! 👊
            </button>
          </div>
        </div>

        {/* Pulsing dot top-right */}
        {!isMobile && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#FF6B35",
              boxShadow: "0 0 10px #FF6B35",
              animation: "fg-dot-pulse 2s ease-in-out infinite",
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes fg-bg-in   { from{opacity:0} to{opacity:1} }
        @keyframes fg-bg-out  { from{opacity:1} to{opacity:0} }
        @keyframes fg-card-in {
          from { opacity:0; transform:translate(-50%,-50%) scale(0.87) translateY(18px); }
          to   { opacity:1; transform:translate(-50%,-50%) scale(1)    translateY(0);    }
        }
        @keyframes fg-card-out {
          from { opacity:1; transform:translate(-50%,-50%) scale(1)    translateY(0);    }
          to   { opacity:0; transform:translate(-50%,-50%) scale(0.91) translateY(14px); }
        }
        @keyframes fg-dot-pulse {
          0%,100% { transform:scale(1);   opacity:1;   box-shadow:0 0 10px #FF6B35; }
          50%      { transform:scale(1.7); opacity:0.6; box-shadow:0 0 22px #FF6B35; }
        }
      `}</style>
    </>
  );
}

/** Dev utility — call from browser console to reset all guide dismissals */
export function resetFlexaGuides() {
  ["dashboard", "workouts", "diet", "progress", "calories"].forEach((k) =>
    localStorage.removeItem(`flexa_guide_${k}`),
  );
  localStorage.removeItem("flexa_video_intro_done");
  console.log("FLEXA guides & video intro reset ✅");
}

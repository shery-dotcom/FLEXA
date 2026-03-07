import React, { useEffect, useState } from "react";
import FlexorAvatar from "./FlexorAvatar";

/**
 * FlexorGuide — Large contextual onboarding card shown once per page.
 * Features the FLEXOR SVG avatar on the left side explaining the section.
 *
 * Usage:  <FlexorGuide pageKey="dashboard" />
 * Supported pageKeys: dashboard | workouts | diet | progress | calories
 *
 * Dismissed state stored in localStorage: flexor_guide_<pageKey>
 */
const GUIDE_MESSAGES = {
  dashboard: {
    emoji: "👋",
    title: "Welcome to your Dashboard!",
    lines: [
      "This is your home base, champ.",
      "Here you'll find your daily calorie target, workout split, streak tracker, and all your key health stats.",
      "Every section of FLEXA is built around YOUR goals — let's crush it together! 💪",
    ],
    avatarClass: "fit",
  },
  workouts: {
    emoji: "🏋️",
    title: "Workout Planner",
    lines: [
      "Your personalized workout plan is right here.",
      "Each day shows exercises, sets, and reps tailored to your goal and fitness level.",
      "Mark sessions done to keep your streak alive — don't break the chain! 🔥",
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

export default function FlexorGuide({ pageKey }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!pageKey) return;
    if (!localStorage.getItem(`flexor_guide_${pageKey}`)) {
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, [pageKey]);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(`flexor_guide_${pageKey}`, "1");
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
          width: "min(700px, 92vw)",
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
          flexDirection: "row",
          minHeight: 360,
        }}
      >
        {/* ── Left column — avatar ────────────────────────────── */}
        <div
          style={{
            width: 200,
            flexShrink: 0,
            background: "linear-gradient(160deg, #1a1628 0%, #100e18 100%)",
            borderRight: "1px solid rgba(212,175,55,0.12)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "28px 12px 20px",
            gap: 12,
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

          <FlexorAvatar
            avatarClass={info.avatarClass}
            animation="idle"
            personalityMode="coach"
            size={190}
          />

          {/* "FLEXOR says" badge */}
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
            FLEXOR says
          </div>
        </div>

        {/* ── Right column — content ─────────────────────────── */}
        <div
          style={{
            flex: 1,
            padding: "30px 28px 24px",
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
                fontSize: 10,
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
              fontSize: 22,
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
                    color: "#D4AF37",
                    fontWeight: 900,
                  }}
                >
                  {i + 1}
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
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
            }}
          >
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
              Click outside to close
            </span>
            <button
              onClick={handleDismiss}
              style={{
                padding: "11px 30px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)",
                color: "#0a0c14",
                fontWeight: 900,
                fontSize: 14,
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
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "#D4AF37",
            boxShadow: "0 0 10px #D4AF37",
            animation: "fg-dot-pulse 2s ease-in-out infinite",
          }}
        />
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
          0%,100% { transform:scale(1);   opacity:1;   box-shadow:0 0 10px #D4AF37; }
          50%      { transform:scale(1.7); opacity:0.6; box-shadow:0 0 22px #D4AF37; }
        }
      `}</style>
    </>
  );
}

/** Dev utility — call from browser console to reset all guide dismissals */
export function resetFlexorGuides() {
  ["dashboard", "workouts", "diet", "progress", "calories"].forEach((k) =>
    localStorage.removeItem(`flexor_guide_${k}`),
  );
  localStorage.removeItem("flexor_video_intro_done");
  console.log("FLEXOR guides & video intro reset ✅");
}

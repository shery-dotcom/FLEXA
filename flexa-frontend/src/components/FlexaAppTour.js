import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import FlexaAvatar from "./FlexaAvatar";

const STORAGE_KEY = "flexa_app_tour_done";

const SLIDES = [
  {
    emoji: "👋",
    label: "WELCOME",
    title: "Hey! I'm FLEXA.",
    avatarClass: "fit",
    animation: "celebrate",
    lines: [
      "Your personal AI fitness companion — here to guide, motivate, and track every step of your journey.",
      "I'll be watching over every page, ready to help whenever you need.",
      "Let me give you a quick tour of FLEXA so you know exactly where everything is. Ready? 💪",
    ],
    cta: null,
  },
  {
    emoji: "🏠",
    label: "DASHBOARD",
    title: "Your Command Centre",
    avatarClass: "fit",
    animation: "idle",
    lines: [
      "The Dashboard is your daily home base — calorie targets, workout split, and streak tracker all in one place.",
      "Your health stats (BMI, weight, body fat) update here as you log progress.",
      "Check it every morning to stay on track for the day. ☀️",
    ],
    cta: { label: "Go to Dashboard →", path: "/dashboard" },
  },
  {
    emoji: "🏋️",
    label: "WORKOUT PLANNER",
    title: "Train Smarter",
    avatarClass: "athletic",
    animation: "idle",
    lines: [
      "FLEXA generates a personalised weekly workout plan based on your goal and fitness level.",
      "Each exercise has a per-set timer so you know exactly how long you're working.",
      "Tick off sets as you go — completing a day keeps your streak alive! 🔥",
    ],
    cta: { label: "See Workouts →", path: "/workouts" },
  },
  {
    emoji: "🥗",
    label: "DIET PLANNER",
    title: "Eat Right, Always",
    avatarClass: "fit",
    animation: "idle",
    lines: [
      "Set your region, diet preferences, and allergies — FLEXA generates a complete 7-day meal plan.",
      "Pakistani cuisine fully supported: biryani, dal, roti, you name it.",
      "View macros for every meal and log what you actually eat. 🍛",
    ],
    cta: { label: "Plan My Diet →", path: "/diet-planner" },
  },
  {
    emoji: "📊",
    label: "PROGRESS",
    title: "Watch Yourself Grow",
    avatarClass: "slim",
    animation: "idle",
    lines: [
      "Log your weight and body measurements regularly to track real change over time.",
      "Charts show BMI trends, weight history, and milestone achievements.",
      "I celebrate every milestone with you — no PR goes unnoticed! 🏆",
    ],
    cta: { label: "Track Progress →", path: "/progress" },
  },
  {
    emoji: "📸",
    label: "CALORIE ESTIMATOR",
    title: "AI-Powered Food Scanner",
    avatarClass: "fit",
    animation: "idle",
    lines: [
      "Take a photo of any meal and FLEXA's AI instantly estimates calories and macros.",
      "Works brilliantly on desi food that most apps don't recognise.",
      "Detected meals can be logged directly to your meal diary. ☕",
    ],
    cta: { label: "Try Scanner →", path: "/calorie-estimator" },
  },
  {
    emoji: "🤖",
    label: "FLEXA AI",
    title: "Talk to Me Anytime",
    avatarClass: "athletic",
    animation: "celebrate",
    lines: [
      "Hit the FLEXA button in the nav bar to chat with me — in English or Urdu!",
      "Ask for workout tips, meal ideas, motivation, or anything fitness-related.",
      "I remember your profile, goals, and history to give personalised advice. 🧠",
    ],
    cta: { label: "Chat with FLEXA →", path: "/chatbot" },
  },
];

const DOT_STYLE = (active) => ({
  width: active ? 22 : 8,
  height: 8,
  borderRadius: 4,
  background: active ? "#D4AF37" : "rgba(212,175,55,0.25)",
  border: "1px solid rgba(212,175,55,0.4)",
  transition: "all 0.3s ease",
  flexShrink: 0,
});

export default function FlexaAppTour({ onDone }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = (markDone = true) => {
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      if (markDone) {
        localStorage.setItem(STORAGE_KEY, "1");
        // Also prevent the dashboard page-guide from doubling up
        localStorage.setItem("flexa_guide_dashboard", "1");
      }
      if (onDone) onDone();
    }, 420);
  };

  const handleNext = () => {
    if (step < SLIDES.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleCta = (path) => {
    dismiss();
    setTimeout(() => navigate(path), 450);
  };

  if (!visible) return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <>
      <style>{`
        @keyframes fat-bg-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fat-bg-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes fat-card-in  {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.93) }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1) }
        }
        @keyframes fat-card-out {
          from { opacity: 1; transform: translate(-50%, -50%) scale(1) }
          to   { opacity: 0; transform: translate(-50%, -54%) scale(0.93) }
        }
        @keyframes fat-slide-in {
          from { opacity: 0; transform: translateX(18px) }
          to   { opacity: 1; transform: translateX(0) }
        }
      `}</style>

      {/* Dim backdrop */}
      <div
        onClick={() => dismiss()}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1499,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(6px)",
          animation: leaving
            ? "fat-bg-out 0.42s ease forwards"
            : "fat-bg-in 0.3s ease",
        }}
      />

      {/* Modal card */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 1500,
          width: "min(720px, 94vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "linear-gradient(155deg,#13111a 0%,#0c0a12 100%)",
          border: "1px solid rgba(212,175,55,0.28)",
          borderRadius: 28,
          boxShadow:
            "0 32px 100px rgba(0,0,0,0.88), 0 0 0 1px rgba(255,255,255,0.04)",
          animation: leaving
            ? "fat-card-out 0.42s cubic-bezier(.4,0,1,1) forwards"
            : "fat-card-in 0.5s cubic-bezier(.2,.8,.3,1)",
          display: "flex",
          flexDirection: "column",
          minHeight: 380,
        }}
      >
        {/* ── Gold top bar ── */}
        <div
          style={{
            background:
              "linear-gradient(90deg,#0d0b14 0%,rgba(212,175,55,0.10) 50%,#0d0b14 100%)",
            borderBottom: "1px solid rgba(212,175,55,0.18)",
            padding: "13px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid rgba(212,175,55,0.55)",
              flexShrink: 0,
              boxShadow: "0 0 14px rgba(212,175,55,0.4)",
            }}
          >
            <img
              src="/flexa-avatar.png"
              alt="FLEXA"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: 3,
                color: "rgba(212,175,55,0.65)",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              APP TOUR
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: 0.5,
              }}
            >
              <span style={{ color: "#D4AF37" }}>FLEXA</span> Guide
            </div>
          </div>
          {/* Step counter */}
          <div
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              fontWeight: 600,
            }}
          >
            {step + 1} / {SLIDES.length}
          </div>
          {/* Skip */}
          <button
            onClick={() => dismiss()}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.35)",
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              padding: "4px 6px",
              borderRadius: 8,
              transition: "color 0.2s",
              marginLeft: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255,255,255,0.35)")
            }
            title="Skip tour"
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flex: 1,
          }}
        >
          {/* Left — avatar panel */}
          <div
            style={{
              width: 190,
              flexShrink: 0,
              background: "linear-gradient(160deg,#1a1628 0%,#100e18 100%)",
              borderRight: "1px solid rgba(212,175,55,0.10)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 12px 20px",
              gap: 10,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Glow */}
            <div
              style={{
                position: "absolute",
                top: "42%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                width: 160,
                height: 160,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle,rgba(212,175,55,0.18) 0%,transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <FlexaAvatar
              avatarClass={slide.avatarClass}
              animation={slide.animation}
              personalityMode="coach"
              size={180}
            />
            <div
              style={{
                background: "rgba(212,175,55,0.12)",
                border: "1px solid rgba(212,175,55,0.32)",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 9,
                color: "#D4AF37",
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              FLEXA says
            </div>
          </div>

          {/* Right — content */}
          <div
            key={step}
            style={{
              flex: 1,
              padding: "28px 26px 22px",
              display: "flex",
              flexDirection: "column",
              animation: "fat-slide-in 0.32s ease",
            }}
          >
            {/* Section badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 28 }}>{slide.emoji}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: "rgba(212,175,55,0.55)",
                  textTransform: "uppercase",
                }}
              >
                {slide.label}
              </span>
            </div>

            {/* Title */}
            <h2
              style={{
                margin: "0 0 18px 0",
                fontSize: 22,
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1.2,
              }}
            >
              {slide.title}
            </h2>

            {/* Lines */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 11,
                marginBottom: 22,
              }}
            >
              {slide.lines.map((line, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      marginTop: 2,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "rgba(212,175,55,0.12)",
                      border: "1px solid rgba(212,175,55,0.38)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      color: "#D4AF37",
                      fontWeight: 900,
                    }}
                  >
                    {i + 1}
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      color: "rgba(255,255,255,0.80)",
                      lineHeight: 1.65,
                    }}
                  >
                    {line}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA + nav */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {/* Back */}
              {step > 0 && (
                <button
                  onClick={handleBack}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.55)",
                    padding: "9px 18px",
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                  }}
                >
                  ← Back
                </button>
              )}

              {/* Dot indicators */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  flex: 1,
                  justifyContent: "center",
                }}
              >
                {SLIDES.map((_, i) => (
                  <div key={i} style={DOT_STYLE(i === step)} />
                ))}
              </div>

              {/* Goto page CTA (skip on welcome slide) */}
              {slide.cta && (
                <button
                  onClick={() => handleCta(slide.cta.path)}
                  style={{
                    background: "rgba(212,175,55,0.08)",
                    border: "1px solid rgba(212,175,55,0.35)",
                    color: "#D4AF37",
                    padding: "9px 16px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: 0.3,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(212,175,55,0.18)";
                    e.currentTarget.style.borderColor = "rgba(212,175,55,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(212,175,55,0.08)";
                    e.currentTarget.style.borderColor = "rgba(212,175,55,0.35)";
                  }}
                >
                  {slide.cta.label}
                </button>
              )}

              {/* Next / Done */}
              <button
                onClick={handleNext}
                style={{
                  background: "linear-gradient(135deg,#D4AF37,#8B6914)",
                  border: "none",
                  color: "#0c0a12",
                  padding: "9px 22px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  letterSpacing: 0.3,
                  boxShadow: "0 0 18px rgba(212,175,55,0.35)",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {isLast ? "Let's Go! 🚀" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}



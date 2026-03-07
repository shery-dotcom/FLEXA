import React, { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "flexor_video_intro_done";

/**
 * FlexorVideoIntro — plays the FLEXOR intro video the very first time
 * the user opens the Chatbot / FLEXOR section.
 * After the user skips or the video ends, the modal is permanently dismissed
 * via localStorage.
 */
export default function FlexorVideoIntro() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setLeaving(true);
    if (videoRef.current) videoRef.current.pause();
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, "1");
    }, 420);
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(6px)",
          animation: leaving
            ? "fvi-out 0.42s ease forwards"
            : "fvi-in 0.35s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2001,
          width: "min(640px, 94vw)",
          background: "linear-gradient(155deg, #13111a 0%, #0d0b14 100%)",
          border: "1px solid rgba(212,175,55,0.3)",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow:
            "0 30px 90px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)",
          animation: leaving
            ? "fvi-card-out 0.42s cubic-bezier(.4,0,1,1) forwards"
            : "fvi-card-in 0.48s cubic-bezier(.2,.8,.3,1)",
        }}
      >
        {/* Gold header bar */}
        <div
          style={{
            background:
              "linear-gradient(90deg, #0d0b14 0%, rgba(212,175,55,0.12) 50%, #0d0b14 100%)",
            borderBottom: "1px solid rgba(212,175,55,0.2)",
            padding: "16px 22px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {/* FLEXOR logo mark */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #D4AF37, #8B6914)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              flexShrink: 0,
              boxShadow: "0 0 18px rgba(212,175,55,0.55)",
              overflow: "hidden",
              padding: 0,
            }}
          >
            <img
              src="/flexor-avatar.png"
              alt="FLEXOR"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 3,
                color: "rgba(212,175,55,0.7)",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              AI FITNESS COMPANION
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1.1,
                letterSpacing: 1,
              }}
            >
              Meet <span style={{ color: "#D4AF37" }}>FLEXOR</span>
            </div>
          </div>
          {/* Skip X */}
          <button
            onClick={dismiss}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
              padding: "4px 8px",
              borderRadius: 8,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255,255,255,0.4)")
            }
          >
            ✕
          </button>
        </div>

        {/* Video */}
        <div
          style={{ position: "relative", background: "#000", lineHeight: 0 }}
        >
          <video
            ref={videoRef}
            src="/flexor-intro.mp4"
            autoPlay
            playsInline
            onEnded={dismiss}
            style={{
              width: "100%",
              maxHeight: "55vh",
              objectFit: "contain",
              display: "block",
            }}
            controls={false}
          />
          {/* Subtle gold vignette overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
            }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(212,175,55,0.12)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.55,
              maxWidth: 340,
            }}
          >
            Your personal AI coach — ask me anything in{" "}
            <strong style={{ color: "#D4AF37" }}>English or Urdu</strong>.<br />
            I know your goals and BMI, so my advice is tailored just for you. 🚀
          </p>
          <button
            onClick={dismiss}
            style={{
              flexShrink: 0,
              padding: "10px 26px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #D4AF37, #B8962E)",
              color: "#0a0c14",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 4px 18px rgba(212,175,55,0.45)",
              letterSpacing: 0.5,
              marginLeft: 20,
            }}
          >
            Let's Go! 💪
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fvi-in      { from{opacity:0} to{opacity:1} }
        @keyframes fvi-out     { from{opacity:1} to{opacity:0} }
        @keyframes fvi-card-in {
          from { opacity:0; transform:translate(-50%,-50%) scale(0.88); }
          to   { opacity:1; transform:translate(-50%,-50%) scale(1);    }
        }
        @keyframes fvi-card-out {
          from { opacity:1; transform:translate(-50%,-50%) scale(1);    }
          to   { opacity:0; transform:translate(-50%,-50%) scale(0.9);  }
        }
      `}</style>
    </>
  );
}

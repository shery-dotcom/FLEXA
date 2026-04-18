import React, { useEffect, useState } from "react";

/**
 * FlexaAvatar — Uses the real FLEXA character image.
 * CSS animations: idle float | celebrate bounce | sleep sway
 *
 * Props:
 *   avatarClass   – "slim"|"fit"|"athletic"|"heavy"|"heavy_plus" (applies glow colour)
 *   animation     – "idle" | "celebrate" | "sleep"
 *   streakDays    – number shown below
 *   badge         – "trophy" | "flame" | "gold"  (optional overlay)
 *   personalityMode – "coach" | "motivator"
 *   bmi           – number (optional)
 *   bmiCategory   – string (optional)
 *   size          – pixel height of the image (default 260)
 */
export default function FlexaAvatar({
  avatarClass = "fit",
  animation = "idle",
  streakDays = 0,
  badge = null,
  personalityMode = "coach",
  bmi = null,
  bmiCategory = "Normal weight",
  size = 260,
}) {
  const [anim, setAnim] = useState(animation);
  useEffect(() => setAnim(animation), [animation]);

  const glow = GLOW[avatarClass] || GLOW.fit;
  const animClass =
    anim === "celebrate"
      ? "av-celebrate"
      : anim === "sleep"
        ? "av-sleep"
        : "av-idle";

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Ground glow */}
      <div
        style={{
          position: "absolute",
          bottom: 52,
          left: "50%",
          transform: "translateX(-50%)",
          width: size * 0.75,
          height: 20,
          borderRadius: "50%",
          background: glow,
          filter: "blur(14px)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Avatar wrapper */}
      <div
        style={{ position: "relative", zIndex: 1 }}
        className={`flexa-img-wrap ${animClass}`}
      >
        <img
          src="/flexa-avatar.png"
          alt="FLEXA"
          style={{
            height: size,
            width: "auto",
            objectFit: "contain",
            display: "block",
            filter: [
              `drop-shadow(0 10px 32px ${glow})`,
              "drop-shadow(0 2px 10px rgba(0,0,0,0.55))",
              anim === "sleep" ? "brightness(0.72) saturate(0.55)" : "",
            ]
              .filter(Boolean)
              .join(" "),
          }}
        />

        {/* Sleep Zzz overlay */}
        {anim === "sleep" && (
          <div
            style={{
              position: "absolute",
              top: "8%",
              right: "-18%",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 2,
              pointerEvents: "none",
            }}
          >
            <span
              className="av-zzz z1"
              style={{ fontSize: 13, color: "#D4AF37", fontWeight: 900 }}
            >
              z
            </span>
            <span
              className="av-zzz z2"
              style={{ fontSize: 17, color: "#D4AF37", fontWeight: 900 }}
            >
              z
            </span>
            <span
              className="av-zzz z3"
              style={{ fontSize: 22, color: "#D4AF37", fontWeight: 900 }}
            >
              Z
            </span>
          </div>
        )}

        {/* Celebrate stars */}
        {anim === "celebrate" && (
          <div
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <span
              className="av-star s1"
              style={{
                position: "absolute",
                top: "10%",
                left: "-16%",
                fontSize: 20,
              }}
            >
              ✦
            </span>
            <span
              className="av-star s2"
              style={{
                position: "absolute",
                top: "18%",
                right: "-18%",
                fontSize: 16,
              }}
            >
              ⭐
            </span>
            <span
              className="av-star s3"
              style={{
                position: "absolute",
                top: "-5%",
                left: "38%",
                fontSize: 24,
              }}
            >
              ✦
            </span>
          </div>
        )}
      </div>

      {/* Badge */}
      {badge && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: -8,
            fontSize: 28,
            filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.8))",
            zIndex: 2,
          }}
        >
          {badge === "trophy" ? "🏆" : badge === "flame" ? "🔥" : "🥇"}
        </div>
      )}

      {/* Info panel */}
      <div
        style={{
          textAlign: "center",
          marginTop: 6,
          zIndex: 1,
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: "#D4AF37",
            letterSpacing: 3,
          }}
        >
          FLEXA
        </div>
        <div
          style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 }}
        >
          {personalityMode === "coach" ? "🎯 Coach Mode" : "💪 Motivator Mode"}
        </div>
        {bmi && (
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.65)",
              marginTop: 3,
            }}
          >
            BMI{" "}
            <span style={{ color: "#D4AF37", fontWeight: 700 }}>
              {Number(bmi).toFixed(1)}
            </span>
            {" · "}
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
              {bmiCategory}
            </span>
          </div>
        )}
        {streakDays > 0 && (
          <div
            style={{
              fontSize: 12,
              color: "#F97316",
              fontWeight: 600,
              marginTop: 3,
            }}
          >
            🔥 {streakDays} day{streakDays !== 1 ? "s" : ""} streak
          </div>
        )}
      </div>

      <style>{`
        /* ── Idle float ───────────────────────────── */
        @keyframes avImgIdle {
          0%,100% { transform: translateY(0px);   }
          50%      { transform: translateY(-10px); }
        }
        .av-idle { animation: avImgIdle 3.4s ease-in-out infinite; }

        /* ── Celebrate bounce ─────────────────────── */
        @keyframes avImgCelebrate {
          0%   { transform: translateY(0)    scale(1)    rotate(0deg); }
          25%  { transform: translateY(-18px) scale(1.05) rotate(-3deg); }
          75%  { transform: translateY(-14px) scale(1.05) rotate(3deg); }
          100% { transform: translateY(0)    scale(1)    rotate(0deg); }
        }
        .av-celebrate { animation: avImgCelebrate 0.65s ease-in-out infinite; }

        /* ── Sleep sway ───────────────────────────── */
        @keyframes avImgSleep {
          0%,100% { transform: rotate(0deg)   translateY(0); }
          50%      { transform: rotate(3deg)   translateY(6px); }
        }
        .av-sleep { animation: avImgSleep 3.2s ease-in-out infinite; }

        /* ── Zzz float up ─────────────────────────── */
        @keyframes zFloat {
          0%   { opacity: 0; transform: translateY(0)    scale(0.7); }
          50%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-22px) scale(1.1); }
        }
        .av-zzz { animation: zFloat 2.6s ease-in-out infinite; display: block; }
        .z1 { animation-delay: 0s;    }
        .z2 { animation-delay: 0.7s;  }
        .z3 { animation-delay: 1.4s;  }

        /* ── Star pop ─────────────────────────────── */
        @keyframes starPop {
          0%,100% { opacity: 0; transform: scale(0.4) rotate(0deg);   }
          50%      { opacity: 1; transform: scale(1.4) rotate(20deg);  }
        }
        .av-star { animation: starPop 0.85s ease-in-out infinite; display: block; }
        .s1 { animation-delay: 0s;    }
        .s2 { animation-delay: 0.28s; }
        .s3 { animation-delay: 0.56s; }
      `}</style>
    </div>
  );
}

/* Glow colour per BMI class */
const GLOW = {
  slim: "rgba(59,130,246,0.45)",
  fit: "rgba(16,185,129,0.45)",
  athletic: "rgba(239,68,68,0.45)",
  heavy: "rgba(124,58,237,0.45)",
  heavy_plus: "rgba(147,51,234,0.45)",
};



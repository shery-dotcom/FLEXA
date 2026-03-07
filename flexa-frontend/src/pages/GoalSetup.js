import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiTrendingUp, FiZap, FiSliders } from "react-icons/fi";
import api from "../api/axios";
import toast from "react-hot-toast";

const GOAL_OPTIONS = [
  {
    value: "bulking",
    label: "Bulking",
    icon: <FiTrendingUp size={32} color="#D4AF37" />,
    desc: "Build muscle mass with a calorie surplus",
  },
  {
    value: "cutting",
    label: "Cutting",
    icon: <FiZap size={32} color="#D4AF37" />,
    desc: "Lose fat while preserving lean muscle",
  },
  {
    value: "recomp",
    label: "Recomp",
    icon: <FiSliders size={32} color="#D4AF37" />,
    desc: "Simultaneously build muscle and burn fat",
  },
];

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", desc: "Little or no exercise" },
  { value: "light", label: "Light", desc: "1–3 days/week" },
  { value: "moderate", label: "Moderate", desc: "3–5 days/week" },
  { value: "active", label: "Active", desc: "6–7 days/week" },
  {
    value: "very_active",
    label: "Very Active",
    desc: "Hard training twice a day",
  },
];

export default function GoalSetup() {
  const navigate = useNavigate();
  const [goalType, setGoalType] = useState("");
  const [activity, setActivity] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!goalType || !activity) {
      toast.error("Please select a goal and activity level");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/goals/", {
        goal_type: goalType,
        activity_level: activity,
      });
      setReport(res.data.ai_report);
      toast.success("Goal set! Health report ready.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to set goal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="page-content"
      style={{ maxWidth: 700, margin: "0 auto", paddingTop: 48 }}
    >
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>
          Set Your <span className="text-gold">Goal</span>
        </h1>
        <p style={{ color: "#9e9e9e", marginTop: 8, fontSize: 14 }}>
          Step 2 — We'll personalize your plan based on your goal
        </p>
      </div>

      {!report ? (
        <form onSubmit={handleSubmit}>
          {/* Goal selection */}
          <h3
            style={{
              marginBottom: 16,
              fontSize: 15,
              fontWeight: 600,
              color: "#9e9e9e",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
            }}
          >
            Choose Your Goal
          </h3>
          <div className="grid-3" style={{ marginBottom: 32 }}>
            {GOAL_OPTIONS.map((g) => (
              <div
                key={g.value}
                onClick={() => setGoalType(g.value)}
                style={{
                  background:
                    goalType === g.value ? "rgba(212,175,55,0.12)" : "#111",
                  border: `2px solid ${goalType === g.value ? "#D4AF37" : "#242424"}`,
                  borderRadius: 12,
                  padding: "20px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{g.icon}</div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: goalType === g.value ? "#D4AF37" : "#fff",
                  }}
                >
                  {g.label}
                </div>
                <div style={{ fontSize: 12, color: "#9e9e9e", marginTop: 6 }}>
                  {g.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Activity selection */}
          <h3
            style={{
              marginBottom: 16,
              fontSize: 15,
              fontWeight: 600,
              color: "#9e9e9e",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
            }}
          >
            Activity Level
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 28,
            }}
          >
            {ACTIVITY_OPTIONS.map((a) => (
              <div
                key={a.value}
                onClick={() => setActivity(a.value)}
                style={{
                  background:
                    activity === a.value ? "rgba(212,175,55,0.08)" : "#111",
                  border: `2px solid ${activity === a.value ? "#D4AF37" : "#242424"}`,
                  borderRadius: 10,
                  padding: "14px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: activity === a.value ? "#D4AF37" : "#e0e0e0",
                  }}
                >
                  {a.label}
                </span>
                <span style={{ fontSize: 13, color: "#9e9e9e" }}>{a.desc}</span>
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-gold"
            style={{ width: "100%", marginTop: 8 }}
            disabled={loading}
          >
            {loading ? "Generating Report..." : "Generate My Health Report"}
          </button>
        </form>
      ) : (
        /* AI Report Card */
        <AIReportCard
          report={report}
          onContinue={() => navigate("/dashboard")}
        />
      )}
    </div>
  );
}

function AIReportCard({ report, onContinue }) {
  return (
    <div className="card-gold-border">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Your Health Report</h2>
        <span
          className={`badge ${report.is_valid ? "badge-green" : "badge-red"}`}
        >
          {report.is_valid ? "✓ Goal Validated" : "⚠ Needs Attention"}
        </span>
      </div>

      <div className="grid-3" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">Your BMI</div>
          <div className="stat-value">{report.bmi}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Category</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {report.bmi_category}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Goal Score</div>
          <div className="stat-value">
            {(report.ml_score * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {report.warnings?.length > 0 && (
        <div
          style={{
            background: "rgba(239,83,80,0.08)",
            border: "1px solid rgba(239,83,80,0.2)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          {report.warnings.map((w, i) => (
            <p
              key={i}
              style={{ fontSize: 13, color: "#ef9a9a", marginBottom: 4 }}
            >
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      <h4
        style={{
          marginBottom: 10,
          fontSize: 13,
          fontWeight: 600,
          color: "#D4AF37",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
        }}
      >
        Next Steps
      </h4>
      <ul
        style={{
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {report.next_steps?.map((s, i) => (
          <li
            key={i}
            style={{ fontSize: 14, color: "#e0e0e0", display: "flex", gap: 10 }}
          >
            <span style={{ color: "#D4AF37" }}>→</span> {s}
          </li>
        ))}
      </ul>

      <button
        className="btn btn-gold"
        style={{ width: "100%", marginTop: 28 }}
        onClick={onContinue}
      >
        Continue to My Dashboard →
      </button>
    </div>
  );
}

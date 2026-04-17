import { useState, useEffect } from "react";
import {
  FiBarChart2,
  FiActivity,
  FiTarget,
  FiZap,
  FiHeart,
  FiAward,
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import api from "../api/axios";
import toast from "react-hot-toast";
import FlexorGuide from "../components/FlexorGuide";

/* ── Fitness formula helpers ───────────────────────────────────── */
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function calcBMR(weight, height, age, gender) {
  if (!weight || !height || !age) return null;
  // Mifflin-St Jeor
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === "female" ? Math.round(base - 161) : Math.round(base + 5);
}

function calcDEE(bmr, activityLevel) {
  if (!bmr || !activityLevel) return null;
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.2));
}

function calcCalorieTarget(dee, goalType) {
  if (!dee) return null;
  if (goalType === "bulking") return dee + 400;
  if (goalType === "cutting") return dee - 500;
  return dee; // recomp / maintenance
}

function calcMacros(calories, weight, goalType) {
  if (!calories || !weight) return null;
  let proteinG, fatG;
  if (goalType === "cutting") {
    proteinG = Math.round(weight * 2.2);
    fatG = Math.round(weight * 0.9);
  } else if (goalType === "bulking") {
    proteinG = Math.round(weight * 1.8);
    fatG = Math.round(weight * 1.0);
  } else {
    // recomp / maintenance
    proteinG = Math.round(weight * 2.0);
    fatG = Math.round(weight * 0.95);
  }
  const proteinCal = proteinG * 4;
  const fatCal = fatG * 9;
  const carbCal = Math.max(0, calories - proteinCal - fatCal);
  const carbG = Math.round(carbCal / 4);
  return {
    protein: proteinG,
    carbs: carbG,
    fat: fatG,
    proteinPct: Math.round((proteinCal / calories) * 100),
    carbsPct: Math.round((carbCal / calories) * 100),
    fatPct: Math.round((fatCal / calories) * 100),
  };
}

function bmiColor(cat) {
  if (!cat) return "#9e9e9e";
  const c = cat.toLowerCase();
  if (c.includes("underweight")) return "#64b5f6";
  if (c.includes("normal") || c.includes("healthy")) return "#4caf50";
  if (c.includes("overweight")) return "#ff9800";
  return "#ef5350";
}

/* ── AI goal recommendation based on BMI ──────────────────────── */
function aiGoalRecommendation(bmi, currentGoal) {
  if (!bmi) return null;
  if (bmi < 18.5)
    return {
      rec: "Bulking",
      reason:
        "You're underweight — a calorie surplus will help build healthy mass.",
    };
  if (bmi < 25) {
    if (currentGoal === "bulking")
      return {
        rec: "Bulking / Recomp",
        reason: "Your BMI is healthy — lean bulking or recomp both work well.",
      };
    if (currentGoal === "cutting")
      return {
        rec: "Recomp",
        reason:
          "You're already in a healthy range — recomp is optimal without aggressive cutting.",
      };
    return {
      rec: "Recomp / Maintenance",
      reason: "Your BMI is in the healthy range — maintain or slowly recomp.",
    };
  }
  if (bmi < 30)
    return {
      rec: "Cutting",
      reason:
        "A moderate calorie deficit will help bring BMI into the healthy zone.",
    };
  return {
    rec: "Cutting",
    reason:
      "Focus on fat loss — significant deficit with high protein will protect muscle.",
  };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #D4AF37",
        borderRadius: 8,
        padding: "10px 14px",
      }}
    >
      <p style={{ color: "#9e9e9e", fontSize: 12, marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p
          key={p.name}
          style={{ color: p.color, fontSize: 14, fontWeight: 600 }}
        >
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function Progress() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [summaryPeriod, setSummaryPeriod] = useState("weekly"); // "weekly" | "monthly"
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState(null);
  const [form, setForm] = useState({
    log_date: new Date().toISOString().split("T")[0],
    weight_kg: "",
    calorie_intake: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const p = user?.profile; // profile shorthand

  // ── Health report computed values ──
  const bmr = calcBMR(p?.weight_kg, p?.height_cm, p?.age, p?.gender);
  const activityLevel = dashData?.activity_level;
  const dee = calcDEE(bmr, activityLevel);
  const goalType = dashData?.current_goal;
  const bmi = dashData?.bmi || p?.bmi;
  const bmiCategory = dashData?.bmi_category || p?.bmi_category;
  const calorieTarget =
    dashData?.target_calories || calcCalorieTarget(dee, goalType);
  const macros = calcMacros(calorieTarget, p?.weight_kg, goalType);
  const aiRec = aiGoalRecommendation(bmi, goalType);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, summaryRes, dashRes, monthlyRes] = await Promise.all([
        api.get("/progress/logs?limit=60"),
        api.get("/progress/summary/weekly"),
        api.get("/dashboard/").catch(() => ({ data: null })),
        api.get("/progress/summary/monthly").catch(() => ({ data: null })),
      ]);
      const sortedLogs = logsRes.data.sort(
        (a, b) => new Date(a.log_date) - new Date(b.log_date),
      );
      setLogs(sortedLogs);
      setSummary(summaryRes.data);
      setDashData(dashRes.data);
      if (monthlyRes.data) setMonthlySummary(monthlyRes.data);
      // Milestones come from dashboard response
      if (dashRes.data?.milestones) setMilestones(dashRes.data.milestones);
    } catch {
      /* ok */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/progress/log", {
        ...form,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined,
        calorie_intake: form.calorie_intake
          ? parseFloat(form.calorie_intake)
          : undefined,
      });
      toast.success("Progress logged!");
      setForm({
        log_date: new Date().toISOString().split("T")[0],
        weight_kg: "",
        calorie_intake: "",
        notes: "",
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to log progress.");
    } finally {
      setSubmitting(false);
    }
  };

  const chartData = logs.map((l) => ({
    date: new Date(l.log_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    Weight: l.weight_kg,
    BMI: l.bmi,
    Calories: l.calorie_intake || null,
  }));

  return (
    <div className="page-content">
      <FlexorGuide pageKey="progress" />
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>
          Health <span className="text-gold">Report</span>
        </h1>
        <p style={{ color: "#9e9e9e", marginTop: 6, fontSize: 14 }}>
          Your complete fitness picture — metrics, goals & nutrition
        </p>
      </div>

      {/* ── Health Analytics Section ──────────────────────────────── */}
      {(bmi || bmr || dee) && (
        <div style={{ marginBottom: 32 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#D4AF37",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Body Metrics
          </p>

          {/* Row 1: BMI, BMR, DEE */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <MetricCard
              label="BMI"
              value={bmi ? bmi.toFixed(1) : "—"}
              sub={bmiCategory || "Not measured"}
              subColor={bmiColor(bmiCategory)}
              icon={<FiActivity size={16} />}
            />
            <MetricCard
              label="BMR"
              value={bmr ? bmr.toLocaleString() : "—"}
              sub="kcal at rest"
              icon={<FiHeart size={16} />}
              tooltip="Basal Metabolic Rate — calories your body burns at complete rest (Mifflin-St Jeor)"
            />
            <MetricCard
              label="Daily Calories"
              value={dee ? dee.toLocaleString() : "—"}
              sub={
                activityLevel ? activityLevel.replace(/_/g, " ") : "kcal/day"
              }
              icon={<FiZap size={16} />}
              tooltip="Total Daily Calories (TDEE) — BMR × activity multiplier"
            />
          </div>

          {/* Row 2: Goal, AI Recommendation */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: 14,
                padding: "18px 18px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <FiTarget size={14} color="#D4AF37" />
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#D4AF37",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  Your Goal
                </p>
              </div>
              {goalType ? (
                <>
                  <p
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#fff",
                      textTransform: "capitalize",
                      marginBottom: 6,
                    }}
                  >
                    {goalType}
                  </p>
                  <p style={{ fontSize: 12, color: "#9e9e9e" }}>
                    {goalType === "bulking"
                      ? "Calorie surplus to build muscle mass"
                      : goalType === "cutting"
                        ? "Calorie deficit to lose body fat"
                        : "Simultaneous muscle gain and fat loss"}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "#616161" }}>
                  No goal set yet
                </p>
              )}
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #0a140a 0%, #111e0e 100%)",
                border: "1px solid rgba(76,175,80,0.2)",
                borderRadius: 14,
                padding: "18px 18px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 14 }}>🤖</span>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#4caf50",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  AI Recommendation
                </p>
              </div>
              {aiRec ? (
                <>
                  <p
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#4caf50",
                      marginBottom: 6,
                    }}
                  >
                    {aiRec.rec}
                  </p>
                  <p
                    style={{ fontSize: 12, color: "#9e9e9e", lineHeight: 1.5 }}
                  >
                    {aiRec.reason}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "#616161" }}>
                  Complete your profile to get AI suggestions
                </p>
              )}
            </div>
          </div>

          {/* Row 3: Calorie Target + Macros */}
          {calorieTarget && macros && (
            <div
              style={{
                background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: 14,
                padding: "20px 20px 18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#D4AF37",
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                      marginBottom: 6,
                    }}
                  >
                    Daily Calorie Target
                  </p>
                  <p style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>
                    {calorieTarget.toLocaleString()}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#9e9e9e",
                        marginLeft: 6,
                      }}
                    >
                      kcal
                    </span>
                  </p>
                  <p style={{ fontSize: 12, color: "#9e9e9e", marginTop: 4 }}>
                    {goalType === "bulking"
                      ? `+400 kcal surplus above DEE (${dee?.toLocaleString()} kcal)`
                      : goalType === "cutting"
                        ? `-500 kcal deficit below DEE (${dee?.toLocaleString()} kcal)`
                        : `Maintenance — same as DEE`}
                  </p>
                </div>
                {/* Macro split visual */}
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    height: 8,
                    minWidth: 140,
                    borderRadius: 4,
                    overflow: "hidden",
                    alignSelf: "center",
                  }}
                >
                  <div
                    style={{ flex: macros.proteinPct, background: "#D4AF37" }}
                  />
                  <div
                    style={{ flex: macros.carbsPct, background: "#64b5f6" }}
                  />
                  <div style={{ flex: macros.fatPct, background: "#ef9a9a" }} />
                </div>
              </div>

              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#9e9e9e",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  marginBottom: 12,
                }}
              >
                Macronutrient Breakdown
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                }}
              >
                <MacroCard
                  label="Protein"
                  grams={macros.protein}
                  pct={macros.proteinPct}
                  color="#D4AF37"
                  note="Muscle repair & growth"
                />
                <MacroCard
                  label="Carbohydrates"
                  grams={macros.carbs}
                  pct={macros.carbsPct}
                  color="#64b5f6"
                  note="Energy & performance"
                />
                <MacroCard
                  label="Fats"
                  grams={macros.fat}
                  pct={macros.fatPct}
                  color="#ef9a9a"
                  note="Hormones & joints"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Milestones & Achievements ─────────────────────────────── */}
      {milestones.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#D4AF37",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FiAward size={14} /> Milestones Earned
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {milestones.map((m) => (
              <div
                key={m.id || m.title}
                style={{
                  background:
                    "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
                  border: "1px solid rgba(212,175,55,0.3)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  minWidth: 180,
                  flex: "1 1 180px",
                  maxWidth: 240,
                }}
              >
                <p
                  style={{
                    fontSize: 20,
                    marginBottom: 6,
                  }}
                >
                  {m.milestone_type === "elite"
                    ? "🏆"
                    : m.milestone_type === "streak"
                      ? "🔥"
                      : m.milestone_type === "health"
                        ? "💚"
                        : m.milestone_type === "progress"
                          ? "📉"
                          : "⭐"}
                </p>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#D4AF37",
                    marginBottom: 4,
                  }}
                >
                  {m.title}
                </p>
                <p style={{ fontSize: 11, color: "#9e9e9e", lineHeight: 1.4 }}>
                  {m.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Progress Tracker Section ───────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#D4AF37",
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Progress Tracker
        </p>
      </div>

      <div className="grid-2" style={{ alignItems: "start", gap: 28 }}>
        {/* Left: Log form + Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Log form */}
          <div className="card-gold-border">
            <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>
              Log Today's Stats
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  className="form-input"
                  type="date"
                  name="log_date"
                  value={form.log_date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="grid-2 progress-form-grid">
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    className="form-input"
                    type="number"
                    name="weight_kg"
                    placeholder="75.5"
                    step="0.1"
                    value={form.weight_kg}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Calorie Intake (kcal)</label>
                <input
                  className="form-input"
                  type="number"
                  name="calorie_intake"
                  placeholder={
                    calorieTarget
                      ? `Target: ${calorieTarget} kcal`
                      : "e.g. 2200"
                  }
                  step="1"
                  min="0"
                  value={form.calorie_intake}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input
                  className="form-input"
                  name="notes"
                  placeholder="Feeling great today!"
                  value={form.notes}
                  onChange={handleChange}
                />
              </div>
              <button
                type="submit"
                className="btn btn-gold"
                style={{ width: "100%" }}
                disabled={submitting}
              >
                {submitting ? "Logging..." : "+ Log Progress"}
              </button>
            </form>
          </div>

          {/* Summary — Weekly / Monthly toggle */}
          {(summary || monthlySummary) && (
            <div className="card">
              {/* Period toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {["weekly", "monthly"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setSummaryPeriod(p)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 20,
                      border: "1px solid",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "capitalize",
                      letterSpacing: "0.4px",
                      background:
                        summaryPeriod === p ? "#D4AF37" : "transparent",
                      borderColor:
                        summaryPeriod === p
                          ? "#D4AF37"
                          : "rgba(212,175,55,0.3)",
                      color: summaryPeriod === p ? "#000" : "#9e9e9e",
                      transition: "all 0.2s",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Active period summary data */}
              {(() => {
                const s =
                  summaryPeriod === "monthly" && monthlySummary
                    ? monthlySummary
                    : summary;
                if (!s) return null;
                return (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {s.weight_change !== undefined && (
                      <SummaryRow
                        label="Weight Change"
                        value={`${s.weight_change > 0 ? "+" : ""}${s.weight_change?.toFixed(1)} kg`}
                        color={s.weight_change < 0 ? "#4caf50" : "#ef5350"}
                      />
                    )}
                    {s.current_weight && (
                      <SummaryRow
                        label="Current Weight"
                        value={`${s.current_weight} kg`}
                      />
                    )}
                    {s.current_bmi && (
                      <SummaryRow label="Current BMI" value={s.current_bmi} />
                    )}
                    <SummaryRow
                      label={
                        summaryPeriod === "monthly"
                          ? "Logs This Month"
                          : "Logs This Week"
                      }
                      value={s.logs_count || 0}
                    />
                    {s.trend && (
                      <SummaryRow
                        label="Trend"
                        value={s.trend
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                        color={s.trend === "on_track" ? "#4caf50" : "#D4AF37"}
                      />
                    )}
                    {summaryPeriod === "monthly" && s.month && (
                      <SummaryRow label="Month" value={s.month} />
                    )}

                    {/* Stagnation alert */}
                    {s.trend &&
                      s.trend !== "on_track" &&
                      s.weight_change !== undefined &&
                      Math.abs(s.weight_change) < 0.3 && (
                        <div
                          style={{
                            background: "rgba(255,152,0,0.08)",
                            border: "1px solid rgba(255,152,0,0.3)",
                            borderRadius: 8,
                            padding: "10px 14px",
                            marginTop: 8,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#ff9800",
                              marginBottom: 4,
                            }}
                          >
                            ⚠ Stagnation Detected
                          </p>
                          <p
                            style={{
                              fontSize: 11,
                              color: "#ffcc80",
                              lineHeight: 1.5,
                            }}
                          >
                            Your weight hasn't changed significantly this{" "}
                            {summaryPeriod === "monthly" ? "month" : "week"}.
                            Consider adjusting your calorie intake or training
                            intensity.
                          </p>
                        </div>
                      )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Right: Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {loading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : logs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <FiBarChart2 size={60} color="#9e9e9e" />
              </div>
              <h3 style={{ marginTop: 16, marginBottom: 8 }}>No Data Yet</h3>
              <p style={{ color: "#9e9e9e", fontSize: 14 }}>
                Start logging your weight to see beautiful charts.
              </p>
            </div>
          ) : (
            <>
              {/* Weight chart */}
              <div className="card">
                <h4 style={{ fontWeight: 700, marginBottom: 20, fontSize: 15 }}>
                  Weight Over Time (kg)
                </h4>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#D4AF37"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#D4AF37"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis
                      dataKey="date"
                      stroke="#616161"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#616161"
                      tick={{ fontSize: 11 }}
                      domain={["dataMin - 2", "dataMax + 2"]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="Weight"
                      stroke="#D4AF37"
                      fill="url(#goldGrad)"
                      strokeWidth={2}
                      dot={{ fill: "#D4AF37", r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* BMI chart */}
              {chartData.some((d) => d.BMI) && (
                <div className="card">
                  <h4
                    style={{ fontWeight: 700, marginBottom: 20, fontSize: 15 }}
                  >
                    BMI Progress
                  </h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis
                        dataKey="date"
                        stroke="#616161"
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        stroke="#616161"
                        tick={{ fontSize: 11 }}
                        domain={["dataMin - 1", "dataMax + 1"]}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {/* Normal BMI reference */}
                      <Line
                        type="monotone"
                        dataKey="BMI"
                        stroke="#A08C29"
                        strokeWidth={2}
                        dot={{ fill: "#D4AF37", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
                    <BMIRef color="#4caf50" label="Normal: 18.5–24.9" />
                    <BMIRef color="#ff9800" label="Overweight: 25–29.9" />
                    <BMIRef color="#ef5350" label="Obese: ≥30" />
                  </div>
                </div>
              )}

              {/* Log table */}
              <div className="card">
                <h4 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
                  Recent Logs
                </h4>
                <div className="table-scroll" style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid #242424" }}>
                        {[
                          "Date",
                          "Weight (kg)",
                          "BMI",
                          "Calories",
                          "Notes",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "8px 12px",
                              color: "#9e9e9e",
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...logs]
                        .reverse()
                        .slice(0, 10)
                        .map((l) => (
                          <tr
                            key={l.id}
                            style={{ borderBottom: "1px solid #1a1a1a" }}
                          >
                            <td
                              style={{
                                padding: "10px 12px",
                                color: "#D4AF37",
                                fontWeight: 500,
                              }}
                            >
                              {new Date(l.log_date).toLocaleDateString()}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {l.weight_kg ?? "—"}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {l.bmi?.toFixed(1) ?? "—"}
                            </td>
                            <td
                              style={{ padding: "10px 12px", color: "#64b5f6" }}
                            >
                              {l.calorie_intake
                                ? `${l.calorie_intake?.toLocaleString()} kcal`
                                : "—"}
                            </td>
                            <td
                              style={{ padding: "10px 12px", color: "#9e9e9e" }}
                            >
                              {l.notes || "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid #1a1a1a",
      }}
    >
      <span style={{ fontSize: 13, color: "#9e9e9e" }}>{label}</span>
      <span
        style={{ fontSize: 13, fontWeight: 700, color: color || "#e0e0e0" }}
      >
        {value}
      </span>
    </div>
  );
}

function BMIRef({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{ width: 10, height: 10, borderRadius: 2, background: color }}
      />
      <span style={{ fontSize: 11, color: "#9e9e9e" }}>{label}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  subColor = "#9e9e9e",
  icon,
  tooltip,
}) {
  return (
    <div
      title={tooltip}
      style={{
        background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
        border: "1px solid rgba(212,175,55,0.18)",
        borderRadius: 14,
        padding: "16px 16px 14px",
        cursor: tooltip ? "help" : "default",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <span style={{ color: "#D4AF37" }}>{icon}</span>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#D4AF37",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
          }}
        >
          {label}
        </p>
      </div>
      <p
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: 11,
          color: subColor,
          fontWeight: 600,
          textTransform: "capitalize",
        }}
      >
        {sub}
      </p>
    </div>
  );
}

function MacroCard({ label, grams, pct, color, note }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${color}33`,
        borderRadius: 10,
        padding: "14px 14px 12px",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: "#fff",
          marginBottom: 2,
        }}
      >
        {grams}g
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#616161",
            marginLeft: 4,
          }}
        >
          {pct}%
        </span>
      </p>
      <p style={{ fontSize: 11, color: "#616161" }}>{note}</p>
    </div>
  );
}

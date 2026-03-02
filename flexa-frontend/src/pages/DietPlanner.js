/**
 * DietPlanner.js — Module 3: Personalized Diet Planner
 * 2-step flow (auto-calculates from sign-up profile):
 *   Step 0 → Preferences (region, diet type, allergies, meals/day)
 *   Step 1 → Generated 7-day meal plan with day tabs
 *   + Tab: Daily meal logger
 */
import { useState, useEffect, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  FiTarget,
  FiSettings,
  FiList,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
  FiDroplet,
  FiSun,
  FiMoon,
  FiCoffee,
  FiShoppingBag,
  FiCheck,
  FiBell,
  FiEdit2,
  FiX,
} from "react-icons/fi";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// ──────────────────────────────────────── Constants ────────────────────────
const GOLD = "#D4AF37";
const STEPS = ["Preferences", "Your Plan"];

const REGION_OPTIONS = [
  "general",
  "punjabi",
  "sindhi",
  "balochi",
  "kashmiri",
  "pashtun",
  "karachi",
  "coastal",
];

const DIET_TYPE_OPTIONS = [
  { value: "non-vegetarian", label: "Non-Vegetarian" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "keto", label: "Keto" },
];

const ALLERGEN_OPTIONS = [
  "dairy",
  "gluten",
  "nuts",
  "eggs",
  "fish",
  "shellfish",
  "soy",
];

const MEAL_ICONS = {
  breakfast: <FiSun size={16} />,
  lunch: <FiCoffee size={16} />,
  dinner: <FiMoon size={16} />,
  snacks: <FiShoppingBag size={16} />,
};

// ──────────────────────────────────────── Sub-components ───────────────────

function StepDot({ label, idx, active, done }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: done
            ? GOLD
            : active
              ? "rgba(212,175,55,0.2)"
              : "rgba(255,255,255,0.06)",
          border: `2px solid ${done || active ? GOLD : "rgba(255,255,255,0.1)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: done ? "#000" : active ? GOLD : "#555",
          fontWeight: 700,
          fontSize: 13,
          transition: "all .3s",
        }}
      >
        {done ? <FiCheck size={14} /> : idx + 1}
      </div>
      <span
        style={{
          fontSize: 10,
          color: active ? GOLD : "#555",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function MacroPill({ label, value, unit, color }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${color}33`,
        borderRadius: 12,
        padding: "14px 20px",
        textAlign: "center",
        flex: 1,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
        {label} ({unit})
      </div>
    </div>
  );
}

// Parse Python list-repr ingredients string → clean comma-separated string
function parseIngredients(raw) {
  if (!raw || ["0.0", "0", "nan", "None"].includes(String(raw).trim()))
    return "";
  const s = String(raw).trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    // strip brackets, remove quotes, split on comma-space between items
    const inner = s.slice(1, -1);
    const items = inner
      .split(/,\s*(?='|"|\w)/)
      .map((i) => i.replace(/^['"]|['"]$/g, "").trim())
      .filter((i) => i && !["nan", "0.0", "0"].includes(i));
    return items.map((i) => i.charAt(0).toUpperCase() + i.slice(1)).join(", ");
  }
  return s;
}

function MealCard({ meal, onLog }) {
  const ingredients = parseIngredients(meal.ingredients);
  const cuisine =
    meal.cuisine && meal.cuisine !== "general" ? meal.cuisine : null;

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: "#e0e0e0", fontSize: 14 }}>
          {meal.food_name}
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
          {meal.quantity_g}g{cuisine ? ` · ${cuisine}` : ""}
        </div>
        <div
          style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}
        >
          <span style={{ fontSize: 11, color: GOLD }}>
            {meal.calories} kcal
          </span>
          <span style={{ fontSize: 11, color: "#4ec9b0" }}>
            P {meal.protein_g}g
          </span>
          <span style={{ fontSize: 11, color: "#ce9178" }}>
            C {meal.carbs_g}g
          </span>
          <span style={{ fontSize: 11, color: "#dcdcaa" }}>
            F {meal.fat_g}g
          </span>
        </div>
        {ingredients && (
          <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>
            {ingredients.length > 90
              ? ingredients.slice(0, 87) + "…"
              : ingredients}
          </div>
        )}
      </div>
      {onLog && (
        <button
          onClick={() => onLog(meal)}
          style={{
            background: "rgba(212,175,55,0.1)",
            border: `1px solid ${GOLD}44`,
            borderRadius: 8,
            padding: "6px 12px",
            color: GOLD,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <FiPlus size={14} />
        </button>
      )}
    </div>
  );
}

function MacroBar({ label, consumed, target, color }) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#888",
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span style={{ color }}>
          {consumed}g / {target}g
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            transition: "width .5s",
          }}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────── Main Component ───────────────────
export default function DietPlanner() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState("plan"); // plan | log

  const [targets, setTargets] = useState(null);
  const [autoCalcLoading, setAutoCalcLoading] = useState(true);
  const [autoCalcError, setAutoCalcError] = useState(null);

  // Step 0 prefs
  const [prefs, setPrefs] = useState({
    region: "",
    diet_type: [],
    allergies: [],
    meals_per_day: null,
  });
  const [planLoading, setPlanLoading] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState(null); // [Mon..Sun] – 7 daily plans
  const [selectedDay, setSelectedDay] = useState(0); // 0 = Monday
  const plan = weeklyPlan ? weeklyPlan[selectedDay] : null;

  // Daily log tab
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [mealLogs, setMealLogs] = useState([]);

  // FE-5: Hydration / meal reminders
  const [reminder, setReminder] = useState(null);

  // FE-4: Inline log editing
  const [editingLog, setEditingLog] = useState(null); // { id, qty, meal_type }
  const [editSaving, setEditSaving] = useState(false);

  // ── On mount: auto-calculate from profile + active goal ─────────────────
  useEffect(() => {
    const GOAL_MAP = {
      bulking: "muscle_gain",
      cutting: "fat_loss",
      recomp: "maintenance",
    };
    const ACTIVITY_MAP = {
      sedentary: "sedentary",
      light: "lightly_active",
      moderate: "moderately_active",
      active: "very_active",
      very_active: "extremely_active",
    };

    const init = async () => {
      setAutoCalcLoading(true);
      setAutoCalcError(null);

      // 1) If saved diet preferences exist, restore targets and skip to prefs or plan
      try {
        const res = await api.get("/diet/preferences");
        const p = res.data;
        setTargets({
          calorie_target: p.daily_calorie_target,
          protein_g: p.protein_target_g,
          carbs_g: p.carbs_target_g,
          fat_g: p.fat_target_g,
          water_ml: p.water_target_ml,
          bmr: p.bmr,
          tdee: p.tdee,
        });
        setPrefs({
          region: p.region || "",
          diet_type: Array.isArray(p.diet_type)
            ? p.diet_type
            : (p.diet_type || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
          allergies: p.allergies || [],
          meals_per_day: p.meals_per_day || null,
        });
        const savedWeeklyPlan = localStorage.getItem("flexa_diet_weekly_plan");
        if (savedWeeklyPlan) {
          try {
            setWeeklyPlan(JSON.parse(savedWeeklyPlan));
            setSelectedDay(0);
            setStep(1);
          } catch {
            setStep(0);
          }
        } else {
          setStep(0);
        }
        setAutoCalcLoading(false);
        return;
      } catch {
        // 404 — no preferences yet; continue to auto-calculate
      }

      // 2) Auto-calculate from profile + active goal
      try {
        const [meRes, goalRes] = await Promise.all([
          api.get("/users/me"),
          api.get("/goals/active"),
        ]);
        const profile = meRes.data.profile;
        const goal = goalRes.data;
        if (
          !profile?.age ||
          !profile?.weight_kg ||
          !profile?.height_cm ||
          !profile?.gender
        ) {
          setAutoCalcError(
            "Please complete your profile setup before using the diet planner.",
          );
          setAutoCalcLoading(false);
          return;
        }
        const calcRes = await api.post("/diet/calculate-calories", {
          age: profile.age,
          gender: profile.gender,
          weight_kg: profile.weight_kg,
          height_cm: profile.height_cm,
          activity_level:
            ACTIVITY_MAP[goal.activity_level] || "moderately_active",
          goal: GOAL_MAP[goal.goal_type] || "maintenance",
        });
        setTargets(calcRes.data);
        setStep(0);
      } catch {
        setAutoCalcError(
          "Set up your profile and fitness goal before using the diet planner.",
        );
      }
      setAutoCalcLoading(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch daily summary ────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    // Pass client's local calendar date (YYYY-MM-DD) so server filters the right day
    const localDate = new Date().toLocaleDateString("en-CA");
    try {
      const sumRes = await api.get(`/diet/daily-summary?log_date=${localDate}`);
      setSummary(sumRes.data);
    } catch {
      // If no preferences yet, show an empty summary so the card structure renders
      setSummary((prev) =>
        prev
          ? prev
          : {
              calorie_target: 2000,
              calories_consumed: 0,
              protein_target_g: 50,
              protein_consumed_g: 0,
              carbs_target_g: 250,
              carbs_consumed_g: 0,
              fat_target_g: 65,
              fat_consumed_g: 0,
              water_target_ml: 2500,
              on_track: true,
              meals: [],
            },
      );
    }
    try {
      const logsRes = await api.get("/diet/meal-logs?limit=20");
      setMealLogs(logsRes.data);
    } catch {
      // silent
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "log") fetchSummary();
  }, [tab, fetchSummary]);

  // FE-5: Fetch time-based reminder on mount (and every 30 min)
  useEffect(() => {
    const fetchReminder = async () => {
      try {
        const res = await api.get("/diet/reminders");
        setReminder(res.data);
      } catch {
        // silent — no preferences set yet
      }
    };
    fetchReminder();
    const interval = setInterval(fetchReminder, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // FE-4: Save edited meal log
  const handleSaveEdit = async () => {
    if (!editingLog) return;
    setEditSaving(true);
    try {
      await api.patch(`/diet/meal-logs/${editingLog.id}`, {
        meal_type: editingLog.meal_type,
        quantity_g: parseFloat(editingLog.qty),
      });
      toast.success("Meal updated!");
      setEditingLog(null);
      fetchSummary();
    } catch {
      toast.error("Failed to update meal.");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Step 0 → 1: Generate plan (7-day) ─────────────────────────────────
  const handleGeneratePlan = async () => {
    if (!targets) return;
    if (!prefs.region) {
      toast.error("Please select a cuisine region.");
      return;
    }
    if (!prefs.diet_type || prefs.diet_type.length === 0) {
      toast.error("Please select at least one diet type.");
      return;
    }
    if (!prefs.meals_per_day) {
      toast.error("Please select meals per day.");
      return;
    }
    setPlanLoading(true);
    const toastId = "plan-gen";
    toast.loading("Building your 7-day meal plan…", { id: toastId });
    try {
      const body = {
        calorie_target: targets.calorie_target,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
        ...prefs,
      };
      // 7 parallel calls → different stochastic tie-breaks per day
      const results = await Promise.all(
        Array.from({ length: 7 }, () => api.post("/diet/generate-plan", body)),
      );
      const plans = results.map((r) => r.data);
      setWeeklyPlan(plans);
      setSelectedDay(0);
      setStep(1);
      localStorage.setItem("flexa_diet_weekly_plan", JSON.stringify(plans));
      toast.success("7-day meal plan ready!", { id: toastId });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Plan generation failed.", {
        id: toastId,
      });
    } finally {
      setPlanLoading(false);
    }
  };

  // ── Food search ────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const res = await api.get(
        `/diet/search-foods?query=${encodeURIComponent(searchQuery)}&limit=10`,
      );
      setSearchResults(res.data);
    } catch {
      toast.error("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const handleLogMeal = async (food, mealType = "lunch") => {
    try {
      // food.quantity_g comes from plan items (already scaled portion)
      // food.serving_size_g comes from search results (per-100g DB record)
      const qty = food.quantity_g || food.serving_size_g || 100;
      // food_id=0 means a built-in / plan item not persisted in DB — don't send it
      const foodId = food.id && food.id > 0 ? food.id : undefined;
      await api.post("/diet/log-meal", {
        food_id: foodId,
        food_name: food.food_name,
        meal_type: mealType,
        quantity_g: qty,
        // pre-computed macros (plan items already have these scaled correctly)
        calories: food.calories ?? undefined,
        protein_g: food.protein_g ?? undefined,
        carbs_g: food.carbs_g ?? undefined,
        fat_g: food.fat_g ?? undefined,
      });
      toast.success(`${food.food_name} logged!`);
      fetchSummary();
    } catch {
      toast.error("Failed to log meal.");
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      await api.delete(`/diet/meal-logs/${logId}`);
      toast.success("Removed.");
      fetchSummary();
    } catch {
      toast.error("Failed to remove.");
    }
  };

  // ── Tab: Plan ──────────────────────────────────────────────────────────
  const renderPlanTab = () => (
    <div>
      {/* Step indicator */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 0,
          marginBottom: 36,
        }}
      >
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center" }}>
            <StepDot
              label={label}
              idx={i}
              active={step === i}
              done={step > i}
            />
            {i < STEPS.length - 1 && (
              <div
                style={{
                  width: 48,
                  height: 2,
                  margin: "0 4px",
                  background: step > i ? GOLD : "rgba(255,255,255,0.07)",
                  transition: "background .4s",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Loading / Error state while auto-calculating ── */}
      {autoCalcLoading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#666" }}>
          <div style={{ fontSize: 14 }}>
            Calculating your targets from your profile…
          </div>
        </div>
      )}

      {!autoCalcLoading && autoCalcError && (
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 12,
            padding: "24px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ color: "#ef4444", fontWeight: 600, marginBottom: 8 }}>
            Profile Incomplete
          </div>
          <div style={{ color: "#888", fontSize: 13 }}>{autoCalcError}</div>
        </div>
      )}

      {/* ── Step 0: Preferences ── */}
      {!autoCalcLoading && !autoCalcError && step === 0 && (
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ color: GOLD, marginBottom: 8, fontSize: 22 }}>
            Your Food Preferences
          </h2>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>
            Meals will be filtered by your region, diet type, and allergies.
          </p>

          {/* Region */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 12,
                color: "#888",
                display: "block",
                marginBottom: 8,
              }}
            >
              Preferred Cuisine Region
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {REGION_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setPrefs((p) => ({ ...p, region: r }))}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 20,
                    cursor: "pointer",
                    background: prefs.region === r ? `${GOLD}22` : "#111",
                    border: `1px solid ${prefs.region === r ? GOLD : "#282828"}`,
                    color: prefs.region === r ? GOLD : "#777",
                    fontSize: 12,
                    textTransform: "capitalize",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Diet Type */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 12,
                color: "#888",
                display: "block",
                marginBottom: 4,
              }}
            >
              Diet Type
            </label>
            <p style={{ fontSize: 10, color: "#555", margin: "0 0 10px" }}>
              Select one or more — meals will mix on each regeneration
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DIET_TYPE_OPTIONS.map((opt) => {
                const active = prefs.diet_type.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setPrefs((p) => {
                        const already = p.diet_type.includes(opt.value);
                        if (already && p.diet_type.length === 1) return p; // keep at least 1
                        return {
                          ...p,
                          diet_type: already
                            ? p.diet_type.filter((t) => t !== opt.value)
                            : [...p.diet_type, opt.value],
                        };
                      })
                    }
                    style={{
                      padding: "8px 16px",
                      borderRadius: 20,
                      cursor: "pointer",
                      background: active ? `${GOLD}22` : "#111",
                      border: `1px solid ${active ? GOLD : "#282828"}`,
                      color: active ? GOLD : "#777",
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {active ? "✓ " : ""}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Meals per day */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 12,
                color: "#888",
                display: "block",
                marginBottom: 8,
              }}
            >
              Meals Per Day
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setPrefs((p) => ({ ...p, meals_per_day: n }))}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 8,
                    cursor: "pointer",
                    background:
                      prefs.meals_per_day === n ? `${GOLD}22` : "#111",
                    border: `1px solid ${prefs.meals_per_day === n ? GOLD : "#282828"}`,
                    color: prefs.meals_per_day === n ? GOLD : "#777",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Allergens */}
          <div style={{ marginBottom: 28 }}>
            <label
              style={{
                fontSize: 12,
                color: "#888",
                display: "block",
                marginBottom: 8,
              }}
            >
              Allergens to Avoid
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALLERGEN_OPTIONS.map((a) => {
                const active = prefs.allergies.includes(a);
                return (
                  <button
                    key={a}
                    onClick={() =>
                      setPrefs((p) => ({
                        ...p,
                        allergies: active
                          ? p.allergies.filter((x) => x !== a)
                          : [...p.allergies, a],
                      }))
                    }
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      cursor: "pointer",
                      background: active ? "rgba(239,68,68,0.12)" : "#111",
                      border: `1px solid ${active ? "#ef4444" : "#282828"}`,
                      color: active ? "#ef4444" : "#666",
                      fontSize: 12,
                      textTransform: "capitalize",
                    }}
                  >
                    {active ? "✕ " : ""}
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleGeneratePlan}
            disabled={planLoading}
            style={{
              width: "100%",
              padding: "14px 0",
              background: GOLD,
              color: "#000",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              cursor: planLoading ? "not-allowed" : "pointer",
              opacity: planLoading ? 0.7 : 1,
              fontSize: 15,
            }}
          >
            {planLoading ? "Generating…" : "Generate My Plan →"}
          </button>
        </div>
      )}

      {/* ── Step 1: Meal Plan ── */}
      {!autoCalcLoading && !autoCalcError && step === 1 && plan && (
        <div>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 20,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ color: GOLD, fontSize: 22, marginBottom: 4 }}>
                Your 7-Day Meal Plan
              </h2>
              <p style={{ color: "#666", fontSize: 12 }}>
                Total: {plan.total_calories} kcal · P {plan.total_protein_g}g ·
                C {plan.total_carbs_g}g · F {plan.total_fat_g}g
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setPrefs({
                    region: "",
                    diet_type: [],
                    allergies: [],
                    meals_per_day: null,
                  });
                  localStorage.removeItem("flexa_diet_weekly_plan");
                  setWeeklyPlan(null);
                  setStep(0);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid #333",
                  borderRadius: 8,
                  padding: "8px 14px",
                  color: "#aaa",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <FiSettings size={13} /> Change Plan
              </button>
              <button
                onClick={handleGeneratePlan}
                disabled={planLoading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(212,175,55,0.1)",
                  border: `1px solid ${GOLD}44`,
                  borderRadius: 8,
                  padding: "8px 14px",
                  color: GOLD,
                  cursor: planLoading ? "not-allowed" : "pointer",
                  opacity: planLoading ? 0.6 : 1,
                  fontSize: 13,
                }}
              >
                <FiRefreshCw size={13} /> Regenerate
              </button>
            </div>
          </div>

          {/* Day selector — Mon through Sun */}
          {(() => {
            const DAY_LABELS = [
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
              "Sun",
            ];
            return (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 20,
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                {DAY_LABELS.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(i)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      flexShrink: 0,
                      background: selectedDay === i ? GOLD : "#111",
                      color: selectedDay === i ? "#000" : "#666",
                      border: `1px solid ${selectedDay === i ? GOLD : "#282828"}`,
                      fontWeight: selectedDay === i ? 700 : 400,
                      fontSize: 12,
                      transition: "all .2s",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Water reminder */}
          <div
            style={{
              background: "rgba(78,201,176,0.05)",
              border: "1px solid rgba(78,201,176,0.15)",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#4ec9b0",
            }}
          >
            <FiDroplet size={14} /> Target: {(plan.water_ml / 1000).toFixed(1)}L
            water today
          </div>

          {/* Meal slots */}
          {["breakfast", "lunch", "dinner", "snacks"].map((slot) => {
            const slotMeals = plan[slot];
            if (!slotMeals || slotMeals.length === 0) return null;
            return (
              <div key={slot} style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                    color: GOLD,
                    fontWeight: 600,
                    textTransform: "capitalize",
                    fontSize: 14,
                  }}
                >
                  {MEAL_ICONS[slot]} {slot}
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {slotMeals.map((meal, i) => (
                    <MealCard
                      key={i}
                      meal={meal}
                      onLog={() =>
                        handleLogMeal(meal, slot === "snacks" ? "snack" : slot)
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Tips */}
          {plan.tips && plan.tips.length > 0 && (
            <div
              style={{
                background: "#111",
                border: "1px solid #222",
                borderRadius: 12,
                padding: "16px 18px",
                marginTop: 8,
              }}
            >
              <div
                style={{
                  color: GOLD,
                  fontWeight: 600,
                  fontSize: 13,
                  marginBottom: 10,
                }}
              >
                💡 Diet Tips
              </div>
              {plan.tips.map((tip, i) => (
                <div
                  key={i}
                  style={{
                    color: "#888",
                    fontSize: 12,
                    marginBottom: 6,
                    paddingLeft: 10,
                    borderLeft: "2px solid #2a2a2a",
                  }}
                >
                  {tip}
                </div>
              ))}
            </div>
          )}

          {/* Bottom actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button
              onClick={() => {
                localStorage.removeItem("flexa_diet_weekly_plan");
                setWeeklyPlan(null);
                setStep(0);
              }}
              style={{
                flex: 1,
                padding: "12px 0",
                background: "transparent",
                border: "1px solid #2a2a2a",
                borderRadius: 10,
                color: "#555",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ← Recalculate from Scratch
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Tab: Log ───────────────────────────────────────────────────────────
  const renderLogTab = () => (
    <div>
      {/* Today Summary */}
      {summaryLoading ? (
        <div style={{ textAlign: "center", color: "#555", padding: 40 }}>
          Loading summary…
        </div>
      ) : summary ? (
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 16,
            }}
          >
            <h3 style={{ color: "#e0e0e0", fontSize: 16 }}>Today's Progress</h3>
            <span
              style={{
                fontSize: 12,
                color: summary.on_track ? "#4ec9b0" : "#ef4444",
              }}
            >
              {summary.on_track ? "✅ On track" : "⚠️ Over limit"}
            </span>
          </div>

          {/* Calorie ring summary */}
          <div
            style={{
              background: "#111",
              border: "1px solid #222",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: GOLD }}>
                {Math.round(summary.calories_consumed)}
              </div>
              <div style={{ fontSize: 10, color: "#555" }}>
                of {Math.round(summary.calorie_target)} kcal
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <MacroBar
                label="Protein"
                consumed={Math.round(summary.protein_consumed_g)}
                target={Math.round(summary.protein_target_g)}
                color="#4ec9b0"
              />
              <MacroBar
                label="Carbs"
                consumed={Math.round(summary.carbs_consumed_g)}
                target={Math.round(summary.carbs_target_g)}
                color="#ce9178"
              />
              <MacroBar
                label="Fats"
                consumed={Math.round(summary.fat_consumed_g)}
                target={Math.round(summary.fat_target_g)}
                color="#dcdcaa"
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#111",
            border: "1px solid #1a1a1a",
            borderRadius: 12,
            padding: "24px 20px",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <p style={{ color: "#555", fontSize: 13 }}>
            Complete Step 1 (Calculate Calories) to set up your daily targets.
          </p>
        </div>
      )}

      {/* Search food */}
      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            fontSize: 12,
            color: "#888",
            display: "block",
            marginBottom: 8,
          }}
        >
          Search & Log Food
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search food (e.g. Chicken Biryani)…"
            style={{
              flex: 1,
              background: "#111",
              border: "1px solid #282828",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#e0e0e0",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            style={{
              padding: "10px 18px",
              background: GOLD,
              color: "#000",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {searching ? "…" : "Search"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {searchResults.map((food) => (
              <div
                key={food.id}
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #1a1a1a",
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{ color: "#e0e0e0", fontSize: 13, fontWeight: 500 }}
                  >
                    {food.food_name}
                  </div>
                  <div style={{ fontSize: 11, color: "#555" }}>
                    {food.serving_size_g}g · {food.calories} kcal · P{" "}
                    {food.protein_g}g
                  </div>
                </div>
                <button
                  onClick={() => handleLogMeal(food)}
                  style={{
                    background: "rgba(212,175,55,0.1)",
                    border: `1px solid ${GOLD}44`,
                    borderRadius: 6,
                    padding: "5px 10px",
                    color: GOLD,
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  + Log
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's meal log */}
      <div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
          Today's Food Log (
          {
            mealLogs.filter((l) =>
              l.logged_at?.startsWith(new Date().toISOString().slice(0, 10)),
            ).length
          }{" "}
          items)
        </div>
        {mealLogs.length === 0 ? (
          <div
            style={{
              color: "#444",
              fontSize: 13,
              textAlign: "center",
              padding: 24,
            }}
          >
            No meals logged today. Search food above to start!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {mealLogs.slice(0, 20).map((log) => (
              <div
                key={log.id}
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #1a1a1a",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                {editingLog?.id === log.id ? (
                  /* ── Edit mode ── */
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        color: "#888",
                        fontSize: 12,
                        fontWeight: 600,
                        marginRight: 2,
                      }}
                    >
                      {log.food_name}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={editingLog.qty}
                      onChange={(e) =>
                        setEditingLog((el) => ({ ...el, qty: e.target.value }))
                      }
                      style={{
                        width: 70,
                        background: "#1a1a1a",
                        border: "1px solid #333",
                        borderRadius: 6,
                        padding: "4px 8px",
                        color: "#e0e0e0",
                        fontSize: 12,
                      }}
                    />
                    <span style={{ color: "#555", fontSize: 11 }}>g</span>
                    <select
                      value={editingLog.meal_type}
                      onChange={(e) =>
                        setEditingLog((el) => ({
                          ...el,
                          meal_type: e.target.value,
                        }))
                      }
                      style={{
                        background: "#1a1a1a",
                        border: "1px solid #333",
                        borderRadius: 6,
                        padding: "4px 8px",
                        color: "#e0e0e0",
                        fontSize: 12,
                      }}
                    >
                      {["breakfast", "lunch", "dinner", "snack"].map((mt) => (
                        <option key={mt} value={mt}>
                          {mt}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveEdit}
                      disabled={editSaving}
                      style={{
                        padding: "4px 12px",
                        background: GOLD,
                        color: "#000",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: editSaving ? "not-allowed" : "pointer",
                        opacity: editSaving ? 0.6 : 1,
                      }}
                    >
                      {editSaving ? "…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingLog(null)}
                      style={{
                        padding: "4px 8px",
                        background: "transparent",
                        border: "1px solid #333",
                        borderRadius: 6,
                        color: "#888",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <FiX size={12} />
                    </button>
                  </div>
                ) : (
                  /* ── Display mode ── */
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ color: "#ccc", fontSize: 13 }}>
                        {log.food_name}
                      </div>
                      <div style={{ fontSize: 11, color: "#555" }}>
                        {log.meal_type} · {log.quantity_g}g ·{" "}
                        {log.calories_consumed} kcal
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() =>
                          setEditingLog({
                            id: log.id,
                            qty: log.quantity_g,
                            meal_type: log.meal_type,
                          })
                        }
                        style={{
                          background: `rgba(212,175,55,0.08)`,
                          border: `1px solid ${GOLD}44`,
                          borderRadius: 6,
                          padding: "5px 8px",
                          color: GOLD,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <FiEdit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        style={{
                          background: "rgba(239,68,68,0.06)",
                          border: "1px solid rgba(239,68,68,0.15)",
                          borderRadius: 6,
                          padding: "5px 8px",
                          color: "#ef4444",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ──────────────────────────────────────── Render ───────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e0e0e0",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Toaster
        position="top-right"
        toastOptions={{ style: { background: "#1a1a1a", color: "#e0e0e0" } }}
      />

      <div
        style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px 80px" }}
      >
        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: GOLD,
              marginBottom: 6,
            }}
          >
            Diet Planner
          </h1>
          <p style={{ color: "#555", fontSize: 13 }}>
            Personalized calorie targets, macro splits, and culturally relevant
            meal plans.
          </p>
        </div>

        {/* FE-5: Hydration / Meal Reminder Banner */}
        {reminder && (
          <div
            style={{
              background: "rgba(78,201,176,0.06)",
              border: "1px solid rgba(78,201,176,0.2)",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 20,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <FiBell
              color="#4ec9b0"
              size={16}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  color: "#4ec9b0",
                  fontWeight: 600,
                  fontSize: 13,
                  marginBottom: 2,
                }}
              >
                {reminder.hydration.message}
              </div>
              <div style={{ color: "#555", fontSize: 11 }}>
                Daily water goal:{" "}
                {Math.round((reminder.hydration.target_ml / 1000) * 10) / 10}L (
                {reminder.hydration.glass_count} glasses)
              </div>
              {reminder.meal && (
                <div
                  style={{
                    color: "#ce9178",
                    fontSize: 12,
                    marginTop: 6,
                    fontWeight: 500,
                  }}
                >
                  🍽 {reminder.meal.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            background: "#111",
            borderRadius: 10,
            padding: 4,
            gap: 4,
            marginBottom: 32,
          }}
        >
          {[
            {
              key: "plan",
              label: "Generate Plan",
              icon: <FiTarget size={14} />,
            },
            { key: "log", label: "Daily Log", icon: <FiList size={14} /> },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                padding: "9px 16px",
                borderRadius: 8,
                cursor: "pointer",
                background: tab === t.key ? `${GOLD}18` : "transparent",
                border: `1px solid ${tab === t.key ? GOLD + "55" : "transparent"}`,
                color: tab === t.key ? GOLD : "#666",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontWeight: tab === t.key ? 600 : 400,
                fontSize: 13,
                transition: "all .2s",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "plan" ? renderPlanTab() : renderLogTab()}
      </div>
    </div>
  );
}

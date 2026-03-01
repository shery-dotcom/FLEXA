/**
 * DietPlanner.js — Module 3: Personalized Diet Planner
 * Multi-step flow:
 *   Step 1 → Personal info → calculate BMR/TDEE
 *   Step 2 → Show calorie & macro targets
 *   Step 3 → Preferences (region, diet type, allergies)
 *   Step 4 → Generated meal plan
 *   + Tab: Daily meal logger
 */
import { useState, useEffect, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  FiUser,
  FiTarget,
  FiSettings,
  FiList,
  FiPlus,
  FiTrash2,
  FiChevronRight,
  FiChevronLeft,
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
const STEPS = ["Your Info", "Calorie Targets", "Preferences", "Your Plan"];

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", sub: "Desk job, no exercise" },
  {
    value: "lightly_active",
    label: "Lightly Active",
    sub: "Light exercise 1–3×/week",
  },
  {
    value: "moderately_active",
    label: "Moderately Active",
    sub: "Exercise 3–5×/week",
  },
  {
    value: "very_active",
    label: "Very Active",
    sub: "Hard exercise 6–7×/week",
  },
  {
    value: "extremely_active",
    label: "Extremely Active",
    sub: "Physical job + 2× training",
  },
];

const GOAL_OPTIONS = [
  {
    value: "fat_loss",
    label: "Fat Loss",
    sub: "500 kcal deficit · −0.5 kg/week",
  },
  {
    value: "muscle_gain",
    label: "Muscle Gain",
    sub: "300 kcal surplus · lean bulk",
  },
  {
    value: "maintenance",
    label: "Maintenance",
    sub: "Maintain current weight",
  },
];

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

function MealCard({ meal, onLog }) {
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
          {meal.quantity_g}g · {meal.cuisine || "general"}
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
        {meal.ingredients && (
          <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>
            {meal.ingredients.slice(0, 80)}
            {meal.ingredients.length > 80 ? "…" : ""}
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

  // Step 1 form
  const [form, setForm] = useState({
    age: "",
    gender: "male",
    weight_kg: "",
    height_cm: "",
    activity_level: "moderately_active",
    goal: "maintenance",
  });
  const [calcLoading, setCalcLoading] = useState(false);
  const [targets, setTargets] = useState(null);

  // Step 3 prefs
  const [prefs, setPrefs] = useState({
    region: "general",
    diet_type: ["non-vegetarian"],
    allergies: [],
    meals_per_day: 3,
  });
  const [planLoading, setPlanLoading] = useState(false);
  const [plan, setPlan] = useState(null);

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

  // ── On mount: load existing diet preferences or pre-fill from profile ──────
  useEffect(() => {
    const init = async () => {
      // 1) Try loading saved diet preferences
      try {
        const res = await api.get("/diet/preferences");
        const p = res.data;
        // Pre-fill form with stored personal metrics
        setForm({
          age: p.age,
          gender: p.gender,
          weight_kg: p.weight_kg,
          height_cm: p.height_cm,
          activity_level: p.activity_level,
          goal: p.goal,
        });
        // Pre-fill preferences
        setPrefs({
          region: p.region,
          diet_type: Array.isArray(p.diet_type)
            ? p.diet_type
            : (p.diet_type || "non-vegetarian").split(",").map((s) => s.trim()),
          allergies: p.allergies || [],
          meals_per_day: p.meals_per_day,
        });
        // Restore computed targets
        setTargets({
          calorie_target: p.daily_calorie_target,
          protein_g: p.protein_target_g,
          carbs_g: p.carbs_target_g,
          fat_g: p.fat_target_g,
          water_ml: p.water_target_ml,
          bmr: p.bmr,
          tdee: p.tdee,
          summary: `Based on your ${p.goal.replace("_", " ")} goal and ${p.activity_level.replace("_", " ")} lifestyle.`,
        });
        // Skip step 0 – user already went through this
        setStep(1);
        return;
      } catch {
        // 404 = no preferences yet — fall back to profile data
      }

      // 2) No saved preferences: pre-fill what we know from the user profile
      const profile = user?.profile;
      if (profile) {
        setForm((f) => ({
          ...f,
          age: profile.age ?? f.age,
          gender: profile.gender ?? f.gender,
          weight_kg: profile.weight_kg ?? f.weight_kg,
          height_cm: profile.height_cm ?? f.height_cm,
        }));
        if (profile.region) {
          setPrefs((p) => ({ ...p, region: profile.region }));
        }
      }
    };
    init();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Step 1: Calculate calories ─────────────────────────────────────────
  const handleCalculate = async () => {
    const { age, weight_kg, height_cm } = form;
    if (!age || !weight_kg || !height_cm) {
      toast.error("Please fill in age, weight and height.");
      return;
    }
    setCalcLoading(true);
    try {
      const res = await api.post("/diet/calculate-calories", {
        ...form,
        age: parseInt(age),
        weight_kg: parseFloat(weight_kg),
        height_cm: parseFloat(height_cm),
      });
      setTargets(res.data);
      setStep(1);
      toast.success("Calorie targets calculated!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Calculation failed.");
    } finally {
      setCalcLoading(false);
    }
  };

  // ── Step 4: Generate plan ──────────────────────────────────────────────
  const handleGeneratePlan = async () => {
    if (!targets) return;
    setPlanLoading(true);
    try {
      const res = await api.post("/diet/generate-plan", {
        calorie_target: targets.calorie_target,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
        ...prefs,
      });
      setPlan(res.data);
      setStep(3);
      toast.success("Meal plan generated!");
    } catch (e) {
      toast.error(
        e.response?.data?.detail ||
          "Plan generation failed. Seed the nutrition DB first.",
      );
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

      {/* ── Step 0: Personal Info ── */}
      {step === 0 && (
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ color: GOLD, marginBottom: 8, fontSize: 22 }}>
            Your Personal Info
          </h2>
          <p style={{ color: "#666", marginBottom: 28, fontSize: 13 }}>
            Used to calculate your Basal Metabolic Rate (Mifflin-St Jeor
            formula).
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            {[
              { key: "age", label: "Age", placeholder: "25", type: "number" },
              {
                key: "weight_kg",
                label: "Weight (kg)",
                placeholder: "70",
                type: "number",
              },
              {
                key: "height_cm",
                label: "Height (cm)",
                placeholder: "175",
                type: "number",
              },
            ].map(({ key, label, placeholder, type }) => (
              <div
                key={key}
                style={{ gridColumn: key === "height_cm" ? "1 / -1" : "auto" }}
              >
                <label
                  style={{
                    fontSize: 12,
                    color: "#888",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: "#111",
                    border: "1px solid #282828",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "#e0e0e0",
                    fontSize: 14,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Gender */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 12,
                color: "#888",
                display: "block",
                marginBottom: 8,
              }}
            >
              Gender
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {["male", "female"].map((g) => (
                <button
                  key={g}
                  onClick={() => setForm((f) => ({ ...f, gender: g }))}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: form.gender === g ? `${GOLD}22` : "#111",
                    border: `1px solid ${form.gender === g ? GOLD : "#282828"}`,
                    color: form.gender === g ? GOLD : "#666",
                    fontWeight: 600,
                    textTransform: "capitalize",
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 12,
                color: "#888",
                display: "block",
                marginBottom: 8,
              }}
            >
              Activity Level
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setForm((f) => ({ ...f, activity_level: opt.value }))
                  }
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "10px 14px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background:
                      form.activity_level === opt.value ? `${GOLD}18` : "#111",
                    border: `1px solid ${form.activity_level === opt.value ? GOLD : "#222"}`,
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      color: form.activity_level === opt.value ? GOLD : "#ccc",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {opt.label}
                  </span>
                  <span style={{ color: "#555", fontSize: 11, marginTop: 2 }}>
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div style={{ marginBottom: 28 }}>
            <label
              style={{
                fontSize: 12,
                color: "#888",
                display: "block",
                marginBottom: 8,
              }}
            >
              Goal
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setForm((f) => ({ ...f, goal: opt.value }))}
                  style={{
                    flex: 1,
                    padding: "10px 10px 8px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: form.goal === opt.value ? `${GOLD}22` : "#111",
                    border: `1px solid ${form.goal === opt.value ? GOLD : "#222"}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span
                    style={{
                      color: form.goal === opt.value ? GOLD : "#ccc",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {opt.label}
                  </span>
                  <span
                    style={{ color: "#555", fontSize: 10, textAlign: "center" }}
                  >
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCalculate}
            disabled={calcLoading}
            style={{
              width: "100%",
              padding: "14px 24px",
              background: GOLD,
              color: "#000",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: calcLoading ? "not-allowed" : "pointer",
              opacity: calcLoading ? 0.7 : 1,
            }}
          >
            {calcLoading ? "Calculating…" : "Calculate My Targets →"}
          </button>
        </div>
      )}

      {/* ── Step 1: Calorie Targets ── */}
      {step === 1 && targets && (
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ color: GOLD, marginBottom: 6, fontSize: 22 }}>
            Your Calorie Targets
          </h2>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>
            {targets.summary}
          </p>

          {/* BMR / TDEE / Target */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginBottom: 24,
            }}
          >
            {[
              {
                label: "BMR",
                value: Math.round(targets.bmr),
                sub: "kcal/day at rest",
              },
              {
                label: "TDEE",
                value: Math.round(targets.tdee),
                sub: "with activity",
              },
              {
                label: "TARGET",
                value: Math.round(targets.calorie_target),
                sub: "your daily goal",
              },
            ].map(({ label, value, sub }) => (
              <div
                key={label}
                style={{
                  background: "#111",
                  border: `1px solid ${label === "TARGET" ? GOLD + "66" : "#222"}`,
                  borderRadius: 12,
                  padding: "16px 12px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: label === "TARGET" ? GOLD : "#e0e0e0",
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: GOLD,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                  {sub}
                </div>
              </div>
            ))}
          </div>

          {/* Macros */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <MacroPill
              label="Protein"
              value={`${targets.protein_g}g`}
              unit="kcal/g×4"
              color="#4ec9b0"
            />
            <MacroPill
              label="Carbs"
              value={`${targets.carbs_g}g`}
              unit="kcal/g×4"
              color="#ce9178"
            />
            <MacroPill
              label="Fats"
              value={`${targets.fat_g}g`}
              unit="kcal/g×9"
              color="#dcdcaa"
            />
          </div>

          {/* Water */}
          <div
            style={{
              background: "rgba(78,201,176,0.06)",
              border: "1px solid rgba(78,201,176,0.15)",
              borderRadius: 12,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 28,
            }}
          >
            <FiDroplet color="#4ec9b0" size={18} />
            <span style={{ color: "#4ec9b0", fontWeight: 600 }}>
              Drink {(targets.water_ml / 1000).toFixed(1)}L of water daily
            </span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setStep(0)}
              style={{
                flex: 1,
                padding: "12px 0",
                background: "transparent",
                border: "1px solid #333",
                borderRadius: 10,
                color: "#888",
                cursor: "pointer",
              }}
            >
              <FiChevronLeft size={14} style={{ marginRight: 4 }} /> Back
            </button>
            <button
              onClick={() => setStep(2)}
              style={{
                flex: 2,
                padding: "12px 0",
                background: GOLD,
                color: "#000",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Set Preferences →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preferences ── */}
      {step === 2 && (
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

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                flex: 1,
                padding: "12px 0",
                background: "transparent",
                border: "1px solid #333",
                borderRadius: 10,
                color: "#888",
                cursor: "pointer",
              }}
            >
              <FiChevronLeft size={14} style={{ marginRight: 4 }} /> Back
            </button>
            <button
              onClick={handleGeneratePlan}
              disabled={planLoading}
              style={{
                flex: 2,
                padding: "12px 0",
                background: GOLD,
                color: "#000",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                cursor: "pointer",
                opacity: planLoading ? 0.7 : 1,
              }}
            >
              {planLoading ? "Generating…" : "Generate My Plan →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Meal Plan ── */}
      {step === 3 && plan && (
        <div>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 24,
            }}
          >
            <div>
              <h2 style={{ color: GOLD, fontSize: 22, marginBottom: 4 }}>
                Your Daily Meal Plan
              </h2>
              <p style={{ color: "#666", fontSize: 12 }}>
                Total: {plan.total_calories} kcal · P {plan.total_protein_g}g ·
                C {plan.total_carbs_g}g · F {plan.total_fat_g}g
              </p>
            </div>
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
                cursor: "pointer",
              }}
            >
              <FiRefreshCw size={13} /> Regenerate
            </button>
          </div>

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

          <button
            onClick={() => setStep(0)}
            style={{
              marginTop: 24,
              width: "100%",
              padding: "12px 0",
              background: "transparent",
              border: "1px solid #333",
              borderRadius: 10,
              color: "#666",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ← Recalculate with Different Info
          </button>
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

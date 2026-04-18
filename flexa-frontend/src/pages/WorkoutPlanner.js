import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import FlexorGuide from "../components/FlexorGuide";
import {
  FiActivity,
  FiArrowLeft,
  FiClock,
  FiSun,
  FiWind,
  FiBarChart2,
  FiSettings,
  FiChevronRight,
  FiPlus,
  FiCheck,
  FiCamera,
} from "react-icons/fi";
import api from "../api/axios";
import toast from "react-hot-toast";

/* ─────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────── */
const FREQ_OPTIONS = [
  { value: 3, label: "3 Days / Week", desc: "Full Body split" },
  { value: 4, label: "4 Days / Week", desc: "Upper / Lower or Bro Split" },
  { value: 5, label: "5 Days / Week", desc: "PPL + extras" },
  { value: 6, label: "6 Days / Week", desc: "PPL twice per week" },
];

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner", desc: "Less than 1 year" },
  { value: "intermediate", label: "Intermediate", desc: "1–3 years" },
  { value: "advanced", label: "Advanced", desc: "3+ years" },
];

const SPLIT_INFO = {
  "Full Body": { desc: "All muscles every session — best for beginners" },
  PPL: { desc: "Push / Pull / Legs 3-day cycle" },
  "PPL x2": { desc: "Push / Pull / Legs — twice per week" },
  "Upper/Lower": { desc: "Alternating upper and lower body days" },
  "Bro Split": { desc: "One muscle group per session" },
};

const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */
function fmtTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseRepTarget(repsText) {
  const raw = String(repsText || "");
  const nums = raw.match(/\d+/g);
  if (!nums || nums.length === 0) return 0;
  const parsed = nums.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (parsed.length === 0) return 0;
  return Math.round(parsed.reduce((sum, n) => sum + n, 0) / parsed.length);
}

function makeDefaultSets(ex) {
  const count = Number(ex?.sets) || 3;
  return Array.from({ length: count }, () => ({
    weight: "",
    reps: "",
    done: false,
  }));
}

function getMuscleLabel(workout) {
  if (workout.is_rest_day) return "Rest";
  const name = (workout.name || "").toLowerCase();
  if (name.includes("push")) return "Chest · Shoulders · Triceps";
  if (name.includes("pull")) return "Back · Biceps";
  if (name.includes("leg")) return "Quads · Hamstrings · Glutes";
  if (name.includes("upper")) return "Chest · Back · Shoulders · Arms";
  if (name.includes("lower")) return "Legs · Core";
  if (name.includes("chest")) return "Chest";
  if (name.includes("back")) return "Back";
  if (name.includes("arm")) return "Biceps · Triceps";
  if (name.includes("shoulder")) return "Shoulders";
  if (name.includes("full")) return "Full Body";
  const groups = [
    ...new Set(
      (workout.exercises || [])
        .map((e) => e.muscle_group)
        .filter(Boolean)
        .map((g) => g.charAt(0).toUpperCase() + g.slice(1)),
    ),
  ];
  return groups.length > 0 ? groups.slice(0, 3).join(" · ") : "General";
}

function mapExerciseToPostureMode(exercise) {
  const raw =
    `${exercise?.name || ""} ${exercise?.muscle_group || ""}`.toLowerCase();

  if (/curl|bicep|biceps|hammer/.test(raw)) return "bicep_curl";
  if (/lunge|split squat|bulgarian|step up/.test(raw)) return "lunge";
  if (
    /push ?up|push-up|bench|chest press|dip|shoulder press|overhead press/.test(
      raw,
    )
  ) {
    return "pushup";
  }
  if (/squat|leg press|hack squat|front squat|back squat|goblet/.test(raw)) {
    return "squat";
  }

  return "squat";
}

/* ─────────────────────────────────────────────────────────────────
   Root component
───────────────────────────────────────────────────────────────── */
export default function WorkoutPlanner() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [freq, setFreq] = useState(4);
  const [week, setWeek] = useState(1);
  const [mlSplit, setMlSplit] = useState(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState("intermediate");
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [newFreq, setNewFreq] = useState(4);
  const [newExperienceLevel, setNewExperienceLevel] = useState("intermediate");

  // "plan" | "session"
  const [view, setView] = useState("plan");
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  /* ── fetch ── */
  const fetchMlSplit = async () => {
    try {
      const res = await api.get("/workouts/my-split");
      if (res.data?.split) setMlSplit(res.data);
    } catch {
      /* ignore */
    }
  };

  const fetchWorkouts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/workouts/?week=${week}`);
      const sorted = [...res.data].sort(
        (a, b) =>
          ALL_DAYS.indexOf(a.day_of_week) - ALL_DAYS.indexOf(b.day_of_week),
      );
      setWorkouts(sorted);
      if (sorted.length > 0) setHasPlan(true);
    } catch {
      /* no plan yet */
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);
  useEffect(() => {
    fetchMlSplit();
  }, []);

  /* ── generate ── */
  const generate = async (
    targetFreq = freq,
    targetWeek = week,
    targetXp = experienceLevel,
  ) => {
    setGenerating(true);
    try {
      const res = await api.post("/workouts/generate", {
        frequency_per_week: targetFreq,
        week_number: targetWeek,
        experience_level: targetXp,
      });
      const sorted = [...res.data].sort(
        (a, b) =>
          ALL_DAYS.indexOf(a.day_of_week) - ALL_DAYS.indexOf(b.day_of_week),
      );
      setWorkouts(sorted);
      setHasPlan(true);
      setFreq(targetFreq);
      setExperienceLevel(targetXp);
      if (targetWeek === 1) setWeek(1);
      toast.success(
        targetWeek === 1
          ? `${targetFreq}-day plan generated!`
          : `Week ${targetWeek} ready!`,
      );
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Set up your profile and goal first.",
      );
    } finally {
      setGenerating(false);
    }
  };

  /* ── complete workout ── */
  const completeWorkout = async (workoutId, sessionData = {}) => {
    try {
      await api.post(`/workouts/${workoutId}/complete`, {
        sets_data: sessionData.setsData || null,
        session_duration_seconds: sessionData.durationSeconds || null,
        notes: sessionData.notes || null,
      });
      toast.success("Workout session recorded!");
      fetchWorkouts();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not log session.");
    }
  };

  /* ── view transitions ── */
  const openSession = (workout) => {
    setSelectedWorkout(workout);
    setView("session");
    window.scrollTo({ top: 0 });
  };
  const backToPlan = () => {
    setView("plan");
    setSelectedWorkout(null);
  };

  /* ── render ── */
  if (view === "session" && selectedWorkout)
    return (
      <WorkoutSessionScreen
        workout={selectedWorkout}
        onBack={backToPlan}
        onComplete={async (sessionData) => {
          await completeWorkout(selectedWorkout.id, sessionData);
          backToPlan();
        }}
      />
    );

  /* ── Plan view ── */
  return (
    <div className="page-content">
      <FlexorGuide pageKey="workouts" />
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>
            Workout <span className="text-gold">Planner</span>
          </h1>
          <p style={{ color: "#9e9e9e", marginTop: 6, fontSize: 14 }}>
            AI-generated weekly training plan built around your goal
          </p>
        </div>

        {hasPlan && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="btn btn-ghost"
              onClick={() => setWeek((w) => Math.max(1, w - 1))}
              disabled={week <= 1}
              style={{ padding: "8px 14px" }}
            >
              ← Prev
            </button>
            <span
              style={{
                color: "#D4AF37",
                fontWeight: 700,
                minWidth: 60,
                textAlign: "center",
                fontSize: 14,
              }}
            >
              Week {week}
            </span>
            <button
              className="btn btn-ghost"
              onClick={() => setWeek((w) => w + 1)}
              style={{ padding: "8px 14px" }}
            >
              Next →
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setNewFreq(freq);
                setNewExperienceLevel(experienceLevel);
                setChangePlanOpen(true);
              }}
              style={{
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FiSettings size={14} /> Change Plan
            </button>
          </div>
        )}
      </div>

      {changePlanOpen && (
        <ChangePlanOverlay
          freq={newFreq}
          setFreq={setNewFreq}
          experienceLevel={newExperienceLevel}
          setExperienceLevel={setNewExperienceLevel}
          generating={generating}
          onConfirm={() => {
            setChangePlanOpen(false);
            generate(newFreq, 1, newExperienceLevel);
          }}
          onCancel={() => setChangePlanOpen(false)}
        />
      )}

      {loading ? (
        <div className="loading-center">
          <div className="spinner" />
        </div>
      ) : workouts.length === 0 && !hasPlan ? (
        <EmptyState
          freq={freq}
          setFreq={setFreq}
          experienceLevel={experienceLevel}
          setExperienceLevel={setExperienceLevel}
          generating={generating}
          onGenerate={() => generate(freq, 1, experienceLevel)}
        />
      ) : workouts.length === 0 && hasPlan ? (
        <WeekEmptyCard
          week={week}
          generating={generating}
          onGenerate={() => generate(freq, week, experienceLevel)}
        />
      ) : (
        <WeekGrid workouts={workouts} onViewWorkout={openSession} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   WeekGrid — 7 day cards
───────────────────────────────────────────────────────────────── */
function WeekGrid({ workouts, onViewWorkout }) {
  const dayMap = {};
  workouts.forEach((w) => {
    dayMap[w.day_of_week] = w;
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 18,
      }}
    >
      {ALL_DAYS.map((day) => {
        const workout = dayMap[day];
        const isRest = !workout || workout.is_rest_day;
        const exCount = workout?.exercises?.length || 0;
        const muscleLabel = workout && !isRest ? getMuscleLabel(workout) : null;
        const duration = workout?.duration_minutes || 0;
        const difficulty = workout?.difficulty || null;

        return (
          <div
            key={day}
            style={{
              background: isRest
                ? "rgba(255,255,255,0.015)"
                : "linear-gradient(145deg, #141414 0%, #0e0e0e 100%)",
              border: `1px solid ${isRest ? "#1a1a1a" : "#2a2a2a"}`,
              borderRadius: 14,
              padding: "22px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 0,
              minHeight: 180,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Accent line on left for workout days */}
            {!isRest && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background:
                    "linear-gradient(180deg, #D4AF37 0%, rgba(212,175,55,0.3) 100%)",
                  borderRadius: "14px 0 0 14px",
                }}
              />
            )}

            {/* Day label + difficulty pill */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isRest ? "#303030" : "#D4AF37",
                  textTransform: "uppercase",
                  letterSpacing: "1.2px",
                  margin: 0,
                }}
              >
                {day}
              </p>
              {!isRest && difficulty && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color:
                      difficulty === "advanced"
                        ? "#ef5350"
                        : difficulty === "intermediate"
                          ? "#D4AF37"
                          : "#4ec9b0",
                    background:
                      difficulty === "advanced"
                        ? "rgba(239,83,80,0.1)"
                        : difficulty === "intermediate"
                          ? "rgba(212,175,55,0.1)"
                          : "rgba(78,201,176,0.1)",
                    border: `1px solid ${difficulty === "advanced" ? "#ef535033" : difficulty === "intermediate" ? "#D4AF3733" : "#4ec9b033"}`,
                    borderRadius: 20,
                    padding: "2px 8px",
                    textTransform: "capitalize",
                  }}
                >
                  {difficulty}
                </span>
              )}
            </div>

            {/* Workout name */}
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: isRest ? "#252525" : "#e0e0e0",
                marginBottom: isRest ? 0 : 6,
                lineHeight: 1.3,
              }}
            >
              {isRest ? "Rest Day" : workout.name}
            </p>

            {/* Muscle groups */}
            {!isRest && muscleLabel && (
              <p
                style={{
                  fontSize: 12,
                  color: "#616161",
                  marginBottom: 14,
                  lineHeight: 1.4,
                }}
              >
                {muscleLabel}
              </p>
            )}

            {/* Stats row */}
            {!isRest && (
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginBottom: 16,
                  marginTop: "auto",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "#555",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <FiActivity size={11} color="#D4AF37" />
                  {exCount} exercises
                </span>
                {duration > 0 && (
                  <span
                    style={{
                      fontSize: 12,
                      color: "#555",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <FiClock size={11} color="#D4AF37" />
                    {duration} min
                  </span>
                )}
              </div>
            )}

            {/* View button */}
            {!isRest && (
              <button
                onClick={() => onViewWorkout(workout)}
                style={{
                  background: "rgba(212,175,55,0.07)",
                  border: "1px solid rgba(212,175,55,0.2)",
                  borderRadius: 9,
                  padding: "10px 14px",
                  color: "#D4AF37",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(212,175,55,0.55)";
                  e.currentTarget.style.background = "rgba(212,175,55,0.13)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(212,175,55,0.2)";
                  e.currentTarget.style.background = "rgba(212,175,55,0.07)";
                }}
              >
                View Workout <FiChevronRight size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Shared sub-components
───────────────────────────────────────────────────────────────── */
function StatPill({ icon, label }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color: "#9e9e9e",
      }}
    >
      <span style={{ color: "#D4AF37" }}>{icon}</span>
      {label}
    </div>
  );
}

function SectionLabel({ icon, label, color }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        color,
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon}
      {label}
    </p>
  );
}

function SimpleDetailRow({ name, right, rightColor }) {
  return (
    <div
      style={{
        background: "#111",
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        border: "1px solid #1e1e1e",
      }}
    >
      <p style={{ fontSize: 14, color: "#e0e0e0" }}>{name}</p>
      <span
        style={{
          fontSize: 13,
          color: rightColor || "#9e9e9e",
          fontWeight: 600,
        }}
      >
        {right}
      </span>
    </div>
  );
}

function ExerciseDetailCard({ index, ex }) {
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #1e1e1e",
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            flex: 1,
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "rgba(212,175,55,0.1)",
              border: "1px solid rgba(212,175,55,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#D4AF37",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {index + 1}
          </span>
          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#e0e0e0",
                marginBottom: 4,
              }}
            >
              {ex.name}
            </p>
            <p style={{ fontSize: 12, color: "#616161" }}>
              {ex.muscle_group
                ? ex.muscle_group.charAt(0).toUpperCase() +
                  ex.muscle_group.slice(1)
                : ""}
              {ex.equipment && ex.equipment !== "none"
                ? ` · ${ex.equipment.replace(/_/g, " ")}`
                : ""}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: "#D4AF37" }}>
            {ex.sets} × {ex.reps}
          </p>
          <p style={{ fontSize: 11, color: "#616161", marginTop: 2 }}>
            {ex.rest_seconds}s rest
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   WorkoutSessionScreen — unified workout day view with set logging,
   anti-cheat timer, and inline rest suggestions
───────────────────────────────────────────────────────────────── */
const MIN_SET_DURATION_S = 12; // min realistic seconds per set
const RAPID_WINDOW_S = 20; // sets completed within this window count as rapid
const RAPID_THRESHOLD = 3; // rapid sets before rest is suggested

function WorkoutSessionScreen({ workout, onBack, onComplete }) {
  const navigate = useNavigate();
  const exercises = (workout.exercises || []).filter(Boolean);
  const warmupList = workout.warmup || [];
  const cooldownList = workout.cooldown || [];

  /* ── session timer ── */
  const [sessionSec, setSessionSec] = useState(0);
  const sessionRef = useRef(null);
  useEffect(() => {
    sessionRef.current = setInterval(() => setSessionSec((s) => s + 1), 1000);
    return () => clearInterval(sessionRef.current);
  }, []);

  /* ── warmup / cooldown checklists ── */
  const [warmupChecked, setWarmupChecked] = useState(() =>
    Array(warmupList.length).fill(false),
  );
  const [cooldownChecked, setCooldownChecked] = useState(() =>
    Array(cooldownList.length).fill(false),
  );

  /* ── exercise accordion state ── */
  const [expandedExerciseIdx, setExpandedExerciseIdx] = useState(null);

  /* ── per-exercise set rows ── */
  const [allSetRows, setAllSetRows] = useState(() => {
    const init = {};
    exercises.forEach((ex, i) => {
      init[i] = makeDefaultSets(ex);
    });
    return init;
  });

  /* ── rest timer ── */
  const [restSec, setRestSec] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restMax, setRestMax] = useState(0);
  const [restLabel, setRestLabel] = useState("");
  const restRef = useRef(null);
  useEffect(() => {
    if (!restRunning) return;
    clearInterval(restRef.current);
    restRef.current = setInterval(() => {
      setRestSec((s) => {
        if (s <= 1) {
          clearInterval(restRef.current);
          setRestRunning(false);
          toast("Rest complete — start your next set!", {
            duration: 4000,
            style: {
              background: "#1a1a1a",
              border: "1px solid #4caf50",
              color: "#4caf50",
            },
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(restRef.current);
  }, [restRunning]);
  useEffect(() => () => clearInterval(restRef.current), []);

  /* ── anti-cheat refs ── */
  const exerciseStartedAt = useRef({}); // { [exIdx]: timestamp }
  const lastSetDoneAt = useRef({}); // { [exIdx]: timestamp }
  const rapidTimestamps = useRef([]); // timestamps of recent set completions (any exercise)

  const [completing, setCompleting] = useState(false);

  /* ── per-set individual timers ── */
  const [setTimers, setSetTimers] = useState({}); // { "exIdx_rowIdx": { sec, running } }
  const setTimerRefs = useRef({}); // { "exIdx_rowIdx": intervalId }

  const startSetTimer = (exIdx, rowIdx) => {
    const key = `${exIdx}_${rowIdx}`;
    if (setTimerRefs.current[key]) return; // already running
    setSetTimers((prev) => ({ ...prev, [key]: { sec: 0, running: true } }));
    setTimerRefs.current[key] = setInterval(() => {
      setSetTimers((prev) => ({
        ...prev,
        [key]: { running: true, sec: (prev[key]?.sec ?? 0) + 1 },
      }));
    }, 1000);
  };

  const stopSetTimer = (exIdx, rowIdx) => {
    const key = `${exIdx}_${rowIdx}`;
    clearInterval(setTimerRefs.current[key]);
    delete setTimerRefs.current[key];
    setSetTimers((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), running: false },
    }));
  };

  // Cleanup all set timers on unmount
  useEffect(
    () => () => Object.values(setTimerRefs.current).forEach(clearInterval),
    [],
  );

  /* ── helpers ── */
  const toggleExpand = (idx) => {
    setExpandedExerciseIdx((prev) => {
      if (prev === idx) return null;
      if (!exerciseStartedAt.current[idx]) {
        exerciseStartedAt.current[idx] = Date.now();
      }
      return idx;
    });
  };

  const updateRow = (exIdx, rowIdx, field, val) =>
    setAllSetRows((prev) => ({
      ...prev,
      [exIdx]: prev[exIdx].map((r, i) =>
        i === rowIdx ? { ...r, [field]: val } : r,
      ),
    }));

  const startRestTimer = (seconds, label) => {
    if (restRunning) return;
    setRestMax(seconds);
    setRestSec(seconds);
    setRestLabel(label);
    setRestRunning(true);
  };

  const toggleRowDone = (exIdx, rowIdx) => {
    const row = (allSetRows[exIdx] || [])[rowIdx];
    if (!row) return;

    /* un-mark */
    if (row.done) {
      setAllSetRows((prev) => ({
        ...prev,
        [exIdx]: prev[exIdx].map((r, i) =>
          i === rowIdx ? { ...r, done: false } : r,
        ),
      }));
      return;
    }

    /* ── anti-cheat: per-set timer check ── */
    const key = `${exIdx}_${rowIdx}`;
    const timerData = setTimers[key];

    if (!timerData) {
      toast("Tap ▶ to start the set timer first!", {
        duration: 3000,
        style: {
          background: "#1a1a1a",
          border: "1px solid #ff9800",
          color: "#ff9800",
        },
      });
      return;
    }

    if ((timerData.sec ?? 0) < MIN_SET_DURATION_S) {
      toast(
        `⚠ Too fast! Keep going — at least ${MIN_SET_DURATION_S}s per set.`,
        {
          duration: 4500,
          style: {
            background: "#1a1a1a",
            border: "1px solid #ef5350",
            color: "#ef5350",
          },
        },
      );
      return; // block the mark-done
    }

    stopSetTimer(exIdx, rowIdx);

    /* ── rapid-set fatigue detection ── */
    const now = Date.now();
    const cutoff = now - RAPID_WINDOW_S * 1000;
    rapidTimestamps.current = rapidTimestamps.current.filter((t) => t > cutoff);
    rapidTimestamps.current.push(now);

    if (rapidTimestamps.current.length >= RAPID_THRESHOLD) {
      rapidTimestamps.current = []; // reset counter
      setTimeout(() => {
        toast(
          "🔔 You're moving fast — take a 30-second recovery break to avoid fatigue and injury.",
          {
            duration: 6000,
            style: {
              background: "#1a1a1a",
              border: "1px solid #ff9800",
              color: "#ff9800",
            },
          },
        );
        startRestTimer(30, "Fatigue Break");
      }, 150);
    }

    /* ── mark done ── */
    const ex = exercises[exIdx];

    setAllSetRows((prev) => ({
      ...prev,
      [exIdx]: prev[exIdx].map((r, i) =>
        i === rowIdx ? { ...r, done: true } : r,
      ),
    }));

    /* start prescribed rest if no rest already running */
    if (ex?.rest_seconds) {
      startRestTimer(ex.rest_seconds, `${ex.name} rest`);
    }
  };

  const addSet = (exIdx) =>
    setAllSetRows((prev) => ({
      ...prev,
      [exIdx]: [...prev[exIdx], { weight: "", reps: "", done: false }],
    }));

  const completedCount = exercises.filter((_, i) =>
    (allSetRows[i] || []).some((r) => r.done),
  ).length;

  const sessionStats = exercises.reduce(
    (acc, ex, exIdx) => {
      const rows = allSetRows[exIdx] || [];
      const targetPerSet = parseRepTarget(ex?.reps);
      const completedRows = rows.filter((row) => row.done);

      acc.totalSets += rows.length;
      acc.completedSets += completedRows.length;
      acc.totalTargetReps += rows.length * targetPerSet;

      const loggedReps = completedRows.reduce((sum, row) => {
        const entered = Number(row.reps);
        if (Number.isFinite(entered) && entered > 0) return sum + entered;
        return sum + targetPerSet;
      }, 0);
      acc.loggedReps += loggedReps;

      if (rows.length > 0 && completedRows.length < rows.length) {
        acc.incompleteExercises.push({
          name: ex?.name || `Exercise ${exIdx + 1}`,
          done: completedRows.length,
          total: rows.length,
        });
      }

      return acc;
    },
    {
      totalSets: 0,
      completedSets: 0,
      totalTargetReps: 0,
      loggedReps: 0,
      incompleteExercises: [],
    },
  );

  const handleComplete = async () => {
    if (sessionStats.totalSets > 0 && sessionStats.completedSets === 0) {
      toast("Log at least one completed set before finishing this workout.", {
        duration: 3500,
        style: {
          background: "#1a1a1a",
          border: "1px solid #ff9800",
          color: "#ff9800",
        },
      });
      return;
    }

    if (sessionStats.incompleteExercises.length > 0) {
      const preview = sessionStats.incompleteExercises
        .slice(0, 3)
        .map((e) => `- ${e.name}: ${e.done}/${e.total} sets`)
        .join("\n");
      const moreCount = Math.max(
        0,
        sessionStats.incompleteExercises.length - 3,
      );
      const proceed = window.confirm(
        `You still have incomplete sets:\n\n${preview}${moreCount ? `\n- +${moreCount} more exercise(s)` : ""}\n\nComplete anyway?`,
      );
      if (!proceed) return;
    }

    clearInterval(sessionRef.current);
    setCompleting(true);
    await onComplete({
      setsData: allSetRows,
      durationSeconds: sessionSec,
      notes: `Session stats: ${sessionStats.completedSets}/${sessionStats.totalSets} sets, ${sessionStats.loggedReps}/${sessionStats.totalTargetReps || 0} reps logged.`,
    });
    setCompleting(false);
  };

  const openPostureTrackerForExercise = (exercise) => {
    const mappedExercise = mapExerciseToPostureMode(exercise);
    const params = new URLSearchParams({
      mode: "workout",
      exercise: mappedExercise,
      exerciseName: exercise?.name || "Workout Exercise",
    });
    navigate(`/posture-tracker?${params.toString()}`);
  };

  const expandedExercise =
    expandedExerciseIdx === null
      ? null
      : exercises[expandedExerciseIdx] || null;

  /* ── render ── */
  return (
    <div className="page-content" style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "#9e9e9e",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            padding: 0,
          }}
        >
          <FiArrowLeft size={16} /> Back to plan
        </button>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 16,
            fontWeight: 700,
            color: "#D4AF37",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FiClock size={14} /> {fmtTime(sessionSec)}
        </div>
      </div>

      {/* Workout header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 700,
            color: "#D4AF37",
            background: "rgba(212,175,55,0.1)",
            border: "1px solid rgba(212,175,55,0.25)",
            borderRadius: 6,
            padding: "3px 10px",
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {workout.day_of_week}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          {workout.name}
        </h1>
        <p style={{ color: "#9e9e9e", fontSize: 13, marginBottom: 10 }}>
          {getMuscleLabel(workout)}
        </p>
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <StatPill
            icon={<FiClock size={13} />}
            label={`${workout.duration_minutes} min`}
          />
          <StatPill
            icon={<FiActivity size={13} />}
            label={`${exercises.length} exercises`}
          />
          <StatPill
            icon={<FiCheck size={13} />}
            label={`${sessionStats.completedSets}/${sessionStats.totalSets} sets`}
          />
          <StatPill
            icon={<FiBarChart2 size={13} />}
            label={`${sessionStats.loggedReps}/${sessionStats.totalTargetReps || 0} reps`}
          />
          {workout.difficulty && (
            <StatPill
              icon={<FiBarChart2 size={13} />}
              label={
                workout.difficulty.charAt(0).toUpperCase() +
                workout.difficulty.slice(1)
              }
            />
          )}
        </div>
        {/* Progress bar */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 12, color: "#9e9e9e" }}>
              {completedCount} of {exercises.length} exercises logged
            </span>
            <span style={{ fontSize: 12, color: "#D4AF37", fontWeight: 700 }}>
              {exercises.length > 0
                ? Math.round((completedCount / exercises.length) * 100)
                : 0}
              %
            </span>
          </div>
          <div
            style={{
              background: "#1a1a1a",
              borderRadius: 6,
              height: 5,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0}%`,
                background: "#D4AF37",
                borderRadius: 6,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Rest timer (floating) */}
      {restRunning && (
        <div
          style={{
            background: "rgba(76,175,80,0.07)",
            border: "1px solid rgba(76,175,80,0.2)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <FiClock size={16} color="#4caf50" />
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <span style={{ fontSize: 13, color: "#4caf50", fontWeight: 700 }}>
                Rest — {restLabel}
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 18,
                  fontWeight: 800,
                  color: restSec <= 10 ? "#ef5350" : "#4caf50",
                }}
              >
                {fmtTime(restSec)}
              </span>
            </div>
            <div style={{ background: "#1a1a1a", borderRadius: 4, height: 4 }}>
              <div
                style={{
                  width: `${restMax > 0 ? (restSec / restMax) * 100 : 0}%`,
                  height: "100%",
                  background: restSec <= 10 ? "#ef5350" : "#4caf50",
                  borderRadius: 4,
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>
          <button
            onClick={() => {
              clearInterval(restRef.current);
              setRestRunning(false);
              setRestSec(0);
            }}
            style={{
              background: "none",
              border: "1px solid #2a2a2a",
              borderRadius: 6,
              padding: "5px 10px",
              cursor: "pointer",
              color: "#616161",
              fontSize: 12,
            }}
          >
            Skip
          </button>
        </div>
      )}

      {/* Warmup */}
      {warmupList.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionLabel
            icon={<FiSun size={13} />}
            label="Warm-Up"
            color="#ff9800"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {warmupList.map((item, i) => (
              <button
                key={i}
                onClick={() =>
                  setWarmupChecked((prev) =>
                    prev.map((v, j) => (j === i ? !v : v)),
                  )
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  background: warmupChecked[i]
                    ? "rgba(76,175,80,0.07)"
                    : "#111",
                  border: `1px solid ${warmupChecked[i] ? "rgba(76,175,80,0.3)" : "#1e1e1e"}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: `2px solid ${warmupChecked[i] ? "#4caf50" : "#333"}`,
                    background: warmupChecked[i]
                      ? "rgba(76,175,80,0.2)"
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {warmupChecked[i] && <FiCheck size={12} color="#4caf50" />}
                </div>
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: warmupChecked[i] ? "#9e9e9e" : "#e0e0e0",
                      textDecoration: warmupChecked[i]
                        ? "line-through"
                        : "none",
                    }}
                  >
                    {item.name || item}
                  </span>
                  {item.duration && (
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "#616161",
                        marginTop: 2,
                      }}
                    >
                      {item.duration}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exercises accordion */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel
          icon={<FiActivity size={13} />}
          label="Exercises"
          color="#D4AF37"
        />
        <button
          type="button"
          disabled={!expandedExercise}
          onClick={() => {
            if (expandedExercise) {
              openPostureTrackerForExercise(expandedExercise);
            }
          }}
          style={{
            marginBottom: 10,
            background: expandedExercise
              ? "rgba(0,229,255,0.08)"
              : "rgba(255,255,255,0.02)",
            border: `1px solid ${expandedExercise ? "rgba(0,229,255,0.25)" : "#2a2a2a"}`,
            borderRadius: 9,
            padding: "8px 10px",
            color: expandedExercise ? "#00e5ff" : "#666",
            fontSize: 12,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: expandedExercise ? "pointer" : "not-allowed",
          }}
        >
          <FiCamera size={13} />
          {expandedExercise
            ? `Track posture: ${expandedExercise.name}`
            : "Expand an exercise to track posture"}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {exercises.map((ex, exIdx) => {
            const isExpanded = expandedExerciseIdx === exIdx;
            const rows = allSetRows[exIdx] || [];
            const doneCount = rows.filter((r) => r.done).length;
            const hasProgress = doneCount > 0;

            return (
              <div
                key={exIdx}
                style={{
                  background: hasProgress
                    ? "linear-gradient(135deg,rgba(76,175,80,0.05) 0%,#111 100%)"
                    : "#111",
                  border: `1px solid ${
                    hasProgress
                      ? "rgba(76,175,80,0.25)"
                      : isExpanded
                        ? "rgba(212,175,55,0.3)"
                        : "#1e1e1e"
                  }`,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {/* Header / toggle */}
                <button
                  onClick={() => toggleExpand(exIdx)}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    padding: "14px 16px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: hasProgress
                            ? "rgba(76,175,80,0.15)"
                            : "rgba(212,175,55,0.1)",
                          border: `1px solid ${hasProgress ? "rgba(76,175,80,0.4)" : "rgba(212,175,55,0.25)"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          color: hasProgress ? "#4caf50" : "#D4AF37",
                          flexShrink: 0,
                        }}
                      >
                        {hasProgress ? <FiCheck size={12} /> : exIdx + 1}
                      </div>
                      <div>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#e0e0e0",
                            marginBottom: 2,
                          }}
                        >
                          {ex.name}
                        </p>
                        <p style={{ fontSize: 12, color: "#616161" }}>
                          {ex.muscle_group
                            ? ex.muscle_group.charAt(0).toUpperCase() +
                              ex.muscle_group.slice(1)
                            : ""}
                          {ex.equipment && ex.equipment !== "none"
                            ? ` · ${ex.equipment.replace(/_/g, " ")}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#D4AF37",
                          }}
                        >
                          {ex.sets} × {ex.reps}
                        </p>
                        {hasProgress && (
                          <p
                            style={{
                              fontSize: 11,
                              color: "#4caf50",
                              marginTop: 2,
                            }}
                          >
                            {doneCount}/{rows.length} done
                          </p>
                        )}
                        {!hasProgress && (
                          <p
                            style={{
                              fontSize: 11,
                              color: "#424242",
                              marginTop: 2,
                            }}
                          >
                            {ex.rest_seconds}s rest
                          </p>
                        )}
                      </div>
                      <FiChevronRight
                        size={14}
                        color="#616161"
                        style={{
                          transform: isExpanded ? "rotate(90deg)" : "none",
                          transition: "transform 0.2s",
                        }}
                      />
                    </div>
                  </div>
                </button>

                {/* Expanded set logger */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #1e1e1e" }}>
                    {/* Table header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "36px 1fr 1fr 72px 36px",
                        background: "#0d0d0d",
                        padding: "8px 16px",
                        borderBottom: "1px solid #1e1e1e",
                      }}
                    >
                      {["Set", "Weight (kg)", "Reps", "Timer", ""].map((h) => (
                        <p
                          key={h}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#616161",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            margin: 0,
                          }}
                        >
                          {h}
                        </p>
                      ))}
                    </div>

                    {/* Set rows */}
                    {rows.map((row, rowIdx) => {
                      const tKey = `${exIdx}_${rowIdx}`;
                      const tData = setTimers[tKey];
                      return (
                        <div
                          key={rowIdx}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "36px 1fr 1fr 72px 36px",
                            alignItems: "center",
                            padding: "10px 16px",
                            borderBottom:
                              rowIdx < rows.length - 1
                                ? "1px solid #161616"
                                : "none",
                            background: row.done
                              ? "rgba(76,175,80,0.05)"
                              : tData?.running
                                ? "rgba(212,175,55,0.03)"
                                : "transparent",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: row.done ? "#4caf50" : "#9e9e9e",
                            }}
                          >
                            {rowIdx + 1}
                          </span>
                          <input
                            type="number"
                            placeholder="—"
                            min="0"
                            step="0.5"
                            value={row.weight}
                            onChange={(e) =>
                              updateRow(exIdx, rowIdx, "weight", e.target.value)
                            }
                            disabled={row.done}
                            style={{
                              background: "transparent",
                              border: "none",
                              borderBottom: row.done
                                ? "none"
                                : "1px solid #2a2a2a",
                              color: row.done ? "#616161" : "#e0e0e0",
                              fontSize: 14,
                              padding: "4px 4px 4px 0",
                              width: "70%",
                              outline: "none",
                            }}
                          />
                          <input
                            type="number"
                            placeholder="—"
                            min="0"
                            value={row.reps}
                            onChange={(e) =>
                              updateRow(exIdx, rowIdx, "reps", e.target.value)
                            }
                            disabled={row.done}
                            style={{
                              background: "transparent",
                              border: "none",
                              borderBottom: row.done
                                ? "none"
                                : "1px solid #2a2a2a",
                              color: row.done ? "#616161" : "#e0e0e0",
                              fontSize: 14,
                              padding: "4px 4px 4px 0",
                              width: "70%",
                              outline: "none",
                            }}
                          />
                          {/* Per-set timer */}
                          {row.done ? (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#4caf50",
                                fontFamily: "monospace",
                              }}
                            >
                              {tData ? fmtTime(tData.sec) : "—"}
                            </span>
                          ) : tData?.running ? (
                            <button
                              onClick={() => stopSetTimer(exIdx, rowIdx)}
                              style={{
                                background: "rgba(239,83,80,0.1)",
                                border: "1px solid rgba(239,83,80,0.3)",
                                borderRadius: 6,
                                padding: "4px 6px",
                                color: "#ef5350",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                                fontFamily: "monospace",
                              }}
                            >
                              ⏹ {fmtTime(tData.sec)}
                            </button>
                          ) : (
                            <button
                              onClick={() => startSetTimer(exIdx, rowIdx)}
                              style={{
                                background: "rgba(212,175,55,0.1)",
                                border: "1px solid rgba(212,175,55,0.3)",
                                borderRadius: 6,
                                padding: "4px 6px",
                                color: "#D4AF37",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              ▶ Start
                            </button>
                          )}
                          <button
                            onClick={() => toggleRowDone(exIdx, rowIdx)}
                            style={{
                              background: row.done
                                ? "rgba(76,175,80,0.15)"
                                : "rgba(255,255,255,0.03)",
                              border: `1px solid ${row.done ? "rgba(76,175,80,0.4)" : "#2a2a2a"}`,
                              borderRadius: 6,
                              width: 32,
                              height: 32,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            {row.done ? (
                              <FiCheck size={14} color="#4caf50" />
                            ) : (
                              <div
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  border: "2px solid #3a3a3a",
                                }}
                              />
                            )}
                          </button>
                        </div>
                      );
                    })}

                    {/* Add set + Cancel (collapse) */}
                    <div
                      style={{ display: "flex", gap: 8, padding: "10px 16px" }}
                    >
                      <button
                        onClick={() => addSet(exIdx)}
                        style={{
                          flex: 1,
                          background: "none",
                          border: "1px dashed #2a2a2a",
                          borderRadius: 8,
                          padding: "8px",
                          color: "#616161",
                          fontSize: 13,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#D4AF37";
                          e.currentTarget.style.color = "#D4AF37";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#2a2a2a";
                          e.currentTarget.style.color = "#616161";
                        }}
                      >
                        <FiPlus size={13} /> Add Set
                      </button>
                      <button
                        onClick={() => toggleExpand(exIdx)}
                        style={{
                          background: "rgba(239,83,80,0.07)",
                          border: "1px solid rgba(239,83,80,0.2)",
                          borderRadius: 8,
                          padding: "8px 14px",
                          color: "#ef5350",
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cooldown */}
      {cooldownList.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionLabel
            icon={<FiWind size={13} />}
            label="Cool-Down"
            color="#4caf50"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cooldownList.map((item, i) => (
              <button
                key={i}
                onClick={() =>
                  setCooldownChecked((prev) =>
                    prev.map((v, j) => (j === i ? !v : v)),
                  )
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  background: cooldownChecked[i]
                    ? "rgba(212,175,55,0.06)"
                    : "#111",
                  border: `1px solid ${
                    cooldownChecked[i] ? "rgba(212,175,55,0.25)" : "#1e1e1e"
                  }`,
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: `2px solid ${cooldownChecked[i] ? "#D4AF37" : "#333"}`,
                    background: cooldownChecked[i]
                      ? "rgba(212,175,55,0.15)"
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {cooldownChecked[i] && <FiCheck size={12} color="#D4AF37" />}
                </div>
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: cooldownChecked[i] ? "#9e9e9e" : "#e0e0e0",
                      textDecoration: cooldownChecked[i]
                        ? "line-through"
                        : "none",
                    }}
                  >
                    {item.name || item}
                  </span>
                  {item.duration && (
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "#616161",
                        marginTop: 2,
                      }}
                    >
                      {item.duration}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Complete workout button */}
      <div style={{ position: "sticky", bottom: 16, padding: "16px 0 4px" }}>
        <button
          className="btn btn-gold"
          style={{
            width: "100%",
            padding: "14px",
            fontSize: 15,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: completing ? 0.45 : 1,
            cursor: completing ? "not-allowed" : "pointer",
          }}
          onClick={handleComplete}
          disabled={completing}
        >
          {completing ? "Saving..." : "Complete Workout ✓"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   EmptyState
───────────────────────────────────────────────────────────────── */
function EmptyState({
  freq,
  setFreq,
  experienceLevel,
  setExperienceLevel,
  generating,
  onGenerate,
}) {
  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        textAlign: "center",
        paddingTop: 20,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "rgba(212,175,55,0.07)",
          border: "1px solid rgba(212,175,55,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}
      >
        <FiActivity size={32} color="#D4AF37" />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        No workout plan yet
      </h2>
      <p
        style={{
          color: "#9e9e9e",
          fontSize: 14,
          marginBottom: 36,
          lineHeight: 1.6,
        }}
      >
        Tell us how many days you can train each week and your experience level.
        We&apos;ll build you a full weekly plan.
      </p>

      <div style={{ marginBottom: 24, textAlign: "left" }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#D4AF37",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 10,
          }}
        >
          Days per week
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FREQ_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFreq(f.value)}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: freq === f.value ? "#D4AF37" : "#2a2a2a",
                background:
                  freq === f.value ? "rgba(212,175,55,0.1)" : "transparent",
                color: freq === f.value ? "#D4AF37" : "#9e9e9e",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f.value} days
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 32, textAlign: "left" }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#D4AF37",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 10,
          }}
        >
          Experience level
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {EXPERIENCE_OPTIONS.map((e) => (
            <button
              key={e.value}
              onClick={() => setExperienceLevel(e.value)}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "1px solid",
                borderColor:
                  experienceLevel === e.value ? "#D4AF37" : "#2a2a2a",
                background:
                  experienceLevel === e.value
                    ? "rgba(212,175,55,0.1)"
                    : "transparent",
                color: experienceLevel === e.value ? "#D4AF37" : "#9e9e9e",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="btn btn-gold"
        style={{ width: "100%", padding: "13px", fontSize: 15 }}
        onClick={onGenerate}
        disabled={generating}
      >
        {generating ? "Generating..." : "Generate My Plan"}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
/* ─────────────────────────────────────────────────────────────────
   WeekEmptyCard
───────────────────────────────────────────────────────────────── */
function WeekEmptyCard({ week, generating, onGenerate }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        border: "1px dashed #242424",
        borderRadius: 14,
      }}
    >
      <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
        Week {week} not generated yet
      </p>
      <p style={{ color: "#9e9e9e", fontSize: 14, marginBottom: 24 }}>
        Generate this week's workouts to continue your plan.
      </p>
      <button
        className="btn btn-gold"
        onClick={onGenerate}
        disabled={generating}
      >
        {generating ? "Generating..." : `Generate Week ${week}`}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ChangePlanOverlay
───────────────────────────────────────────────────────────────── */
function ChangePlanOverlay({
  freq,
  setFreq,
  experienceLevel,
  setExperienceLevel,
  generating,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#111",
          border: "1px solid rgba(212,175,55,0.25)",
          borderRadius: 16,
          padding: "32px",
          width: "100%",
          maxWidth: 460,
        }}
      >
        <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
          Change Training Plan
        </h3>
        <p style={{ color: "#9e9e9e", fontSize: 14, marginBottom: 28 }}>
          This will replace your existing plan with a new one.
        </p>

        <div style={{ marginBottom: 20 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#D4AF37",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 10,
            }}
          >
            Days per week
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FREQ_OPTIONS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFreq(f.value)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: freq === f.value ? "#D4AF37" : "#2a2a2a",
                  background:
                    freq === f.value ? "rgba(212,175,55,0.1)" : "transparent",
                  color: freq === f.value ? "#D4AF37" : "#9e9e9e",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {f.value} days
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#D4AF37",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 10,
            }}
          >
            Experience level
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {EXPERIENCE_OPTIONS.map((e) => (
              <button
                key={e.value}
                onClick={() => setExperienceLevel(e.value)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor:
                    experienceLevel === e.value ? "#D4AF37" : "#2a2a2a",
                  background:
                    experienceLevel === e.value
                      ? "rgba(212,175,55,0.1)"
                      : "transparent",
                  color: experienceLevel === e.value ? "#D4AF37" : "#9e9e9e",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn btn-gold"
            style={{ flex: 1 }}
            onClick={onConfirm}
            disabled={generating}
          >
            {generating ? "Generating..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import FlexorGuide from "../components/FlexorGuide";
import {
  FiActivity,
  FiArrowLeft,
  FiMoon,
  FiClock,
  FiSun,
  FiWind,
  FiBarChart2,
  FiSettings,
  FiChevronRight,
  FiPlus,
  FiCheck,
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

  // "plan" | "detail" | "active"
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
  const completeWorkout = async (workoutId) => {
    try {
      await api.post(`/workouts/${workoutId}/complete`);
      toast.success("Workout session recorded!");
      fetchWorkouts();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not log session.");
    }
  };

  /* ── view transitions ── */
  const openDetail = (workout) => {
    setSelectedWorkout(workout);
    setView("detail");
    window.scrollTo({ top: 0 });
  };
  const openActive = () => {
    setView("active");
    window.scrollTo({ top: 0 });
  };
  const backToPlan = () => {
    setView("plan");
    setSelectedWorkout(null);
  };
  const backToDetail = () => {
    setView("detail");
  };

  /* ── render ── */
  if (view === "detail" && selectedWorkout)
    return (
      <DayDetailView
        workout={selectedWorkout}
        onBack={backToPlan}
        onStart={openActive}
      />
    );

  if (view === "active" && selectedWorkout)
    return (
      <ActiveWorkoutView
        workout={selectedWorkout}
        onBack={backToDetail}
        onComplete={async () => {
          await completeWorkout(selectedWorkout.id);
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
          {mlSplit && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginTop: 10,
                padding: "7px 14px",
                background: "rgba(212,175,55,0.08)",
                border: "1px solid rgba(212,175,55,0.3)",
                borderRadius: 20,
                fontSize: 13,
              }}
            >
              <FiBarChart2 size={14} color="#D4AF37" />
              <span style={{ color: "#D4AF37", fontWeight: 700 }}>
                ML Recommended:
              </span>
              <span style={{ color: "#e0e0e0" }}>{mlSplit.split}</span>
              <span style={{ color: "#616161", fontSize: 12 }}>
                — {SPLIT_INFO[mlSplit.split]?.desc}
              </span>
            </div>
          )}
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
        <WeekGrid workouts={workouts} onViewWorkout={openDetail} />
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
   DayDetailView
───────────────────────────────────────────────────────────────── */
function DayDetailView({ workout, onBack, onStart }) {
  const exercises = workout.exercises || [];
  const warmup = workout.warmup || [];
  const cooldown = workout.cooldown || [];

  return (
    <div className="page-content" style={{ maxWidth: 720, margin: "0 auto" }}>
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
          marginBottom: 24,
          padding: 0,
        }}
      >
        <FiArrowLeft size={16} /> Back to week plan
      </button>

      <div style={{ marginBottom: 28 }}>
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
            marginBottom: 10,
          }}
        >
          {workout.day_of_week}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>
          {workout.name}
        </h1>
        <p style={{ color: "#9e9e9e", fontSize: 14 }}>
          {getMuscleLabel(workout)}
        </p>
        <div
          style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}
        >
          <StatPill
            icon={<FiClock size={13} />}
            label={`${workout.duration_minutes} min`}
          />
          <StatPill
            icon={<FiActivity size={13} />}
            label={`${exercises.length} exercises`}
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
      </div>

      {warmup.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel
            icon={<FiSun size={13} />}
            label="Warmup"
            color="#ff9800"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {warmup.map((item, i) => (
              <SimpleDetailRow
                key={i}
                name={item.name}
                right={item.duration}
                rightColor="#ff9800"
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <SectionLabel
          icon={<FiActivity size={13} />}
          label="Exercises"
          color="#D4AF37"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {exercises.map((ex, i) => (
            <ExerciseDetailCard key={i} index={i} ex={ex} />
          ))}
        </div>
      </div>

      {cooldown.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel
            icon={<FiWind size={13} />}
            label="Cooldown"
            color="#4caf50"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cooldown.map((item, i) => (
              <SimpleDetailRow
                key={i}
                name={item.name}
                right={item.duration}
                rightColor="#4caf50"
              />
            ))}
          </div>
        </div>
      )}

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
          }}
          onClick={onStart}
        >
          Start Workout
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ActiveWorkoutView — live set tracker (with warmup & cooldown)
───────────────────────────────────────────────────────────────── */
function ActiveWorkoutView({ workout, onBack, onComplete }) {
  const exercises = (workout.exercises || []).filter(Boolean);
  const warmupList = workout.warmup || [];
  const cooldownList = workout.cooldown || [];
  const total = exercises.length;

  // phase: "warmup" → "exercise" → "cooldown" → "done"
  const [phase, setPhase] = useState(
    warmupList.length > 0 ? "warmup" : "exercise",
  );
  const [warmupChecked, setWarmupChecked] = useState(() =>
    Array(warmupList.length).fill(false),
  );
  const [cooldownChecked, setCooldownChecked] = useState(() =>
    Array(cooldownList.length).fill(false),
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [setRows, setSetRows] = useState(() => makeDefaultSets(exercises[0]));
  const [sessionSec, setSessionSec] = useState(0);
  const [restSec, setRestSec] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restMax, setRestMax] = useState(0);
  const [completing, setCompleting] = useState(false);

  const sessionRef = useRef(null);
  const restRef = useRef(null);
  const lastSetDoneAt = useRef(null);

  useEffect(() => {
    sessionRef.current = setInterval(() => setSessionSec((s) => s + 1), 1000);
    return () => clearInterval(sessionRef.current);
  }, []);

  useEffect(() => {
    if (!restRunning) return;
    clearInterval(restRef.current);
    restRef.current = setInterval(() => {
      setRestSec((s) => {
        if (s <= 1) {
          clearInterval(restRef.current);
          setRestRunning(false);
          toast("Rest complete — start your next set.", {
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

  // Clear session timer on unmount
  useEffect(() => () => clearInterval(sessionRef.current), []);

  const goToExercise = (idx) => {
    setCurrentIdx(idx);
    setSetRows(makeDefaultSets(exercises[idx]));
    clearInterval(restRef.current);
    setRestRunning(false);
    setRestSec(0);
    lastSetDoneAt.current = null;
    window.scrollTo({ top: 0 });
  };

  const ex = exercises[currentIdx];
  const isLast = currentIdx === total - 1;

  const updateRow = (idx, field, val) =>
    setSetRows((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    );

  const toggleRowDone = (idx) => {
    const currentRow = setRows[idx];
    if (currentRow?.done) {
      setSetRows((rows) =>
        rows.map((r, i) => (i === idx ? { ...r, done: false } : r)),
      );
      return;
    }
    lastSetDoneAt.current = Date.now();
    setSetRows((rows) =>
      rows.map((r, i) => {
        if (i !== idx) return r;
        if (ex?.rest_seconds) {
          clearInterval(restRef.current);
          setRestMax(ex.rest_seconds);
          setRestSec(ex.rest_seconds);
          setRestRunning(true);
        }
        return { ...r, done: true };
      }),
    );
  };

  const addSet = () =>
    setSetRows((rows) => [...rows, { weight: "", reps: "", done: false }]);

  const handleCompleteExercise = async () => {
    if (isLast) {
      // Transition to cooldown if available, else done
      clearInterval(sessionRef.current);
      if (cooldownList.length > 0) {
        setPhase("cooldown");
      } else {
        setPhase("done");
        setCompleting(true);
        await onComplete();
        setCompleting(false);
      }
    } else {
      goToExercise(currentIdx + 1);
    }
  };

  const handleFinishCooldown = async () => {
    setCompleting(true);
    clearInterval(sessionRef.current);
    await onComplete();
    setCompleting(false);
    setPhase("done");
  };

  /* ── Warmup phase ── */
  if (phase === "warmup") {
    const allChecked = warmupChecked.every(Boolean);
    return (
      <div className="page-content" style={{ maxWidth: 680, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
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
            <FiArrowLeft size={16} /> Back
          </button>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 14,
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
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(76,175,80,0.1)",
              border: "1px solid rgba(76,175,80,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <FiActivity size={26} color="#4caf50" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
            Warm-Up
          </h2>
          <p style={{ color: "#9e9e9e", fontSize: 13 }}>
            Complete each warm-up activity before starting your workout
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 32,
          }}
        >
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
                gap: 14,
                padding: "14px 18px",
                background: warmupChecked[i] ? "rgba(76,175,80,0.07)" : "#111",
                border: `1px solid ${warmupChecked[i] ? "rgba(76,175,80,0.3)" : "#1e1e1e"}`,
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: `2px solid ${warmupChecked[i] ? "#4caf50" : "#333"}`,
                  background: warmupChecked[i]
                    ? "rgba(76,175,80,0.2)"
                    : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {warmupChecked[i] && <FiCheck size={13} color="#4caf50" />}
              </div>
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: warmupChecked[i] ? "#9e9e9e" : "#e0e0e0",
                    textDecoration: warmupChecked[i] ? "line-through" : "none",
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
          }}
          onClick={() => setPhase("exercise")}
        >
          {allChecked ? "Start Training →" : "Skip Warm-Up & Start →"}
        </button>
      </div>
    );
  }

  /* ── Cooldown phase ── */
  if (phase === "cooldown") {
    const allChecked = cooldownChecked.every(Boolean);
    return (
      <div className="page-content" style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(212,175,55,0.1)",
              border: "1px solid rgba(212,175,55,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <FiActivity size={26} color="#D4AF37" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
            Cool-Down
          </h2>
          <p style={{ color: "#9e9e9e", fontSize: 13 }}>
            Great work! Finish with these cool-down activities
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 32,
          }}
        >
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
                gap: 14,
                padding: "14px 18px",
                background: cooldownChecked[i]
                  ? "rgba(212,175,55,0.06)"
                  : "#111",
                border: `1px solid ${cooldownChecked[i] ? "rgba(212,175,55,0.25)" : "#1e1e1e"}`,
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: `2px solid ${cooldownChecked[i] ? "#D4AF37" : "#333"}`,
                  background: cooldownChecked[i]
                    ? "rgba(212,175,55,0.15)"
                    : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {cooldownChecked[i] && <FiCheck size={13} color="#D4AF37" />}
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
            opacity: completing ? 0.5 : 1,
            cursor: completing ? "not-allowed" : "pointer",
          }}
          onClick={handleFinishCooldown}
          disabled={completing}
        >
          {completing
            ? "Saving..."
            : allChecked
              ? "Complete Workout ✓"
              : "Skip & Complete Workout"}
        </button>
      </div>
    );
  }

  /* ── Done / summary phase ── */
  if (phase === "done") {
    return (
      <div
        className="page-content"
        style={{
          maxWidth: 680,
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
            background: "rgba(76,175,80,0.1)",
            border: "2px solid rgba(76,175,80,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <FiCheck size={32} color="#4caf50" />
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
          Workout Complete!
        </h2>
        <p style={{ color: "#9e9e9e", fontSize: 14, marginBottom: 32 }}>
          Excellent session — every rep counts.
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            marginBottom: 40,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#D4AF37",
                fontFamily: "monospace",
              }}
            >
              {fmtTime(sessionSec)}
            </p>
            <p style={{ fontSize: 12, color: "#616161", marginTop: 4 }}>
              Total time
            </p>
          </div>
          <div style={{ width: 1, background: "#1e1e1e" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#D4AF37" }}>
              {total}
            </p>
            <p style={{ fontSize: 12, color: "#616161", marginTop: 4 }}>
              Exercises
            </p>
          </div>
        </div>
        <button
          className="btn btn-gold"
          style={{ padding: "13px 36px", fontSize: 15, fontWeight: 700 }}
          onClick={onBack}
        >
          Back to Plan
        </button>
      </div>
    );
  }

  if (!ex) return null;

  return (
    <div className="page-content" style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
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
          <FiArrowLeft size={16} /> Back
        </button>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 14,
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

      {/* Progress bar */}
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 12, color: "#9e9e9e" }}>
            Exercise {currentIdx + 1} of {total}
          </span>
          <span style={{ fontSize: 12, color: "#D4AF37", fontWeight: 700 }}>
            {Math.round((currentIdx / total) * 100)}% done
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
              width: `${(currentIdx / total) * 100}%`,
              background: "#D4AF37",
              borderRadius: 6,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Exercise card */}
      <div
        style={{
          background: "linear-gradient(135deg,#111 0%,#181408 100%)",
          border: "1px solid rgba(212,175,55,0.22)",
          borderRadius: 14,
          padding: "20px 20px 18px",
          marginBottom: 20,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#D4AF37",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 6,
          }}
        >
          {ex.muscle_group
            ? ex.muscle_group.charAt(0).toUpperCase() + ex.muscle_group.slice(1)
            : "Exercise"}
        </p>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
          {ex.name}
        </h2>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#9e9e9e" }}>
            Target: {ex.sets} sets × {ex.reps}
          </span>
          {ex.equipment && ex.equipment !== "none" && (
            <span style={{ fontSize: 13, color: "#616161" }}>
              {ex.equipment.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      {/* Rest timer */}
      {restRunning && (
        <div
          style={{
            background: "rgba(76,175,80,0.07)",
            border: "1px solid rgba(76,175,80,0.2)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 20,
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
                Rest
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

      {/* Set table */}
      <div
        style={{
          background: "#111",
          border: "1px solid #1e1e1e",
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 1fr 44px",
            background: "#0d0d0d",
            padding: "10px 16px",
            borderBottom: "1px solid #1e1e1e",
          }}
        >
          {["Set", "Weight (kg)", "Reps", ""].map((h) => (
            <p
              key={h}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#616161",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {h}
            </p>
          ))}
        </div>
        {setRows.map((row, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 1fr 44px",
              alignItems: "center",
              padding: "10px 16px",
              borderBottom:
                i < setRows.length - 1 ? "1px solid #161616" : "none",
              background: row.done ? "rgba(76,175,80,0.05)" : "transparent",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: row.done ? "#4caf50" : "#9e9e9e",
              }}
            >
              {i + 1}
            </span>
            <input
              type="number"
              placeholder="—"
              min="0"
              step="0.5"
              value={row.weight}
              onChange={(e) => updateRow(i, "weight", e.target.value)}
              disabled={row.done}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: row.done ? "none" : "1px solid #2a2a2a",
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
              onChange={(e) => updateRow(i, "reps", e.target.value)}
              disabled={row.done}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: row.done ? "none" : "1px solid #2a2a2a",
                color: row.done ? "#616161" : "#e0e0e0",
                fontSize: 14,
                padding: "4px 4px 4px 0",
                width: "70%",
                outline: "none",
              }}
            />
            <button
              onClick={() => toggleRowDone(i)}
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
        ))}
      </div>

      {/* Add set */}
      <button
        onClick={addSet}
        style={{
          background: "none",
          border: "1px dashed #2a2a2a",
          borderRadius: 8,
          padding: "9px 14px",
          color: "#616161",
          fontSize: 13,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          justifyContent: "center",
          marginBottom: 28,
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
        <FiPlus size={14} /> Add Set
      </button>

      {/* Complete / Next */}
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
        onClick={handleCompleteExercise}
        disabled={completing}
      >
        {completing
          ? "Saving..."
          : isLast
            ? cooldownList.length > 0
              ? "Finish & Cool Down →"
              : "Complete Workout ✓"
            : `Next: ${exercises[currentIdx + 1]?.name} →`}
      </button>

      {/* Dot navigation */}
      {total > 1 && (
        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#424242",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Exercises
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
            }}
          >
            {exercises.map((e, i) => (
              <button
                key={i}
                onClick={() => i !== currentIdx && goToExercise(i)}
                title={e.name}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: `2px solid ${i === currentIdx ? "#D4AF37" : "#2a2a2a"}`,
                  background: i === currentIdx ? "#D4AF37" : "transparent",
                  color: i === currentIdx ? "#000" : "#424242",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: i === currentIdx ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#616161" }}>
            {exercises[currentIdx]?.name}
          </p>
        </div>
      )}
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
        The AI will build you a full weekly plan.
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

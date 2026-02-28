import { useState, useEffect } from "react";
import {
  FiActivity,
  FiRefreshCw,
  FiZap,
  FiArrowUp,
  FiUser,
  FiMoon,
  FiClock,
  FiSun,
  FiWind,
  FiBarChart2,
  FiCalendar,
  FiSettings,
} from "react-icons/fi";
import api from "../api/axios";
import toast from "react-hot-toast";

const FREQ_OPTIONS = [
  { value: 3, label: "3 Days", desc: "Perfect for beginners" },
  { value: 4, label: "4 Days", desc: "Balanced routine" },
  { value: 5, label: "5 Days", desc: "Advanced split" },
  { value: 6, label: "6 Days", desc: "Elite level" },
];

const DAY_COLORS = {
  Monday: "#D4AF37",
  Tuesday: "#A08C29",
  Wednesday: "#D4AF37",
  Thursday: "#A08C29",
  Friday: "#D4AF37",
  Saturday: "#A08C29",
  Sunday: "#616161",
};

const SPLIT_INFO = {
  "Full Body": {
    icon: <FiActivity size={16} color="#D4AF37" />,
    desc: "All muscles each session — ideal for beginners",
  },
  PPL: {
    icon: <FiRefreshCw size={16} color="#D4AF37" />,
    desc: "Push / Pull / Legs 3-day cycle",
  },
  "PPL x2": {
    icon: <FiZap size={16} color="#D4AF37" />,
    desc: "Push / Pull / Legs — 6 days per week",
  },
  "Upper/Lower": {
    icon: <FiArrowUp size={16} color="#D4AF37" />,
    desc: "Alternating upper and lower body days",
  },
  "Bro Split": {
    icon: <FiUser size={16} color="#D4AF37" />,
    desc: "One muscle group per session",
  },
};

export default function WorkoutPlanner() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [freq, setFreq] = useState(4);
  const [selectedDay, setSelectedDay] = useState(null);
  const [week, setWeek] = useState(1);
  const [mlSplit, setMlSplit] = useState(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [newFreq, setNewFreq] = useState(4);

  const fetchMlSplit = async () => {
    try {
      const res = await api.get("/workouts/my-split");
      if (res.data?.split) setMlSplit(res.data);
    } catch {
      /* silently ignore */
    }
  };

  const fetchWorkouts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/workouts/?week=${week}`);
      setWorkouts(res.data);
      if (res.data.length > 0) {
        setHasPlan(true);
        setSelectedDay(res.data.find((w) => !w.is_rest_day) || res.data[0]);
      }
    } catch {
      /* no workouts yet */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkouts();
  }, [week]); // eslint-disable-line

  useEffect(() => {
    fetchMlSplit();
  }, []); // eslint-disable-line

  const generate = async (targetFreq = freq, targetWeek = week) => {
    setGenerating(true);
    try {
      const res = await api.post("/workouts/generate", {
        frequency_per_week: targetFreq,
        week_number: targetWeek,
      });
      setWorkouts(res.data);
      setSelectedDay(res.data.find((w) => !w.is_rest_day) || res.data[0]);
      setHasPlan(true);
      setFreq(targetFreq);
      if (targetWeek === 1) setWeek(1);
      toast.success(
        targetWeek === 1
          ? `New ${targetFreq}-day plan generated!`
          : `Week ${targetWeek} plan ready!`,
      );
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Generate your profile & goal first.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const completeWorkout = async (workoutId) => {
    try {
      await api.post(`/workouts/${workoutId}/complete`);
      toast.success("Workout completed!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error logging session.");
    }
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 32,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>
            Workout <span className="text-gold">Planner</span>
          </h1>
          <p style={{ color: "#9e9e9e", marginTop: 6, fontSize: 14 }}>
            AI-generated weekly training plan tailored to your goal
          </p>
          {mlSplit && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginTop: 10,
                padding: "8px 16px",
                background: "rgba(212,175,55,0.1)",
                border: "1px solid rgba(212,175,55,0.35)",
                borderRadius: 24,
                fontSize: 13,
              }}
            >
              <span style={{ display: "flex", alignItems: "center" }}>
                {SPLIT_INFO[mlSplit.split]?.icon || (
                  <FiBarChart2 size={16} color="#D4AF37" />
                )}
              </span>
              <span style={{ color: "#D4AF37", fontWeight: 700 }}>
                ML Recommended:
              </span>
              <span style={{ color: "#fff" }}>{mlSplit.split}</span>
              <span style={{ color: "#9e9e9e" }}>
                — {SPLIT_INFO[mlSplit.split]?.desc}
              </span>
            </div>
          )}
        </div>

        {!hasPlan && (
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              {FREQ_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFreq(f.value)}
                  className={`btn ${freq === f.value ? "btn-gold" : "btn-ghost"}`}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              className="btn btn-gold"
              onClick={() => generate(freq, 1)}
              disabled={generating}
            >
              {generating ? "Generating..." : "Generate Plan"}
            </button>
          </div>
        )}

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
              className="btn btn-outline"
              onClick={() => {
                setNewFreq(freq);
                setChangePlanOpen(true);
              }}
              style={{
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FiSettings size={14} />
              Change Plan
            </button>
          </div>
        )}
      </div>

      {changePlanOpen && (
        <ChangePlanOverlay
          freq={newFreq}
          setFreq={setNewFreq}
          mlSplit={mlSplit}
          generating={generating}
          onConfirm={() => {
            setChangePlanOpen(false);
            generate(newFreq, 1);
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
          onGenerate={() => generate(freq, 1)}
          generating={generating}
          freq={freq}
          setFreq={setFreq}
        />
      ) : workouts.length === 0 && hasPlan ? (
        <WeekEmptyCard
          week={week}
          generating={generating}
          onGenerate={() => generate(freq, week)}
        />
      ) : (
        <div className="workout-layout">
          {/* Day sidebar */}
          <div
            className="workout-day-sidebar"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {workouts.map((w) => (
              <div
                key={w.id}
                onClick={() => setSelectedDay(w)}
                style={{
                  background:
                    selectedDay?.id === w.id ? "rgba(212,175,55,0.12)" : "#111",
                  border: `2px solid ${selectedDay?.id === w.id ? "#D4AF37" : "#242424"}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: DAY_COLORS[w.day_of_week] || "#D4AF37",
                      }}
                    >
                      {w.day_of_week}
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        color: w.is_rest_day ? "#616161" : "#e0e0e0",
                        marginTop: 2,
                      }}
                    >
                      {w.name}
                    </p>
                  </div>
                  {w.is_rest_day ? (
                    <FiMoon size={18} color="#616161" />
                  ) : (
                    <span style={{ fontSize: 12, color: "#9e9e9e" }}>
                      {w.duration_minutes}m
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Workout detail */}
          {selectedDay && (
            <WorkoutDetail workout={selectedDay} onComplete={completeWorkout} />
          )}
        </div>
      )}
    </div>
  );
}

function WorkoutDetail({ workout, onComplete }) {
  if (workout.is_rest_day) {
    return (
      <div
        className="card"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <FiMoon size={64} color="#616161" />
        <h2 style={{ marginTop: 20, marginBottom: 8 }}>Rest Day</h2>
        <p
          style={{
            color: "#9e9e9e",
            textAlign: "center",
            maxWidth: 300,
            lineHeight: 1.6,
          }}
        >
          Recovery is where muscle is built. Stay hydrated, eat well, and get
          quality sleep tonight.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <span className="badge badge-gold" style={{ marginBottom: 8 }}>
            {workout.day_of_week}
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{workout.name}</h2>
          <p
            style={{
              color: "#9e9e9e",
              fontSize: 13,
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FiClock size={13} color="#9e9e9e" />
            {workout.duration_minutes} min
            <span style={{ margin: "0 4px" }}>|</span>
            <FiActivity size={13} color="#9e9e9e" />
            {workout.difficulty?.charAt(0).toUpperCase() +
              workout.difficulty?.slice(1)}
          </p>
        </div>
        <button
          className="btn btn-gold"
          style={{ padding: "10px 20px", fontSize: 13 }}
          onClick={() => onComplete(workout.id)}
        >
          ✓ Mark Complete
        </button>
      </div>

      {/* Warmup */}
      {workout.warmup?.length > 0 && (
        <Section title="Warmup" icon={<FiSun size={13} />} color="#ff9800">
          {workout.warmup.map((item, i) => (
            <ExerciseRow key={i} name={item.name} detail={item.duration} />
          ))}
        </Section>
      )}

      {/* Main exercises */}
      <Section
        title="Exercises"
        icon={<FiActivity size={13} />}
        color="#D4AF37"
      >
        {workout.exercises?.map((ex, i) => (
          <ExerciseRow
            key={i}
            name={ex.name}
            detail={`${ex.sets} sets × ${ex.reps}`}
            sub={`Rest: ${ex.rest_seconds}s | ${ex.equipment || "bodyweight"}`}
          />
        ))}
      </Section>

      {/* Cooldown */}
      {workout.cooldown?.length > 0 && (
        <Section title="Cooldown" icon={<FiWind size={13} />} color="#4caf50">
          {workout.cooldown.map((item, i) => (
            <ExerciseRow key={i} name={item.name} detail={item.duration} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon, color, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h4
        style={{
          fontSize: 13,
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        {title}
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function ExerciseRow({ name, detail, sub }) {
  return (
    <div
      style={{
        background: "#1a1a1a",
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>
          {name}
        </p>
        {sub && (
          <p style={{ fontSize: 12, color: "#616161", marginTop: 2 }}>{sub}</p>
        )}
      </div>
      <span style={{ fontSize: 13, color: "#D4AF37", fontWeight: 600 }}>
        {detail}
      </span>
    </div>
  );
}

function EmptyState({ onGenerate, generating, freq, setFreq }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 60 }}>
      <div style={{ marginBottom: 20 }}>
        <FiActivity size={64} color="#9e9e9e" />
      </div>
      <h2 style={{ fontSize: 24, marginBottom: 12 }}>No Workout Plan Yet</h2>
      <p
        style={{
          color: "#9e9e9e",
          marginBottom: 32,
          maxWidth: 400,
          margin: "0 auto 32px",
          lineHeight: 1.6,
        }}
      >
        Choose how many days per week you want to train, then let AI generate
        your personalized plan.
      </p>
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        {[3, 4, 5, 6].map((f) => (
          <button
            key={f}
            onClick={() => setFreq(f)}
            className={`btn ${freq === f ? "btn-gold" : "btn-ghost"}`}
            style={{ minWidth: 80 }}
          >
            {f} Days
          </button>
        ))}
      </div>
      <button
        className="btn btn-gold"
        onClick={onGenerate}
        disabled={generating}
        style={{ minWidth: 200 }}
      >
        {generating ? "Generating..." : "Generate AI Plan"}
      </button>
    </div>
  );
}

function WeekEmptyCard({ week, generating, onGenerate }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 60 }}>
      <div style={{ marginBottom: 20 }}>
        <FiCalendar size={64} color="#9e9e9e" />
      </div>
      <h2 style={{ fontSize: 24, marginBottom: 12 }}>
        No Plan for <span className="text-gold">Week {week}</span>
      </h2>
      <p
        style={{
          color: "#9e9e9e",
          marginBottom: 32,
          maxWidth: 360,
          margin: "0 auto 32px",
          lineHeight: 1.6,
        }}
      >
        Generate this week's workouts based on your current training frequency
        and ML-recommended split.
      </p>
      <button
        className="btn btn-gold"
        onClick={onGenerate}
        disabled={generating}
        style={{ minWidth: 220 }}
      >
        {generating ? "Generating..." : `Generate Week ${week} Plan`}
      </button>
    </div>
  );
}

function ChangePlanOverlay({
  freq,
  setFreq,
  mlSplit,
  generating,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 500, padding: "36px 32px" }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          Change Workout Plan
        </h2>
        <p
          style={{
            color: "#9e9e9e",
            marginBottom: 24,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          Pick a new training frequency. A fresh AI plan will be generated for
          Week 1 using the ML model — your old plan will be replaced.
        </p>

        {mlSplit && (
          <div
            style={{
              padding: "10px 16px",
              background: "rgba(212,175,55,0.08)",
              border: "1px solid rgba(212,175,55,0.3)",
              borderRadius: 10,
              marginBottom: 24,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ color: "#D4AF37", fontWeight: 700 }}>
              ML Recommended:
            </span>
            <span style={{ color: "#fff" }}>{mlSplit.split}</span>
            <span style={{ color: "#9e9e9e" }}>
              — {SPLIT_INFO[mlSplit.split]?.desc}
            </span>
          </div>
        )}

        <p
          style={{
            fontSize: 12,
            color: "#9e9e9e",
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
          }}
        >
          Days per week
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
          {FREQ_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFreq(f.value)}
              className={`btn ${freq === f.value ? "btn-gold" : "btn-ghost"}`}
              style={{ flex: 1, flexDirection: "column", padding: "12px 8px" }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{f.label}</div>
              <div
                style={{
                  fontSize: 11,
                  color:
                    freq === f.value ? "rgba(255,255,255,0.75)" : "#616161",
                  marginTop: 3,
                }}
              >
                {f.desc}
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            className="btn btn-gold"
            onClick={onConfirm}
            disabled={generating}
            style={{ flex: 2 }}
          >
            {generating ? "Generating..." : `Generate ${freq}-Day Plan`}
          </button>
        </div>
      </div>
    </div>
  );
}

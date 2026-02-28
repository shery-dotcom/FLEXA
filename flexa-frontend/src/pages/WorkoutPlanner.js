import { useState, useEffect, useRef, useCallback } from "react";
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
  FiCheckCircle,
  FiCircle,
  FiPlay,
  FiSquare,
  FiAlertTriangle,
} from "react-icons/fi";
import api from "../api/axios";
import toast from "react-hot-toast";

/* ── localStorage helpers ── */
function todayKey(suffix) {
  return `flexa_${suffix}_${new Date().toISOString().slice(0, 10)}`;
}
function getTimerCount() {
  return parseInt(localStorage.getItem(todayKey("timers")) || "0", 10);
}
function incTimerCount() {
  const n = getTimerCount() + 1;
  localStorage.setItem(todayKey("timers"), String(n));
  return n;
}
function getCompletions() {
  return JSON.parse(localStorage.getItem(todayKey("completions")) || "[]");
}
function addCompletion(workoutId) {
  const c = getCompletions();
  c.push({ id: String(workoutId), ts: Date.now() });
  localStorage.setItem(todayKey("completions"), JSON.stringify(c));
  return c;
}

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
  const [timerRunsToday, setTimerRunsToday] = useState(getTimerCount);

  const onTimerFinished = useCallback(() => {
    const n = incTimerCount();
    setTimerRunsToday(n);
  }, []);

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
      const completions = addCompletion(workoutId);
      const todaySame = completions.filter((c) => c.id === String(workoutId));
      if (todaySame.length >= 2) {
        const gap = Date.now() - todaySame[todaySame.length - 2].ts;
        if (gap < 20 * 60 * 1000) {
          toast(
            () => (
              <div
                style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
              >
                <FiAlertTriangle
                  size={20}
                  color="#ff9800"
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      color: "#ff9800",
                      marginBottom: 4,
                    }}
                  >
                    You're going too fast!
                  </p>
                  <p style={{ fontSize: 13, color: "#ccc" }}>
                    You've completed this workout twice today in under 20
                    minutes. Slow down, rest properly — recovery is part of
                    training.
                  </p>
                </div>
              </div>
            ),
            {
              duration: 6000,
              style: {
                background: "#1a1a1a",
                border: "1px solid #ff9800",
              },
            },
          );
          return;
        }
      }
      toast.success("Workout marked complete!");
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
          {timerRunsToday > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                padding: "5px 12px",
                background: "rgba(76,175,80,0.1)",
                border: "1px solid rgba(76,175,80,0.3)",
                borderRadius: 20,
                fontSize: 12,
                color: "#4caf50",
              }}
            >
              <FiClock size={12} />
              {timerRunsToday} rest timer{timerRunsToday !== 1 ? "s" : ""} used
              today
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
            <WorkoutDetail
              workout={selectedDay}
              onComplete={completeWorkout}
              onTimerFinished={onTimerFinished}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── WorkoutDetail ─────────────────────────────────────────────── */
function WorkoutDetail({ workout, onComplete, onTimerFinished }) {
  const totalExercises = workout.exercises?.length || 0;

  // Experience-based mandatory rest config
  const XP_CONFIG = {
    beginner: { threshold: 3, restSec: 120 },
    intermediate: { threshold: 5, restSec: 90 },
    advanced: { threshold: 7, restSec: 60 },
  };
  const xp =
    XP_CONFIG[(workout.difficulty || "intermediate").toLowerCase()] ||
    XP_CONFIG.intermediate;

  // Per-exercise rest timer
  const [doneSet, setDoneSet] = useState(new Set());
  const [activeTimer, setActiveTimer] = useState(null);
  const [timerSec, setTimerSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMaxSec, setTimerMaxSec] = useState(90);
  const intervalRef = useRef(null);

  // Mandatory rest state
  const consecSetsRef = useRef(0);
  const [consecSets, setConsecSets] = useState(0);
  const [showMandatoryRest, setShowMandatoryRest] = useState(false);
  const [mandatoryRestSec, setMandatoryRestSec] = useState(xp.restSec);
  const [mandatoryRestMax, setMandatoryRestMax] = useState(xp.restSec);
  const mandatoryIntervalRef = useRef(null);

  useEffect(() => {
    setDoneSet(new Set());
    clearInterval(intervalRef.current);
    clearInterval(mandatoryIntervalRef.current);
    setActiveTimer(null);
    setTimerRunning(false);
    setTimerSec(0);
    consecSetsRef.current = 0;
    setConsecSets(0);
    setShowMandatoryRest(false);
  }, [workout.id]);

  const startTimer = (exIndex, restSec) => {
    clearInterval(intervalRef.current);
    setActiveTimer(exIndex);
    setTimerMaxSec(restSec);
    setTimerSec(restSec);
    setTimerRunning(true);
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    setTimerRunning(false);
    setActiveTimer(null);
    setTimerSec(0);
  };

  // Trigger mandatory rest overlay
  const triggerMandatoryRest = useCallback(() => {
    clearInterval(intervalRef.current);
    setTimerRunning(false);
    setActiveTimer(null);
    setTimerSec(0);
    setMandatoryRestSec(xp.restSec);
    setMandatoryRestMax(xp.restSec);
    setShowMandatoryRest(true);
  }, [xp.restSec]);

  // Mandatory rest countdown
  useEffect(() => {
    if (!showMandatoryRest) return;
    clearInterval(mandatoryIntervalRef.current);
    mandatoryIntervalRef.current = setInterval(() => {
      setMandatoryRestSec((s) => {
        if (s <= 1) {
          clearInterval(mandatoryIntervalRef.current);
          setShowMandatoryRest(false);
          consecSetsRef.current = 0;
          setConsecSets(0);
          toast("Ready! Continue your workout.", {
            duration: 3000,
            style: {
              background: "#1a1a1a",
              border: "1px solid #D4AF37",
              color: "#D4AF37",
              fontWeight: 700,
            },
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(mandatoryIntervalRef.current);
  }, [showMandatoryRest]); // eslint-disable-line

  const reduceMandatoryRest = () => {
    setMandatoryRestSec((s) => Math.max(30, s - 10));
  };

  useEffect(() => {
    if (!timerRunning) return;
    intervalRef.current = setInterval(() => {
      setTimerSec((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          setTimerRunning(false);
          setActiveTimer(null);
          // Proper rest taken — reset consecutive counter
          consecSetsRef.current = 0;
          setConsecSets(0);
          onTimerFinished();
          toast("⏱ Rest complete! Start your next set.", {
            duration: 4000,
            style: {
              background: "#1a1a1a",
              border: "1px solid #4caf50",
              color: "#4caf50",
              fontWeight: 700,
            },
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [timerRunning]); // eslint-disable-line

  const toggleDone = (idx) => {
    const isAdding = !doneSet.has(idx);
    setDoneSet((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
    if (isAdding) {
      const newConsec = consecSetsRef.current + 1;
      consecSetsRef.current = newConsec;
      setConsecSets(newConsec);
      if (newConsec >= xp.threshold) {
        triggerMandatoryRest();
        consecSetsRef.current = 0;
        setConsecSets(0);
      }
    }
  };

  const doneCount = doneSet.size;
  const allDone = totalExercises > 0 && doneCount === totalExercises;

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
      {/* Mandatory rest overlay */}
      {showMandatoryRest && (
        <MandatoryRestScreen
          restSec={mandatoryRestSec}
          restMax={mandatoryRestMax}
          difficulty={(workout.difficulty || "intermediate").toLowerCase()}
          onReduce={reduceMandatoryRest}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
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
          className={`btn ${allDone ? "btn-gold" : "btn-outline"}`}
          style={{ padding: "10px 20px", fontSize: 13 }}
          onClick={() => onComplete(workout.id)}
        >
          ✓ Mark Workout Complete
        </button>
      </div>

      {/* Exercise progress bar */}
      {totalExercises > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 12, color: "#9e9e9e" }}>
              Exercise Progress
            </span>
            <span
              style={{
                fontSize: 12,
                color: allDone ? "#4caf50" : "#D4AF37",
                fontWeight: 700,
              }}
            >
              {doneCount}/{totalExercises} done{allDone && " ✓"}
            </span>
          </div>
          <div
            style={{
              background: "#242424",
              borderRadius: 6,
              height: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(doneCount / totalExercises) * 100}%`,
                height: "100%",
                background: allDone ? "#4caf50" : "#D4AF37",
                borderRadius: 6,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Consecutive sets progress */}
      {consecSets > 0 && !showMandatoryRest && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 14px",
            background: "rgba(212,175,55,0.06)",
            border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          <FiBarChart2 size={13} color="#D4AF37" />
          <span style={{ color: "#9e9e9e" }}>Sets since last rest:</span>
          <div
            style={{
              flex: 1,
              background: "#242424",
              borderRadius: 4,
              height: 5,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min((consecSets / xp.threshold) * 100, 100)}%`,
                height: "100%",
                background:
                  consecSets >= xp.threshold - 1 ? "#ff9800" : "#D4AF37",
                borderRadius: 4,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span
            style={{
              color: consecSets >= xp.threshold - 1 ? "#ff9800" : "#D4AF37",
              fontWeight: 700,
              minWidth: 36,
              textAlign: "right",
            }}
          >
            {consecSets}/{xp.threshold}
          </span>
        </div>
      )}

      {/* Active rest timer banner */}
      {timerRunning && activeTimer !== null && (
        <div
          style={{
            background: "rgba(212,175,55,0.08)",
            border: "1px solid rgba(212,175,55,0.4)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <FiClock size={18} color="#D4AF37" />
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <span style={{ fontSize: 13, color: "#D4AF37", fontWeight: 700 }}>
                Rest Timer
              </span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: timerSec <= 10 ? "#ff5252" : "#D4AF37",
                  fontFamily: "monospace",
                }}
              >
                {Math.floor(timerSec / 60)}:
                {String(timerSec % 60).padStart(2, "0")}
              </span>
            </div>
            <div style={{ background: "#242424", borderRadius: 4, height: 5 }}>
              <div
                style={{
                  width: `${(timerSec / timerMaxSec) * 100}%`,
                  height: "100%",
                  background: timerSec <= 10 ? "#ff5252" : "#D4AF37",
                  borderRadius: 4,
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>
          <button
            onClick={stopTimer}
            style={{
              background: "none",
              border: "1px solid #424242",
              borderRadius: 6,
              padding: "4px 8px",
              cursor: "pointer",
              color: "#9e9e9e",
              lineHeight: 0,
            }}
          >
            <FiSquare size={14} />
          </button>
        </div>
      )}

      {/* Warmup */}
      {workout.warmup?.length > 0 && (
        <Section title="Warmup" icon={<FiSun size={13} />} color="#ff9800">
          {workout.warmup.map((item, i) => (
            <SimpleRow key={i} name={item.name} detail={item.duration} />
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
            index={i}
            ex={ex}
            done={doneSet.has(i)}
            isTimerActive={activeTimer === i && timerRunning}
            onToggle={() => toggleDone(i)}
            onStartTimer={() => startTimer(i, ex.rest_seconds || 60)}
            onStopTimer={stopTimer}
          />
        ))}
      </Section>

      {/* Cooldown */}
      {workout.cooldown?.length > 0 && (
        <Section title="Cooldown" icon={<FiWind size={13} />} color="#4caf50">
          {workout.cooldown.map((item, i) => (
            <SimpleRow key={i} name={item.name} detail={item.duration} />
          ))}
        </Section>
      )}
    </div>
  );
}

/* ─── InteractiveExerciseRow ────────────────────────────────────── */
function ExerciseRow({
  ex,
  done,
  isTimerActive,
  onToggle,
  onStartTimer,
  onStopTimer,
}) {
  return (
    <div
      style={{
        background: done ? "rgba(76,175,80,0.07)" : "#1a1a1a",
        borderRadius: 8,
        padding: "12px 14px",
        border: `1px solid ${done ? "rgba(76,175,80,0.35)" : "transparent"}`,
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Completion tick */}
        <button
          onClick={onToggle}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
            lineHeight: 0,
          }}
          title={done ? "Mark incomplete" : "Mark complete"}
        >
          {done ? (
            <FiCheckCircle size={20} color="#4caf50" />
          ) : (
            <FiCircle size={20} color="#424242" />
          )}
        </button>

        {/* Name + sub */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: done ? "#9e9e9e" : "#e0e0e0",
              textDecoration: done ? "line-through" : "none",
            }}
          >
            {ex.name}
          </p>
          <p style={{ fontSize: 12, color: "#616161", marginTop: 2 }}>
            Rest: {ex.rest_seconds}s | {ex.equipment || "bodyweight"}
          </p>
        </div>

        {/* Sets × reps */}
        <span
          style={{
            fontSize: 13,
            color: done ? "#4caf50" : "#D4AF37",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {ex.sets} × {ex.reps}
        </span>

        {/* Rest timer button */}
        {!done && (
          <button
            onClick={isTimerActive ? onStopTimer : onStartTimer}
            style={{
              background: isTimerActive
                ? "rgba(255,82,82,0.1)"
                : "rgba(212,175,55,0.1)",
              border: `1px solid ${isTimerActive ? "#ff5252" : "rgba(212,175,55,0.4)"}`,
              borderRadius: 6,
              padding: "5px 10px",
              cursor: "pointer",
              color: isTimerActive ? "#ff5252" : "#D4AF37",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
            title={
              isTimerActive
                ? "Stop rest timer"
                : `Start ${ex.rest_seconds}s rest timer`
            }
          >
            {isTimerActive ? <FiSquare size={11} /> : <FiPlay size={11} />}
            {isTimerActive ? "Stop" : "Rest"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Section wrapper ───────────────────────────────────────────── */
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

/* ─── SimpleRow (warmup / cooldown) ────────────────────────────── */
function SimpleRow({ name, detail }) {
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
      <p style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>{name}</p>
      <span style={{ fontSize: 13, color: "#D4AF37", fontWeight: 600 }}>
        {detail}
      </span>
    </div>
  );
}

/* ─── MandatoryRestScreen overlay ──────────────────────────────── */
function MandatoryRestScreen({ restSec, restMax, difficulty, onReduce }) {
  const fmtTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const pct = restMax > 0 ? (restSec / restMax) * 100 : 0;
  const atMin = restSec <= 30;

  const CONFIG = {
    beginner: {
      label: "Beginner",
      color: "#4caf50",
      msg: "You've been pushing hard! Beginners fatigue faster — this rest is essential for muscle recovery and injury prevention.",
    },
    intermediate: {
      label: "Intermediate",
      color: "#D4AF37",
      msg: "Good work! Time for a mandatory rest before continuing. Consistent rest keeps your performance high across all sets.",
    },
    advanced: {
      label: "Advanced",
      color: "#ff9800",
      msg: "High-volume checkpoint. Brief mandatory rest — even advanced athletes need recovery between intense efforts.",
    },
  };
  const cfg = CONFIG[difficulty] || CONFIG.intermediate;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.93)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#111",
          border: `1px solid ${cfg.color}55`,
          borderRadius: 20,
          padding: "44px 40px",
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <FiClock size={52} color={cfg.color} style={{ marginBottom: 16 }} />

        {/* Title */}
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
          Mandatory Rest Break
        </h2>

        {/* Level badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 14px",
            background: `${cfg.color}18`,
            border: `1px solid ${cfg.color}44`,
            borderRadius: 20,
            fontSize: 12,
            color: cfg.color,
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          {cfg.label} Level
        </div>

        {/* Message */}
        <p
          style={{
            color: "#9e9e9e",
            fontSize: 13,
            lineHeight: 1.65,
            marginBottom: 30,
          }}
        >
          {cfg.msg}
        </p>

        {/* Countdown */}
        <div
          style={{
            fontSize: 60,
            fontWeight: 900,
            fontFamily: "monospace",
            color: atMin ? "#ff9800" : cfg.color,
            marginBottom: 18,
            letterSpacing: 2,
          }}
        >
          {fmtTime(restSec)}
        </div>

        {/* Depleting progress bar */}
        <div
          style={{
            background: "#242424",
            borderRadius: 8,
            height: 10,
            overflow: "hidden",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: atMin ? "#ff9800" : cfg.color,
              borderRadius: 8,
              transition: "width 1s linear",
            }}
          />
        </div>

        {/* -10s button */}
        <button
          onClick={onReduce}
          disabled={atMin}
          style={{
            padding: "11px 28px",
            background: atMin ? "rgba(66,66,66,0.2)" : `${cfg.color}18`,
            border: `1px solid ${atMin ? "#424242" : cfg.color + "55"}`,
            borderRadius: 10,
            cursor: atMin ? "not-allowed" : "pointer",
            color: atMin ? "#424242" : cfg.color,
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 10,
            display: "inline-block",
          }}
        >
          − 10 seconds
        </button>

        <p style={{ fontSize: 11, color: "#424242", marginTop: 6 }}>
          Minimum rest: 30s &nbsp;·&nbsp; Timer auto-dismisses when done
        </p>
      </div>
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

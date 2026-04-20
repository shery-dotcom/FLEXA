import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import FlexaGuide from "../components/FlexaGuide";
import FlexaAppTour from "../components/FlexaAppTour";

/* --- Calorie formula helpers (Mifflin-St Jeor) ------------------ */
const ACTIVITY_MULT = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function computeCalories(profile, goalType, activityLevel) {
  if (!profile?.weight_kg || !profile?.height_cm || !profile?.age)
    return [null, null];
  const { weight_kg: w, height_cm: h, age: a, gender } = profile;
  const bmr =
    (gender || "male").toLowerCase() === "female"
      ? 10 * w + 6.25 * h - 5 * a - 161
      : 10 * w + 6.25 * h - 5 * a + 5;
  const mult =
    ACTIVITY_MULT[
      (activityLevel || "moderate").toLowerCase().replace(/ /g, "_")
    ] ?? 1.55;
  const tdee = Math.round(bmr * mult);
  const adj =
    { cutting: -500, bulking: 400, recomp: -250, maintaining: 0 }[
      (goalType || "maintaining").toLowerCase()
    ] ?? 0;
  return [tdee, Math.max(1200, tdee + adj)];
}

const SPLIT_DESC = {
  "Full Body": "All muscles each session",
  PPL: "Push / Pull / Legs",
  "PPL x2": "Push / Pull / Legs � 6 days",
  "Upper/Lower": "Alternating upper & lower body",
  "Bro Split": "One muscle group per session",
};

/* --- Daily inspiration quotes ----------------------------------- */
const QUOTES = [
  {
    text: "Discipline is choosing between what you want now and what you want most.",
    author: "Abraham Lincoln",
  },
  {
    text: "The only bad workout is the one that didn't happen.",
    author: "Unknown",
  },
  {
    text: "Take care of your body. It's the only place you have to live.",
    author: "Jim Rohn",
  },
  {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
  },
  {
    text: "If it doesn't challenge you, it won't change you.",
    author: "Fred DeVito",
  },
  {
    text: "Your body can stand almost anything. It's your mind that you have to convince.",
    author: "Unknown",
  },
  {
    text: "Strength does not come from physical capacity. It comes from an indomitable will.",
    author: "Mahatma Gandhi",
  },
  {
    text: "Push yourself because no one else is going to do it for you.",
    author: "Unknown",
  },
  {
    text: "The groundwork for all happiness is good health.",
    author: "Leigh Hunt",
  },
  {
    text: "Success is walking from failure to failure with no loss of enthusiasm.",
    author: "Winston Churchill",
  },
  {
    text: "What hurts today makes you stronger tomorrow.",
    author: "Jay Cutler",
  },
  {
    text: "A champion is someone who gets up when they can't.",
    author: "Jack Dempsey",
  },
  {
    text: "Energy and persistence conquer all things.",
    author: "Benjamin Franklin",
  },
  {
    text: "You don't have to be great to start, but you have to start to be great.",
    author: "Zig Ziglar",
  },
  {
    text: "The pain you feel today will be the strength you feel tomorrow.",
    author: "Arnold Schwarzenegger",
  },
  {
    text: "Don't count the days, make the days count.",
    author: "Muhammad Ali",
  },
  { text: "An hour of training beats a year of regret.", author: "Unknown" },
  { text: "Your only limit is you.", author: "Unknown" },
  { text: "Be stronger than your strongest excuse.", author: "Unknown" },
  { text: "It never gets easier, you just get better.", author: "Unknown" },
  {
    text: "Wake up with determination. Go to bed with satisfaction.",
    author: "Unknown",
  },
  { text: "Train insane or remain the same.", author: "Unknown" },
  {
    text: "The harder the battle, the sweeter the victory.",
    author: "Les Brown",
  },
  { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  {
    text: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt",
  },
  {
    text: "Every champion was once a contender who refused to give up.",
    author: "Unknown",
  },
  {
    text: "The body achieves what the mind believes.",
    author: "Napoleon Hill",
  },
  { text: "Strive for progress, not perfection.", author: "Unknown" },
  {
    text: "Do something today that your future self will thank you for.",
    author: "Sean Patrick Flanery",
  },
  {
    text: "Fitness is not a destination. It is a way of life.",
    author: "Unknown",
  },
  {
    text: "Motivation gets you started. Habit keeps you going.",
    author: "Jim Ryun",
  },
  {
    text: "All progress takes place outside the comfort zone.",
    author: "Michael John Bobak",
  },
];

function getDayQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good Night";
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  if (h < 21) return "Good Evening";
  return "Good Night";
}

function getDayLabel() {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][new Date().getDay()];
}

function fmtGoal(g) {
  if (!g) return "\u2014";
  return g.charAt(0).toUpperCase() + g.slice(1);
}

function fmtActivity(a) {
  if (!a) return "\u2014";
  return a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function bmiColor(cat) {
  if (!cat) return "#9e9e9e";
  const c = cat.toLowerCase();
  if (c.includes("underweight")) return "#64b5f6";
  if (c.includes("normal") || c.includes("healthy")) return "#4caf50";
  if (c.includes("overweight")) return "#ff9800";
  return "#ef5350";
}

/* ---------------------------------------------------------------
   MAIN COMPONENT
--------------------------------------------------------------- */
const TODAY_NAME = new Date().toLocaleDateString("en-US", { weekday: "long" });

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [weekWorkouts, setWeekWorkouts] = useState([]);
  const [mlSplit, setMlSplit] = useState(null);
  const requestSeqRef = useRef(0);
  const hasLoadedDashboardRef = useRef(false);
  const navigate = useNavigate();
  const quote = getDayQuote();

  useEffect(() => {
    let isActive = true;
    const currentRequest = ++requestSeqRef.current;

    (async () => {
      try {
        const [dashRes, workoutRes, splitRes] = await Promise.all([
          api.get("/dashboard/"),
          api
            .get("/workouts/", { params: { week: 1 } })
            .catch(() => ({ data: [] })),
          api.get("/workouts/my-split").catch(() => ({ data: null })),
        ]);

        if (!isActive || currentRequest !== requestSeqRef.current) return;

        setData(dashRes.data);
        hasLoadedDashboardRef.current = Boolean(dashRes.data);
        setLoading(false);

        if (splitRes.data?.split) {
          setMlSplit(splitRes.data);
        }

        const allWorkouts = workoutRes.data || [];
        setWeekWorkouts(allWorkouts);
        setTodayWorkout(
          allWorkouts.find(
            (w) => w.day_of_week?.toLowerCase() === TODAY_NAME.toLowerCase(),
          ) || null,
        );
      } catch (err) {
        if (!isActive || currentRequest !== requestSeqRef.current) return;

        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
          return;
        }

        const status = err?.response?.status;
        if (status === 400 || status === 404) {
          setData(null);
        } else if (!hasLoadedDashboardRef.current) {
          toast.error("Could not load dashboard. Please refresh.");
        }
        setLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  if (loading)
    return (
      <div className="loading-center">
        <div className="spinner" />
      </div>
    );

  const safeData = data || {
    user_name:
      user?.profile?.username || user?.email?.split("@")[0] || "Athlete",
    bmi: user?.profile?.bmi ?? null,
    bmi_category: user?.profile?.bmi_category ?? null,
    current_goal: "maintaining",
    activity_level: "moderate",
    daily_calories: null,
    target_calories: null,
    has_workout_plan: false,
    motivation_message: "Complete your setup to unlock personalized insights.",
    motivation_score: 0,
    today_tasks: [],
    milestones: [],
    weekly_sessions: 0,
    total_workouts_completed: 0,
  };

  /* -- Calorie computation (backend value or client fallback) --- */
  const profile = user?.profile;
  const goalType = safeData.current_goal || "maintaining";
  const actLevel = safeData.activity_level || "moderate";
  const [fallbackDaily, fallbackTarget] = computeCalories(
    profile,
    goalType,
    actLevel,
  );
  const dailyCalories = safeData.daily_calories ?? fallbackDaily;
  const targetCalories = safeData.target_calories ?? fallbackTarget;

  /* -- Plan metadata derived from fetched workouts -------------- */
  const planFreq = weekWorkouts.filter((w) => !w.is_rest_day).length || 0;
  const planDifficulty =
    weekWorkouts.find((w) => !w.is_rest_day)?.difficulty || null;
  const FULL_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "20px 24px 48px",
      }}
    >
      <FlexaAppTour onDone={() => {}} />
      <FlexaGuide pageKey="dashboard" />
      {/* -- Welcome Banner ------------------------------------------- */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 0,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(212,175,55,0.25)",
          background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
          minHeight: 90,
        }}
      >
        {/* FLEXA logo block */}
        <div
          style={{
            background: "linear-gradient(160deg, #D4AF37 0%, #8c7520 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 22px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 28,
              fontWeight: 900,
              color: "#0a0a0a",
              letterSpacing: 3,
            }}
          >
            FLEXA
          </span>
        </div>

        {/* Greeting */}
        <div
          style={{
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontSize: 19,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.2,
              marginBottom: 5,
            }}
          >
            {getGreeting()}, {safeData.user_name}!
          </p>
          <p style={{ fontSize: 12, color: "#9e9e9e" }}>
            {getDayLabel()} &middot; Ready to crush your goals?
          </p>
        </div>
      </div>

      {/* -- Two-column desktop layout -------------------------------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 420px",
          gap: 20,
          marginTop: 16,
          alignItems: "start",
        }}
      >
        {/* -- LEFT COLUMN --------------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* -- Daily Motivation ----------------------------------------- */}
          <div
            style={{
              background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
              border: "1px solid rgba(212,175,55,0.2)",
              borderRadius: 14,
              padding: "22px 22px 20px",
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#D4AF37",
                letterSpacing: "2px",
                textTransform: "uppercase",
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              &#10022; Daily Motivation &#10022;
            </p>
            <p
              style={{
                fontSize: 15,
                fontStyle: "italic",
                color: "#f0f0f0",
                lineHeight: 1.65,
                textAlign: "center",
                marginBottom: 14,
                fontWeight: 500,
              }}
            >
              &ldquo;{quote.text}&rdquo;
            </p>
            <p
              style={{
                textAlign: "center",
                color: "#D4AF37",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              &mdash; {quote.author}
            </p>
          </div>

          {/* -- 2�2 Stats Grid ------------------------------------------- */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <StatCard
              label="Current Goal"
              value={fmtGoal(safeData.current_goal)}
              sub={
                safeData.current_goal === "cutting"
                  ? "Calorie Deficit"
                  : safeData.current_goal === "bulking"
                    ? "Calorie Surplus"
                    : safeData.current_goal === "recomp"
                      ? "Body Recomp"
                      : "Maintenance"
              }
            />
            <StatCard
              label="BMI"
              value={safeData.bmi ? safeData.bmi.toFixed(2) : "\u2014"}
              sub={safeData.bmi_category || "Not measured"}
              subColor={bmiColor(safeData.bmi_category)}
            />
            <StatCard
              label="Daily Calories"
              value={dailyCalories ? dailyCalories.toLocaleString() : "\u2014"}
              sub={
                dailyCalories
                  ? `TDEE \u00b7 ${fmtActivity(actLevel)}`
                  : "Complete your profile"
              }
            />
            <StatCard
              label="Target Calories"
              value={
                targetCalories ? targetCalories.toLocaleString() : "\u2014"
              }
              sub={
                targetCalories && dailyCalories
                  ? targetCalories > dailyCalories
                    ? `+${(targetCalories - dailyCalories).toLocaleString()} surplus`
                    : targetCalories < dailyCalories
                      ? `\u2212${(dailyCalories - targetCalories).toLocaleString()} deficit`
                      : "Maintenance"
                  : "Set a fitness goal"
              }
              subColor={
                targetCalories && dailyCalories
                  ? targetCalories > dailyCalories
                    ? "#4caf50"
                    : targetCalories < dailyCalories
                      ? "#ef5350"
                      : "#D4AF37"
                  : "#9e9e9e"
              }
            />
          </div>
        </div>
        {/* end LEFT COLUMN */}

        {/* --- RIGHT COLUMN ----------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* -- Workout Plan Block ----------------------------------------- */}
          {!safeData.has_workout_plan && weekWorkouts.length === 0 ? (
            /* No plan � show CTA */
            <div
              style={{
                background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: 14,
                padding: "32px 22px 28px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 42, marginBottom: 14, lineHeight: 1 }}>
                &#127947;
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                No Workout Plan Yet
              </h3>
              <p
                style={{
                  color: "#9e9e9e",
                  fontSize: 13,
                  marginBottom: 24,
                  lineHeight: 1.6,
                }}
              >
                Create a personalized workout plan to get started
              </p>
              <button
                className="btn btn-gold"
                style={{
                  width: "100%",
                  padding: "14px 0",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "1px",
                  borderRadius: 10,
                }}
                onClick={() => navigate("/workouts")}
              >
                CREATE WORKOUT PLAN
              </button>
            </div>
          ) : (
            /* Plan exists � show plan details + today's workout */
            <div
              style={{
                background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: 14,
                padding: "20px 22px",
              }}
            >
              {/* Plan header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#D4AF37",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      marginBottom: 2,
                    }}
                  >
                    Your Workout Plan
                  </p>
                  {planFreq > 0 && (
                    <p style={{ fontSize: 12, color: "#9e9e9e" }}>
                      {planFreq} day{planFreq !== 1 ? "s" : ""}/week
                      {planDifficulty
                        ? ` � ${planDifficulty.charAt(0).toUpperCase() + planDifficulty.slice(1)}`
                        : ""}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "#9e9e9e", paddingTop: 2 }}>
                  {safeData.weekly_sessions} session
                  {safeData.weekly_sessions !== 1 ? "s" : ""} done
                </span>
              </div>

              {/* ML split badge */}
              {mlSplit?.split && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(212,175,55,0.07)",
                    border: "1px solid rgba(212,175,55,0.25)",
                    borderRadius: 8,
                    padding: "7px 12px",
                    marginBottom: 14,
                  }}
                >
                  <span
                    style={{ fontSize: 11, color: "#D4AF37", fontWeight: 700 }}
                  >
                    YOUR PLAN
                  </span>
                  <span
                    style={{
                      width: 1,
                      height: 12,
                      background: "rgba(212,175,55,0.3)",
                    }}
                  />
                  <span
                    style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}
                  >
                    {mlSplit.split}
                  </span>
                  <span style={{ fontSize: 12, color: "#9e9e9e", flex: 1 }}>
                    &mdash; {SPLIT_DESC[mlSplit.split] || "Personalized plan"}
                  </span>
                </div>
              )}

              {/* Day dots � Mon-Sun with workout/rest differentiation */}
              <div
                style={{
                  display: "flex",
                  gap: 5,
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
                  const todayIdx = (new Date().getDay() + 6) % 7;
                  const isToday = i === todayIdx;
                  const dayWorkout = weekWorkouts.find(
                    (w) => w.day_of_week === FULL_DAYS[i],
                  );
                  const isWorkoutDay = dayWorkout && !dayWorkout.is_rest_day;
                  const done =
                    isWorkoutDay &&
                    i < todayIdx &&
                    i < safeData.weekly_sessions;
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          borderRadius: 6,
                          background: isToday
                            ? "rgba(212,175,55,0.25)"
                            : done
                              ? "rgba(76,175,80,0.25)"
                              : isWorkoutDay
                                ? "rgba(212,175,55,0.07)"
                                : "#1a1a1a",
                          border: `1.5px solid ${
                            isToday
                              ? "#D4AF37"
                              : done
                                ? "#4caf50"
                                : isWorkoutDay
                                  ? "rgba(212,175,55,0.3)"
                                  : "#2a2a2a"
                          }`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isToday && (
                          <span
                            style={{
                              color: "#D4AF37",
                              fontWeight: 900,
                              fontSize: 12,
                            }}
                          >
                            &bull;
                          </span>
                        )}
                        {!isToday && done && (
                          <span style={{ color: "#4caf50", fontSize: 10 }}>
                            &#10003;
                          </span>
                        )}
                        {!isToday && !done && isWorkoutDay && (
                          <span
                            style={{
                              color: "rgba(212,175,55,0.4)",
                              fontSize: 9,
                            }}
                          >
                            &#9679;
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          color: isToday
                            ? "#D4AF37"
                            : isWorkoutDay
                              ? "#757575"
                              : "#333",
                          fontWeight: isToday ? 700 : 400,
                        }}
                      >
                        {d}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Today's workout preview */}
              {todayWorkout ? (
                todayWorkout.is_rest_day ? (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 10,
                      padding: "18px 16px",
                      textAlign: "center",
                      marginBottom: 14,
                      border: "1px solid #1e1a12",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>
                      &#128564;
                    </div>
                    <p
                      style={{
                        color: "#D4AF37",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      Rest Day
                    </p>
                    <p style={{ color: "#616161", fontSize: 12, marginTop: 4 }}>
                      Recovery is part of the plan. Rest up!
                    </p>
                  </div>
                ) : (
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <p
                        style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}
                      >
                        Today � {todayWorkout.name}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        {todayWorkout.duration_minutes ? (
                          <span
                            style={{
                              fontSize: 11,
                              color: "#9e9e9e",
                              background: "#1a1a1a",
                              borderRadius: 6,
                              padding: "3px 8px",
                            }}
                          >
                            {todayWorkout.duration_minutes} min
                          </span>
                        ) : null}
                        {todayWorkout.difficulty ? (
                          <span
                            style={{
                              fontSize: 11,
                              color: "#D4AF37",
                              background: "rgba(212,175,55,0.1)",
                              borderRadius: 6,
                              padding: "3px 8px",
                              textTransform: "capitalize",
                            }}
                          >
                            {todayWorkout.difficulty}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {(todayWorkout.exercises || [])
                        .slice(0, 4)
                        .map((ex, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid #1e1a12",
                              borderRadius: 8,
                              padding: "8px 12px",
                            }}
                          >
                            <div>
                              <p
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "#e0e0e0",
                                }}
                              >
                                {ex.name}
                              </p>
                              <p
                                style={{
                                  fontSize: 11,
                                  color: "#616161",
                                  marginTop: 1,
                                }}
                              >
                                {ex.muscle_group}
                              </p>
                            </div>
                            <span
                              style={{
                                fontSize: 12,
                                color: "#D4AF37",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {ex.sets}�{ex.reps}
                            </span>
                          </div>
                        ))}
                      {(todayWorkout.exercises || []).length > 4 && (
                        <p
                          style={{
                            fontSize: 12,
                            color: "#616161",
                            textAlign: "center",
                            padding: "4px 0",
                          }}
                        >
                          +{todayWorkout.exercises.length - 4} more exercises
                        </p>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 10,
                    padding: "14px 16px",
                    textAlign: "center",
                    marginBottom: 14,
                    border: "1px solid #1e1a12",
                  }}
                >
                  <p style={{ color: "#616161", fontSize: 13 }}>
                    No workout scheduled for today.
                  </p>
                </div>
              )}

              <button
                className="btn btn-gold"
                style={{
                  width: "100%",
                  padding: "12px 0",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  borderRadius: 10,
                }}
                onClick={() => navigate("/workouts")}
              >
                {todayWorkout && !todayWorkout.is_rest_day
                  ? "Start Workout"
                  : "View Full Plan"}
              </button>
            </div>
          )}

          {/* -- Today's Tasks -------------------------------------------- */}
          {safeData.today_tasks?.length > 0 && (
            <div
              style={{
                background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: 14,
                padding: "20px 22px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#D4AF37",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                >
                  Today&apos;s Tasks
                </p>
                <span style={{ fontSize: 11, color: "#616161" }}>
                  {safeData.today_tasks.filter((t) => t.is_completed).length}/
                  {safeData.today_tasks.length} done
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {safeData.today_tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* -- All-time strip ------------------------------------------- */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <MiniStatCard
              label="Total Sessions"
              value={safeData.total_workouts_completed}
            />
            <MiniStatCard
              label="This Week"
              value={safeData.weekly_sessions}
              unit="sessions"
            />
          </div>
        </div>
        {/* end RIGHT COLUMN */}
      </div>
      {/* end two-column grid */}
    </div>
  );
}

/* --- StatCard ---------------------------------------------------- */
function StatCard({ label, value, sub, subColor = "#D4AF37" }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
        border: "1px solid rgba(212,175,55,0.18)",
        borderRadius: 14,
        padding: "18px 16px 16px",
      }}
    >
      <p
        style={{
          fontSize: 11,
          color: "#D4AF37",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          marginBottom: 10,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: "#ffffff",
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 12, color: subColor, fontWeight: 600 }}>{sub}</p>
    </div>
  );
}

/* --- MiniStatCard ------------------------------------------------ */
function MiniStatCard({ label, value, unit }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
        border: "1px solid rgba(212,175,55,0.12)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ fontSize: 12, color: "#9e9e9e" }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 900, color: "#D4AF37" }}>
        {value}
        {unit && (
          <span
            style={{
              fontSize: 11,
              color: "#616161",
              fontWeight: 500,
              marginLeft: 3,
            }}
          >
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

/* --- TaskRow ----------------------------------------------------- */
function TaskRow({ task }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 0",
        borderBottom: "1px solid #1e1a12",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `2px solid ${task.is_completed ? "#4caf50" : "#D4AF37"}`,
          background: task.is_completed ? "#4caf50" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {task.is_completed && (
          <span style={{ color: "#000", fontSize: 10, fontWeight: 900 }}>
            &#10003;
          </span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: task.is_completed ? "#424242" : "#e0e0e0",
            textDecoration: task.is_completed ? "line-through" : "none",
          }}
        >
          {task.title}
        </p>
        {task.description && (
          <p style={{ fontSize: 11, color: "#616161", marginTop: 2 }}>
            {task.description}
          </p>
        )}
      </div>
    </div>
  );
}

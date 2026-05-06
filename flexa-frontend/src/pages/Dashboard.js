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
    text: "Strength does not come from physical capacity. It comes from an indomitable will.",
    author: "Mahatma Gandhi",
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
  {
    text: "The harder the battle, the sweeter the victory.",
    author: "Les Brown",
  },
  {
    text: "Fall seven times, stand up eight.",
    author: "Japanese Proverb",
  },
  {
    text: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt",
  },
  {
    text: "The body achieves what the mind believes.",
    author: "Napoleon Hill",
  },
  {
    text: "All progress takes place outside the comfort zone.",
    author: "Michael John Bobak",
  },
  {
    text: "Motivation gets you started. Habit keeps you going.",
    author: "Jim Ryun",
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
  if (!cat) return "var(--text-tertiary)";
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
  const [todayMeals, setTodayMeals] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const requestSeqRef = useRef(0);
  const hasLoadedDashboardRef = useRef(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const navigate = useNavigate();
  const quote = getDayQuote();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let isActive = true;
    const currentRequest = ++requestSeqRef.current;

    (async () => {
      try {
        const [dashRes, workoutRes, splitRes, mealsRes, chatRes, profsRes] =
          await Promise.all([
            api.get("/dashboard/"),
            api
              .get("/workouts/", { params: { week: 1 } })
              .catch(() => ({ data: [] })),
            api.get("/workouts/my-split").catch(() => ({ data: null })),
            api
              .get("/diet/meal-logs", { params: { limit: 10 } })
              .catch(() => ({ data: [] })),
            api
              .get("/chatbot/history", { params: { limit: 5 } })
              .catch(() => ({ data: { conversations: [] } })),
            api
              .get("/professionals/search", { params: { page_size: 6 } })
              .catch(() => ({ data: { professionals: [] } })),
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

        // Filter today's meals from the meal logs
        const mealLogs = mealsRes.data || [];
        const todayDate = new Date().toISOString().split("T")[0];
        const todayMealFiltered = mealLogs.filter((meal) => {
          const mealDate = new Date(meal.logged_at).toISOString().split("T")[0];
          return mealDate === todayDate;
        });
        setTodayMeals(todayMealFiltered);

        // Set chat history
        setChatHistory(chatRes.data?.conversations || []);

        // Set professionals list
        setProfessionals(profsRes.data?.professionals || []);
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
      className="dashboard-page-wrap"
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
        className="dashboard-banner-wrap"
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 0,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(255,107,53,0.25)",
          background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
          minHeight: 90,
        }}
      >
        {/* FLEXA logo block */}
        <div
          className="dashboard-logo-block"
          style={{
            background:
              "linear-gradient(160deg, var(--accent) 0%, #E85A2B 100%)",
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
              color: "var(--bg-primary)",
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
              color: "var(--text-primary)",
              lineHeight: 1.2,
              marginBottom: 5,
            }}
          >
            {getGreeting()}, {safeData.user_name}!
          </p>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {getDayLabel()} &middot; Ready to crush your goals?
          </p>
        </div>
      </div>

      {/* -- Two-column desktop layout -------------------------------- */}
      <div
        className="dashboard-main-grid"
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 420px",
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
              border: "1px solid rgba(255,107,53,0.2)",
              borderRadius: 14,
              padding: "22px 22px 20px",
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent)",
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
                color: "var(--text-secondary)",
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
                color: "var(--accent)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              &mdash; {quote.author}
            </p>
          </div>

          {/* -- 2�2 Stats Grid ------------------------------------------- */}
          <div
            className="dashboard-stats-grid"
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
                      ? "#FF0055"
                      : "var(--accent)"
                  : "var(--text-tertiary)"
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
                border: "1px solid rgba(255,107,53,0.2)",
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
                  color: "var(--text-tertiary)",
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
                border: "1px solid rgba(255,107,53,0.2)",
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
                      color: "var(--accent)",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      marginBottom: 2,
                    }}
                  >
                    Your Workout Plan
                  </p>
                  {planFreq > 0 && (
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {planFreq} day{planFreq !== 1 ? "s" : ""}/week
                      {planDifficulty
                        ? ` � ${planDifficulty.charAt(0).toUpperCase() + planDifficulty.slice(1)}`
                        : ""}
                    </p>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    paddingTop: 2,
                  }}
                >
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
                    background: "rgba(255,107,53,0.07)",
                    border: "1px solid rgba(255,107,53,0.25)",
                    borderRadius: 8,
                    padding: "7px 12px",
                    marginBottom: 14,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--accent)",
                      fontWeight: 700,
                    }}
                  >
                    YOUR PLAN
                  </span>
                  <span
                    style={{
                      width: 1,
                      height: 12,
                      background: "rgba(255,107,53,0.3)",
                    }}
                  />
                  <span
                    style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}
                  >
                    {mlSplit.split}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                      flex: 1,
                    }}
                  >
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
                            ? "rgba(255,107,53,0.25)"
                            : done
                              ? "rgba(76,175,80,0.25)"
                              : isWorkoutDay
                                ? "rgba(255,107,53,0.07)"
                                : "var(--bg-tertiary)",
                          border: `1.5px solid ${
                            isToday
                              ? "var(--accent)"
                              : done
                                ? "#4caf50"
                                : isWorkoutDay
                                  ? "rgba(255,107,53,0.3)"
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
                              color: "var(--accent)",
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
                              color: "rgba(255,107,53,0.4)",
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
                            ? "var(--accent)"
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
                        color: "var(--accent)",
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
                              color: "var(--text-tertiary)",
                              background: "var(--bg-tertiary)",
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
                              color: "var(--accent)",
                              background: "rgba(255,107,53,0.1)",
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
                                  color: "var(--text-secondary)",
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
                                color: "var(--accent)",
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

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                }}
              >
                <button
                  className="btn btn-gold"
                  style={{
                    padding: "10px 0",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                  }}
                  onClick={() => navigate("/workouts")}
                >
                  🏋️ Workout
                </button>
                <button
                  className="btn btn-quick-diet"
                  onClick={() => navigate("/diet-planner")}
                >
                  🍽️ Diet
                </button>
                <button
                  className="btn btn-quick-ai"
                  onClick={() => navigate("/chatbot")}
                >
                  💬 AI
                </button>
              </div>
            </div>
          )}

          {/* -- Diet Planner -------------------------------------------- */}
          <div
            style={{
              background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
              border: "1px solid rgba(78,201,176,0.2)",
              borderRadius: 14,
              padding: "20px 22px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 14,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--macro-protein)",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    marginBottom: 2,
                  }}
                >
                  Your Nutrition
                </p>
                {dailyCalories && (
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    Target: {targetCalories || dailyCalories} kcal/day
                  </p>
                )}
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  paddingTop: 2,
                }}
              >
                {todayMeals.length} meal{todayMeals.length !== 1 ? "s" : ""}{" "}
                logged
              </span>
            </div>

            {todayMeals.length === 0 ? (
              /* No meals logged yet */
              <div
                style={{
                  background: "rgba(78,201,176,0.07)",
                  borderRadius: 10,
                  padding: "20px 16px",
                  textAlign: "center",
                  marginBottom: 14,
                  border: "1px solid rgba(78,201,176,0.2)",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-tertiary)",
                    marginBottom: 16,
                  }}
                >
                  No meals logged yet. Generate a personalized meal plan!
                </p>
                <button
                  className="btn"
                  style={{
                    background: "rgba(78,201,176,0.15)",
                    border: "1.5px solid var(--macro-protein)",
                    color: "var(--macro-protein)",
                    padding: "10px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "rgba(78,201,176,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "rgba(78,201,176,0.15)";
                  }}
                  onClick={() => navigate("/diet-planner")}
                >
                  Generate Meal Plan
                </button>
              </div>
            ) : (
              /* Show today's meals */
              <div
                style={{
                  background: "rgba(78,201,176,0.05)",
                  borderRadius: 10,
                  padding: "14px 12px",
                  marginBottom: 14,
                  border: "1px solid rgba(78,201,176,0.15)",
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {todayMeals.slice(0, 3).map((meal, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingBottom:
                          idx < Math.min(3, todayMeals.length - 1) ? 8 : 0,
                        borderBottom:
                          idx < Math.min(3, todayMeals.length - 1)
                            ? "1px solid rgba(78,201,176,0.1)"
                            : "none",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#fff",
                            marginBottom: 2,
                          }}
                        >
                          {meal.meal_type || "Meal"} &ndash;{" "}
                          {meal.food_name || "Unknown"}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {meal.calories || 0} kcal
                          {meal.protein_g
                            ? ` • ${meal.protein_g.toFixed(1)}g protein`
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                  {todayMeals.length > 3 && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#616161",
                        textAlign: "center",
                        paddingTop: 6,
                      }}
                    >
                      +{todayMeals.length - 3} more meal
                      {todayMeals.length - 3 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              className="btn btn-quick-diet"
              onClick={() => navigate("/diet-planner")}
              style={{
                width: "100%",
                padding: "12px 0",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
              }}
            >
              View Full Plan
            </button>
          </div>

          {/* -- AI Chatbot -------------------------------------------- */}
          <div
            style={{
              background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
              border: "1px solid rgba(255,200,87,0.2)",
              borderRadius: 14,
              padding: "20px 22px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 14,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#ffc857",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    marginBottom: 2,
                  }}
                >
                  AI Assistant
                </p>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  Get personalized fitness guidance
                </p>
              </div>
            </div>

            {chatHistory.length === 0 ? (
              /* No chat history */
              <div
                style={{
                  background: "rgba(255,200,87,0.07)",
                  borderRadius: 10,
                  padding: "20px 16px",
                  textAlign: "center",
                  marginBottom: 14,
                  border: "1px solid rgba(255,200,87,0.2)",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-tertiary)",
                    marginBottom: 16,
                  }}
                >
                  Start a conversation with Flexa AI
                </p>
                <button
                  className="btn"
                  style={{
                    background: "rgba(255,200,87,0.15)",
                    border: "1.5px solid #ffc857",
                    color: "#ffc857",
                    padding: "10px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "rgba(255,200,87,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "rgba(255,200,87,0.15)";
                  }}
                  onClick={() => navigate("/chatbot")}
                >
                  Chat Now
                </button>
              </div>
            ) : (
              /* Show recent conversations */
              <div
                style={{
                  background: "rgba(255,200,87,0.05)",
                  borderRadius: 10,
                  padding: "14px 12px",
                  marginBottom: 14,
                  border: "1px solid rgba(255,200,87,0.15)",
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {chatHistory.slice(0, 2).map((conv, idx) => (
                    <div
                      key={idx}
                      style={{
                        paddingBottom:
                          idx < Math.min(2, chatHistory.length - 1) ? 10 : 0,
                        borderBottom:
                          idx < Math.min(2, chatHistory.length - 1)
                            ? "1px solid rgba(255,200,87,0.1)"
                            : "none",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#fff",
                          marginBottom: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {conv.title || "Conversation"}
                      </p>
                      <p
                        style={{ fontSize: 11, color: "var(--text-tertiary)" }}
                      >
                        {new Date(conv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              className="btn"
              onClick={() => navigate("/chatbot")}
              style={{
                width: "100%",
                padding: "12px 0",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                background: "rgba(255,200,87,0.15)",
                border: "1.5px solid #ffc857",
                color: "#ffc857",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,200,87,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,200,87,0.15)";
              }}
            >
              Open Chatbot
            </button>
          </div>

          {/* -- Experts Directory -------------------------------------------- */}
          <div
            style={{
              background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
              border: "1px solid rgba(156,102,222,0.2)",
              borderRadius: 14,
              padding: "20px 22px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 14,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#9c66de",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    marginBottom: 2,
                  }}
                >
                  Expert Professionals
                </p>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  Book consultations with certified experts
                </p>
              </div>
            </div>

            {professionals.length === 0 ? (
              /* No professionals found */
              <div
                style={{
                  background: "rgba(156,102,222,0.07)",
                  borderRadius: 10,
                  padding: "20px 16px",
                  textAlign: "center",
                  marginBottom: 14,
                  border: "1px solid rgba(156,102,222,0.2)",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-tertiary)",
                    marginBottom: 16,
                  }}
                >
                  Browse our network of verified professionals
                </p>
                <button
                  className="btn"
                  style={{
                    background: "rgba(156,102,222,0.15)",
                    border: "1.5px solid #9c66de",
                    color: "#9c66de",
                    padding: "10px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "rgba(156,102,222,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "rgba(156,102,222,0.15)";
                  }}
                  onClick={() => navigate("/experts")}
                >
                  Find Experts
                </button>
              </div>
            ) : (
              /* Show available professionals */
              <div
                style={{
                  background: "rgba(156,102,222,0.05)",
                  borderRadius: 10,
                  padding: "12px",
                  marginBottom: 14,
                  border: "1px solid rgba(156,102,222,0.15)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {professionals.slice(0, 4).map((prof, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "10px 12px",
                      background: "rgba(156,102,222,0.08)",
                      borderRadius: 8,
                      border: "1px solid rgba(156,102,222,0.2)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#fff",
                        marginBottom: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {prof.user?.username || "Expert"}
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: "#9c66de",
                        marginBottom: 2,
                      }}
                    >
                      {prof.specialization || "Fitness"}
                    </p>
                    {prof.average_rating && (
                      <p
                        style={{ fontSize: 10, color: "var(--text-tertiary)" }}
                      >
                        ⭐ {prof.average_rating.toFixed(1)} (
                        {prof.total_reviews || 0})
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn"
              onClick={() => navigate("/experts")}
              style={{
                width: "100%",
                padding: "12px 0",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                background: "rgba(156,102,222,0.15)",
                border: "1.5px solid #9c66de",
                color: "#9c66de",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(156,102,222,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(156,102,222,0.15)";
              }}
            >
              View All Experts
            </button>
          </div>

          {/* -- Today's Tasks -------------------------------------------- */}
          {safeData.today_tasks?.length > 0 && (
            <div
              style={{
                background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
                border: "1px solid rgba(255,107,53,0.2)",
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
                    color: "var(--accent)",
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
            className="dashboard-bottom-grid"
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
function StatCard({ label, value, sub, subColor = "var(--accent)" }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #13100a 0%, #1c1608 100%)",
        border: "1px solid rgba(255,107,53,0.18)",
        borderRadius: 14,
        padding: "18px 16px 16px",
      }}
    >
      <p
        style={{
          fontSize: 11,
          color: "var(--accent)",
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
          color: "var(--text-primary)",
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
        border: "1px solid rgba(255,107,53,0.12)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 900, color: "var(--accent)" }}>
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
          border: `2px solid ${task.is_completed ? "#4caf50" : "var(--accent)"}`,
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
            color: task.is_completed ? "#424242" : "var(--text-secondary)",
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

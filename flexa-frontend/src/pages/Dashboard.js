import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";

/* â”€â”€â”€ Daily inspiration quotes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  if (!g) return "â€”";
  return g.charAt(0).toUpperCase() + g.slice(1);
}

function fmtActivity(a) {
  if (!a) return "â€”";
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN COMPONENT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const quote = getDayQuote();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/dashboard/");
        setData(res.data);
      } catch {
        toast.error("Could not load dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <div className="loading-center">
        <div className="spinner" />
      </div>
    );

  if (!data)
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <h2 style={{ color: "#e0e0e0" }}>
          Complete your{" "}
          <span
            className="text-gold"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/profile-setup")}
          >
            profile
          </span>{" "}
          to access the dashboard.
        </h2>
      </div>
    );

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: "16px 16px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* â”€â”€ Welcome Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
            {getGreeting()}, {data.user_name}!
          </p>
          <p style={{ fontSize: 12, color: "#9e9e9e" }}>
            {getDayLabel()} &middot; Ready to crush your goals?
          </p>
        </div>
      </div>

      {/* â”€â”€ Daily Motivation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
          âœ¦ Daily Motivation âœ¦
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
          "{quote.text}"
        </p>
        <p
          style={{
            textAlign: "center",
            color: "#D4AF37",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          â€” {quote.author}
        </p>
      </div>

      {/* â”€â”€ 2Ã—2 Stats Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <StatCard
          label="Current Goal"
          value={fmtGoal(data.current_goal)}
          sub={
            data.current_goal === "cutting"
              ? "Calorie Deficit"
              : data.current_goal === "bulking"
                ? "Calorie Surplus"
                : data.current_goal === "recomp"
                  ? "Body Recomp"
                  : "Maintenance"
          }
        />
        <StatCard
          label="BMI"
          value={data.bmi ? data.bmi.toFixed(2) : "â€”"}
          sub={data.bmi_category || "Not measured"}
          subColor={bmiColor(data.bmi_category)}
        />
        <StatCard
          label="Daily Calories"
          value={
            data.daily_calories ? data.daily_calories.toLocaleString() : "â€”"
          }
          sub={fmtActivity(data.activity_level)}
        />
        <StatCard
          label="Target Calories"
          value={
            data.target_calories ? data.target_calories.toLocaleString() : "â€”"
          }
          sub="cal"
        />
      </div>

      {/* â”€â”€ Workout CTA (no plan) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!data.has_workout_plan && (
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
            ðŸ‹ï¸
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
      )}

      {/* â”€â”€ Weekly progress (has plan) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {data.has_workout_plan && (
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
              This Week
            </p>
            <span style={{ fontSize: 12, color: "#9e9e9e" }}>
              {data.weekly_sessions} session
              {data.weekly_sessions !== 1 ? "s" : ""} done
            </span>
          </div>

          {/* Day dots â€” Mon-Sun */}
          <div
            style={{
              display: "flex",
              gap: 6,
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
              const todayIdx = (new Date().getDay() + 6) % 7;
              const isPast = i < todayIdx;
              const isToday = i === todayIdx;
              const done = isPast && i < data.weekly_sessions;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 5,
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
                          : "#1a1a1a",
                      border: `1.5px solid ${isToday ? "#D4AF37" : done ? "#4caf50" : "#2a2a2a"}`,
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
                        â€¢
                      </span>
                    )}
                    {done && (
                      <span style={{ color: "#4caf50", fontSize: 10 }}>
                        âœ“
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: isToday ? "#D4AF37" : "#424242",
                      fontWeight: isToday ? 700 : 400,
                    }}
                  >
                    {d}
                  </span>
                </div>
              );
            })}
          </div>

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
            View Today's Workout
          </button>
        </div>
      )}

      {/* â”€â”€ Today's Tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {data.today_tasks?.length > 0 && (
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
              Today's Tasks
            </p>
            <span style={{ fontSize: 11, color: "#616161" }}>
              {data.today_tasks.filter((t) => t.is_completed).length}/
              {data.today_tasks.length} done
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.today_tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* â”€â”€ All-time strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <MiniStatCard
          label="Total Sessions"
          value={data.total_workouts_completed}
        />
        <MiniStatCard
          label="This Week"
          value={data.weekly_sessions}
          unit="sessions"
        />
      </div>
    </div>
  );
}

/* â”€â”€â”€ StatCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€ MiniStatCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€ TaskRow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
            âœ“
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

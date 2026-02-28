import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { FiActivity, FiTarget, FiTrendingUp, FiAward } from "react-icons/fi";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await api.get("/dashboard/");
      setData(res.data);
    } catch (err) {
      toast.error("Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const completeTask = async (taskId) => {
    try {
      await api.post(`/dashboard/tasks/${taskId}/complete`);
      setData((prev) => ({
        ...prev,
        today_tasks: prev.today_tasks.map((t) =>
          t.id === taskId ? { ...t, is_completed: true } : t,
        ),
      }));
      toast.success("Task completed!");
    } catch {
      toast.error("Error updating task.");
    }
  };

  if (loading)
    return (
      <div className="loading-center">
        <div className="spinner" />
      </div>
    );

  if (!data)
    return (
      <div
        className="page-content"
        style={{ textAlign: "center", paddingTop: 80 }}
      >
        <h2>
          Complete your{" "}
          <Link to="/profile-setup" className="text-gold">
            profile
          </Link>{" "}
          to access the dashboard.
        </h2>
      </div>
    );

  const scorePercent = Math.round((data.motivation_score || 0) * 100);

  return (
    <div className="page-content">
      {/* Welcome banner */}
      <div
        className="dashboard-banner"
        style={{
          background:
            "linear-gradient(135deg, #111 0%, rgba(212,175,55,0.06) 100%)",
          border: "1px solid rgba(212,175,55,0.15)",
          borderRadius: 16,
          padding: "28px 24px",
          marginBottom: 32,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <p style={{ color: "#9e9e9e", fontSize: 13, marginBottom: 4 }}>
            Welcome back,
          </p>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {data.user_name} <FiActivity size={26} color="#D4AF37" />
          </h1>
          <p
            style={{
              color: "#D4AF37",
              fontSize: 14,
              marginTop: 8,
              maxWidth: 500,
              lineHeight: 1.6,
            }}
          >
            {data.motivation_message}
          </p>
        </div>
        <div className="dashboard-score" style={{ textAlign: "right" }}>
          <p
            style={{
              fontSize: 12,
              color: "#9e9e9e",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
            }}
          >
            Motivation Score
          </p>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: "#D4AF37",
              lineHeight: 1,
            }}
          >
            {scorePercent}%
          </div>
          <div
            className="progress-bar-wrap"
            style={{ width: 120, marginTop: 8, marginLeft: "auto" }}
          >
            <div
              className="progress-bar-fill"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        <StatCard
          icon={<FiActivity color="#D4AF37" />}
          label="BMI"
          value={data.bmi?.toFixed(1) || "—"}
          sub={data.bmi_category || "Not measured"}
        />
        <StatCard
          icon={<FiTarget color="#D4AF37" />}
          label="Current Goal"
          value={
            data.current_goal
              ? data.current_goal.charAt(0).toUpperCase() +
                data.current_goal.slice(1)
              : "—"
          }
          sub="Active goal"
        />
        <StatCard
          icon={<FiActivity color="#D4AF37" />}
          label="This Week"
          value={data.weekly_sessions}
          sub="Sessions"
        />
        <StatCard
          icon={<FiTrendingUp color="#D4AF37" />}
          label="Total Sessions"
          value={data.total_workouts_completed}
          sub="All time"
        />
      </div>

      <div className="grid-2">
        {/* Today's Tasks */}
        <div>
          <div className="section-header">
            <h2 className="section-title">
              Today's <span>Tasks</span>
            </h2>
            <p className="section-subtitle">
              {data.today_tasks?.filter((t) => t.is_completed).length}/
              {data.today_tasks?.length} completed
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.today_tasks?.map((task) => (
              <div
                key={task.id}
                style={{
                  background: task.is_completed
                    ? "rgba(76,175,80,0.06)"
                    : "#111",
                  border: `1.5px solid ${task.is_completed ? "rgba(76,175,80,0.25)" : "#242424"}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
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
                      <span style={{ color: "#fff", fontSize: 11 }}>✓</span>
                    )}
                  </div>
                  <div>
                    <p
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: task.is_completed ? "#616161" : "#e0e0e0",
                        textDecoration: task.is_completed
                          ? "line-through"
                          : "none",
                      }}
                    >
                      {task.title}
                    </p>
                    <p style={{ fontSize: 12, color: "#616161", marginTop: 2 }}>
                      {task.description}
                    </p>
                  </div>
                </div>
                {!task.is_completed && (
                  <button
                    className="btn btn-gold"
                    style={{ padding: "6px 14px", fontSize: 12 }}
                    onClick={() => completeTask(task.id)}
                  >
                    Done
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        <div>
          <div className="section-header">
            <h2 className="section-title">
              <span>Milestones</span> <FiAward size={18} color="#D4AF37" />
            </h2>
            <p className="section-subtitle">Achievements unlocked</p>
          </div>

          {data.milestones?.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <FiTarget
                size={40}
                color="#9e9e9e"
                style={{ margin: "0 auto" }}
              />
              <p style={{ color: "#9e9e9e", marginTop: 12, fontSize: 14 }}>
                Complete workouts to unlock your first milestone!
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.milestones?.map((m, i) => (
                <div
                  key={i}
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "14px 18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <FiAward size={28} color="#D4AF37" />
                  </div>
                  <div>
                    <p
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#D4AF37",
                      }}
                    >
                      {m.title}
                    </p>
                    <p style={{ fontSize: 12, color: "#9e9e9e", marginTop: 2 }}>
                      {m.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick links */}
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <Link
              to="/workouts"
              className="btn btn-outline"
              style={{ flex: 1, justifyContent: "center" }}
            >
              Today's Workout
            </Link>
            <Link
              to="/progress"
              className="btn btn-ghost"
              style={{ flex: 1, justifyContent: "center" }}
            >
              Log Progress
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div className="stat-label">{label}</div>
        <div style={{ opacity: 0.8 }}>{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

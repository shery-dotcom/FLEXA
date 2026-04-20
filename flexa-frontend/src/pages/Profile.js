import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiEdit2,
  FiSave,
  FiX,
  FiTarget,
  FiActivity,
  FiCamera,
  FiTrendingUp,
  FiZap,
  FiSliders,
} from "react-icons/fi";

const GENDERS = ["male", "female", "other"];

const GOAL_OPTIONS = [
  {
    value: "bulking",
    label: "Bulking",
    icon: <FiTrendingUp size={20} />,
    desc: "Calorie surplus to gain muscle",
  },
  {
    value: "cutting",
    label: "Cutting",
    icon: <FiZap size={20} />,
    desc: "Calorie deficit to lose fat",
  },
  {
    value: "recomp",
    label: "Recomp",
    icon: <FiSliders size={20} />,
    desc: "Build muscle & burn fat simultaneously",
  },
];

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", desc: "Little or no exercise" },
  { value: "light", label: "Light", desc: "1–3 days/week" },
  { value: "moderate", label: "Moderate", desc: "3–5 days/week" },
  { value: "active", label: "Active", desc: "6–7 days/week" },
  {
    value: "very_active",
    label: "Very Active",
    desc: "Hard training twice a day",
  },
];

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState(null);
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalLoading, setGoalLoading] = useState(false);
  const [goalValidation, setGoalValidation] = useState(null);
  const [goalForm, setGoalForm] = useState({
    goal_type: "",
    activity_level: "",
    target_weight_kg: "",
  });
  const picInputRef = useRef(null);
  const [profilePic, setProfilePic] = useState(null); // pending base64

  const p = user?.profile;

  const [form, setForm] = useState({
    username: p?.username || "",
    age: p?.age || "",
    gender: p?.gender || "male",
    region: p?.region || "",
    height_cm: p?.height_cm || "",
    weight_kg: p?.weight_kg || "",
  });

  // Load active goal and initialise goal form
  useEffect(() => {
    api
      .get("/goals/active")
      .then((r) => {
        setGoal(r.data);
        setGoalForm({
          goal_type: r.data.goal_type || "",
          activity_level: r.data.activity_level || "",
          target_weight_kg: r.data.target_weight_kg || "",
        });
      })
      .catch(() => {});
  }, []);

  // Sync form when user profile loads/changes
  useEffect(() => {
    if (p) {
      setForm({
        username: p.username || "",
        age: p.age || "",
        gender: p.gender || "male",
        region: p.region || "",
        height_cm: p.height_cm || "",
        weight_kg: p.weight_kg || "",
      });
    }
  }, [p]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePic(ev.target.result);
    reader.readAsDataURL(file);
  };

  const liveBmi =
    form.height_cm && form.weight_kg
      ? (
          parseFloat(form.weight_kg) /
          (parseFloat(form.height_cm) / 100) ** 2
        ).toFixed(1)
      : null;

  const bmiCategory = (bmi) => {
    if (!bmi) return null;
    if (bmi < 18.5) return { label: "Underweight", cls: "badge-red" };
    if (bmi < 25) return { label: "Normal", cls: "badge-green" };
    if (bmi < 30) return { label: "Overweight", cls: "badge-gold" };
    return { label: "Obese", cls: "badge-red" };
  };

  const bmiInfo = bmiCategory(parseFloat(liveBmi || p?.bmi));

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put("/users/me/profile", {
        ...form,
        age: parseInt(form.age) || null,
        height_cm: parseFloat(form.height_cm) || null,
        weight_kg: parseFloat(form.weight_kg) || null,
        profile_picture: profilePic || undefined,
      });
      setProfilePic(null);
      await refreshUser();
      toast.success("Profile updated!");
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoalSave = async (e) => {
    e.preventDefault();
    if (!goalForm.goal_type || !goalForm.activity_level) {
      toast.error("Please select a goal and activity level.");
      return;
    }
    setGoalLoading(true);
    try {
      const res = await api.post("/goals/", {
        goal_type: goalForm.goal_type,
        activity_level: goalForm.activity_level,
        target_weight_kg: goalForm.target_weight_kg
          ? parseFloat(goalForm.target_weight_kg)
          : undefined,
      });
      setGoal(res.data);
      // Save AI validation report to display feedback
      if (res.data?.ai_report) setGoalValidation(res.data.ai_report);
      setGoalEditing(false);
      toast.success("Goal updated! AI assessment complete.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update goal.");
    } finally {
      setGoalLoading(false);
    }
  };

  const cancelEdit = () => {
    setForm({
      username: p?.username || "",
      age: p?.age || "",
      gender: p?.gender || "male",
      region: p?.region || "",
      height_cm: p?.height_cm || "",
      weight_kg: p?.weight_kg || "",
    });
    setEditing(false);
  };

  return (
    <div className="page-content" style={{ maxWidth: 800, margin: "0 auto" }}>
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
            My <span className="text-gold">Profile</span>
          </h1>
          <p style={{ color: "#9e9e9e", marginTop: 6, fontSize: 14 }}>
            Manage your personal details and fitness plan
          </p>
        </div>
        {!editing && (
          <button className="btn btn-gold" onClick={() => setEditing(true)}>
            <FiEdit2 size={15} /> Edit Profile
          </button>
        )}
      </div>

      <div className="grid-2" style={{ gap: 24, alignItems: "start" }}>
        {/* Left: Account Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Profile Picture Card */}
          <div className="card" style={{ textAlign: "center" }}>
            <input
              ref={picInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePicChange}
            />
            {/* Avatar */}
            <div
              style={{
                position: "relative",
                display: "inline-block",
                marginBottom: 12,
              }}
            >
              {profilePic || p?.profile_picture ? (
                <img
                  src={profilePic || p.profile_picture}
                  alt={p?.username}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "3px solid rgba(212,175,55,0.6)",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: "50%",
                    background: "rgba(212,175,55,0.12)",
                    border: "3px solid rgba(212,175,55,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FiUser size={36} color="#D4AF37" />
                </div>
              )}
              {/* Change picture button */}
              <button
                onClick={() => picInputRef.current?.click()}
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#D4AF37",
                  border: "2px solid #0a0a0a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                title="Change photo"
              >
                <FiCamera size={13} color="#000" />
              </button>
            </div>
            <p style={{ fontWeight: 700, fontSize: 15, color: "#e0e0e0" }}>
              {p?.username || "—"}
            </p>
            <p style={{ fontSize: 12, color: "#616161", marginTop: 2 }}>
              {user?.email}
            </p>
            {profilePic && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 11, color: "#D4AF37", marginBottom: 8 }}>
                  New photo selected — save profile to apply
                </p>
                <button
                  onClick={() => setProfilePic(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#616161",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ✕ Remove
                </button>
              </div>
            )}
          </div>

          {/* Account card */}
          <div className="card">
            <h3
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#9e9e9e",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginBottom: 20,
              }}
            >
              Account
            </h3>
            <InfoRow
              icon={<FiMail size={15} />}
              label="Email"
              value={user?.email}
            />
            <InfoRow
              icon={<FiPhone size={15} />}
              label="Phone"
              value={user?.phone || "—"}
            />
            <InfoRow
              icon={<FiUser size={15} />}
              label="Role"
              value={
                <span className="badge badge-gold">
                  {user?.role || "member"}
                </span>
              }
            />
            <InfoRow
              icon={<FiActivity size={15} />}
              label="Member Since"
              value={
                user?.created_at
                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"
              }
            />
          </div>

          {/* BMI card */}
          <div
            style={{
              background:
                "linear-gradient(135deg, #111 0%, rgba(212,175,55,0.06) 100%)",
              border: "1.5px solid rgba(212,175,55,0.2)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: "#9e9e9e",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginBottom: 12,
              }}
            >
              Current BMI
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 48, fontWeight: 900, color: "#D4AF37" }}>
                {liveBmi || p?.bmi?.toFixed(1) || "—"}
              </span>
              {bmiInfo && (
                <span className={`badge ${bmiInfo.cls}`}>{bmiInfo.label}</span>
              )}
            </div>
            {p?.height_cm && p?.weight_kg && (
              <p style={{ fontSize: 12, color: "#616161", marginTop: 8 }}>
                {p.height_cm} cm · {p.weight_kg} kg
              </p>
            )}
          </div>

          {/* Active Goal card */}
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#9e9e9e",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <FiTarget size={13} />
                Fitness Goal
              </h3>
              {!goalEditing && (
                <button
                  onClick={() => setGoalEditing(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#D4AF37",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <FiEdit2 size={12} /> {goal ? "Change" : "Set Goal"}
                </button>
              )}
            </div>

            {goalEditing ? (
              <form onSubmit={handleGoalSave}>
                {/* Goal type pills */}
                <p
                  style={{
                    fontSize: 11,
                    color: "#9e9e9e",
                    marginBottom: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                  }}
                >
                  Goal Type
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  {GOAL_OPTIONS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() =>
                        setGoalForm((f) => ({ ...f, goal_type: g.value }))
                      }
                      style={{
                        background:
                          goalForm.goal_type === g.value
                            ? "rgba(212,175,55,0.12)"
                            : "transparent",
                        border: `1.5px solid ${goalForm.goal_type === g.value ? "#D4AF37" : "#2a2a2a"}`,
                        borderRadius: 10,
                        padding: "10px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.2s",
                      }}
                    >
                      <span style={{ color: "#D4AF37" }}>{g.icon}</span>
                      <div style={{ textAlign: "left" }}>
                        <p
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color:
                              goalForm.goal_type === g.value
                                ? "#D4AF37"
                                : "#e0e0e0",
                          }}
                        >
                          {g.label}
                        </p>
                        <p style={{ fontSize: 11, color: "#616161" }}>
                          {g.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Activity level */}
                <p
                  style={{
                    fontSize: 11,
                    color: "#9e9e9e",
                    marginBottom: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                  }}
                >
                  Activity Level
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  {ACTIVITY_OPTIONS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() =>
                        setGoalForm((f) => ({ ...f, activity_level: a.value }))
                      }
                      style={{
                        background:
                          goalForm.activity_level === a.value
                            ? "rgba(212,175,55,0.08)"
                            : "transparent",
                        border: `1.5px solid ${goalForm.activity_level === a.value ? "#D4AF37" : "#2a2a2a"}`,
                        borderRadius: 8,
                        padding: "9px 14px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "all 0.2s",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color:
                            goalForm.activity_level === a.value
                              ? "#D4AF37"
                              : "#e0e0e0",
                        }}
                      >
                        {a.label}
                      </span>
                      <span style={{ fontSize: 11, color: "#616161" }}>
                        {a.desc}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Target weight */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">
                    Target Weight (kg) — optional
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="e.g. 80"
                    min="30"
                    max="300"
                    value={goalForm.target_weight_kg}
                    onChange={(e) =>
                      setGoalForm((f) => ({
                        ...f,
                        target_weight_kg: e.target.value,
                      }))
                    }
                  />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="submit"
                    className="btn btn-gold"
                    style={{ flex: 1 }}
                    disabled={goalLoading}
                  >
                    <FiSave size={13} />{" "}
                    {goalLoading ? "Saving..." : "Save Goal"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setGoalEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : goal ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#D4AF37",
                      textTransform: "capitalize",
                    }}
                  >
                    {goal.goal_type}
                  </span>
                  <span className="badge badge-green">Active</span>
                </div>
                <InfoRow
                  label="Activity Level"
                  value={goal.activity_level
                    ?.replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                />
                {goal.target_weight_kg && (
                  <InfoRow
                    label="Target Weight"
                    value={`${goal.target_weight_kg} kg`}
                  />
                )}
                {goal.ml_score !== null && (
                  <InfoRow
                    label="Goal Score"
                    value={
                      <span style={{ color: "#D4AF37", fontWeight: 700 }}>
                        {Math.round(goal.ml_score * 100)}%
                      </span>
                    }
                  />
                )}

                {/* BMI Validation Feedback */}
                {goalValidation && (
                  <div style={{ marginTop: 16 }}>
                    {/* Warnings */}
                    {goalValidation.warnings?.length > 0 && (
                      <div
                        style={{
                          background: "rgba(239,83,80,0.07)",
                          border: "1px solid rgba(239,83,80,0.25)",
                          borderRadius: 8,
                          padding: "10px 14px",
                          marginBottom: 10,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#ef5350",
                            textTransform: "uppercase",
                            letterSpacing: "0.6px",
                            marginBottom: 6,
                          }}
                        >
                          ⚠ Warnings
                        </p>
                        {goalValidation.warnings.map((w, i) => (
                          <p
                            key={i}
                            style={{
                              fontSize: 12,
                              color: "#ef9a9a",
                              lineHeight: 1.5,
                            }}
                          >
                            • {w}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Recommendations */}
                    {goalValidation.recommendations?.length > 0 && (
                      <div
                        style={{
                          background: "rgba(212,175,55,0.06)",
                          border: "1px solid rgba(212,175,55,0.2)",
                          borderRadius: 8,
                          padding: "10px 14px",
                          marginBottom: 10,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#D4AF37",
                            textTransform: "uppercase",
                            letterSpacing: "0.6px",
                            marginBottom: 6,
                          }}
                        >
                          AI Recommendation
                        </p>
                        {goalValidation.recommendations.map((r, i) => (
                          <p
                            key={i}
                            style={{
                              fontSize: 12,
                              color: "#c9a227",
                              lineHeight: 1.5,
                            }}
                          >
                            • {r}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Next Steps */}
                    {goalValidation.next_steps?.length > 0 && (
                      <div
                        style={{
                          background: "rgba(76,175,80,0.06)",
                          border: "1px solid rgba(76,175,80,0.2)",
                          borderRadius: 8,
                          padding: "10px 14px",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#4caf50",
                            textTransform: "uppercase",
                            letterSpacing: "0.6px",
                            marginBottom: 6,
                          }}
                        >
                          Next Steps
                        </p>
                        {goalValidation.next_steps.map((s, i) => (
                          <p
                            key={i}
                            style={{
                              fontSize: 12,
                              color: "#81c784",
                              lineHeight: 1.5,
                            }}
                          >
                            ✓ {s}
                          </p>
                        ))}
                        <button
                          onClick={() => setGoalValidation(null)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#616161",
                            fontSize: 11,
                            cursor: "pointer",
                            marginTop: 8,
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ color: "#9e9e9e", fontSize: 14, marginBottom: 16 }}>
                  No active goal set
                </p>
                <button
                  className="btn btn-gold"
                  style={{ fontSize: 13 }}
                  onClick={() => setGoalEditing(true)}
                >
                  Set Fitness Goal
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Editable Profile Details */}
        <div className="card-gold-border">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <h3 style={{ fontWeight: 700, fontSize: 16 }}>Personal Details</h3>
            {editing && (
              <button
                onClick={cancelEdit}
                style={{
                  background: "none",
                  border: "none",
                  color: "#616161",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 13,
                }}
              >
                <FiX size={14} /> Cancel
              </button>
            )}
          </div>

          {!editing ? (
            /* View mode */
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <ProfileDetailRow label="Username" value={p?.username || "—"} />
              <ProfileDetailRow
                label="Age"
                value={p?.age ? `${p.age} years` : "—"}
              />
              <ProfileDetailRow
                label="Gender"
                value={
                  p?.gender
                    ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1)
                    : "—"
                }
              />
              <ProfileDetailRow label="Region" value={p?.region || "—"} />
              <ProfileDetailRow
                label="Height"
                value={p?.height_cm ? `${p.height_cm} cm` : "—"}
              />
              <ProfileDetailRow
                label="Weight"
                value={p?.weight_kg ? `${p.weight_kg} kg` : "—"}
              />
              <div style={{ marginTop: 24 }}>
                <button
                  className="btn btn-gold"
                  style={{ width: "100%" }}
                  onClick={() => setEditing(true)}
                >
                  <FiEdit2 size={14} /> Edit Details
                </button>
              </div>
            </div>
          ) : (
            /* Edit mode */
            <form onSubmit={handleSave}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input
                    className="form-input"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input
                    className="form-input"
                    type="number"
                    name="age"
                    min="13"
                    max="100"
                    placeholder="25"
                    value={form.age}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-select"
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                  >
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Region</label>
                  <input
                    className="form-input"
                    name="region"
                    placeholder="e.g. Karachi"
                    value={form.region}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Height (cm)</label>
                  <input
                    className="form-input"
                    type="number"
                    name="height_cm"
                    min="100"
                    max="250"
                    placeholder="175"
                    value={form.height_cm}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    className="form-input"
                    type="number"
                    name="weight_kg"
                    min="30"
                    max="300"
                    placeholder="75"
                    value={form.weight_kg}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Live BMI preview while editing */}
              {liveBmi && (
                <div
                  style={{
                    background: "rgba(212,175,55,0.06)",
                    border: "1px solid rgba(212,175,55,0.2)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    marginBottom: 20,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 11,
                        color: "#9e9e9e",
                        marginBottom: 2,
                      }}
                    >
                      Calculated BMI
                    </p>
                    <p
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: "#D4AF37",
                      }}
                    >
                      {liveBmi}
                    </p>
                  </div>
                  {bmiInfo && (
                    <span className={`badge ${bmiInfo.cls}`}>
                      {bmiInfo.label}
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="submit"
                  className="btn btn-gold"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  <FiSave size={14} />
                  {loading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #1a1a1a",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "#9e9e9e",
        }}
      >
        {icon} {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>
        {value}
      </span>
    </div>
  );
}

function ProfileDetailRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid #1a1a1a",
      }}
    >
      <span style={{ fontSize: 13, color: "#9e9e9e", fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>
        {value}
      </span>
    </div>
  );
}

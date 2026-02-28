import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
} from "react-icons/fi";

const GENDERS = ["male", "female", "other"];

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState(null);

  const p = user?.profile;

  const [form, setForm] = useState({
    username: p?.username || "",
    age: p?.age || "",
    gender: p?.gender || "male",
    region: p?.region || "",
    height_cm: p?.height_cm || "",
    weight_kg: p?.weight_kg || "",
  });

  // Load active goal
  useEffect(() => {
    api
      .get("/goals/active")
      .then((r) => setGoal(r.data))
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
  }, [user]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

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
      });
      await refreshUser();
      toast.success("Profile updated!");
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setLoading(false);
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
            <h3
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#9e9e9e",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginBottom: 16,
              }}
            >
              <FiTarget size={13} style={{ marginRight: 6 }} />
              Active Goal
            </h3>
            {goal ? (
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
                    label="AI Score"
                    value={
                      <span style={{ color: "#D4AF37", fontWeight: 700 }}>
                        {Math.round(goal.ml_score * 100)}%
                      </span>
                    }
                  />
                )}
                <div style={{ marginTop: 16 }}>
                  <Link
                    to="/goal-setup"
                    className="btn btn-outline"
                    style={{ fontSize: 13, padding: "8px 16px" }}
                  >
                    ↺ Change / Reset Plan
                  </Link>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ color: "#9e9e9e", fontSize: 14, marginBottom: 16 }}>
                  No active goal set
                </p>
                <Link
                  to="/goal-setup"
                  className="btn btn-gold"
                  style={{ fontSize: 13 }}
                >
                  Set Fitness Goal
                </Link>
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

const GENDERS = ["male", "female", "other"];
const REGIONS = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa (KPK)",
  "Balochistan",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir (AJK)",
  "Islamabad Capital Territory",
  "Other",
];

export default function ProfileSetup() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: "",
    age: "",
    gender: "male",
    region: "",
    height_cm: "",
    weight_kg: "",
  });

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const bmi =
    form.height_cm && form.weight_kg
      ? (
          parseFloat(form.weight_kg) /
          (parseFloat(form.height_cm) / 100) ** 2
        ).toFixed(1)
      : null;

  const bmiCategory = bmi
    ? bmi < 18.5
      ? "Underweight"
      : bmi < 25
        ? "Normal"
        : bmi < 30
          ? "Overweight"
          : "Obese"
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const pendingPic =
        localStorage.getItem("flexa_pending_profile_pic") || undefined;
      await api.post("/users/me/profile", {
        ...form,
        age: parseInt(form.age) || null,
        height_cm: parseFloat(form.height_cm) || null,
        weight_kg: parseFloat(form.weight_kg) || null,
        profile_picture: pendingPic,
      });
      if (pendingPic) localStorage.removeItem("flexa_pending_profile_pic");
      await refreshUser();
      toast.success("Profile created! Now set your fitness goal.");
      navigate("/goal-setup");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="page-content"
      style={{ maxWidth: 600, margin: "0 auto", paddingTop: 48 }}
    >
      <div
        className="auth-logo"
        style={{ fontSize: 28, marginBottom: 6, textAlign: "center" }}
      >
        FLEXA
      </div>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>
          Build Your <span className="text-gold">Profile</span>
        </h1>
        <p style={{ color: "#9e9e9e", marginTop: 8, fontSize: 14 }}>
          Step 1 of 2 — Tell us about yourself
        </p>
      </div>

      <div className="card-gold-border">
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input
                className="form-input"
                name="username"
                placeholder="Your name"
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
                placeholder="25"
                min="13"
                max="100"
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
              <select
                className="form-select"
                name="region"
                value={form.region}
                onChange={handleChange}
              >
                <option value="">Select region</option>
                {REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Height (cm)</label>
              <input
                className="form-input"
                type="number"
                name="height_cm"
                placeholder="175"
                min="100"
                max="250"
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
                placeholder="75"
                min="30"
                max="300"
                value={form.weight_kg}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Live BMI preview */}
          {bmi && (
            <div
              style={{
                background: "rgba(255,107,53,0.06)",
                border: "1px solid rgba(255,107,53,0.2)",
                borderRadius: 10,
                padding: "16px 20px",
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ fontSize: 12, color: "#9e9e9e", marginBottom: 4 }}>
                  YOUR BMI
                </p>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#FF6B35" }}>
                  {bmi}
                </p>
              </div>
              <span
                className={`badge ${bmiCategory === "Normal" ? "badge-green" : bmiCategory === "Underweight" ? "badge-red" : "badge-gold"}`}
              >
                {bmiCategory}
              </span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-gold"
            style={{ width: "100%", marginTop: 8 }}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Profile & Continue →"}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { FiCamera, FiMail, FiPhone, FiLock } from "react-icons/fi";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";
const GOOGLE_AUTH_URL = `${API_BASE_URL.replace(/\/$/, "")}/auth/google`;

export default function Register() {
  const [form, setForm] = useState({ email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [profilePic, setProfilePic] = useState(null); // base64 data URL
  const picInputRef = useRef(null);
  const { register } = useAuth();
  const navigate = useNavigate();

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
    reader.onload = (ev) => {
      setProfilePic(ev.target.result);
      // Store temporarily so ProfileSetup can pick it up
      localStorage.setItem("flexa_pending_profile_pic", ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const result = await register(
        form.email,
        form.password,
        form.phone || undefined,
      );
      toast.success(
        result?.message || "Account created! Let's build your profile.",
      );
      navigate("/profile-setup");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">FLEXA</div>
        <p className="auth-tagline">CREATE YOUR ACCOUNT</p>

        <form onSubmit={handleSubmit}>
          {/* Profile Picture Upload */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              onClick={() => picInputRef.current?.click()}
              style={{
                position: "relative",
                width: 90,
                height: 90,
                borderRadius: "50%",
                background: profilePic
                  ? "transparent"
                  : "rgba(255,107,53,0.08)",
                border: "2px dashed rgba(255,107,53,0.5)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                padding: 0,
                transition: "border-color 0.2s",
              }}
            >
              {profilePic ? (
                <img
                  src={profilePic}
                  alt="Profile preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "50%",
                  }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <FiCamera size={24} color="#FF6B35" />
                  <span
                    style={{ fontSize: 10, color: "#9e9e9e", fontWeight: 600 }}
                  >
                    PHOTO
                  </span>
                </div>
              )}
            </button>
            <input
              ref={picInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePicChange}
            />
            <p
              style={{
                fontSize: 11,
                color: "#616161",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Profile photo (optional)
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              <FiMail
                size={14}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              Email
            </label>
            <input
              className="form-input"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
            <p style={{ marginTop: 6, fontSize: 12, color: "#9e9e9e" }}>
              Use your email here. You will set your username on the next step.
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">
              <FiPhone
                size={14}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              Phone (optional)
            </label>
            <input
              className="form-input"
              type="tel"
              name="phone"
              placeholder="+1 234 567 8900"
              value={form.phone}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <FiLock
                size={14}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              Password
            </label>
            <input
              className="form-input"
              type="password"
              name="password"
              placeholder="Min 8 characters"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <div
            style={{
              background: "rgba(255,107,53,0.08)",
              border: "1px solid rgba(255,107,53,0.2)",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
            }}
          >
            <p style={{ fontSize: 12, color: "#9e9e9e", lineHeight: 1.6 }}>
              By joining, you commit to consistency, hard work, and data-driven
              fitness progress.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-gold"
            style={{ width: "100%" }}
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="divider" style={{ margin: "24px 0" }} />

        <button
          className="btn btn-ghost"
          style={{ width: "100%" }}
          onClick={() => (window.location.href = GOOGLE_AUTH_URL)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            style={{ marginRight: 8, verticalAlign: "middle" }}
          >
            <path
              fill="#4285F4"
              d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
            />
            <path
              fill="#34A853"
              d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"
            />
            <path
              fill="#FBBC05"
              d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"
            />
            <path
              fill="#EA4335"
              d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"
            />
          </svg>
          Google Sign Up
        </button>

        <p
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: 14,
            color: "#9e9e9e",
          }}
        >
          Already have an account?&nbsp;
          <Link to="/login" style={{ color: "#00D4FF", fontWeight: 700 }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

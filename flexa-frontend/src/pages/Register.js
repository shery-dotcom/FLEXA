import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { FiCamera } from "react-icons/fi";

export default function Register() {
  const [form, setForm] = useState({ email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [profilePic, setProfilePic] = useState(null); // base64 data URL
  const picInputRef = useRef(null);
  const { register, login } = useAuth();
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
      await register(form.email, form.password, form.phone || undefined);
      // Auto-login immediately after registration
      await login(form.email, form.password);
      toast.success("Account created! Let's build your profile.");
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
        <p className="auth-tagline">START YOUR TRANSFORMATION</p>

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
                  : "rgba(212,175,55,0.08)",
                border: "2px dashed rgba(212,175,55,0.5)",
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
                  <FiCamera size={24} color="#D4AF37" />
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
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
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
            <label className="form-label">Password</label>
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
              background: "rgba(212,175,55,0.06)",
              border: "1px solid rgba(212,175,55,0.2)",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
            }}
          >
            <p style={{ fontSize: 12, color: "#9e9e9e", lineHeight: 1.6 }}>
              By registering you agree to train hard, stay consistent, and let
              AI guide your journey.
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

        <p
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: 14,
            color: "#9e9e9e",
          }}
        >
          Already have an account?&nbsp;
          <Link to="/login" style={{ color: "#D4AF37", fontWeight: 600 }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

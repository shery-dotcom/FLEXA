import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Register() {
  const [form, setForm] = useState({ email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

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

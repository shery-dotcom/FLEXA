import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { FiLock, FiMail } from "react-icons/fi";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";
const GOOGLE_AUTH_URL = `${API_BASE_URL.replace(/\/$/, "")}/auth/google`;

export default function Login() {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.identifier, form.password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Login failed. Check credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">FLEXA</div>
        <p className="auth-tagline">⚡ BACK TO YOUR GAINS</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <FiMail
                size={14}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              Email or Username
            </label>
            <input
              className="form-input"
              type="text"
              name="identifier"
              placeholder="you@example.com or your username"
              value={form.identifier}
              onChange={handleChange}
              required
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
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-gold"
            style={{ width: "100%", marginTop: 8 }}
            disabled={loading}
          >
            {loading ? "Signing in..." : "🔥 Let's Go"}
          </button>

          <p style={{ textAlign: "right", marginTop: 12, fontSize: 13 }}>
            <Link
              to="/forgot-password"
              style={{
                color: "#00D4FF",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Forgot password?
            </Link>
          </p>
        </form>

        <div className="divider" style={{ margin: "28px 0" }} />

        <button
          className="btn btn-ghost"
          style={{ width: "100%" }}
          onClick={() => (window.location.href = GOOGLE_AUTH_URL)}
        >
          <GoogleIcon /> Google Sign In
        </button>

        <p
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: 14,
            color: "#9e9e9e",
          }}
        >
          New to Flexa?&nbsp;
          <Link to="/register" style={{ color: "#FF6B35", fontWeight: 700 }}>
            Start Your Journey
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
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
  );
}

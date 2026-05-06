import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        new_password: form.password,
      });
      setDone(true);
      toast.success("Password reset! You can now log in.");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Reset failed. Link may have expired.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-box" style={{ textAlign: "center" }}>
          <div className="auth-logo">FLEXA</div>
          <p style={{ color: "#ef5350", marginTop: 20 }}>
            Invalid or missing reset token.
          </p>
          <Link
            to="/forgot-password"
            style={{ color: "var(--accent)", fontSize: 14 }}
          >
            Request a new reset link →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">FLEXA</div>
        <p className="auth-tagline">SET NEW PASSWORD</p>

        {!done ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">New Password</label>
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
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                className="form-input"
                type="password"
                name="confirm"
                placeholder="Re-enter password"
                value={form.confirm}
                onChange={handleChange}
                required
              />
            </div>

            {/* Password strength indicator */}
            {form.password && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: "var(--bg-tertiary)",
                    overflow: "hidden",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width:
                        form.password.length >= 12
                          ? "100%"
                          : form.password.length >= 8
                            ? "66%"
                            : "33%",
                      background:
                        form.password.length >= 12
                          ? "#4caf50"
                          : form.password.length >= 8
                            ? "var(--accent)"
                            : "#ef5350",
                      transition: "width 0.3s, background 0.3s",
                    }}
                  />
                </div>
                <p style={{ fontSize: 11, color: "#616161" }}>
                  {form.password.length >= 12
                    ? "Strong password"
                    : form.password.length >= 8
                      ? "Good password"
                      : "Weak — too short"}
                </p>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-gold"
              style={{ width: "100%", marginTop: 8 }}
              disabled={loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ fontWeight: 700, marginBottom: 10 }}>
              Password Updated!
            </h3>
            <p style={{ color: "var(--text-tertiary)", fontSize: 14, marginBottom: 24 }}>
              Your password has been successfully reset.
            </p>
            <button
              className="btn btn-gold"
              style={{ width: "100%" }}
              onClick={() => navigate("/login")}
            >
              Go to Login
            </button>
          </div>
        )}

        {!done && (
          <>
            <div className="divider" style={{ margin: "28px 0" }} />
            <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-tertiary)" }}>
              <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
                ← Back to Login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}




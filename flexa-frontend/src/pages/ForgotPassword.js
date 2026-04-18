import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState(null); // demo: show token in UI

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setSent(true);
      // In dev mode the API returns the token directly for demo
      if (res.data?.reset_token) setDevToken(res.data.reset_token);
      toast.success("Reset instructions sent!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">FLEXA</div>
        <p className="auth-tagline">PASSWORD RECOVERY</p>

        {!sent ? (
          <>
            <p
              style={{
                color: "#9e9e9e",
                fontSize: 14,
                textAlign: "center",
                marginBottom: 28,
                lineHeight: 1.6,
              }}
            >
              Enter your registered email address and we'll send you a password
              reset link.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-gold"
                style={{ width: "100%", marginTop: 8 }}
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 48,
                marginBottom: 16,
              }}
            >
              📧
            </div>
            <h3 style={{ fontWeight: 700, marginBottom: 10 }}>
              Check Your Email
            </h3>
            <p
              style={{
                color: "#9e9e9e",
                fontSize: 14,
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              If <span style={{ color: "#D4AF37" }}>{email}</span> is registered
              with Flexa, you'll receive a reset link shortly.
            </p>

            {/* Demo: show reset token + link for dev/demo purposes */}
            {devToken && (
              <div
                style={{
                  background: "rgba(212,175,55,0.06)",
                  border: "1px solid rgba(212,175,55,0.25)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  marginBottom: 20,
                  textAlign: "left",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: "#D4AF37",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Demo Mode — Reset Link
                </p>
                <Link
                  to={`/reset-password?token=${devToken}`}
                  style={{
                    color: "#D4AF37",
                    fontSize: 13,
                    wordBreak: "break-all",
                    textDecoration: "underline",
                  }}
                >
                  Click here to reset your password →
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="divider" style={{ margin: "28px 0" }} />
        <p style={{ textAlign: "center", fontSize: 14, color: "#9e9e9e" }}>
          Remembered it?&nbsp;
          <Link to="/login" style={{ color: "#D4AF37", fontWeight: 600 }}>
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}



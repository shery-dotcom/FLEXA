import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * /auth/google/success
 *
 * Google redirects the browser here after OAuth with:
 *   #access_token=...&refresh_token=...
 *
 * This page stores the tokens then navigates into the app.
 */
export default function GoogleAuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const fragment = new URLSearchParams(
      window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash,
    );
    const accessToken =
      fragment.get("access_token") || searchParams.get("access_token");
    const refreshToken =
      fragment.get("refresh_token") || searchParams.get("refresh_token");

    if (!accessToken) {
      // Something went wrong — send back to login with error
      navigate("/login?error=google_failed", { replace: true });
      return;
    }

    localStorage.setItem("access_token", accessToken);
    if (refreshToken) localStorage.setItem("refresh_token", refreshToken);

    window.history.replaceState({}, document.title, window.location.pathname);

    // Reload user from API then redirect
    refreshUser().then(() => {
      navigate("/dashboard", { replace: true });
    });
  }, [navigate, refreshUser, searchParams]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "#e8e8e8",
        gap: 16,
      }}
    >
      <div className="spinner" />
      <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>Signing you in…</p>
    </div>
  );
}


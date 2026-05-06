import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/users/me");
      setUser(res.data);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (identifier, password) => {
    const res = await api.post("/auth/login", {
      identifier: String(identifier || "").trim(),
      password,
    });
    const accessToken = res.data.access_token;
    const refreshToken = res.data.refresh_token;

    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);

    // Optimistic auth hydration makes navigation instant after successful login.
    const payload = decodeJwtPayload(accessToken);
    if (payload?.sub || payload?.email) {
      setUser((prev) => ({
        id: payload.sub || prev?.id,
        email: payload.email || prev?.email,
        role: payload.role || prev?.role || "user",
        profile: prev?.profile || {},
      }));
    }

    // Refresh full user data in the background.
    await fetchMe();
    return res.data;
  };

  const register = async (email, password, phone) => {
    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error("Email and password are required");
      }
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      if (!email.includes("@")) {
        throw new Error("Please enter a valid email address");
      }

      console.log("[AUTH] Attempting registration for:", email);

      const res = await api.post("/auth/register", {
        email: email.trim().toLowerCase(),
        password: password.trim(),
        phone: phone ? phone.trim() : null,
      });

      console.log("[AUTH] Registration response:", res.data);

      const accessToken = res.data?.access_token;
      const refreshToken = res.data?.refresh_token;

      if (accessToken && refreshToken) {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        await fetchMe();
        return res.data;
      }

      // Backward compatibility for servers returning only {message} from /auth/register.
      if (res.data?.message) {
        try {
          await login(email, password);
          return {
            ...res.data,
            message: res.data?.message || "Account created and signed in.",
          };
        } catch (loginErr) {
          console.warn(
            "[AUTH] Auto-login after registration failed:",
            loginErr,
          );
          return res.data; // Return registration response even if auto-login fails
        }
      }

      return res.data;
    } catch (err) {
      console.error("[AUTH] Registration error:", err);

      const detail = String(
        err?.response?.data?.detail || err.message || "",
      ).toLowerCase();
      const status = err?.response?.status;

      // Handle network/CORS errors
      if (!err.response) {
        console.error(
          "[AUTH] Network error - check backend connection:",
          err.message,
        );
        throw new Error(
          "Network error. Please check your internet connection and try again.",
        );
      }

      // Handle specific error cases
      if (
        detail.includes("already registered") ||
        detail.includes("already exists")
      ) {
        try {
          await login(email, password);
          return { message: "Account already exists. Signed you in." };
        } catch (loginErr) {
          throw new Error(
            "Email already registered. Use correct password to sign in.",
          );
        }
      }

      if (detail.includes("google sign-in")) {
        throw new Error(
          "This account uses Google sign-in. Please use 'Continue with Google'.",
        );
      }

      if (detail.includes("phone")) {
        throw new Error("This phone number is already registered.");
      }

      if (status === 500) {
        throw new Error("Server error. Please try again in a moment.");
      }

      if (detail.includes("invalid") || detail.includes("failed")) {
        throw new Error(
          "Registration failed. Please check your details and try again.",
        );
      }

      // Fallback error message
      throw new Error(
        err?.response?.data?.detail || "Registration failed. Please try again.",
      );
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout"); // invalidate token server-side
    } catch {
      // silent — proceed with local logout even if server unreachable
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    await fetchMe();
  }, [fetchMe]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

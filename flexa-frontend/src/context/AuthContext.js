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
      const res = await api.post("/auth/register", { email, password, phone });
      return res.data;
    } catch (err) {
      const detail = String(err?.response?.data?.detail || "").toLowerCase();
      if (detail.includes("already registered")) {
        await login(email, password);
        return { message: "Account already existed. Signed you in instead." };
      }
      throw err;
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

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProfileSetup from "./pages/ProfileSetup";
import GoalSetup from "./pages/GoalSetup";
import WorkoutPlanner from "./pages/WorkoutPlanner";
import Dashboard from "./pages/Dashboard";
import Progress from "./pages/Progress";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DietPlanner from "./pages/DietPlanner";
import CalorieEstimator from "./pages/CalorieEstimator";
import Chatbot from "./pages/Chatbot";

// Guard: logged in but no profile → send to profile-setup
function OnboardingGuard({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (!user.profile) return <Navigate to="/profile-setup" />;
  return children;
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#0a0a0a",
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page">
      {user && <Navbar />}
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/register"
          element={!user ? <Register /> : <Navigate to="/dashboard" />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Onboarding routes — accessible even without profile */}
        <Route
          path="/profile-setup"
          element={
            <ProtectedRoute>
              <ProfileSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/goal-setup"
          element={
            <ProtectedRoute>
              <GoalSetup />
            </ProtectedRoute>
          }
        />

        {/* Profile page — always available once logged in */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Main app routes — require completed profile */}
        <Route
          path="/workouts"
          element={
            <OnboardingGuard>
              <WorkoutPlanner />
            </OnboardingGuard>
          }
        />
        <Route
          path="/dashboard"
          element={
            <OnboardingGuard>
              <Dashboard />
            </OnboardingGuard>
          }
        />
        <Route
          path="/progress"
          element={
            <OnboardingGuard>
              <Progress />
            </OnboardingGuard>
          }
        />
        <Route
          path="/diet-planner"
          element={
            <OnboardingGuard>
              <DietPlanner />
            </OnboardingGuard>
          }
        />
        <Route
          path="/calorie-estimator"
          element={
            <OnboardingGuard>
              <CalorieEstimator />
            </OnboardingGuard>
          }
        />
        <Route
          path="/chatbot"
          element={
            <OnboardingGuard>
              <Chatbot />
            </OnboardingGuard>
          }
        />

        {/* Default */}
        <Route
          path="/"
          element={<Navigate to={user ? "/dashboard" : "/login"} />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;

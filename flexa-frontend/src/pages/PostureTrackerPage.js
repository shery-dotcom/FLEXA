import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PoseTracker from "../components/PoseTracker";
import { normalizeExercise } from "../utils/repCounter";

export default function PostureTrackerPage() {
  const [searchParams] = useSearchParams();

  const requestedExercise = useMemo(
    () => normalizeExercise(searchParams.get("exercise") || "squat"),
    [searchParams],
  );
  const requestedExerciseName =
    searchParams.get("exerciseName") || "Active exercise";
  const hasWorkoutContext = searchParams.get("mode") === "workout";
  const trackerExercise = hasWorkoutContext ? requestedExercise : "squat";

  return (
    <div className="page-content">
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
          Posture <span className="text-gold">Tracker</span>
        </h1>
        <p style={{ color: "var(--text-tertiary)", fontSize: 14, marginBottom: 18 }}>
          Select body part and exercise to start real-time posture tracking.
        </p>

        {hasWorkoutContext && (
          <p style={{ color: "#7f7f7f", fontSize: 12, marginBottom: 12 }}>
            Active workout detected: {requestedExerciseName}
          </p>
        )}

        <PoseTracker key={trackerExercise} exercise={trackerExercise} />
      </div>
    </div>
  );
}


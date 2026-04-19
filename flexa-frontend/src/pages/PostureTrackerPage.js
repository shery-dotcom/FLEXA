import { useMemo, useState } from "react";
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
  const [trackingMode, setTrackingMode] = useState(
    hasWorkoutContext ? "workout" : "manual",
  );

  const trackerExercise =
    trackingMode === "workout" && hasWorkoutContext
      ? requestedExercise
      : "squat";

  return (
    <div className="page-content">
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
          Posture <span className="text-gold">Tracker</span>
        </h1>
        <p style={{ color: "#9e9e9e", fontSize: 14, marginBottom: 18 }}>
          Real-time posture tracking grouped by Upper Body, Lower Body, and Core
          / Stability exercises with MediaPipe Pose. Video stays on-device.
        </p>

        {hasWorkoutContext && (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn btn-ghost"
              onClick={() => setTrackingMode("workout")}
              style={{
                borderColor: trackingMode === "workout" ? "#00e5ff" : undefined,
                color: trackingMode === "workout" ? "#00e5ff" : undefined,
              }}
            >
              Use active workout: {requestedExerciseName}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setTrackingMode("manual")}
              style={{
                borderColor: trackingMode === "manual" ? "#D4AF37" : undefined,
                color: trackingMode === "manual" ? "#D4AF37" : undefined,
              }}
            >
              Manual mode (any exercise)
            </button>
          </div>
        )}

        <PoseTracker
          key={`${trackingMode}-${trackerExercise}`}
          exercise={trackerExercise}
        />
      </div>
    </div>
  );
}

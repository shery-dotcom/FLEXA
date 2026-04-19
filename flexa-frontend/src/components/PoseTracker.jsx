import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pose } from "@mediapipe/pose";
import api from "../api/axios";
import WebcamCanvas from "./WebcamCanvas";
import {
  getJointAngles,
  DEFAULT_EXERCISE_ZONE,
  getExerciseZoneCoverage,
} from "../utils/angleUtils";
import {
  createRepCounter,
  updateRepCounter,
  SUPPORTED_EXERCISES,
  EXERCISE_GROUPS,
  normalizeExercise,
  getExerciseLabel,
} from "../utils/repCounter";
import {
  evaluateExercisePosture,
  calculateSessionPostureScore,
} from "../utils/postureRules";

const FPS_TARGET = 12;
const FRAME_INTERVAL_MS = Math.round(1000 / FPS_TARGET);
const ZONE_MIN_RATIO = 0.45;
const INJURY_TRIGGER_STREAK = 8;
const INJURY_RELEASE_STREAK = 4;
const BEEP_COOLDOWN_MS = 2200;

const FLAG_RISK_RULES = {
  back_not_straight: {
    severity: "high",
    hint: "Keep your spine neutral and avoid rounding your back.",
  },
  too_much_rounding: {
    severity: "high",
    hint: "Reduce load and keep chest lifted to protect your lower back.",
  },
  hips_sagging: {
    severity: "high",
    hint: "Brace your core and keep your hips in line with your shoulders.",
  },
  arching_back: {
    severity: "high",
    hint: "Do not over-arch. Keep ribs down and core tight.",
  },
  elbows_moving: {
    severity: "medium",
    hint: "Keep elbows stable and close to your torso.",
  },
  knees_not_aligned: {
    severity: "high",
    hint: "Track your knees over your toes and avoid inward collapse.",
  },
  uneven_depth: {
    severity: "medium",
    hint: "Control depth evenly on both sides.",
  },
  too_deep_or_collapsing: {
    severity: "medium",
    hint: "Do not force depth. Keep control through the full rep.",
  },
  too_deep: {
    severity: "medium",
    hint: "Reduce depth slightly and maintain control.",
  },
  torso_lean: {
    severity: "medium",
    hint: "Keep torso more upright and engage your core.",
  },
  torso_swinging: {
    severity: "medium",
    hint: "Avoid swinging. Slow down the rep and isolate the movement.",
  },
  uneven_elbow_drive: {
    severity: "medium",
    hint: "Press evenly from both arms.",
  },
  uneven_press: {
    severity: "medium",
    hint: "Keep both arms moving symmetrically.",
  },
  uneven_drive: {
    severity: "medium",
    hint: "Push through both legs evenly.",
  },
  too_much_knee_bend: {
    severity: "medium",
    hint: "Hinge from your hips more and keep shins controlled.",
  },
};

function assessInjuryRisk(posture, zoneCoverageRatio) {
  const flags = posture?.flags || [];
  const hints = [];
  let highRiskFlagCount = 0;

  flags.forEach((flag) => {
    const rule = FLAG_RISK_RULES[flag];
    if (!rule) return;
    if (rule.severity === "high") highRiskFlagCount += 1;
    if (!hints.includes(rule.hint)) hints.push(rule.hint);
  });

  if (zoneCoverageRatio < 0.3) {
    hints.push("Stay centered in frame so tracking remains accurate.");
  }

  const lowScoreRisk = (posture?.score ?? 100) <= 45;
  const isRisk = highRiskFlagCount > 0 || lowScoreRisk;
  const severity =
    highRiskFlagCount > 0 ? "high" : lowScoreRisk ? "medium" : "none";

  if (!hints.length && isRisk) {
    hints.push("Slow down and reset your posture before the next rep.");
  }

  return {
    isRisk,
    severity,
    title:
      severity === "high"
        ? "Injury Risk Alert"
        : severity === "medium"
          ? "Posture Warning"
          : "",
    hints,
  };
}

const POSE_CONNECTIONS = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 12],
  [23, 24],
  [11, 23],
  [12, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 28],
];

function drawSkeleton(canvas, landmarks, zone) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  if (!landmarks?.length) return;

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#00e5ff";
  ctx.fillStyle = "#D4AF37";

  POSE_CONNECTIONS.forEach(([from, to]) => {
    const p1 = landmarks[from];
    const p2 = landmarks[to];
    if (!p1 || !p2) return;
    if ((p1.visibility ?? 1) < 0.35 || (p2.visibility ?? 1) < 0.35) return;

    ctx.beginPath();
    ctx.moveTo(p1.x * width, p1.y * height);
    ctx.lineTo(p2.x * width, p2.y * height);
    ctx.stroke();
  });

  landmarks.forEach((p) => {
    if (!p || (p.visibility ?? 1) < 0.45) return;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (zone) {
    ctx.save();
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(
      zone.xMin * width,
      zone.yMin * height,
      (zone.xMax - zone.xMin) * width,
      (zone.yMax - zone.yMin) * height,
    );
    ctx.restore();
  }
}

export default function PoseTracker({ exercise = "squat" }) {
  const initialExercise = useMemo(
    () => normalizeExercise(exercise),
    [exercise],
  );
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const poseRef = useRef(null);
  const rafRef = useRef(null);
  const busyRef = useRef(false);
  const lastFrameAtRef = useRef(0);

  const sessionStartRef = useRef(null);
  const repCounterRef = useRef(createRepCounter(initialExercise));
  const scoreSamplesRef = useRef([]);
  const riskStreakRef = useRef(0);
  const safeStreakRef = useRef(0);
  const lastBeepAtRef = useRef(0);
  const audioContextRef = useRef(null);

  const [isRunning, setIsRunning] = useState(false);
  const [reps, setReps] = useState(0);
  const [feedback, setFeedback] = useState("Ready");
  const [repHint, setRepHint] = useState("Start moving to count reps.");
  const [postureScore, setPostureScore] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState("lower");
  const [selectedExercise, setSelectedExercise] = useState(initialExercise);
  const [injuryAlert, setInjuryAlert] = useState({
    active: false,
    title: "",
    hints: [],
    severity: "none",
  });

  const playAlertBeep = useCallback(() => {
    try {
      const now = Date.now();
      if (now - lastBeepAtRef.current < BEEP_COOLDOWN_MS) return;
      lastBeepAtRef.current = now;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioContextRef.current || new Ctx();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(820, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(680, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // Audio can fail on some browsers without prior gesture; keep UI alerts active.
    }
  }, []);

  useEffect(() => {
    if (isRunning) return;
    setSelectedExercise(initialExercise);
    if ((EXERCISE_GROUPS[0]?.exercises || []).includes(initialExercise)) {
      setSelectedGroup("upper");
    } else if (
      (EXERCISE_GROUPS[2]?.exercises || []).includes(initialExercise)
    ) {
      setSelectedGroup("core");
    } else {
      setSelectedGroup("lower");
    }
  }, [initialExercise, isRunning]);

  const groupOptions = useMemo(
    () => [
      { value: "upper", label: "Upper" },
      { value: "lower", label: "Lower" },
      { value: "core", label: "Core" },
    ],
    [],
  );

  const exercisesByGroup = useMemo(
    () => ({
      upper: EXERCISE_GROUPS[0]?.exercises || [],
      lower: EXERCISE_GROUPS[1]?.exercises || [],
      core: EXERCISE_GROUPS[2]?.exercises || [],
    }),
    [],
  );

  const exerciseOptions = useMemo(
    () =>
      (exercisesByGroup[selectedGroup] || [])
        .filter((mode) => SUPPORTED_EXERCISES.includes(mode))
        .map((mode) => ({ value: mode, label: getExerciseLabel(mode) })),
    [exercisesByGroup, selectedGroup],
  );

  useEffect(() => {
    if (isRunning) return;
    const nextOptions = exercisesByGroup[selectedGroup] || [];
    if (!nextOptions.includes(selectedExercise) && nextOptions.length > 0) {
      setSelectedExercise(nextOptions[0]);
    }
  }, [selectedGroup, selectedExercise, exercisesByGroup, isRunning]);

  const elapsedLabel = useMemo(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [seconds]);

  const resetSession = useCallback(() => {
    repCounterRef.current = createRepCounter(selectedExercise);
    scoreSamplesRef.current = [];
    setReps(0);
    setFeedback("Ready");
    setRepHint("Start moving to count reps.");
    setPostureScore(0);
    setSeconds(0);
    riskStreakRef.current = 0;
    safeStreakRef.current = 0;
    lastBeepAtRef.current = 0;
    setInjuryAlert({ active: false, title: "", hints: [], severity: "none" });
    sessionStartRef.current = Date.now();
  }, [selectedExercise, playAlertBeep]);

  useEffect(() => {
    if (isRunning) return;
    resetSession();
  }, [selectedExercise, isRunning, resetSession]);

  const handleCameraReady = useCallback(() => {
    // Reserved for future hooks (permissions, warmup telemetry).
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const tick = setInterval(() => {
      if (!sessionStartRef.current) return;
      setSeconds(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [isRunning]);

  useEffect(() => {
    const pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      drawSkeleton(canvas, results.poseLandmarks, DEFAULT_EXERCISE_ZONE);

      if (!results.poseLandmarks?.length) {
        setFeedback("Move into camera frame");
        setRepHint("No landmarks detected yet.");
        safeStreakRef.current += 1;
        if (safeStreakRef.current >= INJURY_RELEASE_STREAK) {
          riskStreakRef.current = 0;
          setInjuryAlert({
            active: false,
            title: "",
            hints: [],
            severity: "none",
          });
        }
        return;
      }

      const zoneCoverage = getExerciseZoneCoverage(
        results.poseLandmarks,
        DEFAULT_EXERCISE_ZONE,
      );
      let zoneWarning = "";
      if (zoneCoverage.ratio < ZONE_MIN_RATIO) {
        zoneWarning = " Stay near center box.";
        setRepHint("Move closer to the cyan zone for better tracking.");
      }

      const angles = getJointAngles(results.poseLandmarks);
      const counterState = updateRepCounter(
        repCounterRef.current,
        selectedExercise,
        angles,
        Date.now(),
        "lenient",
      );

      if (counterState.didCount) {
        setReps(counterState.reps);
        setRepHint("Great, rep counted.");
      } else if (counterState.hint) {
        setRepHint(counterState.hint);
      }

      const posture = evaluateExercisePosture(
        selectedExercise,
        results.poseLandmarks,
        angles,
      );

      const injuryRisk = assessInjuryRisk(posture, zoneCoverage.ratio);
      if (injuryRisk.isRisk) {
        riskStreakRef.current += 1;
        safeStreakRef.current = 0;

        if (riskStreakRef.current >= INJURY_TRIGGER_STREAK) {
          setInjuryAlert({
            active: true,
            title: injuryRisk.title,
            hints: injuryRisk.hints,
            severity: injuryRisk.severity,
          });
          playAlertBeep();
        }
      } else {
        safeStreakRef.current += 1;
        if (safeStreakRef.current >= INJURY_RELEASE_STREAK) {
          riskStreakRef.current = 0;
          setInjuryAlert({
            active: false,
            title: "",
            hints: [],
            severity: "none",
          });
        }
      }

      scoreSamplesRef.current.push(posture.score);
      setPostureScore(posture.score);
      setFeedback(`${posture.message}${zoneWarning}`.trim());
    });

    poseRef.current = pose;

    return () => {
      poseRef.current = null;
    };
  }, [selectedExercise]);

  const frameLoop = useCallback(async () => {
    if (!isRunning) return;

    const now = performance.now();
    if (now - lastFrameAtRef.current < FRAME_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(frameLoop);
      return;
    }

    const video = videoRef.current;
    const pose = poseRef.current;

    if (video && pose && video.readyState >= 2 && !busyRef.current) {
      try {
        busyRef.current = true;
        await pose.send({ image: video });
        lastFrameAtRef.current = now;
      } catch {
        // Keep loop alive even if one frame fails.
      } finally {
        busyRef.current = false;
      }
    }

    rafRef.current = requestAnimationFrame(frameLoop);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    rafRef.current = requestAnimationFrame(frameLoop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, frameLoop]);

  const handleStart = () => {
    resetSession();
    setIsRunning(true);
  };

  const handleStopAndSave = async () => {
    setIsRunning(false);

    const duration = Math.max(1, Math.floor(seconds));
    const sessionPostureScore = calculateSessionPostureScore(
      scoreSamplesRef.current,
    );

    try {
      await api.post("/workout/session", {
        exercise: selectedExercise,
        reps: repCounterRef.current.reps,
        duration,
        posture_score: sessionPostureScore,
      });
    } catch {
      // Keep UI responsive; history section indicates persistence state on next load.
    }

    setPostureScore(sessionPostureScore);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          position: "relative",
          borderRadius: 12,
          border: injuryAlert.active
            ? "2px solid rgba(255,82,82,0.9)"
            : "1px solid transparent",
          boxShadow: injuryAlert.active
            ? "0 0 0 3px rgba(255,82,82,0.22), 0 0 28px rgba(255,82,82,0.2)"
            : "none",
          overflow: "hidden",
        }}
      >
        <WebcamCanvas
          videoRef={videoRef}
          canvasRef={canvasRef}
          isRunning={isRunning}
          onReady={handleCameraReady}
        />

        {injuryAlert.active && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              background: "rgba(120, 12, 18, 0.88)",
              border: "1px solid rgba(255,120,120,0.8)",
              borderRadius: 10,
              padding: "10px 12px",
              color: "#ffdede",
            }}
          >
            <p style={{ margin: 0, fontWeight: 800, fontSize: 13 }}>
              {injuryAlert.title}
            </p>
            {injuryAlert.hints.slice(0, 2).map((hint) => (
              <p key={hint} style={{ margin: "6px 0 0", fontSize: 12 }}>
                - {hint}
              </p>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <StatCard label="Exercise" value={getExerciseLabel(selectedExercise)} />
        <StatCard label="Reps" value={String(reps)} />
        <StatCard label="Time" value={elapsedLabel} />
        <StatCard label="Posture" value={`${postureScore}%`} />
      </div>

      <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <label
          htmlFor="body-part-picker"
          style={{ fontSize: 12, color: "#9e9e9e", textTransform: "uppercase" }}
        >
          Body Part
        </label>
        <select
          id="body-part-picker"
          value={selectedGroup}
          disabled={isRunning}
          onChange={(e) => setSelectedGroup(e.target.value)}
          style={{
            background: "#111",
            color: "#d7d7d7",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          {groupOptions.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </select>

        <label
          htmlFor="exercise-picker"
          style={{ fontSize: 12, color: "#9e9e9e", textTransform: "uppercase" }}
        >
          Exercise
        </label>
        <select
          id="exercise-picker"
          value={selectedExercise}
          disabled={isRunning || exerciseOptions.length === 0}
          onChange={(e) => setSelectedExercise(e.target.value)}
          style={{
            background: "#111",
            color: "#d7d7d7",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            padding: "10px 12px",
            textTransform: "capitalize",
          }}
        >
          {exerciseOptions.length === 0 && <option>No exercises</option>}
          {exerciseOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          border: "1px solid #2a2a2a",
          borderRadius: 10,
          padding: "10px 12px",
          background: "#101418",
          maxWidth: 520,
        }}
      >
        <p
          style={{
            margin: 0,
            marginBottom: 6,
            fontSize: 12,
            color: "#9e9e9e",
            textTransform: "uppercase",
          }}
        >
          Rep Assistant ({getExerciseLabel(selectedExercise)})
        </p>
        <p
          style={{ margin: 0, fontSize: 13, color: "#8fd3ff", fontWeight: 700 }}
        >
          {repHint}
        </p>
      </div>

      <div
        style={{
          border: injuryAlert.active
            ? "1px solid rgba(255,82,82,0.65)"
            : "1px solid #2a2a2a",
          borderRadius: 10,
          padding: "12px 14px",
          color: injuryAlert.active
            ? "#ff9c9c"
            : feedback === "Good form"
              ? "#4caf50"
              : "#ff9800",
          fontWeight: 700,
          background: injuryAlert.active ? "#2a0d10" : "#111",
        }}
      >
        {injuryAlert.active ? `${injuryAlert.title}: ${feedback}` : feedback}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {!isRunning ? (
          <button className="btn btn-gold" onClick={handleStart}>
            Start Tracking
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={handleStopAndSave}>
            Stop & Save Session
          </button>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid #2a2a2a",
        borderRadius: 10,
        background: "#111",
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 11, color: "#777", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#D4AF37" }}>
        {value}
      </div>
    </div>
  );
}

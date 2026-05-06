import { POSE_LANDMARKS } from "./angleUtils";
import { normalizeExercise } from "./repCounter";

// Injury severity & recovery advice mapping
export const INJURY_DATABASE = {
  back_not_straight: {
    severity: "high",
    recovery: "Keep spine neutral. Reduce weight if needed. Strengthen core.",
  },
  too_much_rounding: {
    severity: "high",
    recovery: "Stop. Reset posture. Do lighter reps with perfect form.",
  },
  hips_sagging: {
    severity: "high",
    recovery: "Engage glutes & core. Reduce reps or load.",
  },
  arching_back: {
    severity: "high",
    recovery: "Lower ribs, tighten core. Avoid over-arching.",
  },
  knees_not_aligned: {
    severity: "high",
    recovery: "Push knees outward. Avoid inward collapse.",
  },
  uneven_depth: {
    severity: "medium",
    recovery: "Match depth on both sides. Slow down tempo.",
  },
  too_deep_or_collapsing: {
    severity: "medium",
    recovery: "Reduce depth slightly. Maintain control.",
  },
  too_deep: {
    severity: "medium",
    recovery: "Shorten range of motion. Control the movement.",
  },
  elbows_moving: {
    severity: "medium",
    recovery: "Keep elbows close to body. Reduce weight.",
  },
  uneven_elbow_drive: {
    severity: "medium",
    recovery: "Press both arms evenly. Lighter load.",
  },
  uneven_press: {
    severity: "medium",
    recovery: "Balance both arms. Check shoulder alignment.",
  },
  uneven_drive: {
    severity: "medium",
    recovery: "Push evenly through both legs.",
  },
  too_much_knee_bend: {
    severity: "medium",
    recovery: "Hinge more from hips. Engage posterior chain.",
  },
  torso_lean: {
    severity: "medium",
    recovery: "Keep torso upright. Engage core.",
  },
  torso_swinging: {
    severity: "high",
    recovery: "Slow down. Avoid momentum. Isolate movement.",
  },
  low_visibility: { severity: "low", recovery: "Move closer to camera." },
  no_detection: { severity: "low", recovery: "Ensure full body is visible." },
};

function isVisible(p, threshold = 0.45) {
  return !!p && (p.visibility ?? 1) >= threshold;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getInjuryDetails(flags) {
  // Get first high-severity injury flag
  for (const flag of flags) {
    const injury = INJURY_DATABASE[flag];
    if (injury?.severity === "high") {
      return { type: flag, severity: "high", recovery: injury.recovery };
    }
  }
  // Fall back to first flag if no high severity
  if (flags.length > 0) {
    const flag = flags[0];
    const injury = INJURY_DATABASE[flag];
    return {
      type: flag,
      severity: injury?.severity || "low",
      recovery: injury?.recovery || "Adjust form.",
    };
  }
  return null;
}

function basicVisibilityCheck(landmarks) {
  const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const lKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
  const rKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];

  if (
    !isVisible(lShoulder) ||
    !isVisible(rShoulder) ||
    !isVisible(lKnee) ||
    !isVisible(rKnee)
  ) {
    const flags = ["low_visibility"];
    return {
      score: 40,
      message: "Move into camera frame",
      flags,
      injury: getInjuryDetails(flags),
    };
  }

  return null;
}

function evaluateSquatPosture(landmarks, angles) {
  if (!landmarks || !angles) {
    const flags = ["no_detection"];
    return {
      score: 0,
      message: "No body detected",
      flags,
      injury: getInjuryDetails(flags),
    };
  }

  const visibilityIssue = basicVisibilityCheck(landmarks);
  if (visibilityIssue) return visibilityIssue;

  const flags = [];
  let score = 100;

  // Back control check (uses shoulder-hip-knee angle around the hip)
  if (angles.hipBack < 150) {
    flags.push("back_not_straight");
    score -= 30;
  }

  // Knee alignment check keeps left/right movement balanced.
  const kneeGap = Math.abs(angles.leftKnee - angles.rightKnee);
  if (kneeGap > 25) {
    flags.push("knees_not_aligned");
    score -= 20;
  }

  // Depth consistency check for squats.
  if (angles.avgKnee < 75) {
    flags.push("too_deep_or_collapsing");
    score -= 15;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let message = "Good form";
  if (flags.includes("back_not_straight")) {
    message = "Keep your back straight";
  } else if (flags.includes("knees_not_aligned")) {
    message = "Keep your knees aligned";
  } else if (flags.includes("too_deep_or_collapsing")) {
    message = "Control squat depth";
  }

  return { score, message, flags, injury: getInjuryDetails(flags) };
}

function evaluatePushupPosture(landmarks, angles) {
  const visibilityIssue = basicVisibilityCheck(landmarks);
  if (visibilityIssue) return visibilityIssue;

  const flags = [];
  let score = 100;

  if (angles.hipBack < 145) {
    flags.push("hips_sagging");
    score -= 30;
  }

  const elbowGap = Math.abs(angles.leftElbow - angles.rightElbow);
  if (elbowGap > 20) {
    flags.push("uneven_elbow_drive");
    score -= 20;
  }

  if (angles.avgElbow < 60) {
    flags.push("too_deep");
    score -= 10;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let message = "Good form";
  if (flags.includes("hips_sagging")) {
    message = "Keep your core tight and back straight";
  } else if (flags.includes("uneven_elbow_drive")) {
    message = "Push evenly from both arms";
  } else if (flags.includes("too_deep")) {
    message = "Control your depth";
  }

  return { score, message, flags, injury: getInjuryDetails(flags) };
}

function evaluateBicepCurlPosture(landmarks, angles) {
  const lShoulder = landmarks?.[POSE_LANDMARKS.LEFT_SHOULDER];
  const rShoulder = landmarks?.[POSE_LANDMARKS.RIGHT_SHOULDER];
  const lElbow = landmarks?.[POSE_LANDMARKS.LEFT_ELBOW];
  const rElbow = landmarks?.[POSE_LANDMARKS.RIGHT_ELBOW];

  if (
    !isVisible(lShoulder) ||
    !isVisible(rShoulder) ||
    !isVisible(lElbow) ||
    !isVisible(rElbow)
  ) {
    const flags = ["low_visibility"];
    return {
      score: 40,
      message: "Move into camera frame",
      flags,
      injury: getInjuryDetails(flags),
    };
  }

  const flags = [];
  let score = 100;

  const leftDrift = Math.abs(lElbow.x - lShoulder.x);
  const rightDrift = Math.abs(rElbow.x - rShoulder.x);
  const drift = Math.max(leftDrift, rightDrift);

  if (drift > 0.12) {
    flags.push("elbows_moving");
    score -= 25;
  }

  if (angles.hipBack < 150) {
    flags.push("torso_swinging");
    score -= 20;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let message = "Good form";
  if (flags.includes("elbows_moving")) {
    message = "Keep elbows close to your torso";
  } else if (flags.includes("torso_swinging")) {
    message = "Avoid torso swinging";
  }

  return { score, message, flags, injury: getInjuryDetails(flags) };
}

function evaluateLungePosture(landmarks, angles) {
  const visibilityIssue = basicVisibilityCheck(landmarks);
  if (visibilityIssue) return visibilityIssue;

  const flags = [];
  let score = 100;

  const kneeGap = Math.abs(angles.leftKnee - angles.rightKnee);
  if (kneeGap > 40) {
    flags.push("uneven_depth");
    score -= 20;
  }

  if (angles.hipBack < 145) {
    flags.push("torso_lean");
    score -= 25;
  }

  if (angles.minKnee < 70) {
    flags.push("too_deep");
    score -= 10;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let message = "Good form";
  if (flags.includes("torso_lean")) {
    message = "Keep your torso upright";
  } else if (flags.includes("uneven_depth")) {
    message = "Match depth on both sides";
  } else if (flags.includes("too_deep")) {
    message = "Control your lunge depth";
  }

  return { score, message, flags, injury: getInjuryDetails(flags) };
}

function evaluateShoulderPressPosture(landmarks, angles) {
  const visibilityIssue = basicVisibilityCheck(landmarks);
  if (visibilityIssue) return visibilityIssue;

  const flags = [];
  let score = 100;

  const elbowGap = Math.abs(angles.leftElbow - angles.rightElbow);
  if (elbowGap > 30) {
    flags.push("uneven_press");
    score -= 20;
  }

  if (angles.hipBack < 150) {
    flags.push("arching_back");
    score -= 25;
  }

  if (angles.minElbow < 55) {
    flags.push("too_deep");
    score -= 10;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let message = "Good form";
  if (flags.includes("arching_back")) {
    message = "Keep your core tight and ribs down";
  } else if (flags.includes("uneven_press")) {
    message = "Press both arms evenly";
  } else if (flags.includes("too_deep")) {
    message = "Control the bottom position";
  }

  return { score, message, flags, injury: getInjuryDetails(flags) };
}

function evaluateDeadliftPosture(landmarks, angles) {
  const visibilityIssue = basicVisibilityCheck(landmarks);
  if (visibilityIssue) return visibilityIssue;

  const flags = [];
  let score = 100;

  if (angles.hipBack < 120) {
    flags.push("too_much_rounding");
    score -= 30;
  }

  if (angles.avgKnee < 105) {
    flags.push("too_much_knee_bend");
    score -= 15;
  }

  const kneeGap = Math.abs(angles.leftKnee - angles.rightKnee);
  if (kneeGap > 35) {
    flags.push("uneven_drive");
    score -= 15;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let message = "Good form";
  if (flags.includes("too_much_rounding")) {
    message = "Keep your back neutral during hinge";
  } else if (flags.includes("too_much_knee_bend")) {
    message = "Hinge from hips more than knees";
  } else if (flags.includes("uneven_drive")) {
    message = "Push evenly through both legs";
  }

  return { score, message, flags, injury: getInjuryDetails(flags) };
}

export function evaluateExercisePosture(exercise, landmarks, angles) {
  const mode = normalizeExercise(exercise);

  switch (mode) {
    case "pushup":
    case "bench_press":
    case "tricep_dip":
      return evaluatePushupPosture(landmarks, angles);
    case "pullup":
    case "shoulder_press":
    case "lateral_raise":
      return evaluateShoulderPressPosture(landmarks, angles);
    case "bicep_curl":
      return evaluateBicepCurlPosture(landmarks, angles);
    case "lunge":
      return evaluateLungePosture(landmarks, angles);
    case "deadlift":
    case "hip_thrust":
      return evaluateDeadliftPosture(landmarks, angles);
    case "calf_raise":
      return evaluateSquatPosture(landmarks, angles);
    case "squat":
    default:
      return evaluateSquatPosture(landmarks, angles);
  }
}

export function calculateSessionPostureScore(scoreSamples) {
  if (!scoreSamples?.length) return 0;
  return Math.round(average(scoreSamples));
}

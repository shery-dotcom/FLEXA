const SMOOTHING_ALPHA = 0.35;

const SENSITIVITY_PROFILES = {
  strict: {
    cooldownMs: 700,
    downConfirmFrames: 4,
    upConfirmFrames: 4,
    minRangeMultiplier: 1.2,
    thresholdBuffer: 4,
  },
  normal: {
    cooldownMs: 550,
    downConfirmFrames: 2,
    upConfirmFrames: 2,
    minRangeMultiplier: 0.9,
    thresholdBuffer: -1,
  },
  lenient: {
    cooldownMs: 420,
    downConfirmFrames: 1,
    upConfirmFrames: 1,
    minRangeMultiplier: 0.75,
    thresholdBuffer: -5,
  },
};

export const SENSITIVITY_OPTIONS = [
  { value: "strict", label: "Strict" },
  { value: "normal", label: "Normal" },
  { value: "lenient", label: "Lenient" },
];

const EXERCISE_COUNTER_CONFIG = {
  squat: {
    metric: (angles) => angles.avgKnee,
    downThreshold: 90,
    upThreshold: 160,
    initialStage: "up",
    minRange: 35,
    validate: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) <= 40,
  },
  pushup: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 90,
    upThreshold: 155,
    initialStage: "up",
    minRange: 32,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 35,
  },
  bicep_curl: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 65,
    upThreshold: 155,
    initialStage: "up",
    minRange: 42,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 45,
  },
  hammer_curl: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 70,
    upThreshold: 155,
    initialStage: "up",
    minRange: 40,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 50,
  },
  lunge: {
    metric: (angles) => angles.minKnee,
    downThreshold: 100,
    upThreshold: 155,
    initialStage: "up",
    minRange: 40,
    validate: (angles) => angles.maxKnee >= 125,
  },
  shoulder_press: {
    metric: (angles) => angles.minElbow,
    downThreshold: 95,
    upThreshold: 165,
    initialStage: "up",
    minRange: 45,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 45,
  },
  deadlift: {
    metric: (angles) => angles.hipBack,
    downThreshold: 135,
    upThreshold: 165,
    initialStage: "up",
    minRange: 25,
    validate: (angles) => angles.avgKnee >= 120,
  },
  tricep_extension: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 95,
    upThreshold: 168,
    initialStage: "up",
    minRange: 35,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 40,
  },
};

const EXERCISE_ALIASES = {
  "push-up": "pushup",
  "push up": "pushup",
  "bicep curl": "bicep_curl",
  "biceps curl": "bicep_curl",
  "hammer curl": "hammer_curl",
  "hammer curls": "hammer_curl",
  "shoulder press": "shoulder_press",
  "overhead press": "shoulder_press",
  deadlift: "deadlift",
  deadlifts: "deadlift",
  "tricep extension": "tricep_extension",
  "triceps extension": "tricep_extension",
};

export const SUPPORTED_EXERCISES = Object.keys(EXERCISE_COUNTER_CONFIG);

export function normalizeSensitivity(sensitivity = "normal") {
  const key = String(sensitivity || "")
    .trim()
    .toLowerCase();
  if (SENSITIVITY_PROFILES[key]) return key;
  return "normal";
}

export function getSensitivityProfile(sensitivity = "normal") {
  const key = normalizeSensitivity(sensitivity);
  return SENSITIVITY_PROFILES[key];
}

export function normalizeExercise(exercise = "squat") {
  const raw = String(exercise || "")
    .trim()
    .toLowerCase();
  const normalized = EXERCISE_ALIASES[raw] || raw;
  if (EXERCISE_COUNTER_CONFIG[normalized]) return normalized;
  return "squat";
}

export function createRepCounter(exercise = "squat") {
  const mode = normalizeExercise(exercise);
  const config = EXERCISE_COUNTER_CONFIG[mode] || EXERCISE_COUNTER_CONFIG.squat;
  return {
    stage: config.initialStage,
    reps: 0,
    lastRepAt: 0,
    downFrames: 0,
    upFrames: 0,
    cycleMin: Infinity,
    cycleMax: -Infinity,
    smoothedMetric: null,
  };
}

function getExerciseSpecificHint(mode, reason) {
  const hints = {
    squat: {
      go_down: "Squat lower until thighs move closer to parallel.",
      come_up: "Drive up and fully extend hips and knees.",
      range_small: "Use full squat depth and stand tall at top.",
      strict_form_invalid: "Keep knees tracking evenly and chest stable.",
      cooldown: "Pause briefly before starting next squat rep.",
      invalid_signal: "Keep full lower body visible for squat tracking.",
      stabilizing: "Move smoothly through full squat range.",
    },
    pushup: {
      go_down: "Lower chest more by bending elbows.",
      come_up: "Push up until arms are nearly straight.",
      range_small: "Increase push-up depth and lockout range.",
      strict_form_invalid: "Keep both elbows moving evenly and body aligned.",
      cooldown: "Avoid bouncing; complete one push-up at a time.",
      invalid_signal: "Show shoulders, elbows, and wrists clearly.",
      stabilizing: "Control your push-up tempo.",
    },
    bicep_curl: {
      go_down: "Lower dumbbells fully to open the elbows.",
      come_up: "Curl up higher toward shoulder level.",
      range_small: "Use full curl range: full extension to full curl.",
      strict_form_invalid: "Keep both elbows close and move both arms evenly.",
      cooldown: "Avoid swinging; reset before next curl.",
      invalid_signal: "Keep both arms and shoulders visible.",
      stabilizing: "Curl smoothly without torso sway.",
    },
    hammer_curl: {
      go_down: "Lower hands fully while keeping neutral grip.",
      come_up: "Raise hands higher without swinging.",
      range_small: "Use full hammer curl range each rep.",
      strict_form_invalid: "Keep elbows tucked and both sides balanced.",
      cooldown: "Reset briefly between hammer curl reps.",
      invalid_signal: "Keep elbows and wrists in frame.",
      stabilizing: "Perform controlled neutral-grip curls.",
    },
    lunge: {
      go_down: "Drop deeper by bending the front knee more.",
      come_up: "Push back up to standing position.",
      range_small: "Take a deeper lunge step and return fully.",
      strict_form_invalid: "Keep left and right legs moving evenly.",
      cooldown: "Complete one full lunge before next rep.",
      invalid_signal: "Keep hips, knees, and ankles clearly visible.",
      stabilizing: "Control descent and ascent in each lunge.",
    },
    shoulder_press: {
      go_down: "Lower elbows slightly more before pressing.",
      come_up: "Press up until elbows are near full extension.",
      range_small: "Use full press path from shoulder level to overhead.",
      strict_form_invalid: "Press both arms evenly without leaning.",
      cooldown: "Avoid rapid bouncing at the top.",
      invalid_signal: "Keep shoulders, elbows, and wrists in frame.",
      stabilizing: "Press smoothly with controlled lockout.",
    },
    deadlift: {
      go_down: "Hinge hips back more to start the deadlift.",
      come_up: "Stand tall by extending hips at the top.",
      range_small: "Increase hinge depth and full lockout.",
      strict_form_invalid: "Keep spine neutral and both sides balanced.",
      cooldown: "Reset posture before next deadlift rep.",
      invalid_signal: "Keep torso and legs fully visible for hinge tracking.",
      stabilizing: "Move through a controlled hip-hinge pattern.",
    },
    tricep_extension: {
      go_down: "Lower forearms more behind/above the head.",
      come_up: "Extend elbows fully at the top.",
      range_small: "Use full elbow bend and full extension.",
      strict_form_invalid: "Keep elbows stable and both arms aligned.",
      cooldown: "Avoid jerking; control each extension.",
      invalid_signal: "Keep elbows and forearms in frame.",
      stabilizing: "Perform smooth tricep extensions.",
    },
  };

  const byExercise = hints[mode] || hints.squat;
  return byExercise[reason] || "Keep moving smoothly.";
}

export function updateRepCounter(
  counter,
  exercise,
  angles,
  now = Date.now(),
  sensitivity = "normal",
) {
  const mode = normalizeExercise(exercise);
  const config = EXERCISE_COUNTER_CONFIG[mode] || EXERCISE_COUNTER_CONFIG.squat;
  const profile = getSensitivityProfile(sensitivity);
  const metricValue = config.metric(angles || {});
  const isValidForm = config.validate ? config.validate(angles || {}) : true;
  const requireStrictForm = normalizeSensitivity(sensitivity) === "strict";

  if (
    !counter ||
    typeof metricValue !== "number" ||
    Number.isNaN(metricValue) ||
    metricValue < 10 ||
    metricValue > 190 ||
    (requireStrictForm && !isValidForm)
  ) {
    let hint = getExerciseSpecificHint(mode, "invalid_signal");
    let reason = "invalid_signal";
    if (requireStrictForm && !isValidForm) {
      reason = "strict_form_invalid";
      hint = getExerciseSpecificHint(mode, "strict_form_invalid");
    }
    if (counter) {
      counter.downFrames = 0;
      counter.upFrames = 0;
    }
    return {
      didCount: false,
      reps: counter?.reps || 0,
      stage: counter?.stage || config.initialStage,
      reason,
      hint,
    };
  }

  const smoothedMetric =
    counter.smoothedMetric == null
      ? metricValue
      : counter.smoothedMetric +
        SMOOTHING_ALPHA * (metricValue - counter.smoothedMetric);
  counter.smoothedMetric = smoothedMetric;

  counter.cycleMin = Math.min(counter.cycleMin, smoothedMetric);
  counter.cycleMax = Math.max(counter.cycleMax, smoothedMetric);

  const downThreshold = config.downThreshold + profile.thresholdBuffer;
  const upThreshold = config.upThreshold - profile.thresholdBuffer;

  const isDownMovement = smoothedMetric < downThreshold;
  const isUpMovement = smoothedMetric > upThreshold;

  counter.downFrames = isDownMovement ? counter.downFrames + 1 : 0;
  counter.upFrames = isUpMovement ? counter.upFrames + 1 : 0;

  if (
    counter.downFrames >= profile.downConfirmFrames &&
    counter.stage === "up"
  ) {
    counter.stage = "down";
  }

  const cycleRange = counter.cycleMax - counter.cycleMin;
  const minRangeRequired = (config.minRange || 30) * profile.minRangeMultiplier;
  const hasEnoughRange = cycleRange >= minRangeRequired;

  if (
    counter.upFrames >= profile.upConfirmFrames &&
    counter.stage === "down" &&
    hasEnoughRange &&
    now - counter.lastRepAt > profile.cooldownMs
  ) {
    counter.reps += 1;
    counter.stage = "up";
    counter.lastRepAt = now;
    counter.cycleMin = smoothedMetric;
    counter.cycleMax = smoothedMetric;
    counter.downFrames = 0;
    counter.upFrames = 0;
    return {
      didCount: true,
      reps: counter.reps,
      stage: counter.stage,
      reason: "counted",
      hint: "Rep counted.",
    };
  }

  if (counter.stage === "up") {
    return {
      didCount: false,
      reps: counter.reps,
      stage: counter.stage,
      reason: "go_down",
      hint: getExerciseSpecificHint(mode, "go_down"),
    };
  }

  if (counter.stage === "down" && counter.upFrames < profile.upConfirmFrames) {
    return {
      didCount: false,
      reps: counter.reps,
      stage: counter.stage,
      reason: "come_up",
      hint: getExerciseSpecificHint(mode, "come_up"),
    };
  }

  if (counter.stage === "down" && !hasEnoughRange) {
    return {
      didCount: false,
      reps: counter.reps,
      stage: counter.stage,
      reason: "range_small",
      hint: getExerciseSpecificHint(mode, "range_small"),
    };
  }

  if (
    counter.stage === "down" &&
    now - counter.lastRepAt <= profile.cooldownMs
  ) {
    return {
      didCount: false,
      reps: counter.reps,
      stage: counter.stage,
      reason: "cooldown",
      hint: getExerciseSpecificHint(mode, "cooldown"),
    };
  }

  return {
    didCount: false,
    reps: counter.reps,
    stage: counter.stage,
    reason: "stabilizing",
    hint: getExerciseSpecificHint(mode, "stabilizing"),
  };
}



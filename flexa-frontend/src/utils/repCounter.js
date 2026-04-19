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

export const EXERCISE_GROUPS = [
  {
    label: "Upper Body",
    exercises: [
      "pushup",
      "pullup",
      "bicep_curl",
      "tricep_dip",
      "shoulder_press",
      "lateral_raise",
      "bench_press",
    ],
  },
  {
    label: "Lower Body",
    exercises: ["squat", "lunge", "deadlift", "hip_thrust", "calf_raise"],
  },
  {
    label: "Core / Stability",
    exercises: ["plank", "situp", "mountain_climber"],
  },
];

export const EXERCISE_LABELS = {
  pushup: "Push-ups",
  pullup: "Pull-ups / Chin-ups",
  bicep_curl: "Dumbbell Bicep Curls",
  tricep_dip: "Tricep Dips",
  shoulder_press: "Shoulder Press (Dumbbell/Barbell)",
  lateral_raise: "Lateral Raises",
  bench_press: "Bench Press (Barbell/Dumbbell)",
  squat: "Squats (Bodyweight/Barbell)",
  lunge: "Lunges (Forward/Walking)",
  deadlift: "Deadlifts (Conventional/Romanian)",
  hip_thrust: "Glute Bridges / Hip Thrusts",
  calf_raise: "Calf Raises",
  plank: "Plank",
  situp: "Sit-ups / Crunches",
  mountain_climber: "Mountain Climbers",
};

const EXERCISE_COUNTER_CONFIG = {
  pushup: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 90,
    upThreshold: 155,
    initialStage: "up",
    minRange: 32,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 35,
  },
  pullup: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 82,
    upThreshold: 158,
    initialStage: "up",
    minRange: 38,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 45,
  },
  bicep_curl: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 65,
    upThreshold: 155,
    initialStage: "up",
    minRange: 42,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 45,
  },
  tricep_dip: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 88,
    upThreshold: 155,
    initialStage: "up",
    minRange: 34,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 42,
  },
  shoulder_press: {
    metric: (angles) => angles.minElbow,
    downThreshold: 95,
    upThreshold: 165,
    initialStage: "up",
    minRange: 45,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 45,
  },
  lateral_raise: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 120,
    upThreshold: 165,
    initialStage: "up",
    minRange: 20,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 55,
  },
  bench_press: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 85,
    upThreshold: 160,
    initialStage: "up",
    minRange: 38,
    validate: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) <= 40,
  },
  squat: {
    metric: (angles) => angles.avgKnee,
    downThreshold: 90,
    upThreshold: 160,
    initialStage: "up",
    minRange: 35,
    validate: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) <= 40,
  },
  lunge: {
    metric: (angles) => angles.minKnee,
    downThreshold: 100,
    upThreshold: 155,
    initialStage: "up",
    minRange: 40,
    validate: (angles) => angles.maxKnee >= 125,
  },
  deadlift: {
    metric: (angles) => angles.hipBack,
    downThreshold: 135,
    upThreshold: 165,
    initialStage: "up",
    minRange: 25,
    validate: (angles) => angles.avgKnee >= 120,
  },
  hip_thrust: {
    metric: (angles) => angles.hipBack,
    downThreshold: 125,
    upThreshold: 168,
    initialStage: "up",
    minRange: 30,
    validate: (angles) => angles.avgKnee >= 85,
  },
  calf_raise: {
    metric: (angles) => angles.avgKnee,
    downThreshold: 155,
    upThreshold: 172,
    initialStage: "up",
    minRange: 10,
    validate: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) <= 25,
  },
  plank: {
    mode: "hold",
    metric: (angles) => angles.hipBack,
    holdMin: 150,
    holdMax: 180,
    holdDurationMs: 3000,
    cooldownMs: 2000,
    initialStage: "up",
    validate: (angles) =>
      Math.abs(angles.leftElbow - angles.rightElbow) <= 30 &&
      Math.abs(angles.leftKnee - angles.rightKnee) <= 30,
  },
  situp: {
    metric: (angles) => angles.hipBack,
    downThreshold: 115,
    upThreshold: 160,
    initialStage: "up",
    minRange: 28,
    validate: (angles) => angles.avgKnee >= 65,
  },
  mountain_climber: {
    metric: (angles) => angles.minKnee,
    downThreshold: 95,
    upThreshold: 145,
    initialStage: "up",
    minRange: 35,
    validate: (angles) => angles.maxKnee >= 120,
  },
};

const EXERCISE_ALIASES = {
  "push-up": "pushup",
  "push up": "pushup",
  pushups: "pushup",
  "pull-up": "pullup",
  "pull-ups": "pullup",
  "pull up": "pullup",
  "pull ups": "pullup",
  chinup: "pullup",
  chinups: "pullup",
  "chin-up": "pullup",
  "chin-ups": "pullup",
  "chin up": "pullup",
  "chin ups": "pullup",
  "bicep curl": "bicep_curl",
  "biceps curl": "bicep_curl",
  "hammer curl": "bicep_curl",
  "hammer curls": "bicep_curl",
  "tricep dip": "tricep_dip",
  "tricep dips": "tricep_dip",
  "triceps dip": "tricep_dip",
  "triceps dips": "tricep_dip",
  "shoulder press": "shoulder_press",
  "overhead press": "shoulder_press",
  "lateral raise": "lateral_raise",
  "lateral raises": "lateral_raise",
  "side raise": "lateral_raise",
  "side raises": "lateral_raise",
  "bench press": "bench_press",
  deadlift: "deadlift",
  deadlifts: "deadlift",
  "glute bridge": "hip_thrust",
  "glute bridges": "hip_thrust",
  "hip thrust": "hip_thrust",
  "hip thrusts": "hip_thrust",
  "calf raise": "calf_raise",
  "calf raises": "calf_raise",
  crunch: "situp",
  crunches: "situp",
  "sit-up": "situp",
  "sit-ups": "situp",
  "sit up": "situp",
  "sit ups": "situp",
  "mountain climber": "mountain_climber",
  "mountain climbers": "mountain_climber",
  "tricep extension": "tricep_dip",
  "triceps extension": "tricep_dip",
};

export const SUPPORTED_EXERCISES = EXERCISE_GROUPS.flatMap(
  (group) => group.exercises,
);

export function getExerciseLabel(exercise) {
  const mode = normalizeExercise(exercise);
  return EXERCISE_LABELS[mode] || mode.replace(/_/g, " ");
}

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
    holdStartedAt: 0,
    downFrames: 0,
    upFrames: 0,
    cycleMin: Infinity,
    cycleMax: -Infinity,
    smoothedMetric: null,
  };
}

function getExerciseSpecificHint(mode, reason) {
  const hints = {
    pushup: {
      go_down: "Lower chest more by bending elbows.",
      come_up: "Push up until arms are nearly straight.",
      range_small: "Increase push-up depth and lockout range.",
      strict_form_invalid: "Keep both elbows moving evenly and body aligned.",
      cooldown: "Avoid bouncing; complete one push-up at a time.",
      invalid_signal: "Show shoulders, elbows, and wrists clearly.",
      stabilizing: "Control your push-up tempo.",
    },
    pullup: {
      go_down: "Pull higher by bending elbows and driving chest up.",
      come_up: "Lower under control to nearly full arm extension.",
      range_small: "Use full pull-up range from hang to top.",
      strict_form_invalid: "Keep both elbows moving evenly.",
      cooldown: "Avoid kipping; finish one strict rep at a time.",
      invalid_signal: "Keep shoulders, elbows, and wrists visible.",
      stabilizing: "Control the pull and descent tempo.",
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
    tricep_dip: {
      go_down: "Lower deeper with controlled elbow bend.",
      come_up: "Press up until arms are almost straight.",
      range_small: "Increase dip depth and full lockout.",
      strict_form_invalid: "Keep both elbows tracking evenly.",
      cooldown: "Pause briefly before the next dip rep.",
      invalid_signal: "Keep shoulders, elbows, and wrists in frame.",
      stabilizing: "Use a smooth descent and press.",
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
    lateral_raise: {
      go_down: "Raise arms higher toward shoulder level.",
      come_up: "Lower with control before next raise.",
      range_small: "Use a bigger side-raise arc each rep.",
      strict_form_invalid: "Lift both arms symmetrically.",
      cooldown: "Avoid bouncing at top and bottom.",
      invalid_signal: "Keep shoulders, elbows, and wrists visible.",
      stabilizing: "Control tempo without torso swing.",
    },
    bench_press: {
      go_down: "Lower weights deeper by bending elbows.",
      come_up: "Press up until arms are nearly straight.",
      range_small: "Use full bench press range each rep.",
      strict_form_invalid: "Keep left and right press depth balanced.",
      cooldown: "Reset briefly at the top before next rep.",
      invalid_signal: "Keep shoulders, elbows, and wrists in frame.",
      stabilizing: "Press with a controlled cadence.",
    },
    squat: {
      go_down: "Squat lower until thighs move closer to parallel.",
      come_up: "Drive up and fully extend hips and knees.",
      range_small: "Use full squat depth and stand tall at top.",
      strict_form_invalid: "Keep knees tracking evenly and chest stable.",
      cooldown: "Pause briefly before starting next squat rep.",
      invalid_signal: "Keep full lower body visible for squat tracking.",
      stabilizing: "Move smoothly through full squat range.",
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
    deadlift: {
      go_down: "Hinge hips back more to start the deadlift.",
      come_up: "Stand tall by extending hips at the top.",
      range_small: "Increase hinge depth and full lockout.",
      strict_form_invalid: "Keep spine neutral and both sides balanced.",
      cooldown: "Reset posture before next deadlift rep.",
      invalid_signal: "Keep torso and legs fully visible for hinge tracking.",
      stabilizing: "Move through a controlled hip-hinge pattern.",
    },
    hip_thrust: {
      go_down: "Drop hips lower before driving back up.",
      come_up: "Squeeze glutes and reach full hip extension.",
      range_small: "Use deeper bridge depth and stronger lockout.",
      strict_form_invalid: "Keep left and right side drive balanced.",
      cooldown: "Pause briefly at top for control.",
      invalid_signal: "Keep hips, knees, and shoulders visible.",
      stabilizing: "Drive through heels with controlled tempo.",
    },
    calf_raise: {
      go_down: "Rise higher onto your toes.",
      come_up: "Lower heels fully before the next raise.",
      range_small: "Increase ankle range on each calf raise.",
      strict_form_invalid: "Keep both legs and knees aligned.",
      cooldown: "Avoid bouncing; pause before next rep.",
      invalid_signal: "Keep lower legs and ankles in frame.",
      stabilizing: "Perform smooth, controlled calf raises.",
    },
    plank: {
      go_down: "Straighten your body line from shoulders to ankles.",
      come_up: "Hold steady and keep breathing.",
      range_small: "Maintain a flatter, more stable plank line.",
      strict_form_invalid: "Square shoulders and hips to the camera.",
      cooldown: "Great hold. Reset and brace for the next interval.",
      invalid_signal: "Keep shoulders, hips, and knees visible.",
      stabilizing: "Hold steady for a clean plank interval.",
    },
    situp: {
      go_down: "Curl up higher with controlled core engagement.",
      come_up: "Lower back down with control.",
      range_small: "Use fuller sit-up range on each rep.",
      strict_form_invalid: "Keep movement balanced and controlled.",
      cooldown: "Avoid bouncing; complete each sit-up fully.",
      invalid_signal: "Keep torso and knees visible.",
      stabilizing: "Move smoothly through each sit-up rep.",
    },
    mountain_climber: {
      go_down: "Drive your knee farther toward the chest.",
      come_up: "Extend leg back fully before switching.",
      range_small: "Increase knee drive and full leg extension.",
      strict_form_invalid: "Keep hips level and alternate evenly.",
      cooldown: "Keep rhythm controlled, not rushed.",
      invalid_signal: "Keep shoulders, hips, knees, and ankles visible.",
      stabilizing: "Maintain steady alternating mountain climbers.",
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

  if (config.mode === "hold") {
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
        counter.holdStartedAt = 0;
      }
      return {
        didCount: false,
        reps: counter?.reps || 0,
        stage: counter?.stage || config.initialStage,
        reason,
        hint,
      };
    }

    const holdMin = config.holdMin ?? 145;
    const holdMax = config.holdMax ?? 180;
    const holdDurationMs = config.holdDurationMs ?? 3000;
    const cooldownMs = config.cooldownMs ?? profile.cooldownMs;
    const inHoldWindow = metricValue >= holdMin && metricValue <= holdMax;

    if (!inHoldWindow) {
      counter.holdStartedAt = 0;
      return {
        didCount: false,
        reps: counter.reps,
        stage: counter.stage,
        reason: "go_down",
        hint: getExerciseSpecificHint(mode, "go_down"),
      };
    }

    if (!counter.holdStartedAt) {
      counter.holdStartedAt = now;
    }

    const heldMs = now - counter.holdStartedAt;
    if (heldMs >= holdDurationMs && now - counter.lastRepAt > cooldownMs) {
      counter.reps += 1;
      counter.lastRepAt = now;
      counter.holdStartedAt = now;
      return {
        didCount: true,
        reps: counter.reps,
        stage: counter.stage,
        reason: "counted",
        hint: "Hold interval counted.",
      };
    }

    if (now - counter.lastRepAt <= cooldownMs) {
      return {
        didCount: false,
        reps: counter.reps,
        stage: counter.stage,
        reason: "cooldown",
        hint: getExerciseSpecificHint(mode, "cooldown"),
      };
    }

    const remainingSec = Math.max(
      1,
      Math.ceil((holdDurationMs - heldMs) / 1000),
    );
    return {
      didCount: false,
      reps: counter.reps,
      stage: counter.stage,
      reason: "stabilizing",
      hint: `Hold steady for ${remainingSec}s.`,
    };
  }

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

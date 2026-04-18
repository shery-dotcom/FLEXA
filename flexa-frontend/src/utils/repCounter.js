const REP_COOLDOWN_MS = 500;
const SMOOTHING_ALPHA = 0.35;

const EXERCISE_COUNTER_CONFIG = {
  squat: {
    metric: (angles) => angles.avgKnee,
    downThreshold: 90,
    upThreshold: 160,
    initialStage: "up",
    minRange: 35,
  },
  pushup: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 90,
    upThreshold: 155,
    initialStage: "up",
    minRange: 32,
  },
  bicep_curl: {
    metric: (angles) => angles.avgElbow,
    downThreshold: 55,
    upThreshold: 155,
    initialStage: "up",
    minRange: 45,
  },
  lunge: {
    metric: (angles) => angles.minKnee,
    downThreshold: 95,
    upThreshold: 155,
    initialStage: "up",
    minRange: 40,
  },
};

const EXERCISE_ALIASES = {
  "push-up": "pushup",
  "push up": "pushup",
  "bicep curl": "bicep_curl",
  "biceps curl": "bicep_curl",
};

export const SUPPORTED_EXERCISES = Object.keys(EXERCISE_COUNTER_CONFIG);

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
    cycleMin: Infinity,
    cycleMax: -Infinity,
    smoothedMetric: null,
  };
}

export function updateRepCounter(counter, exercise, angles, now = Date.now()) {
  const mode = normalizeExercise(exercise);
  const config = EXERCISE_COUNTER_CONFIG[mode] || EXERCISE_COUNTER_CONFIG.squat;
  const metricValue = config.metric(angles || {});

  if (
    !counter ||
    typeof metricValue !== "number" ||
    Number.isNaN(metricValue) ||
    metricValue < 10 ||
    metricValue > 190
  ) {
    return {
      didCount: false,
      reps: counter?.reps || 0,
      stage: counter?.stage || config.initialStage,
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

  const isDownMovement = smoothedMetric < config.downThreshold;
  const isUpMovement = smoothedMetric > config.upThreshold;

  if (isDownMovement && counter.stage === "up") {
    counter.stage = "down";
  }

  const cycleRange = counter.cycleMax - counter.cycleMin;
  const hasEnoughRange = cycleRange >= (config.minRange || 30);

  if (
    isUpMovement &&
    counter.stage === "down" &&
    hasEnoughRange &&
    now - counter.lastRepAt > REP_COOLDOWN_MS
  ) {
    counter.reps += 1;
    counter.stage = "up";
    counter.lastRepAt = now;
    counter.cycleMin = smoothedMetric;
    counter.cycleMax = smoothedMetric;
    return { didCount: true, reps: counter.reps, stage: counter.stage };
  }

  return { didCount: false, reps: counter.reps, stage: counter.stage };
}

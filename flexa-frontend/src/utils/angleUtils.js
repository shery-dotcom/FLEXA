export const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

export function calculateAngle(a, b, c) {
  if (!a || !b || !c) return 0;

  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);

  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

export function getMidPoint(p1, p2) {
  if (!p1 || !p2) return null;
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    visibility: Math.min(p1.visibility ?? 1, p2.visibility ?? 1),
  };
}

export function getJointAngles(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 29) {
    return {
      leftKnee: 0,
      rightKnee: 0,
      avgKnee: 0,
      minKnee: 0,
      leftElbow: 0,
      rightElbow: 0,
      avgElbow: 0,
      hipBack: 0,
    };
  }

  const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const lKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
  const rKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
  const lAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
  const rAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
  const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const lElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
  const rElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
  const lWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
  const rWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

  const leftKnee = calculateAngle(lHip, lKnee, lAnkle);
  const rightKnee = calculateAngle(rHip, rKnee, rAnkle);
  const leftElbow = calculateAngle(lShoulder, lElbow, lWrist);
  const rightElbow = calculateAngle(rShoulder, rElbow, rWrist);

  const midShoulder = getMidPoint(lShoulder, rShoulder);
  const midHip = getMidPoint(lHip, rHip);
  const midKnee = getMidPoint(lKnee, rKnee);
  const hipBack = calculateAngle(midShoulder, midHip, midKnee);

  return {
    leftKnee,
    rightKnee,
    avgKnee: (leftKnee + rightKnee) / 2,
    minKnee: Math.min(leftKnee, rightKnee),
    leftElbow,
    rightElbow,
    avgElbow: (leftElbow + rightElbow) / 2,
    hipBack,
  };
}

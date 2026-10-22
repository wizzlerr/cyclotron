// Pedalling pose for the virtual rider (E16-4): where the foot is for a crank angle, and the hip and
// knee angles that put it there (a two-bone solve in the bike's side plane). Pure, so it's tested.

export interface RiderDims {
  /** Bottom bracket to hip, metres (seat height along the frame). */
  hipX: number
  hipY: number
  thigh: number
  shin: number
  crank: number
}

export const RIDER_DIMS: RiderDims = {
  hipX: -0.2,
  hipY: 0.7,
  thigh: 0.46,
  shin: 0.46,
  crank: 0.17,
}

export interface LegPose {
  /** Foot (pedal) position relative to the bottom bracket; x forward, y up. */
  footX: number
  footY: number
  /** Thigh angle from straight down, radians, positive = forward. */
  hip: number
  /** Knee bend, radians, 0 = straight. */
  knee: number
}

/** Pose for a crank angle (radians, 0 = pedal straight forward, increasing as the pedal goes down). */
export function legPose(crankAngle: number, dims: RiderDims = RIDER_DIMS): LegPose {
  const footX = Math.cos(crankAngle) * dims.crank
  const footY = -Math.sin(crankAngle) * dims.crank
  // Hip → foot vector, then the law of cosines for the knee.
  const dx = footX - dims.hipX
  const dy = footY - dims.hipY
  const reach = Math.min(Math.hypot(dx, dy), dims.thigh + dims.shin - 1e-6)
  const cosKnee = (dims.thigh ** 2 + dims.shin ** 2 - reach ** 2) / (2 * dims.thigh * dims.shin)
  const knee = Math.PI - Math.acos(Math.min(1, Math.max(-1, cosKnee)))
  // Angle of hip→foot from straight down, plus the thigh's offset inside the triangle; the knee
  // points forward.
  const toFoot = Math.atan2(dx, -dy)
  const cosA = (dims.thigh ** 2 + reach ** 2 - dims.shin ** 2) / (2 * dims.thigh * reach)
  const hip = toFoot + Math.acos(Math.min(1, Math.max(-1, cosA)))
  return { footX, footY, hip, knee }
}

/** Knee position for a pose, relative to the bottom bracket. */
export function kneeAt(pose: LegPose, dims: RiderDims = RIDER_DIMS): { x: number; y: number } {
  return {
    x: dims.hipX + Math.sin(pose.hip) * dims.thigh,
    y: dims.hipY - Math.cos(pose.hip) * dims.thigh,
  }
}

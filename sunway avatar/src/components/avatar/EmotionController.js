/**
 * EmotionController — Bone-based emotions for ReadyPlayerMe avatar
 * Since the model has no expression morph targets (only visemes),
 * we use subtle bone rotations on Head, Neck, Spine2 to convey emotion.
 */
import * as THREE from "three";

// Subtle bone adjustments per emotion (euler deltas in radians)
const EMOTION_POSES = {
  neutral: {
    Head:   { x:  0.00, y: 0.00, z: 0.00 },
    Neck:   { x:  0.00, y: 0.00, z: 0.00 },
    Spine2: { x:  0.00, y: 0.00, z: 0.00 },
  },
  happy: {
    // Slight head tilt + chest forward = confidence/happiness
    Head:   { x: -0.05, y: 0.03, z: 0.02 },
    Neck:   { x: -0.03, y: 0.00, z: 0.00 },
    Spine2: { x:  0.02, y: 0.00, z: 0.00 },
  },
  excited: {
    Head:   { x: -0.08, y: 0.04, z: 0.03 },
    Neck:   { x: -0.05, y: 0.00, z: 0.00 },
    Spine2: { x:  0.04, y: 0.00, z: 0.00 },
  },
  concerned: {
    // Head tilts forward + slight sideways = concern/thinking
    Head:   { x:  0.06, y: 0.05, z: -0.04 },
    Neck:   { x:  0.03, y: 0.03, z: 0.00 },
    Spine2: { x: -0.02, y: 0.00, z: 0.00 },
  },
  thinking: {
    Head:   { x:  0.04, y: 0.08, z: -0.05 },
    Neck:   { x:  0.02, y: 0.05, z: 0.00 },
    Spine2: { x: -0.01, y: 0.00, z: 0.00 },
  },
};

export class EmotionController {
  constructor() {
    this.currentEmotion = "neutral";
    this.targetEmotion  = "neutral";
    this._lerpT         = 1;
    this._fromPose      = EMOTION_POSES["neutral"];
    this._toPose        = EMOTION_POSES["neutral"];
    this.lerpSpeed      = 2.5; // seconds to blend
  }

  setEmotion(emotion) {
    if (!EMOTION_POSES[emotion]) return;
    if (emotion === this.targetEmotion) return;
    this._fromPose     = this._getCurrentInterpolated();
    this._toPose       = EMOTION_POSES[emotion];
    this._lerpT        = 0;
    this.targetEmotion = emotion;
  }

  _getCurrentInterpolated() {
    const t = Math.min(this._lerpT, 1);
    const result = {};
    const bones = Object.keys(this._toPose);
    bones.forEach(bone => {
      result[bone] = {};
      ["x","y","z"].forEach(ax => {
        const from = this._fromPose[bone]?.[ax] || 0;
        const to   = this._toPose[bone]?.[ax] || 0;
        result[bone][ax] = THREE.MathUtils.lerp(from, to, t);
      });
    });
    return result;
  }

  // Apply current emotion pose to bones — called every frame
  // basePose = the bone's original rest rotation (THREE.Euler)
  update(delta, group) {
    if (!group) return;
    this._lerpT = Math.min(this._lerpT + delta * this.lerpSpeed, 1);
    const t = this._ease(this._lerpT);

    const pose = {};
    Object.keys(this._toPose).forEach(bone => {
      pose[bone] = {};
      ["x","y","z"].forEach(ax => {
        const from = this._fromPose[bone]?.[ax] || 0;
        const to   = this._toPose[bone]?.[ax] || 0;
        pose[bone][ax] = THREE.MathUtils.lerp(from, to, t);
      });
    });

    // Apply deltas to bones
    Object.entries(pose).forEach(([boneName, delta_rot]) => {
      const bone = group.getObjectByName(boneName);
      if (!bone) return;
      // Apply as additive rotation delta
      if (delta_rot.x) bone.rotation.x += delta_rot.x * 0.016;
      if (delta_rot.y) bone.rotation.y += delta_rot.y * 0.016;
      if (delta_rot.z) bone.rotation.z += delta_rot.z * 0.016;
    });
  }

  _ease(t) { return t * t * (3 - 2 * t); }
}

/**
 * AnimationManager
 * Maps semantic animation names to GLB/FBX clip names with fallback.
 */
import * as THREE from "three";

// Semantic → possible clip name variations (first match wins)
export const ANIMATION_MAP = {
  idle:        ["Idle", "idle", "T-Pose", "TPose"],
  talking:     ["Talking", "talk", "TalkingGesture", "Standing Idle", "Idle"],
  thinking:    ["Thinking", "think", "Idle"],
  listening:   ["Listening", "listen", "Idle"],
  smile:       ["Smiling", "smile", "Happy", "Idle"],
  namaste:     ["Namaste", "namaste"],
  wave:        ["Wave", "wave", "Waving", "Standing Greeting"],
  point_right: ["PointRight", "point_right", "Pointing", "Idle"],
  nod:         ["Nod", "nod", "HeadNod", "Idle"],
  head_shake:  ["HeadShake", "head_shake", "No", "Idle"],
  greeting:    ["Standing Greeting", "Greeting", "Wave", "wave"],
  angry:       ["Angry Gesture", "Angry", "angry"],
};

export const ONE_SHOT_ANIMS = new Set(["namaste", "wave", "greeting", "angry"]);

export class AnimationManager {
  constructor(mixer, actions) {
    this.mixer   = mixer;
    this.actions = actions; // { clipName: AnimationAction }
    this.current = null;
    this.currentSemantic = "idle";
    this._returnTimer = null;
  }

  /** Find the best available action for a semantic name */
  resolve(semantic) {
    const candidates = ANIMATION_MAP[semantic] || ANIMATION_MAP["idle"];
    for (const name of candidates) {
      if (this.actions[name]) return this.actions[name];
    }
    // Final fallback: first available action
    const first = Object.values(this.actions)[0];
    return first || null;
  }

  /** Play a semantic animation with smooth crossfade */
  play(semantic, { loop = true, onFinish = null } = {}) {
    const action = this.resolve(semantic);
    if (!action) return;

    if (this._returnTimer) {
      clearTimeout(this._returnTimer);
      this._returnTimer = null;
    }

    if (this.current && this.current !== action) {
      this.current.fadeOut(0.3);
    }

    const isOneShot = ONE_SHOT_ANIMS.has(semantic);
    action.setLoop(isOneShot ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = isOneShot;
    action.reset().fadeIn(0.3).play();

    this.current = action;
    this.currentSemantic = semantic;

    if (isOneShot) {
      const dur = (action.getClip().duration + 0.2) * 1000;
      this._returnTimer = setTimeout(() => {
        onFinish?.();
        this.play("idle");
      }, dur);
    }
  }

  /** Return to idle (used after talking ends) */
  returnToIdle() {
    this.play("idle");
  }
}

/**
 * LipSyncController — Amplitude-based natural lipsync
 * Uses Web Speech API boundary events for timing + audio amplitude fallback
 * Drives all 15 viseme morph targets on Wolf3D_Head and Wolf3D_Teeth
 */
import * as THREE from "three";

// Full viseme set from model
const ALL_VISEMES = [
  "viseme_sil","viseme_PP","viseme_FF","viseme_TH","viseme_DD",
  "viseme_kk","viseme_CH","viseme_SS","viseme_nn","viseme_RR",
  "viseme_aa","viseme_E","viseme_I","viseme_O","viseme_U",
];

// Phoneme → viseme mapping (for Web Speech word boundary events)
const PHONEME_MAP = {
  // Silence
  sil: "viseme_sil",
  // Bilabial
  p:"viseme_PP", b:"viseme_PP", m:"viseme_PP",
  // Labiodental
  f:"viseme_FF", v:"viseme_FF",
  // Dental
  th:"viseme_TH",
  // Alveolar
  d:"viseme_DD", t:"viseme_DD", n:"viseme_nn",
  // Velar
  k:"viseme_kk", g:"viseme_kk",
  // Postalveolar
  ch:"viseme_CH", sh:"viseme_CH", zh:"viseme_CH", jh:"viseme_CH",
  // Sibilant
  s:"viseme_SS", z:"viseme_SS",
  // Nasal
  ng:"viseme_nn",
  // Rhotic
  r:"viseme_RR",
  // Vowels
  aa:"viseme_aa", ae:"viseme_aa", ah:"viseme_aa",
  eh:"viseme_E",  ey:"viseme_E",
  ih:"viseme_I",  iy:"viseme_I",
  ow:"viseme_O",  ao:"viseme_O",
  uh:"viseme_U",  uw:"viseme_U",
};

// Natural weight for each viseme when mouth is open (amplitude-based blend)
const OPEN_MOUTH_BLEND = {
  viseme_aa: 0.7,  // main open mouth
  viseme_E:  0.25,
  viseme_I:  0.1,
};

export class LipSyncController {
  constructor(nodes) {
    this.nodes       = nodes;
    this.currentVis  = "viseme_sil";
    this.targetVis   = "viseme_sil";
    this.blendSpeed  = 12;   // lerp speed per frame
    this.isTalking   = false;
    this._phase      = 0;    // oscillation for natural variation
    this._wordTimer  = 0;    // cycles through visemes while talking
    this._wordVisemes = [    // rotation of visemes for natural speech
      "viseme_aa","viseme_E","viseme_I","viseme_O","viseme_U",
      "viseme_DD","viseme_kk","viseme_nn","viseme_RR","viseme_aa",
    ];
    this._wordIdx    = 0;
    this._amplitude  = 0;
  }

  setTalking(val) { this.isTalking = val; }

  // Called from useChat when a word boundary fires (Web Speech API)
  onWord(word) {
    if (!word) return;
    const lower = word.toLowerCase().replace(/[^a-z]/g,"");
    // Pick viseme based on first consonant/vowel sound
    for (const [ph, vis] of Object.entries(PHONEME_MAP)) {
      if (lower.startsWith(ph)) { this.targetVis = vis; return; }
    }
    // Default to open mouth for unknown words
    this.targetVis = "viseme_aa";
  }

  update(delta) {
    const head  = this.nodes?.Head_Mesh || this.nodes?.Wolf3D_Head;
    const teeth = this.nodes?.Teeth_Mesh || this.nodes?.Wolf3D_Teeth;
    if (!head?.morphTargetInfluences || !head?.morphTargetDictionary) return;

    this._phase += delta;
    this._wordTimer += delta;

    if (!this.isTalking) {
      // Smoothly close all visemes → silence
      ALL_VISEMES.forEach(v => {
        const hi = head.morphTargetDictionary[v];
        if (hi === undefined) return;
        head.morphTargetInfluences[hi] = THREE.MathUtils.lerp(
          head.morphTargetInfluences[hi], 0, delta * 8
        );
        if (teeth?.morphTargetDictionary?.[v] !== undefined) {
          teeth.morphTargetInfluences[teeth.morphTargetDictionary[v]] =
            head.morphTargetInfluences[hi];
        }
      });
      return;
    }

    // ── Talking: natural oscillating viseme blend ─────────────────────────

    // Cycle through visemes at natural speech rate (~3-4 syllables/sec)
    if (this._wordTimer > 0.18) {
      this._wordTimer = 0;
      this._wordIdx = (this._wordIdx + 1) % this._wordVisemes.length;
      this.targetVis = this._wordVisemes[this._wordIdx];
    }

    // Amplitude oscillation (0.4–1.0) simulates natural open/close rhythm
    const amp = 0.5 + Math.sin(this._phase * 7.5) * 0.25 +
                      Math.sin(this._phase * 13.0) * 0.1;

    // Reset all to 0 first, then apply target
    ALL_VISEMES.forEach(v => {
      const hi = head.morphTargetDictionary[v];
      if (hi === undefined) return;
      const targetVal = v === this.targetVis ? amp : 0;
      head.morphTargetInfluences[hi] = THREE.MathUtils.lerp(
        head.morphTargetInfluences[hi],
        targetVal,
        delta * this.blendSpeed
      );
      // Sync teeth
      if (teeth?.morphTargetDictionary?.[v] !== undefined) {
        teeth.morphTargetInfluences[teeth.morphTargetDictionary[v]] =
          head.morphTargetInfluences[hi] * 0.6; // teeth open less than head
      }
    });
  }
}

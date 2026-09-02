/**
 * LipSyncController — drives the mouth from the REAL voice audio.
 *
 * The previous version cycled through a fixed list of mouth shapes every 0.18s
 * and drove openness from a sine wave. It was never connected to the audio, so
 * the mouth moved on its own schedule while the voice said something else.
 * That mismatch is what "the lips don't match" looked like.
 *
 * Now every frame asks speechAnalyser what the voice is doing at this instant:
 *
 *   level     how loud   -> how far the mouth opens
 *   centroid  how bright -> which shape it opens into
 *                           low  = rounded  (O, U)  — "oo", "oh"
 *                           mid  = open     (aa, E) — "aa", "eh"
 *                           high = spread   (I, SS) — "ee", "s", "sh"
 *
 * Because both come from the same audio that the speakers are playing, the
 * mouth cannot drift out of step: silence closes it, a loud vowel opens it, and
 * the two stop at exactly the same moment.
 *
 * If the browser blocks audio analysis (autoplay policy), `sample()` returns
 * null and we fall back to the old synthetic motion — better than a frozen face.
 */
import * as THREE from "three";
import { sample as sampleSpeech } from "../../services/speechAnalyser";
import { shapeNow, hasTrack } from "../../services/visemeTrack";

// Full viseme set present on the Ready Player Me head
const ALL_VISEMES = [
  "viseme_sil","viseme_PP","viseme_FF","viseme_TH","viseme_DD",
  "viseme_kk","viseme_CH","viseme_SS","viseme_nn","viseme_RR",
  "viseme_aa","viseme_E","viseme_I","viseme_O","viseme_U",
];

/**
 * Mouth shapes blended by brightness. Each entry is the mix used at that
 * point on the dark→bright axis; the two nearest are interpolated.
 * Blends rather than single shapes because a real mouth is never in exactly
 * one position — switching hard between visemes is what reads as "robotic".
 */
const SHAPE_BY_BRIGHTNESS = [
  { at: 0.00, mix: { viseme_U: 0.85, viseme_O: 0.35 } },                    // oo
  { at: 0.30, mix: { viseme_O: 0.80, viseme_aa: 0.30 } },                   // oh
  { at: 0.52, mix: { viseme_aa: 0.90, viseme_E: 0.20 } },                   // aa
  { at: 0.72, mix: { viseme_E: 0.75, viseme_I: 0.35 } },                    // eh
  { at: 1.00, mix: { viseme_I: 0.65, viseme_SS: 0.45, viseme_CH: 0.20 } },  // ee / s
];

// Below this the voice is between words — let the mouth close.
const SILENCE_LEVEL = 0.06;

/** Exported for testing — pure function of brightness, no audio needed. */
export function blendShapes(brightness) {
  const b = THREE.MathUtils.clamp(brightness, 0, 1);
  let lo = SHAPE_BY_BRIGHTNESS[0];
  let hi = SHAPE_BY_BRIGHTNESS[SHAPE_BY_BRIGHTNESS.length - 1];
  for (let i = 0; i < SHAPE_BY_BRIGHTNESS.length - 1; i++) {
    if (b >= SHAPE_BY_BRIGHTNESS[i].at && b <= SHAPE_BY_BRIGHTNESS[i + 1].at) {
      lo = SHAPE_BY_BRIGHTNESS[i];
      hi = SHAPE_BY_BRIGHTNESS[i + 1];
      break;
    }
  }
  const span = hi.at - lo.at;
  const t = span > 0 ? (b - lo.at) / span : 0;

  const out = {};
  for (const [v, w] of Object.entries(lo.mix)) out[v] = (out[v] || 0) + w * (1 - t);
  for (const [v, w] of Object.entries(hi.mix)) out[v] = (out[v] || 0) + w * t;
  return out;
}

export class LipSyncController {
  constructor(nodes) {
    this.nodes      = nodes;
    this.isTalking  = false;
    this.blendSpeed = 20;   // higher than before: real audio changes fast
    this._phase     = 0;    // only used by the fallback path
    this._targets   = {};   // viseme -> desired influence this frame
    this._jaw       = 0;    // smoothed openness, for the jaw bone
  }

  setTalking(val) { this.isTalking = val; }

  /** Current mouth openness 0–1 — used to nod the head in time with speech. */
  get openness() { return this._jaw; }

  update(delta) {
    const head  = this.nodes?.Head_Mesh  || this.nodes?.Wolf3D_Head;
    const teeth = this.nodes?.Teeth_Mesh || this.nodes?.Wolf3D_Teeth;
    if (!head?.morphTargetInfluences || !head?.morphTargetDictionary) return;

    const dict = head.morphTargetDictionary;
    const infl = head.morphTargetInfluences;

    // ── Work out what the mouth should be doing right now ──────────────────
    this._targets = {};

    if (this.isTalking) {
      const voice = sampleSpeech();
      // Word timings from Edge TTS: exact start/end per word, so the shape is
      // driven by the actual word being spoken rather than inferred from the
      // sound. Preferred whenever available.
      const timed = hasTrack() ? shapeNow() : null;

      if (timed) {
        // Loudness still sets HOW FAR the mouth opens, so emphasis and quiet
        // syllables still read — timing from the marks, size from the signal.
        const gain = voice
          ? THREE.MathUtils.clamp(0.35 + voice.level * 0.9, 0, 1)
          : 0.7;

        // Crossfade into the next phoneme instead of snapping between shapes.
        this._targets[timed.viseme] = (1 - timed.blend) * gain;
        if (timed.next && timed.next !== timed.viseme) {
          this._targets[timed.next] = (this._targets[timed.next] || 0) + timed.blend * gain;
        }
        this._jaw = gain;

      } else if (hasTrack()) {
        // Between words — a real pause in the sentence. Close the mouth.
        this._jaw = 0;

      } else if (voice) {
        // No timings (browser voice, or marks not loaded yet). Loudness path.
        if (voice.level > SILENCE_LEVEL) {
          const shape = blendShapes(voice.centroid);
          const gain = THREE.MathUtils.clamp(voice.level * 1.15, 0, 1);
          for (const [v, w] of Object.entries(shape)) this._targets[v] = w * gain;
          this._jaw = gain;
        } else {
          this._jaw = 0; // genuine silence between words
        }
      } else {
        // Fallback: analysis unavailable. Keep the old gentle motion so the
        // avatar still looks alive rather than frozen mid-sentence.
        this._phase += delta;
        const amp = 0.45 + Math.sin(this._phase * 7.5) * 0.22 + Math.sin(this._phase * 13) * 0.08;
        const shape = blendShapes((Math.sin(this._phase * 3.1) + 1) / 2);
        for (const [v, w] of Object.entries(shape)) this._targets[v] = w * amp;
        this._jaw = amp;
      }
    } else {
      this._jaw = 0;
    }

    // ── Move every viseme toward its target ────────────────────────────────
    // Closing is slower than opening; a mouth snapping shut looks mechanical.
    for (const v of ALL_VISEMES) {
      const i = dict[v];
      if (i === undefined) continue;

      const target = this._targets[v] || 0;
      const speed = target > infl[i] ? this.blendSpeed : this.blendSpeed * 0.6;
      infl[i] = THREE.MathUtils.lerp(infl[i], target, Math.min(1, delta * speed));

      // Teeth follow the head but open less, or they clip through the lips.
      const ti = teeth?.morphTargetDictionary?.[v];
      if (ti !== undefined) teeth.morphTargetInfluences[ti] = infl[i] * 0.6;
    }

    // A touch of jaw drop on top of the visemes — the morphs alone move the
    // lips but not the chin, which is what makes speech read as mumbling.
    const jawIdx = dict.jawOpen ?? dict.mouthOpen;
    if (jawIdx !== undefined) {
      infl[jawIdx] = THREE.MathUtils.lerp(infl[jawIdx], this._jaw * 0.35, Math.min(1, delta * 14));
    }
  }
}

/**
 * bake-namaste.mjs — Fixed after visual feedback
 *
 * Screenshot showed: arms going UP and OUTWARD (hands raised above head)
 * That means X=-45 was WRONG direction — it raised arms up/out not forward/chest
 *
 * CORRECTED ANALYSIS:
 * Rest pose: LeftArm X=57, Y=1, Z=-8 (arm hanging down at ~57° forward tilt)
 *
 * From screenshot the arms went straight UP (like surrender pose)
 * This means reducing X (57→-45) raises arms UP.
 * We need arms to go FORWARD toward chest, NOT up.
 *
 * CORRECT NAMASTE approach:
 * - Keep X close to rest (don't reduce much)  
 * - Use Z to bring arm FORWARD/INWARD (Z positive for LeftArm = forward swing based on LeftShoulder frame)
 * - ForeArm: bend elbow (Z increase still correct)
 *
 * From LeftShoulder euler = (89, -2, -90):
 * The shoulder is rotated ~90° around Z and ~90° around X
 * This means in LeftArm local space:
 *   LOCAL +Z rotation = arm swings FORWARD (toward viewer/chest) ✓
 *   LOCAL -X rotation = arm goes UP and BACKWARD (wrong - confirmed by screenshot)
 *   LOCAL +X rotation = arm goes DOWN and FORWARD
 *
 * For Namaste (arms forward at chest height):
 * LeftArm: X stays ~57 (don't change much), Z: -8 → +65 (swing arm FORWARD toward center)
 * LeftForeArm: Z: 25 → 90 (elbow bend inward)
 */

import * as THREE from "three";
import { readFileSync, writeFileSync } from "fs";

function slerp(a, b, t) {
  const qa = new THREE.Quaternion(...a);
  const qb = new THREE.Quaternion(...b);
  qa.slerp(qb, t);
  return [qa.x, qa.y, qa.z, qa.w];
}

function ease(t) { return t * t * (3 - 2 * t); }

function fromDeg(x, y, z) {
  const q = new THREE.Quaternion();
  q.setFromEuler(new THREE.Euler(x*Math.PI/180, y*Math.PI/180, z*Math.PI/180, "XYZ"));
  return [q.x, q.y, q.z, q.w];
}

// ─── Exact rest pose from model ──────────────────────────────────────────────
const REST = {
  LeftShoulder:  fromDeg( 89.38, -2.27, -90.52),
  LeftArm:       fromDeg( 57.18,  1.07,  -8.24),
  LeftForeArm:   fromDeg( -6.14,  1.34,  25.59),
  LeftHand:      fromDeg(  5.39,  4.33,  -2.33),
  RightShoulder: fromDeg( 89.37,  2.27,  90.52),
  RightArm:      fromDeg( 57.18, -1.07,   8.24),
  RightForeArm:  fromDeg( -6.14, -1.34, -25.59),
  RightHand:     fromDeg(  5.39, -4.33,   2.33),
  Neck:          fromDeg( 23.43,  0.00,   0.00),
  Head:          fromDeg(-18.72,  0.00,   0.00),
};

// ─── Namaste target ───────────────────────────────────────────────────────────
// KEY FIX: Do NOT reduce X on LeftArm (that raised arms above head)
// Instead: keep X close to rest, increase Z to swing arms FORWARD toward chest
//
// LeftArm:
//   X: 57 → 45  (slight reduction only — less downward hang)
//   Y: 1  → -5  (slight inward)
//   Z: -8 → 60  (PRIMARY: Z+ swings arm FORWARD toward chest centerline)
//
// LeftForeArm:
//   X: -6 → -10
//   Y:  1 → -20  (rotate forearm inward)
//   Z: 25 → 88   (elbow bends, forearm horizontal toward center)
//
// LeftHand: palms press together
//   Z: -2 → -15  (palm faces right/inward)

const NAMASTE = {
  LeftShoulder:  REST.LeftShoulder,
  LeftArm:       fromDeg( 45, -5,  60),
  LeftForeArm:   fromDeg(-10,-20,  88),
  LeftHand:      fromDeg(  0, 10, -15),

  RightShoulder: REST.RightShoulder,
  RightArm:      fromDeg( 45,  5, -60),
  RightForeArm:  fromDeg(-10, 20, -88),
  RightHand:     fromDeg(  0,-10,  15),

  Neck:          fromDeg( 15, 0, 0),   // slight forward tilt
  Head:          fromDeg( -5, 0, 0),   // gentle bow
};

// ─── Timeline ────────────────────────────────────────────────────────────────
const DURATION = 3.2;
const FPS      = 30;
const FRAMES   = Math.round(DURATION * FPS) + 1;
const BONES    = ["LeftArm","LeftForeArm","LeftHand","RightArm","RightForeArm","RightHand","Neck","Head"];

function evalBone(bone, t) {
  const rest   = REST[bone];
  const target = NAMASTE[bone];

  if (bone === "Head" || bone === "Neck") {
    let a;
    if      (t < 0.5) a = 0;
    else if (t < 1.1) a = ease((t-0.5)/0.6);
    else if (t < 2.5) a = 1;
    else if (t < 3.1) a = ease(1-(t-2.5)/0.6);
    else              a = 0;
    return slerp(rest, target, a);
  }

  let a;
  if      (t < 0.0) a = 0;
  else if (t < 1.0) a = ease(t/1.0);
  else if (t < 2.2) a = 1;
  else if (t < 3.2) a = ease(1-(t-2.2)/1.0);
  else              a = 0;
  return slerp(rest, target, a);
}

// ─── Build keyframes ─────────────────────────────────────────────────────────
const times = Array.from({length: FRAMES}, (_,i) => (i/(FRAMES-1))*DURATION);
const samplers = {};
for (const bone of BONES) {
  samplers[bone] = { times, values: [] };
  for (const t of times) samplers[bone].values.push(...evalBone(bone, t));
}

// ─── Parse GLB ───────────────────────────────────────────────────────────────
const glbPath = "public/models/Namaste.glb";
const glbBuf  = readFileSync(glbPath);
const jsonLen = glbBuf.readUInt32LE(12);
const gltf    = JSON.parse(glbBuf.slice(20, 20+jsonLen).toString("utf8"));
const binOff  = 20+jsonLen;
let   binData = Buffer.from(glbBuf.slice(binOff+8, binOff+8+glbBuf.readUInt32LE(binOff)));

const nodeIdx = {};
gltf.nodes.forEach((n,i) => { nodeIdx[n.name] = i; });

const missing = BONES.filter(b => nodeIdx[b] === undefined);
if (missing.length) { console.error("Missing:", missing); process.exit(1); }

// ─── Inject binary ───────────────────────────────────────────────────────────
function align4(buf) {
  const p = (4-buf.length%4)%4;
  return p ? Buffer.concat([buf, Buffer.alloc(p)]) : buf;
}
function addAccessor(arr, ct, type, count) {
  const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  const off   = binData.length;
  binData = Buffer.concat([binData, align4(bytes)]);
  const bvIdx = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer:0, byteOffset:off, byteLength:bytes.length });
  const accIdx = gltf.accessors.length;
  const mm = type==="SCALAR" ? {min:[Math.min(...arr)],max:[Math.max(...arr)]} : {};
  gltf.accessors.push({ bufferView:bvIdx, componentType:ct, count, type, ...mm });
  return accIdx;
}

const F32 = 5126;
const tAcc = addAccessor(new Float32Array(times), F32, "SCALAR", times.length);
const animS = [], animC = [];

for (const bone of BONES) {
  const qAcc = addAccessor(new Float32Array(samplers[bone].values), F32, "VEC4", times.length);
  const si   = animS.length;
  animS.push({ input:tAcc, output:qAcc, interpolation:"LINEAR" });
  animC.push({ sampler:si, target:{ node:nodeIdx[bone], path:"rotation" } });
}

gltf.animations = (gltf.animations||[]).filter(a => a.name !== "Namaste");
gltf.animations.push({ name:"Namaste", samplers:animS, channels:animC });
gltf.buffers[0].byteLength = binData.length;

// ─── Repack ───────────────────────────────────────────────────────────────────
const jBuf   = Buffer.from(JSON.stringify(gltf),"utf8");
const jPad   = (4-jBuf.length%4)%4;
const jChunk = Buffer.concat([jBuf, Buffer.alloc(jPad, 0x20)]);
const bPad   = (4-binData.length%4)%4;
const bChunk = Buffer.concat([binData, Buffer.alloc(bPad)]);
const total  = 12+8+jChunk.length+8+bChunk.length;
const out    = Buffer.alloc(total);
let   off    = 0;
out.writeUInt32LE(0x46546C67,off);off+=4;
out.writeUInt32LE(2,off);off+=4;
out.writeUInt32LE(total,off);off+=4;
out.writeUInt32LE(jChunk.length,off);off+=4;
out.writeUInt32LE(0x4E4F534A,off);off+=4;
jChunk.copy(out,off);off+=jChunk.length;
out.writeUInt32LE(bChunk.length,off);off+=4;
out.writeUInt32LE(0x004E4942,off);off+=4;
bChunk.copy(out,off);

writeFileSync(glbPath, out);
console.log("✅ Namaste baked! LeftArm Z: -8→60° (forward swing), ForeArm Z: 25→88° (elbow bend)");
console.log("   FIXED: No more X-axis reduction (that caused hands-up pose)");

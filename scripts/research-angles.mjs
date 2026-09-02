import * as THREE from "three";

// ─── Rest pose quaternions from model ────────────────────────────────────
const REST = {
  LeftShoulder:  [0.5049,  0.4895, -0.5147, 0.4904],
  LeftArm:       [0.4733,  0.0724,  0.0036, 0.8779],
  LeftForeArm:   [-0.0351, 0.0427,  0.2172, 0.9746],
  LeftHand:      [0.0447,  0.0400, -0.0148, 0.9981],
  RightShoulder: [0.5049, -0.4895,  0.5147, 0.4904],
  RightArm:      [0.4733, -0.0724, -0.0036, 0.8779],
  RightForeArm:  [-0.0351,-0.0427, -0.2172, 0.9746],
  RightHand:     [0.0447, -0.0400,  0.0148, 0.9981],
  Neck:          [0.2031,  0.0000,  0.0000, 0.9792],
  Head:          [-0.1627, 0.0000,  0.0000, 0.9867],
};

console.log("=== REST POSE (local euler degrees) ===");
Object.entries(REST).forEach(([name, q]) => {
  const quat = new THREE.Quaternion(q[0],q[1],q[2],q[3]);
  const e = new THREE.Euler().setFromQuaternion(quat,"XYZ");
  const d = [e.x,e.y,e.z].map(v=>+(v*180/Math.PI).toFixed(1));
  console.log(name.padEnd(16),"X:"+d[0].toString().padStart(7)," Y:"+d[1].toString().padStart(7)," Z:"+d[2].toString().padStart(7));
});

// Helper
function fromEuler(x,y,z) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x*Math.PI/180,y*Math.PI/180,z*Math.PI/180,"XYZ"));
  return [+q.x.toFixed(5),+q.y.toFixed(5),+q.z.toFixed(5),+q.w.toFixed(5)];
}

// ─── Research: ReadyPlayerMe rig bone axes ────────────────────────────────
// LeftShoulder local euler: X=-38, Y=89, Z=-131
//   → it acts as a ~90° rotated frame, so LeftArm's local axes are ROTATED
//   → In LeftArm local space:
//      +X = roll/twist along the arm
//      +Y = LOWER the arm (arm goes down when Y increases)
//      +Z = swing arm FORWARD toward chest (inward)
//
// To achieve Namaste (hands at chest, fingers up):
//   LeftArm: reduce X (rest=57° → target ~10-20°) = arm moves forward+up
//            increase Z (rest=-3.6° → target ~55-65°) = arm swings inward
//   LeftForeArm: increase Z (rest=25° → target ~85-95°) = elbow bends, forearm goes toward center
//   LeftHand: small Z adjustment for palm alignment

console.log("\n=== NAMASTE TARGET QUATERNIONS ===");

// Strategy based on axis research:
// LeftArm: X=15 (less twist than rest 57, arm goes up+forward), Y=-10, Z=62
const targets = {
  LeftArm:      fromEuler(15, -10, 62),
  LeftForeArm:  fromEuler(-8, -20, 90),   // Z=90 → forearm parallel to ground, pointing inward
  LeftHand:     fromEuler( 0,  5, -12),   // slight wrist rotation for palm alignment
  RightArm:     fromEuler(15,  10,-62),   // exact mirror
  RightForeArm: fromEuler(-8,  20,-90),
  RightHand:    fromEuler( 0, -5,  12),
  Neck:         fromEuler(-18, 0,   0),   // gentle bow
  Head:         fromEuler(-25, 0,   0),
};

Object.entries(targets).forEach(([name,q]) => {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q[0],q[1],q[2],q[3]),"XYZ");
  const d = [e.x,e.y,e.z].map(v=>+(v*180/Math.PI).toFixed(1));
  console.log(name.padEnd(16),"quat:", JSON.stringify(q), "  euler(deg):", d);
});

console.log("\n✅ Use these quaternions in bake-namaste.mjs NAMASTE section.");

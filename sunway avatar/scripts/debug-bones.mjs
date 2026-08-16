/**
 * Debug bone hierarchy and find exact parent chain for each arm bone.
 * This tells us precisely what coordinate frame each bone lives in.
 */
import { NodeIO } from "@gltf-transform/core";
import * as THREE from "three";
import { readFileSync } from "fs";

const glbPath  = "public/models/Namaste.glb";
const glbBuf   = readFileSync(glbPath);

// Parse raw GLB JSON
const jsonLen  = glbBuf.readUInt32LE(12);
const gltf     = JSON.parse(glbBuf.slice(20, 20 + jsonLen).toString("utf8"));

// Build node name index
const byName = {};
gltf.nodes.forEach((n, i) => { byName[n.name] = i; });

// Build parent map
const parentOf = {};
gltf.nodes.forEach((n, i) => {
  (n.children || []).forEach(childIdx => { parentOf[childIdx] = i; });
});

function getAncestors(name) {
  const chain = [name];
  let idx = byName[name];
  while (parentOf[idx] !== undefined) {
    idx = parentOf[idx];
    chain.push(gltf.nodes[idx].name || `node_${idx}`);
  }
  return chain;
}

function qToEuler(q) {
  if (!q) return [0,0,0];
  const quat = new THREE.Quaternion(q[0],q[1],q[2],q[3]);
  const e = new THREE.Euler().setFromQuaternion(quat,"XYZ");
  return [e.x*180/Math.PI, e.y*180/Math.PI, e.z*180/Math.PI].map(v=>+v.toFixed(2));
}

// Print arm bone chain with local rotations
const armBones = [
  "Hips","Spine","Spine1","Spine2",
  "LeftShoulder","LeftArm","LeftForeArm","LeftHand",
  "RightShoulder","RightArm","RightForeArm","RightHand",
  "Neck","Head"
];

console.log("=== BONE HIERARCHY & LOCAL ROTATIONS ===\n");
armBones.forEach(name => {
  const idx  = byName[name];
  const node = gltf.nodes[idx];
  if (!node) return;
  const q  = node.rotation || [0,0,0,1];
  const t  = node.translation || [0,0,0];
  const eu = qToEuler(q);
  const ancestors = getAncestors(name).slice(1,4).join(" → ");
  console.log(`${name.padEnd(18)} local_euler: [${eu.map(v=>v.toString().padStart(7)).join(", ")}]  parent_chain: ${ancestors}`);
});

// ─── Compute world rotation for LeftArm by accumulating parent rotations ───
console.log("\n=== WORLD ROTATION ACCUMULATION ===");
const chainToLeftArm = ["Hips","Spine","Spine1","Spine2","LeftShoulder","LeftArm"];
let worldQ = new THREE.Quaternion(); // identity

chainToLeftArm.forEach(name => {
  const idx  = byName[name];
  const node = gltf.nodes[idx];
  const q    = node?.rotation || [0,0,0,1];
  const lq   = new THREE.Quaternion(q[0],q[1],q[2],q[3]);
  worldQ = worldQ.clone().multiply(lq);
  const e = new THREE.Euler().setFromQuaternion(worldQ,"XYZ");
  const d = [e.x,e.y,e.z].map(v=>+(v*180/Math.PI).toFixed(1));
  console.log(`  After ${name.padEnd(16)}: world_euler = [${d.map(v=>v.toString().padStart(7)).join(", ")}]`);
});

// ─── Figure out what axis to rotate for Namaste ───────────────────────────
console.log("\n=== AXIS ANALYSIS ===");
// In LeftArm local space, the bone Y-axis points down the arm (from shoulder to elbow).
// We need to know what WORLD direction each local axis of LeftArm points.
const leftArmWorldQ = worldQ.clone();

const localX = new THREE.Vector3(1,0,0).applyQuaternion(leftArmWorldQ);
const localY = new THREE.Vector3(0,1,0).applyQuaternion(leftArmWorldQ); // "down the arm"
const localZ = new THREE.Vector3(0,0,1).applyQuaternion(leftArmWorldQ);

console.log("LeftArm LOCAL-X points world:", localX.toArray().map(v=>+v.toFixed(3)));
console.log("LeftArm LOCAL-Y points world:", localY.toArray().map(v=>+v.toFixed(3)), "  ← bone direction (shoulder→elbow)");
console.log("LeftArm LOCAL-Z points world:", localZ.toArray().map(v=>+v.toFixed(3)));

console.log("\n=> To raise arm UP, rotate LeftArm around local axis whose world = +Y or +Z");
console.log("=> To swing arm FORWARD, rotate around local axis whose world = +X or +Z");

// Determine which local axis points most upward
const axes = [{name:"localX",v:localX},{name:"localY",v:localY},{name:"localZ",v:localZ}];
const mostUp = axes.reduce((a,b) => a.v.y > b.v.y ? a : b);
const mostFwd = axes.reduce((a,b) => a.v.z < b.v.z ? a : b);
console.log(`\n=> Most UPWARD local axis: ${mostUp.name} (world Y = ${mostUp.v.y.toFixed(3)})`);
console.log(`=> Most FORWARD local axis: ${mostFwd.name} (world -Z = ${(-mostFwd.v.z).toFixed(3)})`);

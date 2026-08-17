/**
 * AvatarController.jsx
 *
 * Three-avatar lifecycle:
 *   1. Page load      → namaste_girl.glb plays its animation ONCE (greeting)
 *   2. Namaste done   → standing_girl_pose.glb loops its idle animation
 *                       (shown whenever no instruction is active)
 *   3. User speaks /  → explaining_girl_pose.glb loops its animation
 *      AI is talking     (shown when avatarState is talking | thinking | listening)
 *   4. Response done  → back to standing_girl_pose.glb (idle)
 */

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useAssistantStore } from "../../store/assistantStore";
import { LipSyncController } from "./LipSyncController";

// ── Model paths ──────────────────────────────────────────────────────────────
const NAMASTE_PATH    = "/models/namaste_girl.glb";
const IDLE_PATH       = "/models/standing_girl_pose.glb";
const EXPLAINING_PATH = "/models/explaining_girl_pose.glb";

// Pre-load all three so transitions are instant with no network delay
useGLTF.preload(NAMASTE_PATH);
useGLTF.preload(IDLE_PATH);
useGLTF.preload(EXPLAINING_PATH);

// States in which the "explaining" avatar is shown
const ACTIVE_STATES = new Set(["talking", "thinking", "listening"]);

export function AvatarController(props) {
  const { avatarState } = useAssistantStore();

  const [activeAvatar, setActiveAvatar] = useState("namaste");
  const namasteFinished = useRef(false);

  // ── Refs shared across all avatars ────────────────────────────────────────
  const namasteGroup    = useRef();
  const idleGroup       = useRef();
  const explainingGroup = useRef();
  
  const lipSyncIdle       = useRef(null);
  const lipSyncExplaining = useRef(null);

  const blinkTimer  = useRef(0);
  const blinkNext   = useRef(3 + Math.random() * 4);
  const isBlinking  = useRef(false);
  const blinkPhase  = useRef(0);

  // ── Load all three models ─────────────────────────────────────────────────
  const {
    scene:      namasteScene,
    nodes:      namasteNodes,
    materials:  namasteMaterials,
    animations: namasteAnims,
  } = useGLTF(NAMASTE_PATH);
  const { actions: namasteActions } = useAnimations(namasteAnims, namasteGroup);

  const {
    scene:      idleScene,
    nodes:      idleNodes,
    materials:  idleMaterials,
    animations: idleAnims,
  } = useGLTF(IDLE_PATH);
  const { actions: idleActions } = useAnimations(idleAnims, idleGroup);

  const {
    scene:      explainingScene,
    nodes:      explainingNodes,
    materials:  explainingMaterials,
    animations: explainingAnims,
  } = useGLTF(EXPLAINING_PATH);
  const { actions: explainingActions } = useAnimations(explainingAnims, explainingGroup);

  // ── Step 1: Play namaste ONCE on mount, then go to idle ───────────────────
  useEffect(() => {
    if (!namasteAnims || namasteAnims.length === 0) {
      namasteFinished.current = true;
      setActiveAvatar("idle");
      return;
    }

    const clip   = namasteAnims[0];
    const action = namasteActions[clip.name] || Object.values(namasteActions)[0];

    if (!action) {
      namasteFinished.current = true;
      setActiveAvatar("idle");
      return;
    }

    // Play exactly once, hold last frame until timeout fires
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    
    // Speed up the animation by 1.85x to match the voice speed perfectly
    const speedMultiplier = 1.95;
    action.setEffectiveTimeScale(speedMultiplier);
    
    action.reset().play();

    // Adjust delay to match the sped-up animation
    const switchDelay = (clip.duration / speedMultiplier) * 1000 + 400; // ms
    const timer = setTimeout(() => {
      namasteFinished.current = true;
      setActiveAvatar("idle");
    }, switchDelay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namasteActions, namasteAnims]);

  // ── Step 2: Start standing and explaining animations continuously ──────────
  // By playing them immediately, they are never in a T-pose when they become visible
  useEffect(() => {
    if (idleAnims && idleAnims.length > 0) {
      const clip = idleAnims[0];
      const action = idleActions[clip.name] || Object.values(idleActions)[0];
      if (action) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.reset().play();
      }
    }
    
    if (explainingAnims && explainingAnims.length > 0) {
      const clip = explainingAnims[0];
      const action = explainingActions[clip.name] || Object.values(explainingActions)[0];
      if (action) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.reset().play();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleActions, explainingActions, idleAnims, explainingAnims]);

  // ── Step 3: Setup LipSync Controllers ──────────────────────────────────────
  useEffect(() => {
    lipSyncIdle.current = new LipSyncController(idleNodes);
    lipSyncExplaining.current = new LipSyncController(explainingNodes);
  }, [idleNodes, explainingNodes]);

  // ── Step 4: Watch avatarState to switch between idle ↔ explaining ─────────
  // Only fires AFTER the namaste greeting has completed
  useEffect(() => {
    if (!namasteFinished.current) return;

    if (ACTIVE_STATES.has(avatarState)) {
      setActiveAvatar("explaining");
    } else {
      setActiveAvatar("idle");
    }
  }, [avatarState]);

  // ── Material transparency fixes ───────────────────────────────────────────
  useEffect(() => {
    const fix = (mat) => {
      if (!mat) return;
      mat.transparent = false;
      mat.opacity     = 1;
      mat.side        = THREE.FrontSide;
      mat.needsUpdate = true;
    };
    fix(namasteMaterials?.Wolf3D_Skin);
    fix(idleMaterials?.Wolf3D_Skin);
    fix(explainingMaterials?.Wolf3D_Skin);
  }, [namasteMaterials, idleMaterials, explainingMaterials]);

  // ── Per-frame: blink, lip-sync ───────────────────────────────────────────
  useFrame((state, delta) => {
    let activeNodes;
    if (activeAvatar === "namaste") {
      activeNodes = namasteNodes;
    } else if (activeAvatar === "explaining") {
      activeNodes = explainingNodes;
    } else {
      activeNodes = idleNodes;
    }
    if (!activeNodes) return;

    // ── Auto-blink ───────────────────────────────────────────────────────────
    blinkTimer.current += delta;
    if (!isBlinking.current && blinkTimer.current >= blinkNext.current) {
      isBlinking.current = true;
      blinkPhase.current = 0;
      blinkTimer.current = 0;
      blinkNext.current  = 2.5 + Math.random() * 4.5;
    }
    if (isBlinking.current) {
      blinkPhase.current += delta * 9;
      const bv = Math.max(0, Math.sin(blinkPhase.current * Math.PI));
      ["Head_Mesh", "EyeLeft", "EyeRight"].forEach(name => {
        const mesh = activeNodes[name];
        if (!mesh?.morphTargetInfluences) return;
        const idx = mesh.morphTargetDictionary?.["eyesClosed"] ??
                    mesh.morphTargetDictionary?.["eyeBlinkLeft"] ??
                    mesh.morphTargetDictionary?.["eyeBlinkRight"];
        if (idx !== undefined) mesh.morphTargetInfluences[idx] = bv;
      });
      if (blinkPhase.current >= 1) isBlinking.current = false;
    }

    // ── Lip sync (only when avatar is speaking) ─────────────────────────────
    if (activeAvatar === "idle" && lipSyncIdle.current) {
      lipSyncIdle.current.setTalking(avatarState === "talking");
      lipSyncIdle.current.update(delta);
    }
    if (activeAvatar === "explaining" && lipSyncExplaining.current) {
      lipSyncExplaining.current.setTalking(avatarState === "talking");
      lipSyncExplaining.current.update(delta);
    }
  });

  // ── Render all three groups; only the active one is visible ──────────────
  return (
    <>
      {/* 1. Namaste greeting – visible on page load only */}
      <group
        {...props}
        rotation={[0, 0.6, 0]}
        ref={namasteGroup}
        dispose={null}
        visible={activeAvatar === "namaste"}
      >
        <primitive object={namasteScene} />
      </group>

      {/* 2. Standing idle – default when no instruction is active */}
      <group
        {...props}
        ref={idleGroup}
        dispose={null}
        visible={activeAvatar === "idle"}
      >
        <primitive object={idleScene} />
      </group>

      {/* 3. Explaining – shown when user gives a command / AI is responding */}
      <group
        {...props}
        ref={explainingGroup}
        dispose={null}
        visible={activeAvatar === "explaining"}
      >
        <primitive object={explainingScene} />
      </group>
    </>
  );
}

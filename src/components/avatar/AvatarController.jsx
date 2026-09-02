/**
 * AvatarController.jsx
 *
 * Three-avatar lifecycle:
 *   1. Page load      → standing_girl_pose.glb idles (she is simply standing)
 *   2. Greeting audio → namaste_girl.glb bows and joins hands, started by the
 *      actually starts     VOICE, not by a timer, so the bow lands on "नमस्ते"
 *   3. User speaks /  → explaining_girl_pose.glb loops its animation
 *      AI is talking     (shown when avatarState is talking | thinking | listening)
 *   4. Response done  → back to standing_girl_pose.glb (idle)
 *
 * TIMING — why this is event-driven and not on setTimeout
 * -------------------------------------------------------
 * The greeting used to fire the animation on an 800ms timer while the audio
 * was still being fetched and decoded, then play the 5.00s namaste clip at
 * 1.95x speed to "match the voice". Both numbers were guesses, so the bow and
 * the word drifted apart by however long the network took that morning.
 *
 * Now the animation starts from the `onStart` callback of the audio element —
 * the same event that means sound is leaving the speakers — and the clip runs
 * at its natural 5.00s (measured, not guessed), holding the hands-joined pose
 * until speech ends. Network speed can no longer desynchronise them.
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

// Pre-load all model paths
useGLTF.preload(NAMASTE_PATH);
useGLTF.preload(IDLE_PATH);
useGLTF.preload(EXPLAINING_PATH);

// States in which the "explaining" avatar is shown
const ACTIVE_STATES = new Set(["talking", "thinking", "listening"]);

export function AvatarController(props) {
  const { avatarState, currentAnimation } = useAssistantStore();

  // Starts on the standing pose, so she is visibly idle while the greeting
  // audio is still loading rather than frozen mid-bow.
  const [activeAvatar, setActiveAvatar] = useState("idle");

  // ── Refs shared across all avatars ────────────────────────────────────────
  const namasteGroup    = useRef();
  const idleGroup       = useRef();
  const explainingGroup = useRef();
  
  const lipSyncIdle       = useRef(null);
  const lipSyncExplaining = useRef(null);
  const lipSyncNamaste    = useRef(null);
  // Smoothed speech-driven nod amount, applied as an offset on top of whatever
  // the animation clip poses the head to this frame.
  const headNod           = useRef(0);

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

  // ── Step 1: Namaste, started by the voice ─────────────────────────────────
  // Runs when the store says the greeting animation is wanted, which App.jsx
  // sets from the audio's onStart — so the bow begins on the first syllable.
  useEffect(() => {
    if (currentAnimation !== "Namaste") return;

    const clip   = namasteAnims?.[0];
    const action = clip && (namasteActions[clip.name] || Object.values(namasteActions)[0]);
    if (!action) return; // no greeting clip in this model — stay on idle

    setActiveAvatar("namaste");

    // Natural speed. The clip is 5.00s, which closely matches the spoken
    // greeting; clampWhenFinished then holds the hands-joined pose for any
    // remaining words instead of snapping back to idle mid-sentence.
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveTimeScale(1.0);
    action.reset().play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAnimation, namasteActions, namasteAnims]);

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
    // The greeting is spoken while the namaste model is on screen, so it needs
    // a controller too — without one her mouth stayed shut through "नमस्ते".
    lipSyncNamaste.current = new LipSyncController(namasteNodes);
  }, [idleNodes, explainingNodes, namasteNodes]);

  // ── Step 4: Watch avatarState to switch between idle ↔ explaining ─────────
  // The namaste pose owns the avatar for as long as the greeting is playing,
  // so this stands aside while that animation is the requested one.
  useEffect(() => {
    if (currentAnimation === "Namaste") return;
    setActiveAvatar(ACTIVE_STATES.has(avatarState) ? "explaining" : "idle");
  }, [avatarState, currentAnimation]);

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
    let lip = null;
    if (activeAvatar === "idle") lip = lipSyncIdle.current;
    else if (activeAvatar === "explaining") lip = lipSyncExplaining.current;
    else if (activeAvatar === "namaste") lip = lipSyncNamaste.current;

    if (lip) {
      lip.setTalking(avatarState === "talking");
      lip.update(delta);
    }

    // ── Head motion driven by the same voice signal ─────────────────────────
    // A mouth moving on a completely still head is the other half of why the
    // avatar read as robotic. This nods very slightly on loud syllables, so
    // emphasis in the voice shows up in the body — same source as the lips,
    // so it can never drift out of time with them.
    const headBone = activeNodes.Head;
    if (headBone) {
      const drive = avatarState === "talking" ? (lip?.openness || 0) : 0;

      // Smooth the drive, not the bone. The animation mixer rewrites this
      // bone's rotation from the clip every frame, so the nod is ADDED on top
      // afterwards — lerping the rotation itself toward a captured "rest"
      // value would pin her head and cancel the body animation entirely.
      headNod.current += (drive - headNod.current) * Math.min(1, delta * 8);

      const sway = Math.sin(state.clock.elapsedTime * 0.6) * 0.012;
      headBone.rotation.x += -headNod.current * 0.055 + sway * 0.4;
      headBone.rotation.y += sway;
    }
  });

  // ── Render all three groups; only the active one is visible ──────────────
  return (
    <>
      {/* 1. Namaste greeting – plays once on page load */}
      <group
        {...props}
        ref={namasteGroup}
        dispose={null}
        visible={activeAvatar === "namaste"}
        rotation={[0, Math.PI * 0.15, 0]}
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

      {/* 3. Explaining – shown for thinking/listening/talking */}
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

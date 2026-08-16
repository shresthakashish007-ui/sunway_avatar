/*
  Avatar.jsx – ReadyPlayerMe avatar with lipsync + extensible animation system.
  Namaste animation is baked directly into the GLB.
*/

import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import { useFrame, useLoader } from "@react-three/fiber";
import { useControls } from "leva";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// ─── Viseme map ──────────────────────────────────────────────────────────────
const VISEME_MAP = {
  A: "viseme_PP", B: "viseme_kk", C: "viseme_I",
  D: "viseme_AA", E: "viseme_O",  F: "viseme_U",
  G: "viseme_FF", H: "viseme_TH", X: "viseme_PP",
};

// One-shot animations that return to Idle automatically
const ONE_SHOTS = ["Namaste", "Greeting", "Angry"];

export function Avatar(props) {

  // ─── Leva controls ──────────────────────────────────────────────────────
  const {
    playAudio, script, headFollow,
    smoothMorphTarget, morphTargetSmoothing, animationName,
  } = useControls({
    playAudio:            false,
    headFollow:           true,
    smoothMorphTarget:    true,
    morphTargetSmoothing: 0.5,
    script: { value: "welcome", options: ["welcome", "pizzas"] },
    animationName: { value: "Idle", options: ["Idle", "Greeting", "Angry", "Namaste"] },
  });

  // ─── Audio + lipsync ─────────────────────────────────────────────────────
  const audio    = useMemo(() => new Audio(`/audios/${script}.mp3`), [script]);
  const jsonFile = useLoader(THREE.FileLoader, `audios/${script}.json`);
  const lipsync  = useMemo(() => JSON.parse(jsonFile), [jsonFile]);

  // ─── Model (contains the baked Namaste clip) ─────────────────────────────
  const { nodes, materials, animations: glbAnims } = useGLTF(
    "/models/Namaste.glb"
  );

  // ─── FBX clips ───────────────────────────────────────────────────────────
  const { animations: idleAnim }     = useFBX("/animations/Idle.fbx");
  const { animations: angryAnim }    = useFBX("/animations/Angry Gesture.fbx");
  const { animations: greetingAnim } = useFBX("/animations/Standing Greeting.fbx");

  idleAnim[0].name     = "Idle";
  angryAnim[0].name    = "Angry";
  greetingAnim[0].name = "Greeting";

  // ─── Namaste clip from GLB ───────────────────────────────────────────────
  const namasteClip = useMemo(() => {
    const clip = glbAnims.find(c => c.name === "Namaste");
    if (!clip) { console.warn("⚠️ Namaste clip not found in GLB!"); return null; }
    console.log("✅ Namaste clip found — duration:", clip.duration.toFixed(2), "s, tracks:", clip.tracks.length);
    return clip;
  }, [glbAnims]);

  // ─── useAnimations — FBX clips only (body layer) ─────────────────────────
  const group = useRef();
  const { actions: fbxActions } = useAnimations(
    [idleAnim[0], angryAnim[0], greetingAnim[0]],
    group
  );

  // ─── Dedicated mixer for Namaste (GLB clip layer) ─────────────────────────
  // A separate AnimationMixer avoids FBX bone-track conflicts.
  const namasteMixer  = useRef(null);
  const namasteAction = useRef(null);

  useEffect(() => {
    if (!group.current || !namasteClip) return;

    // Create mixer bound to the group's root object
    namasteMixer.current  = new THREE.AnimationMixer(group.current);
    namasteAction.current = namasteMixer.current.clipAction(namasteClip);
    namasteAction.current.setLoop(THREE.LoopOnce, 1);
    namasteAction.current.clampWhenFinished = false;
  }, [namasteClip]);

  // ─── Current animation state ──────────────────────────────────────────────
  const currentAnim = useRef("Idle");

  // ─── playAnimation helper ─────────────────────────────────────────────────
  const playAnimation = (name) => {
    const prev = currentAnim.current;
    if (prev === name) return;
    currentAnim.current = name;

    if (name === "Namaste") {
      // 1. Completely stop ALL FBX actions so they don't override GLB bones
      Object.values(fbxActions).forEach(a => a?.stop());

      // 2. Play Namaste on its own mixer
      if (namasteAction.current) {
        namasteAction.current.reset().fadeIn(0.2).play();
        const duration = (namasteClip.duration - 0.3) * 1000;
        setTimeout(() => {
          if (currentAnim.current === "Namaste") {
            namasteAction.current.fadeOut(0.4);
            // restart idle after fade
            setTimeout(() => playAnimation("Idle"), 400);
          }
        }, Math.max(duration, 100));
      } else {
        console.warn("Namaste action not ready yet");
        playAnimation("Idle");
      }
    } else {
      // Stop Namaste mixer cleanly
      namasteAction.current?.stop();

      // FBX layer
      const next = fbxActions[name];
      if (!next) { console.warn("Unknown animation:", name); return; }
      // Fade out previous FBX action
      if (prev !== "Namaste") fbxActions[prev]?.fadeOut(0.3);
      next.reset().fadeIn(0.3).play();

      // One-shots → return to Idle
      if (ONE_SHOTS.includes(name)) {
        const dur = (fbxActions[name].getClip().duration - 0.3) * 1000;
        setTimeout(() => {
          if (currentAnim.current === name) playAnimation("Idle");
        }, Math.max(dur, 100));
      }
    }
  };

  // Expose globally for AI/LLM integration
  useEffect(() => {
    window.playAnimation = playAnimation;
  });

  // ─── Start Idle on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (fbxActions["Idle"]) {
      fbxActions["Idle"].reset().fadeIn(0.4).play();
      currentAnim.current = "Idle";
    }
  }, [fbxActions]);

  // ─── Sync Leva dropdown ───────────────────────────────────────────────────
  const prevLevaAnim = useRef("Idle");
  useEffect(() => {
    if (animationName !== prevLevaAnim.current) {
      prevLevaAnim.current = animationName;
      playAnimation(animationName);
    }
  }, [animationName]);

  // ─── Sync playAudio ───────────────────────────────────────────────────────
  useEffect(() => {
    if (playAudio) {
      audio.play();
      playAnimation(script === "welcome" ? "Greeting" : "Angry");
    } else {
      audio.pause();
      playAnimation("Idle");
    }
  }, [playAudio, script]);

  // ─── Per-frame: advance namaste mixer + lipsync + head follow ────────────
  useFrame((state, delta) => {
    // Advance the Namaste mixer every frame (only has effect when Namaste is playing)
    namasteMixer.current?.update(delta);

    // Head follow
    if (headFollow && group.current) {
      group.current.getObjectByName("Head")?.lookAt(state.camera.position);
    }

    // Lipsync
    const t = audio.currentTime;
    if (audio.paused || audio.ended) return;

    Object.values(VISEME_MAP).forEach((morphName) => {
      const hInf  = nodes.Wolf3D_Head?.morphTargetInfluences;
      const tInf  = nodes.Wolf3D_Teeth?.morphTargetInfluences;
      const hDict = nodes.Wolf3D_Head?.morphTargetDictionary;
      const tDict = nodes.Wolf3D_Teeth?.morphTargetDictionary;
      if (!hInf) return;
      const hi = hDict[morphName]; const ti = tDict[morphName];
      if (hi === undefined) return;
      if (!smoothMorphTarget) {
        hInf[hi] = 0; tInf[ti] = 0;
      } else {
        hInf[hi] = THREE.MathUtils.lerp(hInf[hi], 0, morphTargetSmoothing);
        tInf[ti] = THREE.MathUtils.lerp(tInf[ti], 0, morphTargetSmoothing);
      }
    });

    for (const cue of lipsync.mouthCues) {
      if (t >= cue.start && t <= cue.end) {
        const morphName = VISEME_MAP[cue.value];
        if (!morphName) break;
        const hInf  = nodes.Wolf3D_Head?.morphTargetInfluences;
        const tInf  = nodes.Wolf3D_Teeth?.morphTargetInfluences;
        const hi    = nodes.Wolf3D_Head?.morphTargetDictionary[morphName];
        const ti    = nodes.Wolf3D_Teeth?.morphTargetDictionary[morphName];
        if (!hInf || hi === undefined) break;
        if (!smoothMorphTarget) {
          hInf[hi] = 1; tInf[ti] = 1;
        } else {
          hInf[hi] = THREE.MathUtils.lerp(hInf[hi], 1, morphTargetSmoothing);
          tInf[ti] = THREE.MathUtils.lerp(tInf[ti], 1, morphTargetSmoothing);
        }
        break;
      }
    }
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <group {...props} dispose={null} ref={group}>
      <primitive object={nodes.Hips} />
      <skinnedMesh geometry={nodes.Wolf3D_Body.geometry}            material={materials.Wolf3D_Body}           skeleton={nodes.Wolf3D_Body.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Bottom.geometry}   material={materials.Wolf3D_Outfit_Bottom}  skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Footwear.geometry} material={materials.Wolf3D_Outfit_Footwear}skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Top.geometry}      material={materials.Wolf3D_Outfit_Top}     skeleton={nodes.Wolf3D_Outfit_Top.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Hair.geometry}            material={materials.Wolf3D_Hair}           skeleton={nodes.Wolf3D_Hair.skeleton} />
      <skinnedMesh name="EyeLeft"
        geometry={nodes.EyeLeft.geometry} material={materials.Wolf3D_Eye}
        skeleton={nodes.EyeLeft.skeleton}
        morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary}
        morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences} />
      <skinnedMesh name="EyeRight"
        geometry={nodes.EyeRight.geometry} material={materials.Wolf3D_Eye}
        skeleton={nodes.EyeRight.skeleton}
        morphTargetDictionary={nodes.EyeRight.morphTargetDictionary}
        morphTargetInfluences={nodes.EyeRight.morphTargetInfluences} />
      <skinnedMesh name="Wolf3D_Head"
        geometry={nodes.Wolf3D_Head.geometry} material={materials.Wolf3D_Skin}
        skeleton={nodes.Wolf3D_Head.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary}
        morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences} />
      <skinnedMesh name="Wolf3D_Teeth"
        geometry={nodes.Wolf3D_Teeth.geometry} material={materials.Wolf3D_Teeth}
        skeleton={nodes.Wolf3D_Teeth.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary}
        morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences} />
    </group>
  );
}

useGLTF.preload("/models/Namaste.glb");

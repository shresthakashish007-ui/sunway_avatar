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

  // ─── Model (contains the baked animation) ─────────────────────────────
  const { scene, nodes, materials, animations: glbAnims } = useGLTF(
    "/models/namaste_girl.glb"
  );
  
  const group = useRef();
  const { actions } = useAnimations(glbAnims, group);

  useEffect(() => {
    if (glbAnims && glbAnims.length > 0) {
      const animName = glbAnims[0].name;
      const action = actions[animName];
      if (action) {
        action.reset().fadeIn(0.5).play();
      }
    }
  }, [actions, glbAnims]);

  // Expose playAnimation stub globally for AI/LLM integration compatibility
  useEffect(() => {
    window.playAnimation = (name) => console.log("Animation requested:", name, "- Ignoring since we use embedded animation");
  });

  // ─── Sync playAudio ───────────────────────────────────────────────────────
  useEffect(() => {
    if (playAudio) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [playAudio, script]);

  // ─── Per-frame: lipsync + head follow ────────────
  useFrame((state, delta) => {

    // Head follow
    if (headFollow && group.current) {
      group.current.getObjectByName("Head")?.lookAt(state.camera.position);
    }

    // Lipsync
    const t = audio.currentTime;
    if (audio.paused || audio.ended) return;

    Object.values(VISEME_MAP).forEach((morphName) => {
      const hInf  = (nodes.Head_Mesh || nodes.Wolf3D_Head)?.morphTargetInfluences;
      const tInf  = (nodes.Teeth_Mesh || nodes.Wolf3D_Teeth)?.morphTargetInfluences;
      const hDict = (nodes.Head_Mesh || nodes.Wolf3D_Head)?.morphTargetDictionary;
      const tDict = (nodes.Teeth_Mesh || nodes.Wolf3D_Teeth)?.morphTargetDictionary;
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
        const hInf  = (nodes.Head_Mesh || nodes.Wolf3D_Head)?.morphTargetInfluences;
        const tInf  = (nodes.Teeth_Mesh || nodes.Wolf3D_Teeth)?.morphTargetInfluences;
        const hi    = (nodes.Head_Mesh || nodes.Wolf3D_Head)?.morphTargetDictionary[morphName];
        const ti    = (nodes.Teeth_Mesh || nodes.Wolf3D_Teeth)?.morphTargetDictionary[morphName];
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
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/models/namaste_girl.glb");

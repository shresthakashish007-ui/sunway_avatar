import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useAssistantStore } from "../../store/assistantStore";
import { LipSyncController } from "./LipSyncController";

const MODEL_PATH = "/models/Namaste.glb";

// FBX semantic → clip name
const FBX_MAP = {
  idle: "Idle", talking: "Idle", thinking: "Idle", listening: "Idle",
  greeting: "Standing Greeting", wave: "Standing Greeting",
  angry: "Angry Gesture",
};
const FBX_ONE_SHOTS = new Set(["greeting","wave","angry"]);

// Emotion → subtle head pose (additive, small values)
const EMOTION_HEAD = {
  neutral:   { x:  0.00, z:  0.00 },
  happy:     { x: -0.04, z:  0.02 },
  excited:   { x: -0.06, z:  0.03 },
  concerned: { x:  0.05, z: -0.03 },
  thinking:  { x:  0.04, z: -0.05 },
};

export function AvatarController(props) {
  const { currentAnimation, currentEmotion, avatarState } = useAssistantStore();

  const group        = useRef();
  const lipSync      = useRef(null);
  const blinkTimer   = useRef(0);
  const blinkNext    = useRef(3 + Math.random() * 4);
  const isBlinking   = useRef(false);
  const blinkPhase   = useRef(0);
  const emotionPose  = useRef({ x: 0, z: 0 });
  const targetPose   = useRef({ x: 0, z: 0 });

  // Namaste
  const namasteMixer  = useRef(null);
  const namasteAction = useRef(null);
  const namasteActive = useRef(false);
  const currentFBX    = useRef("idle");

  // ── Load model ────────────────────────────────────────────────────────────
  const { nodes, materials, animations: glbAnims } = useGLTF(MODEL_PATH);

  // ── Load FBX clips ────────────────────────────────────────────────────────
  const { animations: idleAnims }     = useFBX("/animations/Idle.fbx");
  const { animations: angryAnims }    = useFBX("/animations/Angry Gesture.fbx");
  const { animations: greetingAnims } = useFBX("/animations/Standing Greeting.fbx");

  const fbxClips = useMemo(() => {
    const clips = [];
    if (idleAnims?.[0]) {
      const clip = idleAnims[0].clone();
      clip.name = "Idle";
      // Strip the root Armature track — it doesn't exist in the GLB skeleton
      clip.tracks = clip.tracks.filter(t => !t.name.startsWith("Armature."));
      clips.push(clip);
    }
    if (angryAnims?.[0]) {
      const clip = angryAnims[0].clone();
      clip.name = "Angry Gesture";
      clip.tracks = clip.tracks.filter(t => !t.name.startsWith("Armature."));
      clips.push(clip);
    }
    if (greetingAnims?.[0]) {
      const clip = greetingAnims[0].clone();
      clip.name = "Standing Greeting";
      clip.tracks = clip.tracks.filter(t => !t.name.startsWith("Armature."));
      clips.push(clip);
    }
    return clips;
  }, []);

  const { actions: fbxActions } = useAnimations(fbxClips, group);

  // ── Namaste clip ──────────────────────────────────────────────────────────
  const namasteClip = useMemo(() => {
    return glbAnims?.find(c => c.name === "Namaste") || null;
  }, [glbAnims]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    lipSync.current = new LipSyncController(nodes);
  }, [nodes]);

  useEffect(() => {
    if (!group.current || !namasteClip) return;
    namasteMixer.current  = new THREE.AnimationMixer(group.current);
    namasteAction.current = namasteMixer.current.clipAction(namasteClip);
    namasteAction.current.setLoop(THREE.LoopOnce, 1);
    namasteAction.current.clampWhenFinished = false;
  }, [namasteClip]);

  useEffect(() => {
    if (fbxActions["Idle"]) {
      fbxActions["Idle"].reset().fadeIn(0.4).play();
      currentFBX.current = "idle";
    }
  }, [fbxActions]);

  // ── FBX play ──────────────────────────────────────────────────────────────
  const playFBX = (semantic) => {
    if (namasteActive.current) return;
    const clipName = FBX_MAP[semantic] || "Idle";
    const prevName = FBX_MAP[currentFBX.current] || "Idle";
    const next = fbxActions[clipName];
    const prev = fbxActions[prevName];
    if (!next) return;
    if (clipName === prevName && next.isRunning()) return;
    prev?.fadeOut(0.35);
    next.reset().fadeIn(0.35).play();
    currentFBX.current = semantic;
    if (FBX_ONE_SHOTS.has(semantic)) {
      const dur = (next.getClip().duration - 0.3) * 1000;
      setTimeout(() => {
        if (currentFBX.current === semantic && !namasteActive.current) playFBX("idle");
      }, Math.max(dur, 200));
    }
  };

  // ── Namaste play ──────────────────────────────────────────────────────────
  const playNamaste = () => {
    if (!namasteAction.current || !namasteMixer.current) { playFBX("greeting"); return; }
    Object.values(fbxActions).forEach(a => a?.stop());
    namasteActive.current = true;
    namasteAction.current.reset().play();
    const dur = (namasteClip?.duration || 3.2) * 1000;
    setTimeout(() => {
      namasteAction.current?.stop();
      namasteActive.current = false;
      currentFBX.current = "idle";
      fbxActions["Idle"]?.reset().fadeIn(0.4).play();
    }, dur + 200);
  };

  // ── Respond to store changes ───────────────────────────────────────────────
  useEffect(() => {
    if (!fbxActions["Idle"]) return;
    const anim = currentAnimation.toLowerCase().trim();
    if (anim === "namaste") playNamaste();
    else playFBX(anim.replace(/ /g,"_"));
  }, [currentAnimation, fbxActions]);

  // Update emotion target
  useEffect(() => {
    const pose = EMOTION_HEAD[currentEmotion] || EMOTION_HEAD.neutral;
    targetPose.current = pose;
  }, [currentEmotion]);

  // ── Per-frame ─────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    if (!group.current) return;

    // Advance Namaste mixer
    if (namasteActive.current && namasteMixer.current) {
      namasteMixer.current.update(delta);
    }

    // Head follow camera (smooth)
    const headBone = group.current.getObjectByName("Head");
    if (headBone && !namasteActive.current) {
      const camPos   = state.camera.position;
      const headPos  = headBone.getWorldPosition(new THREE.Vector3());
      const dir      = new THREE.Vector3().subVectors(camPos, headPos).normalize();
      const targetY  = Math.atan2(dir.x, dir.z) * 0.12; // subtle left/right
      const targetX  = -dir.y * 0.08;                    // subtle up/down

      // Smooth emotion pose blend
      emotionPose.current.x = THREE.MathUtils.lerp(emotionPose.current.x, targetPose.current.x, delta * 2);
      emotionPose.current.z = THREE.MathUtils.lerp(emotionPose.current.z, targetPose.current.z, delta * 2);

      headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, targetY, delta * 3);
      headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, targetX + emotionPose.current.x, delta * 3);
      headBone.rotation.z = THREE.MathUtils.lerp(headBone.rotation.z, emotionPose.current.z, delta * 3);
    }

    // Subtle body sway when talking
    const spineBone = group.current.getObjectByName("Spine");
    if (spineBone && avatarState === "talking") {
      spineBone.rotation.z = Math.sin(state.clock.elapsedTime * 1.2) * 0.008;
      spineBone.rotation.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.005;
    }

    // Auto-blink
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
      ["EyeLeft","EyeRight"].forEach(name => {
        const mesh = nodes[name];
        if (!mesh?.morphTargetInfluences) return;
        const idx = mesh.morphTargetDictionary?.["eyesClosed"] ??
                    mesh.morphTargetDictionary?.["eyeBlinkLeft"] ??
                    mesh.morphTargetDictionary?.["eyeBlinkRight"];
        if (idx !== undefined) mesh.morphTargetInfluences[idx] = bv;
      });
      if (blinkPhase.current >= 1) isBlinking.current = false;
    }

    // Lip sync
    if (lipSync.current) {
      lipSync.current.setTalking(avatarState === "talking");
      lipSync.current.update(delta);
    }
  });

  // Ensure materials are properly configured
  useEffect(() => {
    if (materials.Wolf3D_Skin) {
      materials.Wolf3D_Skin.transparent = false;
      materials.Wolf3D_Skin.opacity = 1;
      materials.Wolf3D_Skin.side = THREE.FrontSide;
      materials.Wolf3D_Skin.needsUpdate = true;
    }
  }, [materials]);

  return (
    <group {...props} dispose={null} ref={group}>
      <primitive object={nodes.Hips} />
      <skinnedMesh geometry={nodes.Wolf3D_Body.geometry}            material={materials.Wolf3D_Body}           skeleton={nodes.Wolf3D_Body.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Bottom.geometry}   material={materials.Wolf3D_Outfit_Bottom}  skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Footwear.geometry} material={materials.Wolf3D_Outfit_Footwear}skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Top.geometry}      material={materials.Wolf3D_Outfit_Top}     skeleton={nodes.Wolf3D_Outfit_Top.skeleton} />
      <skinnedMesh geometry={nodes.Wolf3D_Hair.geometry}            material={materials.Wolf3D_Hair}           skeleton={nodes.Wolf3D_Hair.skeleton} />
      <skinnedMesh name="EyeLeft"    geometry={nodes.EyeLeft.geometry}    material={materials.Wolf3D_Eye}   skeleton={nodes.EyeLeft.skeleton}    morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary}    morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences} />
      <skinnedMesh name="EyeRight"   geometry={nodes.EyeRight.geometry}   material={materials.Wolf3D_Eye}   skeleton={nodes.EyeRight.skeleton}   morphTargetDictionary={nodes.EyeRight.morphTargetDictionary}   morphTargetInfluences={nodes.EyeRight.morphTargetInfluences} />
      <skinnedMesh name="Wolf3D_Head"  geometry={nodes.Wolf3D_Head.geometry}  material={materials.Wolf3D_Skin}  skeleton={nodes.Wolf3D_Head.skeleton}  morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary}  morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences} castShadow receiveShadow />
      <skinnedMesh name="Wolf3D_Teeth" geometry={nodes.Wolf3D_Teeth.geometry} material={materials.Wolf3D_Teeth} skeleton={nodes.Wolf3D_Teeth.skeleton} morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary} morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences} />
    </group>
  );
}

useGLTF.preload(MODEL_PATH);

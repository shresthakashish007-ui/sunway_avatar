import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import React, { Suspense } from "react";
import { AvatarController } from "./AvatarController";

export function AvatarScene() {
  return (
    <div style={{
      position: "relative", width: "100%", height: "100%",
      overflow: "hidden",
      /* Avatar background image */
      backgroundImage: "url('/img/avatar_background/Background_Img_3D.png')",
      backgroundSize: "cover",
      backgroundPosition: "center top",
      backgroundRepeat: "no-repeat",
    }}>
      {/* Subtle dark overlay at bottom for depth */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "25%",
        background: "linear-gradient(0deg, rgba(0,0,0,0.08) 0%, transparent 100%)",
        pointerEvents: "none", zIndex: 1,
      }} />

      <Canvas
        shadows
        camera={{ position: [0, 0.35, 5.2], fov: 42 }}
        style={{ position: "absolute", inset: 0, background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
      >
        {/* Warm studio lighting */}
        <ambientLight intensity={0.8} color="#fff8f0" />
        <directionalLight position={[-1.5, 5, 4]} intensity={1.8} color="#fffaf5" castShadow />
        <directionalLight position={[3, 2, 2]} intensity={0.5} color="#ffeedd" />
        <pointLight position={[0, 4, -2]} intensity={0.3} color="#ffe0d0" />

        <Suspense fallback={null}>
          <AvatarController position={[0, -2.9, 0]} scale={2} />
          <ContactShadows
            position={[0, -2.95, 0]}
            opacity={0.12} scale={5} blur={2} far={4}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

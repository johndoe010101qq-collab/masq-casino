import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

function seeded(index, salt = 0) {
  let value = ((index + 1) * 2654435761 + salt * 2246822519) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 2246822519) >>> 0;
  value ^= value >>> 13;
  return (value >>> 0) / 4294967296;
}

function sprite(color, size = 128) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.14, color);
  gradient.addColorStop(0.45, "rgba(201,184,158,0.08)");
  gradient.addColorStop(1, "rgba(201,184,158,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return canvas;
}

// Light/sparks are raster drawImage operations, never SVG/CSS-shaped chips.
function RasterLight({ tier, elapsed }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 1, height: 1, dpr: 1 });
  const sprites = useMemo(() => ({
    spark: sprite("rgba(255,229,132,0.95)", 64),
    halo: sprite("rgba(194,45,84,0.5)", 256),
  }), []);

  useEffect(() => {
    const element = ref.current;
    const resize = () => {
      const bounds = element.getBoundingClientRect();
      setSize({
        width: Math.max(1, bounds.width),
        height: Math.max(1, bounds.height),
        dpr: Math.min(1.4, window.devicePixelRatio || 1),
      });
    };
    resize();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useLayoutEffect(() => {
    const canvas = ref.current;
    const context = canvas.getContext("2d");
    if (!context || !sprites.halo || !sprites.spark) return;
    const { width, height, dpr } = size;
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = "screen";
    const seconds = elapsed / 1000;
    const haloSize = Math.min(width * 1.1, 1100);
    context.globalAlpha = tier ? Math.max(0, 0.5 - seconds * 0.08) : 0.16;
    context.drawImage(
      sprites.halo,
      width / 2 - haloSize / 2,
      height * 0.47 - haloSize / 2,
      haloSize, haloSize,
    );

    const count = [0, 30, 44, 60, 80][tier];
    for (let index = 0; index < count; index += 1) {
      const age = seconds - seeded(index, 2) * 0.28;
      const life = 1.1 + seeded(index, 6) * 1.1;
      if (age < 0 || age >= life) continue;
      const angle = -Math.PI + seeded(index, 3) * Math.PI * 2;
      const speed = 110 + seeded(index, 4) * Math.min(width, height) * 0.7;
      const x = width * 0.5 + Math.cos(angle) * speed * age;
      const y = height * 0.44 + Math.sin(angle) * speed * age - 110 * age + 150 * age ** 2;
      const radius = 3 + seeded(index, 5) * 5;
      context.globalAlpha = (1 - age / life) ** 2 * 0.68;
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.drawImage(sprites.spark, -radius * 2, -radius / 2, radius * 4, radius);
      context.restore();
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }, [elapsed, size, sprites, tier]);

  return <canvas ref={ref} className="payout-raster-light" />;
}

function Coins({ tier, elapsed }) {
  const count = [0, 18, 30, 46, 64][tier];
  const bodyRef = useRef(null);
  const insetRef = useRef(null);
  const faceRef = useRef(null);
  const { viewport, invalidate } = useThree();
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const resources = useMemo(() => ({
    bodyGeometry: new THREE.CylinderGeometry(0.17, 0.17, 0.058, 12),
    insetGeometry: new THREE.CylinderGeometry(0.117, 0.117, 0.066, 12),
    faceGeometry: new THREE.CylinderGeometry(0.072, 0.072, 0.072, 12),
    bodyMaterial: new THREE.MeshStandardMaterial({
      color: "#ffffff", roughness: 0.35, metalness: 0.7, flatShading: true,
    }),
    insetMaterial: new THREE.MeshStandardMaterial({
      color: "#24272c", roughness: 0.65, metalness: 0.5, flatShading: true,
    }),
    faceMaterial: new THREE.MeshStandardMaterial({
      color: "#ffdc8b", roughness: 0.32, metalness: 0.7, flatShading: true,
    }),
  }), []);

  const coins = useMemo(() => Array.from({ length: count }, (_, index) => ({
    delay: seeded(index, 1) * 0.24,
    vx: (seeded(index, 2) * 2 - 1) * 1.6,
    vy: 3.1 + seeded(index, 3) * 3.5,
    scale: 0.65 + seeded(index, 4) * 0.65,
    phase: seeded(index, 5) * Math.PI * 2,
    spinX: (seeded(index, 6) * 2 - 1) * 5,
    spinY: (seeded(index, 7) * 2 - 1) * 7,
    spinZ: (seeded(index, 8) * 2 - 1) * 3.5,
    red: seeded(index, 9) > 0.55,
  })), [count]);

  useLayoutEffect(() => {
    const color = new THREE.Color();
    coins.forEach((coin, index) => {
      color.set(coin.red ? "#c43f61" : "#f3c65f");
      bodyRef.current?.setColorAt(index, color);
    });
    if (bodyRef.current?.instanceColor) bodyRef.current.instanceColor.needsUpdate = true;
    invalidate();
  }, [coins, invalidate]);

  useEffect(() => { invalidate(); }, [elapsed, invalidate]);

  useEffect(() => {
    // Capture instances now: refs can already be detached by passive cleanup.
    const instances = [bodyRef.current, insetRef.current, faceRef.current];
    return () => {
      for (const instance of instances) instance?.dispose();
      for (const resource of Object.values(resources)) resource.dispose();
    };
  }, [resources]);

  useFrame(() => {
    const seconds = elapsed / 1000;
    const spread = Math.min(2.9, viewport.width * 0.3);
    const originY = viewport.height * 0.075;
    coins.forEach((coin, index) => {
      const age = seconds - coin.delay;
      const active = age >= 0 && age <= 3.3;
      const time = Math.max(0, age);
      scratch.position.set(
        coin.vx * spread * time,
        originY + coin.vy * time - 2.8 * time ** 2,
        -0.2 + Math.sin(coin.phase + time * 2.5) * 0.3,
      );
      scratch.rotation.set(
        Math.PI / 2 + coin.spinX * time,
        coin.phase + coin.spinY * time,
        coin.spinZ * time,
      );
      scratch.scale.setScalar(active ? coin.scale : 0);
      scratch.updateMatrix();
      bodyRef.current?.setMatrixAt(index, scratch.matrix);
      insetRef.current?.setMatrixAt(index, scratch.matrix);
      faceRef.current?.setMatrixAt(index, scratch.matrix);
    });
    for (const ref of [bodyRef, insetRef, faceRef]) {
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group dispose={null}>
      <instancedMesh ref={bodyRef} args={[resources.bodyGeometry, resources.bodyMaterial, count]}
        frustumCulled={false} dispose={null} />
      <instancedMesh ref={insetRef} args={[resources.insetGeometry, resources.insetMaterial, count]}
        frustumCulled={false} dispose={null} />
      <instancedMesh ref={faceRef} args={[resources.faceGeometry, resources.faceMaterial, count]}
        frustumCulled={false} dispose={null} />
    </group>
  );
}

export default function PayoutFx({ tier, elapsed }) {
  return (
    <>
      <RasterLight tier={tier} elapsed={elapsed} />
      {tier > 0 && (
        <div className="payout-physical-chips">
          <Canvas
            orthographic
            frameloop="demand"
            dpr={[1, 1.4]}
            camera={{ position: [0, 0, 10], zoom: 88, near: 0.1, far: 30 }}
            gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
            fallback={null}
          >
            <ambientLight intensity={1.05} />
            <directionalLight position={[2, 4, 6]} intensity={2.1} />
            <directionalLight position={[-4, 1, 3]} color="#d3bfa4" intensity={0.65} />
            <Coins tier={tier} elapsed={elapsed} />
          </Canvas>
        </div>
      )}
    </>
  );
}

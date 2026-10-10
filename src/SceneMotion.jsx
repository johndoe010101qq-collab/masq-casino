import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const damp = (current, target, speed, delta) =>
  target + (current - target) * Math.exp(-speed * delta);

export function useReducedMotion(forceReduce = false) {
  const [systemReduce, setSystemReduce] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduce(query.matches);
    update();
    if (query.addEventListener) query.addEventListener('change', update);
    else query.addListener(update);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', update);
      else query.removeListener(update);
    };
  }, []);

  return Boolean(forceReduce || systemReduce);
}

export function usePageVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return visible;
}

export function useSceneActivity(
  containerRef,
  { enabled = true, reducedMotion: forceReduce = false } = {}
) {
  const [inView, setInView] = useState(false);
  const pageVisible = usePageVisible();
  const reducedMotion = useReducedMotion(forceReduce);

  useEffect(() => {
    const node = containerRef?.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  return {
    active: Boolean(enabled && inView && pageVisible && !reducedMotion),
    inView,
    pageVisible,
    reducedMotion,
  };
}

export function FramePump({ active, fps = 30, reducedMotion: forceReduce = false }) {
  const invalidate = useThree(state => state.invalidate);
  const pageVisible = usePageVisible();
  const reducedMotion = useReducedMotion(forceReduce);
  const rate = Number.isFinite(fps) ? clamp(fps, 10, 60) : 30;

  useEffect(() => {
    invalidate();
    if (!active || !pageVisible || reducedMotion) return;

    let stopped = false;
    let raf = 0;
    let nextFrame = null;
    const interval = 1000 / rate;

    const tick = now => {
      if (stopped) return;
      if (nextFrame === null) nextFrame = now;
      if (now + 0.5 >= nextFrame) {
        invalidate();
        nextFrame += interval;
        if (nextFrame <= now) nextFrame = now + interval;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [active, pageVisible, reducedMotion, rate, invalidate]);

  return null;
}

// Presentation only: never changes outcome, elapsed, balance, or round lifecycle.
// Place floors/tables outside this group so they stay grounded.
export function PresentationRig({
  children,
  active,
  idle = true,
  reducedMotion: forceReduce = false,
  yawAmplitude = 0.13,
  floatAmplitude = 0,
  basePosition = [0, 0, 0],
  baseRotation = [0, 0, 0],
}) {
  const group = useRef();
  const phase = useRef(0);
  const pageVisible = usePageVisible();
  const reducedMotion = useReducedMotion(forceReduce);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.05);
    const moving = Boolean(active && idle && pageVisible && !reducedMotion);
    if (moving) phase.current += dt;

    const yaw = moving
      ? baseRotation[1] + Math.sin(phase.current * 0.65) * yawAmplitude
      : baseRotation[1];
    const y = moving
      ? basePosition[1] + Math.sin(phase.current * 1.1) * floatAmplitude
      : basePosition[1];

    if (reducedMotion) {
      node.rotation.y = baseRotation[1];
      node.position.y = basePosition[1];
      return;
    }
    node.rotation.y = damp(node.rotation.y, yaw, 6, dt);
    node.position.y = damp(node.position.y, y, 6, dt);
  });

  return (
    <group ref={group} position={basePosition} rotation={baseRotation}>
      {children}
    </group>
  );
}

"use client";

import { useEffect, useRef } from "react";

const MAX_TILT_DEG = 9;
const ORIENTATION_TILT_RANGE_DEG = 22;
const ORIENTATION_GRANTED_EVENT = "tilt-orientation-granted";

type OrientationPermissionAPI = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function getOrientationApi(): OrientationPermissionAPI | undefined {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return undefined;
  return window.DeviceOrientationEvent as OrientationPermissionAPI;
}

/** True on devices (iOS 13+ Safari) that require an explicit user gesture to read the motion sensor. */
export function tiltNeedsOrientationPermission() {
  return typeof getOrientationApi()?.requestPermission === "function";
}

/** Call from a click/tap handler — must run inside a user gesture on iOS. */
export async function requestTiltOrientationPermission() {
  const api = getOrientationApi();
  if (!api?.requestPermission) return true;
  const result = await api.requestPermission();
  const granted = result === "granted";
  if (granted) window.dispatchEvent(new Event(ORIENTATION_GRANTED_EVENT));
  return granted;
}

/**
 * Pointer-tracked 3D tilt + pedestal-shadow illusion for a single "vitrine" card.
 * Desktop: follows the cursor. Touch devices: follows the phone's own tilt
 * (device orientation) instead, since there's no hover position to track.
 * Writes CSS custom properties on the returned ref's element; the visuals
 * (transform/shadow/sheen) live in CSS so this stays pure interaction logic.
 */
export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    const applyTilt = (px: number, py: number) => {
      const rotateY = (px - 0.5) * MAX_TILT_DEG * 2;
      const rotateX = -(py - 0.5) * MAX_TILT_DEG * 2;
      el.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`);
      el.style.setProperty("--shadow-x", `${((px - 0.5) * -16).toFixed(2)}px`);
      el.style.setProperty("--shadow-y", `${((py - 0.5) * -6 + 8).toFixed(2)}px`);
      el.style.setProperty("--sheen-x", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--sheen-y", `${(py * 100).toFixed(1)}%`);
    };

    const reset = () => {
      cancelAnimationFrame(frame);
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
      el.style.setProperty("--shadow-x", "0px");
      el.style.setProperty("--shadow-y", "8px");
    };

    reset();

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const handleMove = (event: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => applyTilt(px, py));
      };
      el.addEventListener("pointermove", handleMove);
      el.addEventListener("pointerleave", reset);
      return () => {
        cancelAnimationFrame(frame);
        el.removeEventListener("pointermove", handleMove);
        el.removeEventListener("pointerleave", reset);
      };
    }

    // Touch device: no cursor to track, so tilt with the phone itself instead.
    let baseBeta: number | null = null;
    let baseGamma: number | null = null;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      if (baseBeta === null || baseGamma === null) {
        baseBeta = event.beta;
        baseGamma = event.gamma;
      }
      const leanForwardBack = Math.max(-1, Math.min(1, (event.beta - baseBeta) / ORIENTATION_TILT_RANGE_DEG));
      const leanLeftRight = Math.max(-1, Math.min(1, (event.gamma - baseGamma) / ORIENTATION_TILT_RANGE_DEG));

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => applyTilt(0.5 + leanLeftRight / 2, 0.5 + leanForwardBack / 2));
    };

    const attach = () => window.addEventListener("deviceorientation", handleOrientation);
    const detach = () => window.removeEventListener("deviceorientation", handleOrientation);

    if (tiltNeedsOrientationPermission()) {
      window.addEventListener(ORIENTATION_GRANTED_EVENT, attach);
    } else {
      attach();
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(ORIENTATION_GRANTED_EVENT, attach);
      detach();
    };
  }, []);

  return ref;
}

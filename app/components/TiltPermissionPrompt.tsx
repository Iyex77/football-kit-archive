"use client";

import { useEffect, useState } from "react";
import { requestTiltOrientationPermission, tiltNeedsOrientationPermission } from "../lib/useTilt";

/** Small opt-in shown only where it's needed: iOS Safari, which requires a tap before it will share motion-sensor data. */
export function TiltPermissionPrompt() {
  const [needsPermission, setNeedsPermission] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    setNeedsPermission(tiltNeedsOrientationPermission());
  }, []);

  if (!needsPermission || isEnabled) return null;

  return (
    <button
      type="button"
      className="tilt-permission-prompt"
      onClick={async () => {
        const granted = await requestTiltOrientationPermission();
        if (granted) setIsEnabled(true);
      }}
    >
      Activar vista 3D al inclinar el móvil
    </button>
  );
}

"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";

export function ToastProvider() {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-sonner-toast]")) return;
      toast.dismiss();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  return (
    <Toaster
      closeButton
      richColors
      theme="dark"
      position="bottom-center"
      visibleToasts={1}
      duration={4200}
      gap={8}
      offset={18}
      className="app-toaster"
      toastOptions={{
        classNames: {
          toast: "app-toast",
          closeButton: "app-toast-close",
          title: "app-toast-title",
          description: "app-toast-description",
        },
      }}
    />
  );
}

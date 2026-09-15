"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    void import("@serwist/window").then(({ Serwist }) => {
      if (cancelled) return;
      const serwist = new Serwist("/sw.js", {
        scope: "/",
        type: "classic",
      });
      void serwist.register();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

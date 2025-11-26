"use client";

import { useEffect } from "react";

export default function useBfcacheReload(): void {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      // debug log (remove in production if desired)
      console.debug("pageshow event, persisted:", e.persisted);
      if (e.persisted) {
        // Force a reload so middleware and server auth checks run.
        // Using location.reload(true) is deprecated; reload() will do a fresh load.
        window.location.reload();
      }
    };

    const onPopState = () => {
      // Back/Forward navigation: reload to ensure server-side auth check happens.
      console.debug("popstate event - forcing reload to revalidate auth");
      window.location.reload();
    };

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
}
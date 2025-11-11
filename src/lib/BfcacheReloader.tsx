"use client";

import useBfcacheReload from "./useBfcacheReload";

/**
 * Small client component that applies the useBfcacheReload hook when rendered.
 * Render this inside server layouts (e.g. src/app/layout.tsx and src/app/admin/layout.tsx)
 * so any page restored from bfcache will reload.
 */
export default function BfcacheReloader(): null {
  useBfcacheReload();
  return null;
}

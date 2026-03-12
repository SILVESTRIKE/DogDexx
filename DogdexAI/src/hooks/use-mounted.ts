import { useState, useEffect } from 'react';

/**
 * A simple hook to check if the component has mounted on the client.
 * This is useful to prevent hydration mismatches for components that should only render on the client.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
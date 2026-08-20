import { useEffect, useState } from 'react';

const DEFAULT_DELAY_MS = 4000;

// Render's free tier spins the backend down after inactivity, so the first
// request after a while can take up to ~50s instead of the usual <1s. Flips
// `true` once `active` has stayed true for `delayMs`, so slow-network users
// don't see the notice flash on every normal request.
export function useSlowRequestNotice(active, delayMs = DEFAULT_DELAY_MS) {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    if (!active) {
      setWaking(false);
      return;
    }
    const timer = setTimeout(() => setWaking(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return waking;
}

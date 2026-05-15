import { useEffect, useRef, useState } from 'react';

/**
 * Returns a ref + boolean. The boolean flips to `true` the first time the
 * referenced element either enters the viewport or 1.5 s elapses (so
 * below-the-fold elements still reveal eventually, and headless screenshots
 * always capture the visible state). Stays true afterwards.
 */
export function useInView<T extends HTMLElement>(rootMargin = '0px 0px 80px 0px') {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;

    // Fallback: reveal after a short delay even if the observer never fires
    // (covers fullPage screenshots and edge cases where the element is
    // already on-screen but the initial intersection callback never lands).
    const fallback = window.setTimeout(() => setVisible(true), 1500);

    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return () => clearTimeout(fallback);

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            clearTimeout(fallback);
            break;
          }
        }
      },
      { rootMargin, threshold: 0.05 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      clearTimeout(fallback);
    };
  }, [visible, rootMargin]);

  return { ref, visible } as const;
}

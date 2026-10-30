import { useEffect } from 'react';

const SELECTOR = '.btn, .l-btn, .hero-cta';

// One delegated listener gives every button a press ripple, so no button needs its own handler.
export default function useButtonRipple() {
  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduceMotion) return undefined;

    function onPointerDown(event) {
      const button = event.target.closest?.(SELECTOR);
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;

      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      ripple.setAttribute('aria-hidden', 'true');
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      button.appendChild(ripple);
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);
}

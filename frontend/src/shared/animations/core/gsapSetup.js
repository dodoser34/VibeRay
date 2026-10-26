import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from '@/shared/hooks/useReducedMotion';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
gsap.defaults({ ease: 'power3.out', duration: 0.6 });

// Reduced motion: каждая шкала играет почти мгновенно — не нужно переписывать каждую анимацию.
if (prefersReducedMotion()) {
  gsap.globalTimeline.timeScale(20);
}

export { gsap, ScrollTrigger, SplitText, useGSAP };

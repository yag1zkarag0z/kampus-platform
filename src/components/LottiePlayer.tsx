"use client";

import { useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web/build/player/lottie_light";

interface LottiePlayerProps {
  animationData: object;
  className?: string;
}

export default function LottiePlayer({
  animationData,
  className = "",
}: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const anim: AnimationItem = lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: !reduceMotion,
      autoplay: false,
      animationData,
    });

    if (reduceMotion) {
      // Show the finished, settled state instead of animating.
      anim.goToAndStop(anim.totalFrames - 1, true);
    } else {
      anim.play();
    }

    // Pause the (JS-driven) animation while it's off-screen so it isn't
    // spending CPU on frames nobody sees.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (reduceMotion) {
          return;
        }

        if (entry.isIntersecting) {
          anim.play();
        } else {
          anim.pause();
        }
      },
      { threshold: 0 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      anim.destroy();
    };
  }, [animationData]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    />
  );
}

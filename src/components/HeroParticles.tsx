import type { CSSProperties } from "react";

export interface HeroParticle {
  id: number;
  top: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  warm: boolean;
}

/**
 * Deterministic PRNG (mulberry32) so server- and client-rendered particle
 * positions match exactly and never trigger a hydration diff.
 */
export function createHeroParticles(
  count: number,
  seed = 0x9a5944
): HeroParticle[] {
  let state = seed;

  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: count }, (_, id) => ({
    id,
    top: next() * 100,
    left: next() * 100,
    size: 1 + next() * 2.1,
    duration: 16 + next() * 26,
    delay: -(next() * 30),
    opacity: 0.3 + next() * 0.55,
    warm: next() > 0.82,
  }));
}

interface HeroParticlesProps {
  particles: HeroParticle[];
  className?: string;
}

export default function HeroParticles({
  particles,
  className = "",
}: HeroParticlesProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="hero-particle"
          style={
            {
              top: `${particle.top}%`,
              left: `${particle.left}%`,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.warm ? "#ff9d6c" : "#ffffff",
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
              "--particle-opacity": particle.opacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

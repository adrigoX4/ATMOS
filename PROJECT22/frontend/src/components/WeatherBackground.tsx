import React, { useEffect, useRef } from 'react';

export interface WeatherBackgroundProps {
  weatherCode?: number;
  precipitation?: number;
  cloudCover?: number;
  isDay?: number;
  windSpeed?: number;
  windDirection?: number;
  isArid?: boolean;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
  twinkleSpeed: number;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
  active: boolean;
}

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  len: number;
  alpha: number;
}

interface RainSplash {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  angle: number;
  angularSpeed: number;
  alpha: number;
}

interface DustParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
}

interface LightningBranch {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const WeatherBackground: React.FC<WeatherBackgroundProps> = ({
  weatherCode = 0,
  precipitation = 0,
  cloudCover = 20,
  isDay = 0,
  windSpeed = 8,
  isArid = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const hasRain =
      precipitation > 0.05 ||
      (weatherCode >= 50 && weatherCode <= 67) ||
      (weatherCode >= 80 && weatherCode <= 82);
    const hasThunder = weatherCode >= 95;
    const hasSnow = weatherCode >= 71 && weatherCode <= 77;
    const hasFog = weatherCode === 45 || weatherCode === 48;
    const isOvercast = cloudCover >= 80 || weatherCode === 3;
    const isNight = !isDay;

    // Delicate, non-intrusive micro-stars (0.35px - 1.2px)
    const stars: Star[] = Array.from({ length: isNight && !isOvercast ? 240 : 0 }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.75),
      radius: Math.random() * 0.85 + 0.35,
      alpha: Math.random() * Math.PI * 2,
      baseAlpha: Math.random() * 0.5 + 0.25,
      twinkleSpeed: Math.random() * 0.02 + 0.008,
    }));

    const comets: Comet[] = Array.from({ length: 2 }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      length: 0,
      alpha: 0,
      active: false,
    }));

    const launchComet = (comet: Comet) => {
      comet.x = Math.random() * width * 0.6 + width * 0.1;
      comet.y = Math.random() * height * 0.25;
      const speed = Math.random() * 12 + 14;
      const angle = Math.PI / 4 + (Math.random() * 0.2 - 0.1);
      comet.vx = Math.cos(angle) * speed;
      comet.vy = Math.sin(angle) * speed;
      comet.length = Math.random() * 80 + 60;
      comet.alpha = 0.85;
      comet.active = true;
    };

    const dropDensity = Math.min(Math.floor(precipitation * 35 + 75), 260);
    const raindrops: RainDrop[] = Array.from({ length: hasRain ? dropDensity : 0 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: Math.random() * 14 + 18,
      len: Math.random() * 20 + 12,
      alpha: Math.random() * 0.35 + 0.2,
    }));
    const splashes: RainSplash[] = [];

    const snowflakes: Snowflake[] = Array.from({ length: hasSnow ? 110 : 0 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 0.8,
      speed: Math.random() * 1.4 + 0.6,
      drift: Math.random() * 0.6 - 0.3,
      angle: Math.random() * Math.PI * 2,
      angularSpeed: Math.random() * 0.015 - 0.007,
      alpha: Math.random() * 0.5 + 0.25,
    }));

    const dustParticles: DustParticle[] = Array.from({ length: isArid ? 65 : 0 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.8 + 0.6,
      vx: (Math.random() - 0.2) * (windSpeed * 0.1 + 0.35),
      vy: -Math.random() * 0.5 - 0.15,
      alpha: Math.random() * 0.3 + 0.1,
    }));

    let lightningTimer = 0;
    let lightningFlash = 0;
    let lightningBranches: LightningBranch[] = [];

    const generateLightning = (x: number, y: number, length: number, branches: LightningBranch[]) => {
      let currentX = x;
      let currentY = y;
      const steps = Math.floor(length / 15);

      for (let i = 0; i < steps; i++) {
        const nextX = currentX + (Math.random() * 28 - 14);
        const nextY = currentY + (Math.random() * 20 + 10);
        branches.push({ startX: currentX, startY: currentY, endX: nextX, endY: nextY });

        if (Math.random() < 0.22) {
          let subX = currentX;
          let subY = currentY;
          for (let j = 0; j < 3; j++) {
            const subNextX = subX + (Math.random() * 30 - 10);
            const subNextY = subY + (Math.random() * 16 + 8);
            branches.push({ startX: subX, startY: subY, endX: subNextX, endY: subNextY });
            subX = subNextX;
            subY = subNextY;
          }
        }
        currentX = nextX;
        currentY = nextY;
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep atmospheric background gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isNight) {
        if (hasThunder) {
          skyGrad.addColorStop(0, '#04060c');
          skyGrad.addColorStop(1, '#020306');
        } else if (isArid) {
          skyGrad.addColorStop(0, '#060a14');
          skyGrad.addColorStop(0.6, '#0b0f1c');
          skyGrad.addColorStop(1, '#03050a');
        } else {
          skyGrad.addColorStop(0, '#030611');
          skyGrad.addColorStop(0.5, '#060a18');
          skyGrad.addColorStop(1, '#020307');
        }
      } else {
        if (hasRain || isOvercast) {
          skyGrad.addColorStop(0, '#111827');
          skyGrad.addColorStop(1, '#090d16');
        } else if (isArid) {
          skyGrad.addColorStop(0, '#0284c7');
          skyGrad.addColorStop(0.6, '#38bdf8');
          skyGrad.addColorStop(1, '#fed7aa');
        } else {
          skyGrad.addColorStop(0, '#0369a1');
          skyGrad.addColorStop(0.7, '#0284c7');
          skyGrad.addColorStop(1, '#38bdf8');
        }
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Soft upper-atmosphere cyan glow
      if (isNight) {
        const bloom = ctx.createRadialGradient(
          width * 0.5,
          -height * 0.1,
          40,
          width * 0.5,
          -height * 0.1,
          width * 0.6
        );
        bloom.addColorStop(0, 'rgba(6, 182, 212, 0.08)');
        bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, width, height);
      }

      // Micro-stars
      if (isNight && !isOvercast) {
        for (const star of stars) {
          star.alpha += star.twinkleSpeed;
          const currentAlpha = Math.max(0.12, star.baseAlpha + Math.sin(star.alpha) * 0.25);

          ctx.fillStyle = `rgba(224, 242, 254, ${currentAlpha})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Shooting stars
      if (isNight && !isOvercast && Math.random() < 0.005) {
        const ready = comets.find((c) => !c.active);
        if (ready) launchComet(ready);
      }

      for (const comet of comets) {
        if (!comet.active) continue;
        comet.x += comet.vx;
        comet.y += comet.vy;
        comet.alpha -= 0.015;

        if (comet.alpha <= 0 || comet.x > width || comet.y > height) {
          comet.active = false;
          continue;
        }

        const cometGrad = ctx.createLinearGradient(
          comet.x,
          comet.y,
          comet.x - comet.vx * 3.0,
          comet.y - comet.vy * 3.0
        );
        cometGrad.addColorStop(0, `rgba(255, 255, 255, ${comet.alpha})`);
        cometGrad.addColorStop(0.3, `rgba(56, 189, 248, ${comet.alpha * 0.6})`);
        cometGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

        ctx.strokeStyle = cometGrad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(comet.x, comet.y);
        ctx.lineTo(comet.x - comet.vx * 3.0, comet.y - comet.vy * 3.0);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${comet.alpha})`;
        ctx.beginPath();
        ctx.arc(comet.x, comet.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Soft natural crescent moon (Placed cleanly in upper-right without clipping headers)
      const celestialX = width * 0.91;
      const celestialY = Math.max(height * 0.08, 60);

      if (isNight && !isOvercast) {
        const r = 24;

        // Diffuse atmospheric glow
        const haloGrad = ctx.createRadialGradient(
          celestialX,
          celestialY,
          r * 0.5,
          celestialX,
          celestialY,
          r * 3.2
        );
        haloGrad.addColorStop(0, 'rgba(224, 242, 254, 0.16)');
        haloGrad.addColorStop(0.6, 'rgba(186, 230, 253, 0.04)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, r * 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Moon disc (Earthshine)
        ctx.fillStyle = 'rgba(226, 232, 240, 0.10)';
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, r, 0, Math.PI * 2);
        ctx.fill();

        // Crescent shape
        ctx.save();
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, r, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = '#f8fafc';
        ctx.shadowColor = '#bae6fd';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(celestialX - 3, celestialY, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#060a18';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(celestialX + 6, celestialY - 2, r * 0.94, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (!isNight && !hasRain && !isOvercast) {
        const sunGlow = ctx.createRadialGradient(
          celestialX,
          celestialY,
          15,
          celestialX,
          celestialY,
          120
        );
        sunGlow.addColorStop(0, 'rgba(253, 224, 71, 0.35)');
        sunGlow.addColorStop(0.5, 'rgba(251, 146, 60, 0.1)');
        sunGlow.addColorStop(1, 'rgba(251, 146, 60, 0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 120, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fffbeb';
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (isArid) {
        for (const dust of dustParticles) {
          dust.x += dust.vx;
          dust.y += dust.vy;

          if (dust.y < 0) {
            dust.y = height;
            dust.x = Math.random() * width;
          }
          if (dust.x > width) dust.x = 0;
          if (dust.x < 0) dust.x = width;

          ctx.fillStyle = `rgba(251, 191, 36, ${dust.alpha})`;
          ctx.beginPath();
          ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (hasSnow) {
        for (const flake of snowflakes) {
          flake.y += flake.speed;
          flake.x += flake.drift + Math.sin(flake.angle) * 0.4;
          flake.angle += flake.angularSpeed;

          if (flake.y > height) {
            flake.y = -8;
            flake.x = Math.random() * width;
          }

          ctx.fillStyle = `rgba(255, 255, 255, ${flake.alpha})`;
          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (hasRain) {
        const windDrift = windSpeed * 0.15 + 2.0;

        for (const drop of raindrops) {
          drop.y += drop.speed;
          drop.x += windDrift;

          if (drop.y > height - 10) {
            if (splashes.length < 35) {
              splashes.push({
                x: drop.x,
                y: height - Math.random() * 6,
                radius: 1.1,
                alpha: 0.4,
              });
            }
            drop.y = -drop.len;
            drop.x = Math.random() * (width + 100) - 50;
          }

          ctx.strokeStyle = `rgba(186, 230, 253, ${drop.alpha})`;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + windDrift * 0.6, drop.y + drop.len);
          ctx.stroke();
        }

        for (let i = splashes.length - 1; i >= 0; i--) {
          const s = splashes[i];
          s.radius += 0.6;
          s.alpha -= 0.045;

          if (s.alpha <= 0) {
            splashes.splice(i, 1);
            continue;
          }

          ctx.strokeStyle = `rgba(224, 242, 254, ${s.alpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, s.radius * 1.8, s.radius * 0.6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (hasThunder) {
        lightningTimer++;

        if (lightningTimer > 140 && Math.random() < 0.03) {
          lightningTimer = 0;
          lightningFlash = 0.9;
          lightningBranches = [];
          const startX = Math.random() * width * 0.7 + width * 0.15;
          generateLightning(startX, 0, height * 0.7, lightningBranches);
        }

        if (lightningFlash > 0) {
          ctx.fillStyle = `rgba(224, 231, 255, ${lightningFlash * 0.15})`;
          ctx.fillRect(0, 0, width, height);

          ctx.save();
          ctx.strokeStyle = `rgba(255, 255, 255, ${lightningFlash})`;
          ctx.shadowColor = '#818cf8';
          ctx.shadowBlur = 12;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          for (const b of lightningBranches) {
            ctx.moveTo(b.startX, b.startY);
            ctx.lineTo(b.endX, b.endY);
          }
          ctx.stroke();
          ctx.restore();

          lightningFlash -= 0.07;
        }
      }

      if (hasFog || isOvercast) {
        ctx.fillStyle = isNight ? 'rgba(15, 23, 42, 0.22)' : 'rgba(203, 213, 225, 0.18)';
        ctx.fillRect(0, height * 0.65, width, height * 0.35);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [weatherCode, precipitation, cloudCover, isDay, windSpeed, isArid]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};

export default WeatherBackground;
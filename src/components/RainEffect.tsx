import React, { useEffect, useRef } from 'react';

const RainEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const raindrops: { x: number; y: number; length: number; speed: number; opacity: number }[] = [];
    for (let i = 0; i < 150; i++) {
      raindrops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 20 + 10,
        speed: Math.random() * 5 + 5,
        opacity: Math.random() * 0.3 + 0.1,
      });
    }

    const droplets: { x: number; y: number; radius: number; opacity: number }[] = [];
    for (let i = 0; i < 80; i++) {
      droplets.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 3 + 1,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      droplets.forEach((drop) => {
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${drop.opacity})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(drop.x - drop.radius * 0.3, drop.y - drop.radius * 0.3, drop.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${drop.opacity * 1.5})`;
        ctx.fill();
      });

      raindrops.forEach((drop) => {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x, drop.y + drop.length);
        ctx.strokeStyle = `rgba(200, 220, 255, ${drop.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        drop.y += drop.speed;
        if (drop.y > height) {
          drop.y = -drop.length;
          drop.x = Math.random() * width;
        }
      });

      requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10 opacity-70" />;
};

export default RainEffect;

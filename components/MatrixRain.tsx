"use client";
import { useEffect, useRef } from "react";

export default function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx    = canvas.getContext("2d")!;
    const root   = canvas.parentElement!;
    const FS     = 11; // smaller = denser columns

    let cols: number, drops: number[];

    function resize() {
      canvas.width  = root.offsetWidth;
      canvas.height = root.offsetHeight;
    }
    function init() {
      cols  = Math.ceil(canvas.width / FS);
      drops = Array.from({ length: cols }, () => Math.random() * -canvas.height / FS);
    }
    resize(); init();

    // Brighter, more visible purple rain
    const trail  = ["rgba(80,60,160,0.85)","rgba(60,45,130,0.75)","rgba(100,75,200,0.65)"];
    const bright = "rgba(140,120,255,1.0)";
    const fade   = "rgba(8,8,9,0.04)"; // slow fade = long trails

    function draw() {
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `bold ${FS}px "IBM Plex Mono",monospace`;

      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * FS;

        // draw 3 trailing chars per column (more density vertically)
        for (let j = 2; j >= 1; j--) {
          ctx.fillStyle = trail[j - 1];
          ctx.fillText(Math.random() > 0.5 ? "1" : "0", i * FS, y - FS * j);
        }
        // bright head
        ctx.fillStyle = bright;
        ctx.fillText(Math.random() > 0.5 ? "1" : "0", i * FS, y);

        if (y > canvas.height && Math.random() > 0.965) drops[i] = 0;
        drops[i] += 0.45;
      }
    }

    const iv = setInterval(draw, 40);
    const onResize = () => { resize(); init(); };
    window.addEventListener("resize", onResize);
    return () => { clearInterval(iv); window.removeEventListener("resize", onResize); };
  }, []);

  return <canvas ref={ref} style={{ position:"fixed", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} />;
}

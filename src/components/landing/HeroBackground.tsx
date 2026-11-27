"use client";

import { useEffect, useRef } from "react";

// Fumaça fluida em tons de cobre: ruído fBm com "domain warping", desenhado num canvas
// de baixa resolução (o upscale + blur do CSS deixa o resultado suave e barato).
const VERTEX = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.0 + 3.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = gl_FragCoord.xy / uRes.y * 1.4;
  float t = uTime * 0.035;

  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + t * 1.4),
                fbm(p + 3.5 * q + vec2(8.3, 2.8) - t * 1.1));
  float f = fbm(p + 3.5 * r);

  vec3 black  = vec3(0.035, 0.012, 0.012);
  vec3 maroon = vec3(0.20, 0.055, 0.035);
  vec3 copper = vec3(0.74, 0.34, 0.21);
  vec3 glow   = vec3(0.95, 0.62, 0.45);

  vec3 c = mix(black, maroon, smoothstep(0.15, 0.5, f));
  c = mix(c, copper, smoothstep(0.35, 0.75, f * f * 1.6 + r.x * 0.3));
  c += glow * pow(smoothstep(0.6, 0.95, f + length(q) * 0.15), 3.0) * 0.45;

  gl_FragColor = vec4(c, 1.0);
}
`;

// Fração da resolução da tela usada pelo canvas.
const RENDER_SCALE = 0.4;

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { alpha: false, antialias: false });
    if (!canvas || !gl) return; // sem WebGL: fica o gradiente de fallback do CSS

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = 0;
    let teardown: (() => void) | null = null;

    // Cria programa e buffer. Roda de novo se a GPU devolver o contexto depois de uma perda.
    const setup = () => {
      // createShader/createProgram devolvem null se o contexto for perdido durante a inicialização;
      // qualquer falha aborta em silêncio e o gradiente de fallback do CSS continua visível.
      const compile = (type: number, src: string): WebGLShader | null => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
        gl.deleteShader(s);
        return null;
      };
      const vs = compile(gl.VERTEX_SHADER, VERTEX);
      const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
      const program = vs && fs ? gl.createProgram() : null;
      if (!vs || !fs || !program) {
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        return;
      }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return;
      }
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, "a");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(program, "uRes");
      const uTime = gl.getUniformLocation(program, "uTime");

      const render = () => {
        gl.uniform1f(uTime, reduceMotion ? 20 : (performance.now() - start) / 1000 + 20);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      const loop = () => {
        render();
        frame = requestAnimationFrame(loop);
      };
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * RENDER_SCALE));
        canvas.height = Math.max(1, Math.round(rect.height * RENDER_SCALE));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        render(); // mudar o tamanho limpa o canvas: redesenha na hora para não piscar
      };

      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();
      if (!reduceMotion) frame = requestAnimationFrame(loop);
      canvas.dataset.ready = "true";

      teardown = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        // Libera só os recursos; nunca chamar loseContext(): no modo dev o React monta o
        // componente duas vezes e a segunda montagem receberia o mesmo contexto já perdido.
        if (!gl.isContextLost()) {
          gl.deleteBuffer(buffer);
          gl.deleteProgram(program);
          gl.deleteShader(vs);
          gl.deleteShader(fs);
        }
        teardown = null;
      };
    };

    const onLost = (e: Event) => {
      e.preventDefault(); // permite que o navegador devolva o contexto
      teardown?.();
    };
    const onRestored = () => setup();
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    setup();

    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      teardown?.();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0b0404]">
      {/* Fallback sem WebGL */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(180,85,50,0.35),transparent_60%)]" />
      <canvas
        ref={canvasRef}
        style={{ top: "-1.5rem", left: "-1.5rem", width: "calc(100% + 3rem)", height: "calc(100% + 3rem)" }}
        className="absolute opacity-0 blur-[6px] transition-opacity duration-1000 data-[ready=true]:opacity-100"
      />
      {/* Escurece as bordas para o texto continuar legível */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,4,4,0.15)_25%,rgba(10,4,4,0.7)_100%)]" />
    </div>
  );
}

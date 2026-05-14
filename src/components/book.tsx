"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PARAMS } from "@/lib/scene-params";

export type BookCover = {
  title: string;
  author?: string;
  baseColor: string;
  accent: string;
  ink: string;
  pattern: "ornate" | "swirl" | "plain" | "stripe" | "emblem" | "stars";
};

type BookProps = {
  cover: BookCover;
};

function paintCover(canvas: HTMLCanvasElement, cover: BookCover) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = cover.baseColor;
  ctx.fillRect(0, 0, W, H);

  // Subtle vignette
  const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Pattern
  ctx.save();
  ctx.strokeStyle = cover.accent;
  ctx.fillStyle = cover.accent;
  ctx.globalAlpha = 0.6;
  if (cover.pattern === "ornate") {
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, W - 72, H - 72);
    ctx.lineWidth = 2;
    ctx.strokeRect(56, 56, W - 112, H - 112);
    // corner flourishes
    for (const [cx, cy] of [
      [80, 80],
      [W - 80, 80],
      [80, H - 80],
      [W - 80, H - 80],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (cover.pattern === "swirl") {
    ctx.lineWidth = 3;
    for (let r = 40; r < W; r += 60) {
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.6, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (cover.pattern === "stripe") {
    ctx.globalAlpha = 0.25;
    for (let y = 0; y < H; y += 32) {
      ctx.fillRect(0, y, W, 12);
    }
  } else if (cover.pattern === "emblem") {
    ctx.lineWidth = 4;
    const cx = W / 2;
    const cy = H * 0.55;
    ctx.beginPath();
    ctx.ellipse(cx, cy, W * 0.28, H * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, W * 0.22, H * 0.14, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (cover.pattern === "stars") {
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 24; i++) {
      const x = (i * 137.5) % W;
      const y = (i * 211.3) % H;
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, W - 96, H - 96);
  }
  ctx.restore();

  // Title
  ctx.fillStyle = cover.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const words = cover.title.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > 12) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);

  const fontSize = Math.min(72, 520 / Math.max(...lines.map((l) => l.length)));
  ctx.font = `700 ${fontSize}px "Times New Roman", serif`;
  const totalH = lines.length * fontSize * 1.05;
  const startY = H * 0.42 - totalH / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, startY + i * fontSize * 1.05);
  });

  // Author
  if (cover.author) {
    ctx.font = `italic 28px "Times New Roman", serif`;
    ctx.fillStyle = cover.ink;
    ctx.globalAlpha = 0.85;
    ctx.fillText(cover.author, W / 2, H * 0.82);
    ctx.globalAlpha = 1;
  }
}

function paintSpine(canvas: HTMLCanvasElement, cover: BookCover) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = cover.baseColor;
  ctx.fillRect(0, 0, W, H);

  // edge shadow
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.5, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // band
  ctx.fillStyle = cover.accent;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, H * 0.1, W, 6);
  ctx.fillRect(0, H * 0.9 - 6, W, 6);
  ctx.globalAlpha = 1;

  // vertical title
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = cover.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.min(34, 400 / cover.title.length)}px "Times New Roman", serif`;
  ctx.fillText(cover.title.toUpperCase(), 0, 0);
  ctx.restore();
}

function paintPages(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = "#f4ede0";
  ctx.fillRect(0, 0, W, H);
  // page lines for stacked-paper look
  ctx.strokeStyle = "rgba(120,100,70,0.35)";
  ctx.lineWidth = 1;
  for (let y = 4; y < H; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

export function Book({ cover }: BookProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const sizeRef = useRef<[number, number, number]>([0, 0, 0]);

  const { coverTex, spineTex, pagesTex } = useMemo(() => {
    const make = (
      width: number,
      height: number,
      paint: (c: HTMLCanvasElement) => void,
    ) => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      paint(c);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      return tex;
    };
    return {
      coverTex: make(512, 768, (c) => paintCover(c, cover)),
      spineTex: make(128, 768, (c) => paintSpine(c, cover)),
      pagesTex: make(256, 256, paintPages),
    };
  }, [cover]);

  // Materials per face order: +X, -X, +Y, -Y, +Z, -Z
  // +X right (page edge), -X left (spine), +Y top (pages), -Y bottom (pages),
  // +Z front (cover), -Z back (cover dark)
  const materials = useMemo(() => {
    const pages = new THREE.MeshStandardMaterial({
      map: pagesTex,
      roughness: 0.95,
    });
    const spine = new THREE.MeshStandardMaterial({
      map: spineTex,
      roughness: 0.75,
    });
    const front = new THREE.MeshStandardMaterial({
      map: coverTex,
      roughness: 0.55,
    });
    const back = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cover.baseColor).multiplyScalar(0.45),
      roughness: 0.75,
    });
    return [pages, spine, pages, pages, front, back];
  }, [coverTex, spineTex, pagesTex, cover.baseColor]);

  // Imperatively swap the BoxGeometry when size params change.
  // Avoids re-rendering the React tree, which was causing books to flicker.
  useFrame(() => {
    const m = meshRef.current;
    if (!m) return;
    const [lw, lh, ld] = sizeRef.current;
    if (
      lw !== PARAMS.bookWidth ||
      lh !== PARAMS.bookHeight ||
      ld !== PARAMS.bookDepth
    ) {
      m.geometry.dispose();
      m.geometry = new THREE.BoxGeometry(
        PARAMS.bookWidth,
        PARAMS.bookHeight,
        PARAMS.bookDepth,
      );
      sizeRef.current = [
        PARAMS.bookWidth,
        PARAMS.bookHeight,
        PARAMS.bookDepth,
      ];
    }
  });

  useEffect(() => {
    return () => {
      meshRef.current?.geometry.dispose();
    };
  }, []);

  return (
    <mesh ref={meshRef} castShadow receiveShadow material={materials}>
      <boxGeometry
        args={[PARAMS.bookWidth, PARAMS.bookHeight, PARAMS.bookDepth]}
      />
    </mesh>
  );
}

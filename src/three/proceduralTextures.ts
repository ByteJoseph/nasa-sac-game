import * as THREE from 'three';
import type { OutpostSite } from '../types/game';

export function createTerrainTexture(_site: OutpostSite, maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base Martian iron-oxide regolith tone
  ctx.fillStyle = '#A4512C';
  ctx.fillRect(0, 0, size, size);

  // Subtle deterministic grain & mineral patches
  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 2400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 3.5;
    const shade = rand();
    ctx.fillStyle =
      shade > 0.65
        ? 'rgba(234, 152, 92, 0.2)'
        : shade < 0.3
          ? 'rgba(92, 36, 18, 0.22)'
          : 'rgba(180, 88, 46, 0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft Martian craters & wind ripples
  for (let i = 0; i < 16; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rad = 8 + rand() * 24;
    ctx.strokeStyle = 'rgba(251, 191, 136, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(69, 26, 12, 0.14)';
    ctx.beginPath();
    ctx.arc(cx + 1.5, cy + 1.5, rad * 0.78, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, maxAnisotropy);
  return texture;
}

export function createSolarGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#122B5C';
  ctx.fillRect(0, 0, size, size);

  // Photovoltaic cells & gold busbars
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  const cols = 6;
  const rows = 4;
  for (let c = 1; c < cols; c++) {
    const x = (c / cols) * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 2.5;
  for (let r = 1; r < rows; r++) {
    const y = (r / rows) * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(3, 7, 18, 0.72)');
  grad.addColorStop(0.55, 'rgba(3, 7, 18, 0.35)');
  grad.addColorStop(1, 'rgba(3, 7, 18, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLandingPadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, size, size);

  // Concrete grain
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  for (let i = 0; i < 400; i++) {
    ctx.fillRect((i * 73) % size, (i * 137) % size, 2, 2);
  }

  // Hazard perimeter ring
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
  ctx.stroke();

  // Crisp white H marking
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(size * 0.36, size * 0.32, size * 0.07, size * 0.36);
  ctx.fillRect(size * 0.57, size * 0.32, size * 0.07, size * 0.36);
  ctx.fillRect(size * 0.36, size * 0.46, size * 0.28, size * 0.08);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

import * as THREE from 'three';
import type { OutpostSite } from '../types/game';

export function createTerrainTexture(site: OutpostSite, maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base regolith or fractured Europa water-ice tone
  ctx.fillStyle =
    site === 'moon' ? '#6B7280' : site === 'mars' ? '#A4512C' : '#BFE6F7';
  ctx.fillRect(0, 0, size, size);

  // Subtle deterministic grain & mineral patches
  let seed = site === 'moon' ? 1337 : site === 'mars' ? 4242 : 9001;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 2400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 3.5;
    const shade = rand();
    if (site === 'moon') {
      ctx.fillStyle =
        shade > 0.65
          ? 'rgba(203, 213, 225, 0.16)'
          : shade < 0.3
            ? 'rgba(30, 41, 59, 0.22)'
            : 'rgba(100, 116, 139, 0.14)';
    } else if (site === 'mars') {
      ctx.fillStyle =
        shade > 0.65
          ? 'rgba(234, 152, 92, 0.2)'
          : shade < 0.3
            ? 'rgba(92, 36, 18, 0.22)'
            : 'rgba(180, 88, 46, 0.16)';
    } else {
      ctx.fillStyle =
        shade > 0.65
          ? 'rgba(240, 249, 255, 0.28)'
          : shade < 0.3
            ? 'rgba(56, 189, 248, 0.22)'
            : 'rgba(148, 163, 184, 0.14)';
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (site === 'europa') {
    // Reddish-brown mineral salt lineae cracks across Europa's icy shell
    for (let l = 0; l < 24; l++) {
      ctx.strokeStyle =
        l % 3 === 0 ? 'rgba(154, 78, 40, 0.38)' : 'rgba(14, 116, 144, 0.32)';
      ctx.lineWidth = 1.5 + rand() * 2.5;
      ctx.beginPath();
      const x1 = rand() * size;
      const y1 = rand() * size;
      const x2 = x1 + (rand() - 0.5) * 320;
      const y2 = y1 + (rand() - 0.5) * 320;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  } else {
    // Soft crater rings or wind ripples
    const ringCount = site === 'moon' ? 28 : 16;
    for (let i = 0; i < ringCount; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const rad = 8 + rand() * 24;
      ctx.strokeStyle =
        site === 'moon' ? 'rgba(226, 232, 240, 0.14)' : 'rgba(251, 191, 136, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle =
        site === 'moon' ? 'rgba(15, 23, 42, 0.16)' : 'rgba(69, 26, 12, 0.14)';
      ctx.beginPath();
      ctx.arc(cx + 1.5, cy + 1.5, rad * 0.78, 0, Math.PI * 2);
      ctx.fill();
    }
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

export function createJupiterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const width = 256;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const bands = [
    '#9A5B32',
    '#E7D4B5',
    '#C47D48',
    '#F5E6CC',
    '#B56336',
    '#EDD9BE',
    '#9E512E',
    '#E6CFAF',
  ];
  const bandH = height / bands.length;
  bands.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, i * bandH, width, bandH + 1);
  });

  // Great Red Spot
  ctx.fillStyle = '#C2412D';
  ctx.beginPath();
  ctx.ellipse(width * 0.62, height * 0.66, 18, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
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

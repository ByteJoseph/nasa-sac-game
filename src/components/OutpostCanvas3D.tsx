import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildOutpostWorld, type Outpost3DRefs } from '../three/outpostModels';
import { createContactShadowTexture } from '../three/proceduralTextures';
import type { ModuleAllocation, ModuleKey, OutpostSite, SolForecast } from '../types/game';

interface OutpostCanvas3DProps {
  site: OutpostSite;
  allocation: ModuleAllocation;
  forecast: SolForecast;
  canEditPower: boolean;
  commsActive: boolean;
  isTitleMode: boolean;
  onCycleModule: (key: ModuleKey) => void;
}

const MODULE_META: Array<{ key: ModuleKey; label: string; accent: string }> = [
  { key: 'scrubber', label: 'O₂ Dome', accent: '#22D3EE' },
  { key: 'greenhouse', label: 'Farm', accent: '#34D399' },
  { key: 'shield', label: 'Shield', accent: '#FBBF24' },
  { key: 'lab', label: 'Rover Lab', accent: '#818CF8' },
];

// Reusable module-scope math objects (zero GC inside animation loop)
const _projVec = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();
const _targetBgColor = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function OutpostCanvas3D({
  site,
  allocation,
  forecast,
  canEditPower,
  commsActive,
  isTitleMode,
  onCycleModule,
}: OutpostCanvas3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<ModuleKey, HTMLButtonElement | null>>({
    scrubber: null,
    greenhouse: null,
    shield: null,
    lab: null,
  });

  const [webglLost, setWebglLost] = useState(false);

  // Store latest React state in refs so WebGLRenderer never remounts
  const stateRef = useRef({
    site,
    allocation,
    forecast,
    canEditPower,
    commsActive,
    isTitleMode,
    onCycleModule,
  });
  stateRef.current = {
    site,
    allocation,
    forecast,
    canEditPower,
    commsActive,
    isTitleMode,
    onCycleModule,
  };

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    world: Outpost3DRefs | null;
    shadowTex: THREE.Texture;
    isSoftwareGl: boolean;
    keyLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    starPoints: THREE.Points;
  } | null>(null);

  // Initialize Three.js Scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const onContextRestored = () => {
      setWebglLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b16);
    scene.fog = new THREE.FogExp2(0x070b16, 0.028);

    // Studio Environment Reflections via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // Portrait-optimized PerspectiveCamera framing canyon rim, helipads, central base, and greenhouse
    const initialFov = width / height < 0.56 ? 52 : 46;
    const camera = new THREE.PerspectiveCamera(initialFov, width / height, 0.2, 120);
    camera.position.set(0.2, 9.8, 15.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-0.3, 0.55, 0.35);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 9.0;
    controls.maxDistance = 23.0;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI * 0.42;
    controls.minAzimuthAngle = -Math.PI * 0.45;
    controls.maxAzimuthAngle = Math.PI * 0.45;
    controls.update();

    // 3-Point Space Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x4f6d9a, 0x1e293b, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    keyLight.position.set(9, 13, 8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 36;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.65);
    rimLight.position.set(-8, 6, -10);
    scene.add(rimLight);

    // Procedural Starfield
    const starCount = 320;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = ((i * 137.5) % 360) * (Math.PI / 180);
      const phi = 0.15 + ((i * 29) % 100) * 0.011;
      const r = 38 + (i % 7) * 2;
      starPos[i * 3] = r * Math.cos(theta) * Math.cos(phi);
      starPos[i * 3 + 1] = 6 + Math.abs(r * Math.sin(phi));
      starPos[i * 3 + 2] = r * Math.sin(theta) * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.22,
      sizeAttenuation: true,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    const shadowTex = createContactShadowTexture();
    const initialWorld = buildOutpostWorld(
      stateRef.current.site,
      renderer.capabilities.getMaxAnisotropy(),
      shadowTex,
      isSoftwareGl
    );
    scene.add(initialWorld.root);

    sceneRefs.current = {
      scene,
      renderer,
      world: initialWorld,
      shadowTex,
      isSoftwareGl,
      keyLight,
      hemiLight,
      starPoints,
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting setup (Layer 1 only for crisp fast taps)
    _raycaster.layers.set(1);
    let hoveredModule: ModuleKey | null = null;
    let pointerDownPos = { x: 0, y: 0 };

    const getHitModule = (clientX: number, clientY: number): ModuleKey | null => {
      const world = sceneRefs.current?.world;
      if (!world) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_pointerNdc, camera);
      const hits = _raycaster.intersectObjects(world.clickableTargets, false);
      if (hits.length > 0) {
        return (hits[0].object.userData.moduleKey as ModuleKey) ?? null;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!stateRef.current.canEditPower || stateRef.current.isTitleMode) return;
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (dx * dx + dy * dy > 49) return; // Ignore orbit drags > 7px
      const hit = getHitModule(e.clientX, e.clientY);
      if (hit) {
        stateRef.current.onCycleModule(hit);
      }
    };

    let lastHoverCheck = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      if (!stateRef.current.canEditPower || stateRef.current.isTitleMode) {
        hoveredModule = null;
        renderer.domElement.style.cursor = 'grab';
        return;
      }
      const hit = getHitModule(e.clientX, e.clientY);
      hoveredModule = hit;
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // ResizeObserver for crisp portrait container tracking
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      // Widen FOV slightly on very narrow screens so full canyon-rim outpost fits comfortably
      camera.fov = w / h < 0.56 ? 52 : 46;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Animation Loop (delta-time driven + Software-WebGL afterDraw pacing)
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let roverAngle = 0;
    let ringAlpha = 0;
    let shieldAlpha = 0.12;
    let beamAlpha = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const { allocation: alloc, forecast: fc, commsActive: comms, isTitleMode: titleMode, site: curSite } =
        stateRef.current;
      const world = sceneRefs.current?.world;

      // Subtle atmospheric lighting shifts for Solar/Jupiter Storms & Mars Dust
      const targetBg =
        curSite === 'moon'
          ? fc.radiationMsv >= 18
            ? 0x160e18
            : 0x070b16
          : curSite === 'europa'
            ? fc.radiationMsv >= 20
              ? 0x12182e
              : 0x061221
            : fc.dustStormActive
              ? 0x452212
              : 0x261410;
      const bgCol = scene.background as THREE.Color;
      _targetBgColor.setHex(targetBg);
      bgCol.lerp(_targetBgColor, 1 - Math.exp(-3 * dt));
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(bgCol);
        const targetDensity = curSite === 'mars' && fc.dustStormActive ? 0.044 : 0.025;
        scene.fog.density = THREE.MathUtils.damp(scene.fog.density, targetDensity, 3, dt);
      }

      if (world) {
        // 1. Solar Array tilt & brightness (tilt each wing locally around its mount)
        const targetTilt = fc.lunarShadowDip ? 0.15 : 0.48;
        world.solarPanelWings.forEach((wing) => {
          wing.rotation.x = THREE.MathUtils.damp(wing.rotation.x, targetTilt, 4, dt);
        });
        world.solarPanelMat.emissiveIntensity = THREE.MathUtils.damp(
          world.solarPanelMat.emissiveIntensity,
          fc.dustStormActive ? 0.08 : 0.38,
          4,
          dt
        );

        // 2. O2 Scrubber Dome glow & rising 3D bubbles
        world.scrubberWindowsMat.emissiveIntensity = THREE.MathUtils.damp(
          world.scrubberWindowsMat.emissiveIntensity,
          alloc.scrubber > 0 ? 0.6 + alloc.scrubber * 0.45 : 0.08,
          6,
          dt
        );
        world.o2BubblesGroup.visible = alloc.scrubber > 0;
        if (alloc.scrubber > 0) {
          world.o2BubblesGroup.children.forEach((b) => {
            const phase = (b.userData.phase as number) || 0;
            const cycle = ((elapsed * (0.7 + alloc.scrubber * 0.25) + phase) % 1.4) / 1.4;
            b.position.y = 1.45 + cycle * 1.1;
            b.scale.setScalar(Math.sin(cycle * Math.PI) * 1.1 + 0.15);
          });
        }

        // 3. Hydroponic Farm LEDs
        world.greenhouseLedMat.emissiveIntensity = THREE.MathUtils.damp(
          world.greenhouseLedMat.emissiveIntensity,
          alloc.greenhouse > 0 ? 0.55 + alloc.greenhouse * 0.5 : 0.05,
          6,
          dt
        );
        const plantScale = 0.72 + alloc.greenhouse * 0.14;
        world.greenhousePlants.scale.y = THREE.MathUtils.damp(
          world.greenhousePlants.scale.y,
          plantScale,
          4,
          dt
        );

        // 4. Radiation Shield Dome & Beacon
        const targetShieldAlpha =
          alloc.shield === 0 ? 0.0 : 0.08 + alloc.shield * 0.085 + Math.sin(elapsed * 2.5) * 0.025;
        shieldAlpha = THREE.MathUtils.damp(shieldAlpha, targetShieldAlpha, 5, dt);
        world.shieldDomeMat.opacity = shieldAlpha;
        world.shieldDomeMesh.visible = shieldAlpha > 0.01;
        world.shieldDomeMat.color.setHex(alloc.shield >= 2 ? 0x38bdf8 : 0xf59e0b);
        world.shieldBeaconMat.emissiveIntensity = THREE.MathUtils.damp(
          world.shieldBeaconMat.emissiveIntensity,
          alloc.shield > 0 ? 0.6 + alloc.shield * 0.55 : 0.1,
          5,
          dt
        );

        // 5. Comms Dish sweep & Signal Beam
        world.commsDishPivot.rotation.y = Math.sin(elapsed * 0.55) * 0.45;
        const targetBeam = comms ? 0.26 + Math.sin(elapsed * 4) * 0.1 : alloc.lab > 0 ? 0.08 : 0;
        beamAlpha = THREE.MathUtils.damp(beamAlpha, targetBeam, 5, dt);
        world.commsBeamMat.opacity = beamAlpha;
        world.commsBeamMesh.visible = beamAlpha > 0.01;

        // 6. 6-Wheel Explorer Rover patrol loop in front-right clearing (clear of pads & astronauts)
        if (alloc.lab > 0 || titleMode) {
          const speed = titleMode ? 0.34 : 0.36 + alloc.lab * 0.16;
          roverAngle += dt * speed;
          const rx = 2.4 + Math.cos(roverAngle) * 1.15;
          const rz = 3.9 + Math.sin(roverAngle) * 0.75;
          const nextX = 2.4 + Math.cos(roverAngle + 0.08) * 1.15;
          const nextZ = 3.9 + Math.sin(roverAngle + 0.08) * 0.75;
          world.roverGroup.position.set(rx, 0, rz);
          world.roverGroup.lookAt(nextX, 0, nextZ);
          world.roverWheels.forEach((w) => {
            w.rotation.x += dt * 4.5;
          });
        }

        // 7. Hover Selection Ring
        if (hoveredModule) {
          const pos = world.modulePositions[hoveredModule];
          world.hoverRingMesh.position.set(pos.x, 0.05, pos.z);
          ringAlpha = THREE.MathUtils.damp(ringAlpha, 0.85, 10, dt);
        } else {
          ringAlpha = THREE.MathUtils.damp(ringAlpha, 0, 10, dt);
        }
        world.hoverRingMat.opacity = ringAlpha;

        // 8. Project 3D building positions to 2D floating badge anchors without React re-renders
        const cw = renderer.domElement.clientWidth;
        const ch = renderer.domElement.clientHeight;
        MODULE_META.forEach(({ key }) => {
          const btn = labelRefs.current[key];
          if (!btn) return;
          if (titleMode) {
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
            return;
          }
          const mPos = world.modulePositions[key];
          _projVec.set(mPos.x, 2.05, mPos.z);
          _projVec.project(camera);
          if (_projVec.z > 1) {
            btn.style.opacity = '0';
            return;
          }
          const sx = (_projVec.x * 0.5 + 0.5) * cw;
          const sy = (-_projVec.y * 0.5 + 0.5) * ch;
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
        });
      }

      // Title screen gentle orbital camera sweep
      if (titleMode && !isSoftwareGl) {
        const camOrbit = Math.sin(elapsed * 0.2) * 2.2;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, camOrbit, 2, dt);
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      if (sceneRefs.current?.world) {
        sceneRefs.current.world.disposables.forEach((d) => d.dispose());
      }
      starGeo.dispose();
      starMat.dispose();
      shadowTex.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
  }, []);

  // Swap 3D planet terrain & lighting cleanly when user switches Moon <-> Mars
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    if (refs.world) {
      refs.scene.remove(refs.world.root);
      refs.world.disposables.forEach((d) => d.dispose());
    }

    const nextWorld = buildOutpostWorld(
      site,
      refs.renderer.capabilities.getMaxAnisotropy(),
      refs.shadowTex,
      refs.isSoftwareGl
    );
    refs.scene.add(nextWorld.root);
    refs.world = nextWorld;

    if (site === 'moon') {
      refs.hemiLight.color.setHex(0x4f6d9a);
      refs.hemiLight.groundColor.setHex(0x1e293b);
      refs.keyLight.color.setHex(0xfff4e0);
      refs.starPoints.visible = true;
    } else if (site === 'europa') {
      refs.hemiLight.color.setHex(0x7dd3fc);
      refs.hemiLight.groundColor.setHex(0x0f172a);
      refs.keyLight.color.setHex(0xe0f2fe);
      refs.starPoints.visible = true;
    } else {
      refs.hemiLight.color.setHex(0xd98a56);
      refs.hemiLight.groundColor.setHex(0x451a0c);
      refs.keyLight.color.setHex(0xffd8b0);
      refs.starPoints.visible = true;
    }
  }, [site]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#070B16]">
      {/* Isolated Empty WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Fallback UI if WebGL context is unavailable/lost */}
      {webglLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B1120] p-6 text-center">
          <p className="font-display font-bold text-lg text-amber-300">
            3D Graphics Paused
          </p>
          <p className="text-xs text-slate-300 mt-1">
            Use the power buttons in the Command Deck below to continue running your outpost.
          </p>
        </div>
      )}

      {/* Projected Floating 3D Module Power Tags (Zero blur, tap-friendly >= 40px) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {MODULE_META.map(({ key, label, accent }) => {
          const level = allocation[key];
          return (
            <button
              key={key}
              ref={(el) => {
                labelRefs.current[key] = el;
              }}
              type="button"
              disabled={!canEditPower || isTitleMode}
              onClick={() => onCycleModule(key)}
              aria-label={`${label}: ${level} of 3 power units. Tap to adjust.`}
              style={{ opacity: 0, left: 0, top: 0 }}
              className={`absolute px-2.5 py-1 rounded-lg bg-[#0B1120]/90 border border-slate-700/90 text-[11px] font-semibold text-white shadow-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                canEditPower ? 'cursor-pointer hover:border-amber-400' : 'cursor-default'
              }`}
            >
              <span
                className="w-2 h-2 rounded-xs shrink-0"
                style={{ backgroundColor: level > 0 ? accent : '#475569' }}
                aria-hidden="true"
              />
              <span>{label}</span>
              <span className="font-mono tabular-nums text-amber-300">{level}/3</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildOutpostWorld, type Outpost3DRefs } from '../three/outpostModels';
import { createContactShadowTexture } from '../three/proceduralTextures';
import type { ModuleAllocation, ModuleKey, OutpostSite, SolForecast } from '../types/game';

export interface PulseEvent {
  key: ModuleKey;
  nonce: number;
  colorHex: number;
}

interface OutpostCanvas3DProps {
  site: OutpostSite;
  allocation: ModuleAllocation;
  selectedModule: ModuleKey;
  forecast: SolForecast;
  canEditPower: boolean;
  isSimulating: boolean;
  panelsRetracted: boolean;
  commsActive: boolean;
  isTitleMode: boolean;
  pulseEvent: PulseEvent | null;
  onTapModule: (key: ModuleKey) => void;
}

const MODULE_META: Array<{ key: ModuleKey; label: string; accent: string }> = [
  { key: 'scrubber', label: 'O₂', accent: '#22D3EE' },
  { key: 'greenhouse', label: 'Farm', accent: '#34D399' },
  { key: 'shield', label: 'Shield', accent: '#FBBF24' },
  { key: 'lab', label: 'Lab', accent: '#818CF8' },
];

// Reusable module-scope math objects (zero GC inside animation loop)
const _projVec = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();
const _targetBgColor = new THREE.Color();
const _focusTarget = new THREE.Vector3();
const _astroGoal = new THREE.Vector3();

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
  selectedModule,
  forecast,
  canEditPower,
  isSimulating,
  panelsRetracted,
  commsActive,
  isTitleMode,
  pulseEvent,
  onTapModule,
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
    selectedModule,
    forecast,
    canEditPower,
    isSimulating,
    panelsRetracted,
    commsActive,
    isTitleMode,
    pulseEvent,
    onTapModule,
  });
  stateRef.current = {
    site,
    allocation,
    selectedModule,
    forecast,
    canEditPower,
    isSimulating,
    panelsRetracted,
    commsActive,
    isTitleMode,
    pulseEvent,
    onTapModule,
  };

  const focusActiveRef = useRef(false);
  const lastSelectedRef = useRef<ModuleKey>(selectedModule);
  if (lastSelectedRef.current !== selectedModule) {
    lastSelectedRef.current = selectedModule;
    focusActiveRef.current = true;
  }

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
    renderer.toneMappingExposure = 1.14;
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
    scene.background = new THREE.Color(0x261410);
    scene.fog = new THREE.FogExp2(0x261410, 0.024);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const initialFov = width / height < 0.56 ? 54 : 48;
    const camera = new THREE.PerspectiveCamera(initialFov, width / height, 0.2, 120);
    camera.position.set(0.2, 12.2, 20.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-0.4, -0.2, 1.1);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 10.0;
    controls.maxDistance = 28.0;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI * 0.42;
    controls.minAzimuthAngle = -Math.PI * 0.45;
    controls.maxAzimuthAngle = Math.PI * 0.45;
    controls.update();

    const onOrbitStart = () => {
      focusActiveRef.current = false;
    };
    controls.addEventListener('start', onOrbitStart);

    // 3-Point Mars Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xd98a56, 0x451a0c, 0.78);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffd8b0, 2.25);
    keyLight.position.set(11, 16, 10);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 42;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.68);
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
      if (dx * dx + dy * dy > 49) return;
      const hit = getHitModule(e.clientX, e.clientY);
      if (hit) {
        stateRef.current.onTapModule(hit);
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

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.fov = w / h < 0.56 ? 54 : 48;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let roverAngle = 0;
    let ringAlpha = 0;
    let beamAlpha = 0;
    let lastPulseNonce = -1;
    let pulseProgress = 1;

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
      const {
        allocation: alloc,
        selectedModule: selMod,
        forecast: fc,
        canEditPower: canEdit,
        isSimulating: simActive,
        panelsRetracted: retracted,
        commsActive: comms,
        isTitleMode: titleMode,
        pulseEvent: pEvt,
      } = stateRef.current;
      const world = sceneRefs.current?.world;

      const simMult = simActive ? 2.4 : 1.0;

      // Martian sky & dust storm response
      const targetBg = fc.dustStormActive ? 0x452212 : 0x261410;
      const bgCol = scene.background as THREE.Color;
      _targetBgColor.setHex(targetBg);
      bgCol.lerp(_targetBgColor, 1 - Math.exp(-3 * dt));
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(bgCol);
        const targetDensity = fc.dustStormActive ? 0.044 : 0.024;
        scene.fog.density = THREE.MathUtils.damp(scene.fog.density, targetDensity, 3, dt);
      }

      if (world) {
        // 1. Solar Array tilt, retraction during storms & brightness
        const targetTilt = retracted ? 1.54 : fc.lunarShadowDip ? 0.15 : 0.48;
        const targetWingY = retracted ? 0.96 : 1.28;
        world.solarPanelWings.forEach((wing) => {
          wing.rotation.x = THREE.MathUtils.damp(wing.rotation.x, targetTilt, 4.5, dt);
          wing.position.y = THREE.MathUtils.damp(wing.position.y, targetWingY, 4.5, dt);
        });
        world.solarPanelMat.emissiveIntensity = THREE.MathUtils.damp(
          world.solarPanelMat.emissiveIntensity,
          retracted ? 0.04 : fc.dustStormActive ? 0.08 : 0.42,
          4,
          dt
        );

        // 2. O2 Scrubber Dome glow & rising 3D bubbles
        world.scrubberWindowsMat.emissiveIntensity = THREE.MathUtils.damp(
          world.scrubberWindowsMat.emissiveIntensity,
          alloc.scrubber > 0 ? 0.65 + alloc.scrubber * 0.45 : 0.08,
          6,
          dt
        );
        world.o2BubblesGroup.visible = alloc.scrubber > 0;
        if (alloc.scrubber > 0) {
          world.o2BubblesGroup.children.forEach((b) => {
            const phase = (b.userData.phase as number) || 0;
            const cycle =
              ((elapsed * (0.7 + alloc.scrubber * 0.25) * simMult + phase) % 1.4) / 1.4;
            b.position.y = 1.95 + cycle * 1.25;
            b.scale.setScalar(Math.sin(cycle * Math.PI) * 1.15 + 0.15);
          });
        }

        // 3. Hydroponic Farm LEDs & Crop Growth
        world.greenhouseLedMat.emissiveIntensity = THREE.MathUtils.damp(
          world.greenhouseLedMat.emissiveIntensity,
          alloc.greenhouse > 0 ? 0.6 + alloc.greenhouse * 0.5 : 0.05,
          6,
          dt
        );
        const plantScale = 0.72 + alloc.greenhouse * 0.15;
        world.greenhousePlants.scale.y = THREE.MathUtils.damp(
          world.greenhousePlants.scale.y,
          plantScale,
          4,
          dt
        );

        // 4. Radiation Shelter Dosimeter Beacon (Water-Wall & Regolith Storm Shelter)
        const stormHit = fc.radiationMsv >= 18;
        world.shieldBeaconMat.color.setHex(
          stormHit && alloc.shield < 2 ? 0xf43f5e : alloc.shield >= 2 ? 0x38bdf8 : 0xfef08a
        );
        world.shieldBeaconMat.emissive.setHex(
          stormHit && alloc.shield < 2 ? 0xe11d48 : alloc.shield >= 2 ? 0x0284c7 : 0xf59e0b
        );
        world.shieldBeaconMat.emissiveIntensity = THREE.MathUtils.damp(
          world.shieldBeaconMat.emissiveIntensity,
          alloc.shield > 0 ? (stormHit ? 1.15 : 0.45 + alloc.shield * 0.3) : 0.08,
          5,
          dt
        );

        // 5. Comms Dish sweep & Signal Beam
        world.commsDishPivot.rotation.y = Math.sin(elapsed * 0.55 * simMult) * 0.45;
        const targetBeam = comms
          ? 0.28 + Math.sin(elapsed * 4) * 0.1
          : alloc.lab > 0
            ? simActive
              ? 0.22
              : 0.09
            : 0;
        beamAlpha = THREE.MathUtils.damp(beamAlpha, targetBeam, 5, dt);
        world.commsBeamMat.opacity = beamAlpha;
        world.commsBeamMesh.visible = beamAlpha > 0.01;

        // 6. 6-Wheel Explorer Rover patrol in front-right clearing
        if (alloc.lab > 0 || titleMode) {
          const speed = (titleMode ? 0.34 : 0.36 + alloc.lab * 0.16) * simMult;
          roverAngle += dt * speed;
          const rx = 3.6 + Math.cos(roverAngle) * 1.35;
          const rz = 4.9 + Math.sin(roverAngle) * 0.85;
          const nextX = 3.6 + Math.cos(roverAngle + 0.08) * 1.35;
          const nextZ = 4.9 + Math.sin(roverAngle + 0.08) * 0.85;
          world.roverGroup.position.set(rx, 0, rz);
          world.roverGroup.lookAt(nextX, 0, nextZ);
          world.roverWheels.forEach((w) => {
            w.rotation.x += dt * 4.5 * simMult;
          });
        }

        // 7. Hero Astronaut Commander Maya articulated walk, wave & inspection animation
        const hero = world.heroAstronaut;
        const heroRig = hero.userData.rig as
          | {
              legLPivot: THREE.Group;
              legRPivot: THREE.Group;
              armLPivot: THREE.Group;
              armRPivot: THREE.Group;
              headGroup: THREE.Group;
            }
          | undefined;

        if (titleMode) {
          _astroGoal.set(-0.55, 0, 3.65);
        } else {
          const mPos = world.modulePositions[selMod];
          _astroGoal.set(mPos.x * 0.62, 0, Math.min(4.2, mPos.z * 0.62 + 1.65));
        }
        const distSq =
          (hero.position.x - _astroGoal.x) * (hero.position.x - _astroGoal.x) +
          (hero.position.z - _astroGoal.z) * (hero.position.z - _astroGoal.z);

        if (distSq > 0.015) {
          const dx = _astroGoal.x - hero.position.x;
          const dz = _astroGoal.z - hero.position.z;
          hero.position.x = THREE.MathUtils.damp(hero.position.x, _astroGoal.x, 3.8, dt);
          hero.position.z = THREE.MathUtils.damp(hero.position.z, _astroGoal.z, 3.8, dt);
          hero.rotation.y = Math.atan2(dx, dz);
          hero.position.y = Math.abs(Math.sin(elapsed * 9)) * 0.07;
          if (heroRig) {
            const swing = Math.sin(elapsed * 9) * 0.55;
            heroRig.legLPivot.rotation.x = swing;
            heroRig.legRPivot.rotation.x = -swing;
            heroRig.armLPivot.rotation.x = -swing * 0.85;
            heroRig.armRPivot.rotation.x = swing * 0.85;
            heroRig.armRPivot.rotation.z = THREE.MathUtils.damp(heroRig.armRPivot.rotation.z, 0, 6, dt);
            heroRig.headGroup.rotation.y = 0;
          }
        } else {
          hero.position.y = Math.abs(Math.sin(elapsed * 2.2)) * 0.018;
          hero.rotation.y = THREE.MathUtils.damp(hero.rotation.y, 0.16, 4, dt);
          if (heroRig) {
            heroRig.legLPivot.rotation.x = THREE.MathUtils.damp(heroRig.legLPivot.rotation.x, 0, 8, dt);
            heroRig.legRPivot.rotation.x = THREE.MathUtils.damp(heroRig.legRPivot.rotation.x, 0, 8, dt);
            heroRig.armLPivot.rotation.x = THREE.MathUtils.damp(heroRig.armLPivot.rotation.x, 0, 8, dt);
            if (titleMode) {
              // Friendly wave on title screen
              heroRig.armRPivot.rotation.z = THREE.MathUtils.damp(
                heroRig.armRPivot.rotation.z,
                2.35 + Math.sin(elapsed * 5.2) * 0.25,
                6,
                dt
              );
              heroRig.armRPivot.rotation.x = THREE.MathUtils.damp(heroRig.armRPivot.rotation.x, 0, 6, dt);
            } else {
              // Checking wrist display / inspecting outpost module
              heroRig.armRPivot.rotation.z = THREE.MathUtils.damp(heroRig.armRPivot.rotation.z, 0.12, 6, dt);
              heroRig.armRPivot.rotation.x = THREE.MathUtils.damp(
                heroRig.armRPivot.rotation.x,
                fc.radiationMsv >= 18 ? -1.15 : -0.65,
                6,
                dt
              );
            }
            heroRig.headGroup.rotation.y = Math.sin(elapsed * 1.1) * 0.22;
          }
        }

        // Companion crewmate gentle idle motion
        const buddy = world.astronauts[1];
        if (buddy) {
          buddy.position.y = Math.abs(Math.sin(elapsed * 2.6 + 1.2)) * 0.025;
        }

        // 8. Atmospheric Mars Dust / Radiation Particles drift (zero allocations)
        world.weatherParticles.rotation.y += dt * (fc.dustStormActive ? 0.35 : 0.06) * simMult;
        world.weatherParticles.position.y = Math.sin(elapsed * 0.7) * 0.15;
        const targetPartOpacity = fc.dustStormActive
          ? 0.65
          : fc.radiationMsv >= 18
            ? 0.55
            : 0.24;
        world.weatherParticleMat.opacity = THREE.MathUtils.damp(
          world.weatherParticleMat.opacity,
          targetPartOpacity,
          4,
          dt
        );
        world.weatherParticleMat.color.setHex(
          fc.radiationMsv >= 18 ? 0xfbbf24 : 0xfdba74
        );

        // 9. Active / Hover Selection Ring
        const ringModule = hoveredModule ?? (canEdit ? selMod : null);
        if (ringModule && !titleMode && !simActive) {
          const pos = world.modulePositions[ringModule];
          world.hoverRingMesh.position.set(pos.x, 0.05, pos.z);
          const pulseScale = 1 + Math.sin(elapsed * 4.5) * 0.05;
          world.hoverRingMesh.scale.setScalar(pulseScale);
          ringAlpha = THREE.MathUtils.damp(ringAlpha, hoveredModule ? 0.92 : 0.72, 10, dt);
        } else {
          ringAlpha = THREE.MathUtils.damp(ringAlpha, 0, 10, dt);
        }
        world.hoverRingMat.opacity = ringAlpha;

        // 10. Expanding Tap / Power-Up Energy Pulse Ring
        if (pEvt && pEvt.nonce !== lastPulseNonce) {
          lastPulseNonce = pEvt.nonce;
          pulseProgress = 0;
          const pPos = world.modulePositions[pEvt.key];
          world.pulseRingMesh.position.set(pPos.x, 0.08, pPos.z);
          world.pulseRingMat.color.setHex(pEvt.colorHex);
          world.pulseRingMesh.visible = true;
        }
        if (pulseProgress < 1) {
          pulseProgress = Math.min(1, pulseProgress + dt * 2.2);
          const scale = 1.0 + pulseProgress * 1.45;
          world.pulseRingMesh.scale.setScalar(scale);
          world.pulseRingMat.opacity = (1 - pulseProgress) * 0.85;
          if (pulseProgress >= 1) {
            world.pulseRingMesh.visible = false;
          }
        }

        // 11. Gentle Camera Target Nudge toward Selected Module during Allocate Power
        if (focusActiveRef.current && canEdit && !titleMode) {
          const mPos = world.modulePositions[selMod];
          _focusTarget.set(-0.4 + mPos.x * 0.22, -0.2, 1.1 + mPos.z * 0.2);
          controls.target.lerp(_focusTarget, 1 - Math.exp(-4.5 * dt));
          if (controls.target.distanceToSquared(_focusTarget) < 0.002) {
            focusActiveRef.current = false;
          }
        }

        // 12. Project 3D building positions to clean game power-pip markers
        const cw = renderer.domElement.clientWidth;
        const ch = renderer.domElement.clientHeight;
        MODULE_META.forEach(({ key }) => {
          const btn = labelRefs.current[key];
          if (!btn) return;
          if (titleMode || simActive) {
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
            return;
          }
          const mPos = world.modulePositions[key];
          _projVec.set(mPos.x, 2.55, mPos.z);
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

      if (titleMode && !isSoftwareGl) {
        const camOrbit = Math.sin(elapsed * 0.22) * 2.4;
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
      controls.removeEventListener('start', onOrbitStart);
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

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#1D0F0B]">
      {/* Isolated Empty WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Fallback UI if WebGL context is unavailable/lost */}
      {webglLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B1120] p-6 text-center">
          <p className="font-display font-bold text-lg text-amber-300">3D Graphics Paused</p>
          <p className="text-xs text-slate-300 mt-1">
            Use the Command Deck below to continue running your outpost.
          </p>
        </div>
      )}

      {/* Clean Game Power-Pip Markers above 3D Buildings */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {MODULE_META.map(({ key, label, accent }) => {
          const level = allocation[key];
          const isSelected = canEditPower && selectedModule === key;
          return (
            <button
              key={key}
              ref={(el) => {
                labelRefs.current[key] = el;
              }}
              type="button"
              disabled={!canEditPower || isTitleMode || isSimulating}
              onClick={() => onTapModule(key)}
              aria-label={`${label}: level ${level} of 3. Tap to select or boost.`}
              style={{ opacity: 0, left: 0, top: 0 }}
              className={`absolute px-2 py-1 rounded-lg text-[11px] font-bold text-white shadow-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                isSelected
                  ? 'bg-[#172542] border-2 border-amber-400'
                  : 'bg-[#0B1120]/90 border border-slate-700'
              } ${canEditPower ? 'cursor-pointer hover:border-amber-300' : 'cursor-default'}`}
            >
              <span>{label}</span>
              <span className="flex items-center gap-0.5" aria-hidden="true">
                {[1, 2, 3].map((pip) => (
                  <span
                    key={pip}
                    className="w-1.5 h-2.5 rounded-[2px]"
                    style={{
                      backgroundColor: level >= pip ? accent : '#334155',
                    }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

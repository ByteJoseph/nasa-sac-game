import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildOutpostWorld, type Outpost3DRefs } from '../three/outpostModels';
import { createContactShadowTexture } from '../three/proceduralTextures';
import type {
  CutscenePreset,
  ModuleAllocation,
  ModuleKey,
  OutpostSite,
  SolForecast,
} from '../types/game';

export interface PulseEvent {
  key: ModuleKey;
  nonce: number;
  colorHex: number;
}

export interface CutsceneSceneFlags {
  dustBoost?: boolean;
  flareBoost?: boolean;
  commsBeamBoost?: boolean;
  landerDescending?: boolean;
}

interface OutpostCanvas3DProps {
  site: OutpostSite;
  allocation: ModuleAllocation;
  selectedModule: ModuleKey;
  forecast: SolForecast;
  solNumber: number;
  canEditPower: boolean;
  isSimulating: boolean;
  panelsRetracted: boolean;
  commsActive: boolean;
  isTitleMode: boolean;
  cutscenePreset: CutscenePreset;
  cutsceneShotKey: string;
  cutsceneFlags?: CutsceneSceneFlags;
  pulseEvent: PulseEvent | null;
  onTapModule: (key: ModuleKey) => void;
}

const MODULE_META: Array<{ key: ModuleKey; label: string; accent: string }> = [
  { key: 'scrubber', label: 'O₂', accent: '#22D3EE' },
  { key: 'greenhouse', label: 'Farm', accent: '#34D399' },
  { key: 'shield', label: 'Shield', accent: '#FBBF24' },
  { key: 'lab', label: 'Lab', accent: '#818CF8' },
];

interface CutsceneCameraSpec {
  startCam: [number, number, number];
  endCam: [number, number, number];
  startTarget: [number, number, number];
  endTarget: [number, number, number];
  fov: number;
  mayaPos: [number, number, number];
}

const CUTSCENE_SPECS: Record<Exclude<CutscenePreset, 'none'>, CutsceneCameraSpec> = {
  intro_outpost: {
    startCam: [-1.7, 2.75, 9.2],
    endCam: [-0.6, 2.15, 7.2],
    startTarget: [-0.55, 0.75, 3.3],
    endTarget: [-0.55, 0.72, 3.6],
    fov: 46,
    mayaPos: [-0.55, 0, 3.65],
  },
  intro_dust_wall: {
    startCam: [1.3, 2.25, 8.5],
    endCam: [2.8, 2.85, 9.3],
    startTarget: [2.4, 0.9, 1.8],
    endTarget: [3.6, 1.1, 2.6],
    fov: 50,
    mayaPos: [-0.35, 0, 3.7],
  },
  solar_arrays: {
    startCam: [8.4, 3.0, 8.0],
    endCam: [6.8, 2.4, 7.0],
    startTarget: [4.9, 1.05, 3.5],
    endTarget: [5.1, 1.1, 3.5],
    fov: 46,
    mayaPos: [3.35, 0, 3.85],
  },
  o2_dome: {
    startCam: [-6.2, 3.4, 6.8],
    endCam: [-4.8, 2.8, 6.0],
    startTarget: [-3.2, 0.95, 1.65],
    endTarget: [-3.35, 1.0, 1.65],
    fov: 46,
    mayaPos: [-1.95, 0, 2.85],
  },
  farm_dome: {
    startCam: [8.2, 2.9, 5.6],
    endCam: [6.9, 2.4, 4.7],
    startTarget: [4.65, 0.9, 0.65],
    endTarget: [4.65, 0.95, 0.65],
    fov: 46,
    mayaPos: [2.95, 0, 1.9],
  },
  shelter_water: {
    startCam: [3.8, 2.5, 7.2],
    endCam: [2.7, 2.1, 6.1],
    startTarget: [1.3, 0.85, 2.65],
    endTarget: [1.25, 0.9, 2.65],
    fov: 44,
    mayaPos: [0.2, 0, 3.65],
  },
  comms_dish: {
    startCam: [6.4, 4.1, 2.0],
    endCam: [5.1, 3.3, 1.2],
    startTarget: [2.65, 1.65, -3.25],
    endTarget: [2.65, 1.9, -3.25],
    fov: 48,
    mayaPos: [1.55, 0, -1.65],
  },
  rover_eva: {
    startCam: [0.8, 2.3, 9.2],
    endCam: [2.8, 2.0, 8.6],
    startTarget: [2.8, 0.55, 4.7],
    endTarget: [3.4, 0.55, 4.8],
    fov: 46,
    mayaPos: [1.95, 0, 4.85],
  },
  lander_descent: {
    startCam: [-2.2, 3.5, 7.9],
    endCam: [-3.4, 2.2, 6.2],
    startTarget: [-6.8, 4.2, 1.0],
    endTarget: [-6.8, 1.0, 1.0],
    fov: 50,
    mayaPos: [-2.4, 0, 2.3],
  },
  victory_celebration: {
    startCam: [-0.2, 2.3, 8.4],
    endCam: [-1.6, 2.6, 6.8],
    startTarget: [-0.9, 0.85, 2.8],
    endTarget: [-1.3, 0.95, 2.5],
    fov: 46,
    mayaPos: [-0.55, 0, 3.65],
  },
};

const OVERVIEW_CAM = new THREE.Vector3(0.2, 12.2, 20.4);
const OVERVIEW_TARGET = new THREE.Vector3(-0.4, -0.2, 1.1);

// Reusable module-scope math objects (zero GC inside animation loop)
const _projVec = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();
const _targetBgColor = new THREE.Color();
const _focusTarget = new THREE.Vector3();
const _astroGoal = new THREE.Vector3();
const _cutCamEnd = new THREE.Vector3();
const _cutTargetEnd = new THREE.Vector3();

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
  solNumber,
  canEditPower,
  isSimulating,
  panelsRetracted,
  commsActive,
  isTitleMode,
  cutscenePreset,
  cutsceneShotKey,
  cutsceneFlags,
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
    solNumber,
    canEditPower,
    isSimulating,
    panelsRetracted,
    commsActive,
    isTitleMode,
    cutscenePreset,
    cutsceneShotKey,
    cutsceneFlags,
    pulseEvent,
    onTapModule,
  });
  stateRef.current = {
    site,
    allocation,
    selectedModule,
    forecast,
    solNumber,
    canEditPower,
    isSimulating,
    panelsRetracted,
    commsActive,
    isTitleMode,
    cutscenePreset,
    cutsceneShotKey,
    cutsceneFlags,
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

    let baseFov = width / height < 0.56 ? 54 : 48;
    const camera = new THREE.PerspectiveCamera(baseFov, width / height, 0.2, 120);
    camera.position.copy(OVERVIEW_CAM);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(OVERVIEW_TARGET);
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

    let returningFromCutscene = false;
    const onOrbitStart = () => {
      focusActiveRef.current = false;
      returningFromCutscene = false;
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
      if (
        !stateRef.current.canEditPower ||
        stateRef.current.isTitleMode ||
        stateRef.current.cutscenePreset !== 'none'
      ) {
        return;
      }
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
      if (
        !stateRef.current.canEditPower ||
        stateRef.current.isTitleMode ||
        stateRef.current.cutscenePreset !== 'none'
      ) {
        hoveredModule = null;
        renderer.domElement.style.cursor =
          stateRef.current.cutscenePreset !== 'none' ? 'default' : 'grab';
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
      baseFov = w / h < 0.56 ? 54 : 48;
      if (stateRef.current.cutscenePreset === 'none') {
        camera.fov = baseFov;
      }
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
    let lastCutsceneShotKey = '';
    let lastCutscenePreset: CutscenePreset = 'none';
    let shotElapsed = 0;

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
        solNumber: currentSol,
        canEditPower: canEdit,
        isSimulating: simActive,
        panelsRetracted: retracted,
        commsActive: comms,
        isTitleMode: titleMode,
        cutscenePreset: csPreset,
        cutsceneShotKey: csShotKey,
        cutsceneFlags: csFlags,
        pulseEvent: pEvt,
      } = stateRef.current;
      const world = sceneRefs.current?.world;

      const inCutscene = csPreset !== 'none';
      const simMult = simActive ? 2.4 : 1.0;

      // Handle cinema camera cuts when entering/switching cutscene shots
      if (inCutscene && (csShotKey !== lastCutsceneShotKey || csPreset !== lastCutscenePreset)) {
        lastCutsceneShotKey = csShotKey;
        lastCutscenePreset = csPreset;
        shotElapsed = 0;
        returningFromCutscene = false;
        const spec = CUTSCENE_SPECS[csPreset];
        camera.position.set(spec.startCam[0], spec.startCam[1], spec.startCam[2]);
        controls.target.set(spec.startTarget[0], spec.startTarget[1], spec.startTarget[2]);
        camera.fov = spec.fov;
        camera.updateProjectionMatrix();
        if (world) {
          world.heroAstronaut.position.set(spec.mayaPos[0], spec.mayaPos[1], spec.mayaPos[2]);
        }
      } else if (!inCutscene && lastCutscenePreset !== 'none') {
        lastCutscenePreset = 'none';
        lastCutsceneShotKey = '';
        returningFromCutscene = true;
      }

      if (inCutscene) {
        shotElapsed += dt;
        controls.enabled = false;
        const spec = CUTSCENE_SPECS[csPreset];
        _cutCamEnd.set(spec.endCam[0], spec.endCam[1], spec.endCam[2]);
        _cutTargetEnd.set(spec.endTarget[0], spec.endTarget[1], spec.endTarget[2]);
        camera.position.lerp(_cutCamEnd, 1 - Math.exp(-1.15 * dt));
        controls.target.lerp(_cutTargetEnd, 1 - Math.exp(-1.4 * dt));
      } else {
        controls.enabled = true;
        shotElapsed = 0;
        if (returningFromCutscene) {
          camera.position.lerp(OVERVIEW_CAM, 1 - Math.exp(-4.2 * dt));
          controls.target.lerp(OVERVIEW_TARGET, 1 - Math.exp(-4.8 * dt));
          if (Math.abs(camera.fov - baseFov) > 0.05) {
            camera.fov = THREE.MathUtils.damp(camera.fov, baseFov, 5, dt);
            camera.updateProjectionMatrix();
          }
          if (
            camera.position.distanceToSquared(OVERVIEW_CAM) < 0.04 &&
            controls.target.distanceToSquared(OVERVIEW_TARGET) < 0.01
          ) {
            camera.fov = baseFov;
            camera.updateProjectionMatrix();
            returningFromCutscene = false;
          }
        }
      }

      // Martian sky & dust storm response
      const activeDust = fc.dustStormActive || Boolean(csFlags?.dustBoost);
      const activeFlare = fc.radiationMsv >= 18 || Boolean(csFlags?.flareBoost);
      const targetBg = activeDust ? 0x452212 : 0x261410;
      const bgCol = scene.background as THREE.Color;
      _targetBgColor.setHex(targetBg);
      bgCol.lerp(_targetBgColor, 1 - Math.exp(-3 * dt));
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(bgCol);
        const targetDensity = activeDust ? 0.044 : 0.024;
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
          retracted ? 0.04 : activeDust ? 0.08 : 0.42,
          4,
          dt
        );

        // 2. O2 Scrubber Dome glow & rising 3D bubbles
        const boostO2 = csPreset === 'o2_dome';
        world.scrubberWindowsMat.emissiveIntensity = THREE.MathUtils.damp(
          world.scrubberWindowsMat.emissiveIntensity,
          boostO2 ? 1.85 : alloc.scrubber > 0 ? 0.65 + alloc.scrubber * 0.45 : 0.08,
          6,
          dt
        );
        world.o2BubblesGroup.visible = alloc.scrubber > 0 || boostO2;
        if (world.o2BubblesGroup.visible) {
          const effLevel = boostO2 ? 3 : alloc.scrubber;
          world.o2BubblesGroup.children.forEach((b) => {
            const phase = (b.userData.phase as number) || 0;
            const cycle = ((elapsed * (0.7 + effLevel * 0.25) * simMult + phase) % 1.4) / 1.4;
            b.position.y = 1.95 + cycle * 1.25;
            b.scale.setScalar(Math.sin(cycle * Math.PI) * 1.15 + 0.15);
          });
        }

        // 3. Hydroponic Farm LEDs & Crop Growth
        const boostFarm = csPreset === 'farm_dome';
        world.greenhouseLedMat.emissiveIntensity = THREE.MathUtils.damp(
          world.greenhouseLedMat.emissiveIntensity,
          boostFarm ? 2.1 : alloc.greenhouse > 0 ? 0.6 + alloc.greenhouse * 0.5 : 0.05,
          6,
          dt
        );
        const plantScale = 0.72 + (boostFarm ? 3 : alloc.greenhouse) * 0.15;
        world.greenhousePlants.scale.y = THREE.MathUtils.damp(
          world.greenhousePlants.scale.y,
          plantScale,
          4,
          dt
        );

        // 4. Radiation Shelter Dosimeter Beacon (Water-Wall & Regolith Storm Shelter)
        const boostShelter = csPreset === 'shelter_water';
        world.shieldBeaconMat.color.setHex(
          activeFlare && alloc.shield < 2 ? 0xf43f5e : alloc.shield >= 2 || boostShelter ? 0x38bdf8 : 0xfef08a
        );
        world.shieldBeaconMat.emissive.setHex(
          activeFlare && alloc.shield < 2 ? 0xe11d48 : alloc.shield >= 2 || boostShelter ? 0x0284c7 : 0xf59e0b
        );
        world.shieldBeaconMat.emissiveIntensity = THREE.MathUtils.damp(
          world.shieldBeaconMat.emissiveIntensity,
          boostShelter ? 1.55 : alloc.shield > 0 ? (activeFlare ? 1.15 : 0.45 + alloc.shield * 0.3) : 0.08,
          5,
          dt
        );

        // 5. Comms Dish sweep & Signal Beam
        world.commsDishPivot.rotation.y = Math.sin(elapsed * 0.55 * simMult) * 0.45;
        const boostBeam = Boolean(csFlags?.commsBeamBoost) || csPreset === 'comms_dish';
        const targetBeam =
          comms || boostBeam
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
        if (alloc.lab > 0 || titleMode || csPreset === 'rover_eva') {
          const speed = (titleMode ? 0.34 : csPreset === 'rover_eva' ? 0.55 : 0.36 + alloc.lab * 0.16) * simMult;
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

        // 6b. Pad 1 Beacon & Sol 220 Supply Lander Descent
        world.pad1BeaconMat.opacity =
          currentSol >= 7 ? 0.2 : 0.32 + Math.sin(elapsed * 3.2) * 0.18;
        if (currentSol >= 7) {
          world.supplyLanderGroup.visible = true;
          if (csPreset === 'lander_descent' && csFlags?.landerDescending) {
            const descentT = Math.min(1, shotElapsed / 2.25);
            const eased = 1 - Math.pow(1 - descentT, 3);
            world.supplyLanderGroup.position.y = THREE.MathUtils.lerp(9.2, 0.16, eased);
            const thrusting = descentT < 0.96;
            world.landerFlameMesh.visible = thrusting;
            if (thrusting) {
              const flicker = 0.85 + Math.sin(elapsed * 42) * 0.2;
              world.landerFlameMesh.scale.set(1.0, flicker, 1.0);
              world.landerFlameMat.opacity = 0.86;
            }
          } else {
            world.supplyLanderGroup.position.y = THREE.MathUtils.damp(
              world.supplyLanderGroup.position.y,
              0.16,
              6,
              dt
            );
            world.landerFlameMesh.visible = false;
          }
        } else {
          world.supplyLanderGroup.visible = false;
          world.supplyLanderGroup.position.y = 10.5;
          world.landerFlameMesh.visible = false;
        }

        // 7. Hero Astronaut Commander Maya articulated walk, wave & cutscene actions
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
        } else if (inCutscene) {
          const spec = CUTSCENE_SPECS[csPreset];
          _astroGoal.set(spec.mayaPos[0], spec.mayaPos[1], spec.mayaPos[2]);
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
            heroRig.armLPivot.rotation.z = THREE.MathUtils.damp(heroRig.armLPivot.rotation.z, 0, 6, dt);
            heroRig.armRPivot.rotation.z = THREE.MathUtils.damp(heroRig.armRPivot.rotation.z, 0, 6, dt);
            heroRig.headGroup.rotation.y = 0;
          }
        } else {
          hero.position.y = Math.abs(Math.sin(elapsed * 2.2)) * 0.018;
          const targetYaw =
            csPreset === 'lander_descent'
              ? -1.25
              : csPreset === 'solar_arrays'
                ? 1.15
                : csPreset === 'o2_dome'
                  ? -0.95
                  : csPreset === 'farm_dome'
                    ? 0.95
                    : 0.16;
          hero.rotation.y = THREE.MathUtils.damp(hero.rotation.y, targetYaw, 5, dt);
          if (heroRig) {
            heroRig.legLPivot.rotation.x = THREE.MathUtils.damp(heroRig.legLPivot.rotation.x, 0, 8, dt);
            heroRig.legRPivot.rotation.x = THREE.MathUtils.damp(heroRig.legRPivot.rotation.x, 0, 8, dt);
            if (titleMode || csPreset === 'intro_outpost') {
              // Friendly wave
              heroRig.armLPivot.rotation.x = THREE.MathUtils.damp(heroRig.armLPivot.rotation.x, 0, 8, dt);
              heroRig.armLPivot.rotation.z = THREE.MathUtils.damp(heroRig.armLPivot.rotation.z, 0, 8, dt);
              heroRig.armRPivot.rotation.z = THREE.MathUtils.damp(
                heroRig.armRPivot.rotation.z,
                2.35 + Math.sin(elapsed * 5.2) * 0.25,
                6,
                dt
              );
              heroRig.armRPivot.rotation.x = THREE.MathUtils.damp(heroRig.armRPivot.rotation.x, 0, 6, dt);
            } else if (csPreset === 'victory_celebration') {
              // Both arms raised in triumph!
              heroRig.armLPivot.rotation.x = THREE.MathUtils.damp(heroRig.armLPivot.rotation.x, 0, 6, dt);
              heroRig.armRPivot.rotation.x = THREE.MathUtils.damp(heroRig.armRPivot.rotation.x, 0, 6, dt);
              heroRig.armLPivot.rotation.z = THREE.MathUtils.damp(
                heroRig.armLPivot.rotation.z,
                -2.5 + Math.sin(elapsed * 4.5) * 0.18,
                6,
                dt
              );
              heroRig.armRPivot.rotation.z = THREE.MathUtils.damp(
                heroRig.armRPivot.rotation.z,
                2.5 - Math.sin(elapsed * 4.5) * 0.18,
                6,
                dt
              );
            } else if (csPreset === 'intro_dust_wall') {
              // Shielding helmet visor against approaching dust storm
              heroRig.armLPivot.rotation.x = THREE.MathUtils.damp(heroRig.armLPivot.rotation.x, 0, 8, dt);
              heroRig.armLPivot.rotation.z = THREE.MathUtils.damp(heroRig.armLPivot.rotation.z, 0, 8, dt);
              heroRig.armRPivot.rotation.z = THREE.MathUtils.damp(heroRig.armRPivot.rotation.z, 0.35, 6, dt);
              heroRig.armRPivot.rotation.x = THREE.MathUtils.damp(heroRig.armRPivot.rotation.x, -1.75, 6, dt);
            } else {
              // Checking wrist display / inspecting outpost module
              heroRig.armLPivot.rotation.x = THREE.MathUtils.damp(heroRig.armLPivot.rotation.x, 0, 8, dt);
              heroRig.armLPivot.rotation.z = THREE.MathUtils.damp(heroRig.armLPivot.rotation.z, 0, 8, dt);
              heroRig.armRPivot.rotation.z = THREE.MathUtils.damp(heroRig.armRPivot.rotation.z, 0.12, 6, dt);
              heroRig.armRPivot.rotation.x = THREE.MathUtils.damp(
                heroRig.armRPivot.rotation.x,
                activeFlare ? -1.15 : -0.65,
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
        world.weatherParticles.rotation.y += dt * (activeDust ? 0.42 : 0.06) * simMult;
        world.weatherParticles.position.y = Math.sin(elapsed * 0.7) * 0.15;
        const targetPartOpacity = activeDust ? 0.72 : activeFlare ? 0.62 : 0.24;
        world.weatherParticleMat.opacity = THREE.MathUtils.damp(
          world.weatherParticleMat.opacity,
          targetPartOpacity,
          4,
          dt
        );
        world.weatherParticleMat.color.setHex(activeFlare ? 0xfbbf24 : 0xfdba74);

        // 9. Active / Hover Selection Ring
        const ringModule = hoveredModule ?? (canEdit && !inCutscene ? selMod : null);
        if (ringModule && !titleMode && !simActive && !inCutscene) {
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

        // 11. Gentle Camera Target Nudge toward Selected Module during Power Edits
        if (focusActiveRef.current && canEdit && !titleMode && !inCutscene) {
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
          if (titleMode || simActive || inCutscene) {
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

      if (titleMode && !inCutscene && !isSoftwareGl) {
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

  const hideLabels = isTitleMode || isSimulating || cutscenePreset !== 'none';

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
              disabled={!canEditPower || hideLabels}
              onClick={() => onTapModule(key)}
              aria-label={`${label}: level ${level} of 3. Tap to select or boost.`}
              style={{ opacity: 0, left: 0, top: 0 }}
              className={`absolute px-2 py-1 rounded-lg text-[11px] font-bold text-white shadow-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                isSelected
                  ? 'bg-[#172542] border-2 border-amber-400'
                  : 'bg-[#0B1120]/90 border border-slate-700'
              } ${canEditPower && !hideLabels ? 'cursor-pointer hover:border-amber-300' : 'cursor-default'}`}
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

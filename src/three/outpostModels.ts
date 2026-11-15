import * as THREE from 'three';
import type { ModuleKey, OutpostSite } from '../types/game';
import {
  createJupiterTexture,
  createLandingPadTexture,
  createSolarGridTexture,
  createTerrainTexture,
} from './proceduralTextures';

export function groundHeightAt(x: number, z: number, site: OutpostSite): number {
  const dist = Math.sqrt(x * x + z * z);

  // Canyon rim drop-off on the far left (behind/below the helipads)
  if (x < -9.2 && z > -7.5 && z < 8.5) {
    const cliffT = Math.min(1, (-9.2 - x) / 6.5);
    return -cliffT * cliffT * 3.8;
  }

  // Flat central outpost plateau so all spaced-out modules, pads, and paths sit flush
  if (dist <= 10.2) return 0;

  // Distant layered canyon mesas & crater rims
  const rimT = Math.min(1, (dist - 10.2) / 18);
  const smooth = rimT * rimT * (3 - 2 * rimT);
  const mesaSteps =
    Math.round(
      (Math.sin(x * 0.22 + (site === 'mars' ? 1.1 : site === 'europa' ? 2.4 : 0)) *
        Math.cos(z * 0.2) *
        1.1 +
        smooth * (site === 'mars' ? 4.8 : site === 'moon' ? 4.5 : 3.4)) *
        2
    ) / 2;
  return Math.max(0, mesaSteps);
}

export interface Outpost3DRefs {
  root: THREE.Group;
  terrainMesh: THREE.Mesh;
  terrainMat: THREE.MeshStandardMaterial;
  rocksMesh: THREE.InstancedMesh;
  planetBody: THREE.Mesh;
  solarWings: THREE.Group;
  solarPanelWings: THREE.Mesh[];
  solarPanelMat: THREE.MeshStandardMaterial;
  scrubberWindowsMat: THREE.MeshStandardMaterial;
  o2BubblesGroup: THREE.Group;
  greenhouseLedMat: THREE.MeshStandardMaterial;
  greenhousePlants: THREE.Group;
  shieldDomeMat: THREE.MeshPhysicalMaterial;
  shieldDomeMesh: THREE.Mesh;
  shieldCoilMat: THREE.MeshStandardMaterial;
  shieldBeaconMat: THREE.MeshStandardMaterial;
  commsDishPivot: THREE.Group;
  commsBeamMesh: THREE.Mesh;
  commsBeamMat: THREE.MeshBasicMaterial;
  roverGroup: THREE.Group;
  roverWheels: THREE.Mesh[];
  hoverRingMesh: THREE.Mesh;
  hoverRingMat: THREE.MeshBasicMaterial;
  pulseRingMesh: THREE.Mesh;
  pulseRingMat: THREE.MeshBasicMaterial;
  weatherParticles: THREE.Points;
  weatherParticleMat: THREE.PointsMaterial;
  astronauts: THREE.Group[];
  heroAstronaut: THREE.Group;
  clickableTargets: THREE.Mesh[];
  modulePositions: Record<ModuleKey, THREE.Vector3>;
  disposables: Array<{ dispose: () => void }>;
}

function addContactShadow(
  parent: THREE.Group,
  radius: number,
  shadowTex: THREE.Texture,
  disposables: Array<{ dispose: () => void }>
) {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.025;
  parent.add(mesh);
  disposables.push(geo, mat);
}

function addCorrugatedTunnel(
  root: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  hullMat: THREE.Material,
  ringMat: THREE.Material,
  isSoftwareGl: boolean,
  disposables: Array<{ dispose: () => void }>
) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len < 0.2) return;

  const group = new THREE.Group();
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  group.position.set(mid.x, 0.42, mid.z);
  group.rotation.y = Math.atan2(dir.x, dir.z);

  const tubeGeo = new THREE.CylinderGeometry(0.32, 0.32, len, 12);
  tubeGeo.rotateX(Math.PI / 2);
  const tube = new THREE.Mesh(tubeGeo, hullMat);
  tube.castShadow = !isSoftwareGl;
  tube.receiveShadow = true;
  group.add(tube);
  disposables.push(tubeGeo);

  const ringGeo = new THREE.TorusGeometry(0.34, 0.035, 6, 14);
  const ringCount = Math.max(2, Math.floor(len / 0.55));
  for (let i = 1; i < ringCount; i++) {
    const r = new THREE.Mesh(ringGeo, ringMat);
    r.position.z = -len / 2 + (i / ringCount) * len;
    group.add(r);
  }
  disposables.push(ringGeo);
  root.add(group);
}

function buildAstronaut(
  suitMat: THREE.Material,
  packMat: THREE.Material,
  visorMat: THREE.Material,
  bootMat: THREE.Material,
  accentMat: THREE.Material | null,
  isSoftwareGl: boolean,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const astro = new THREE.Group();

  // Articulated Left & Right Leg Pivots (pivot at hip y = 0.28)
  const legLPivot = new THREE.Group();
  legLPivot.position.set(-0.08, 0.28, 0);
  const legRPivot = new THREE.Group();
  legRPivot.position.set(0.08, 0.28, 0);

  const legGeo = new THREE.CapsuleGeometry(0.065, 0.16, 4, 8);
  const bootGeo = new THREE.BoxGeometry(0.11, 0.075, 0.16);

  const legL = new THREE.Mesh(legGeo, suitMat);
  legL.position.set(0, -0.12, 0);
  legL.castShadow = !isSoftwareGl;
  const bootL = new THREE.Mesh(bootGeo, bootMat);
  bootL.position.set(0, -0.245, 0.025);
  legLPivot.add(legL, bootL);

  const legR = new THREE.Mesh(legGeo, suitMat);
  legR.position.set(0, -0.12, 0);
  legR.castShadow = !isSoftwareGl;
  const bootR = new THREE.Mesh(bootGeo, bootMat);
  bootR.position.set(0, -0.245, 0.025);
  legRPivot.add(legR, bootR);

  // Torso & Life-Support Backpack
  const torsoGeo = new THREE.CapsuleGeometry(0.145, 0.21, 6, 10);
  const torso = new THREE.Mesh(torsoGeo, suitMat);
  torso.position.set(0, 0.44, 0);
  torso.castShadow = !isSoftwareGl;

  const packGeo = new THREE.BoxGeometry(0.24, 0.3, 0.15);
  const pack = new THREE.Mesh(packGeo, packMat);
  pack.position.set(0, 0.46, -0.15);
  pack.castShadow = !isSoftwareGl;

  const chestBoxGeo = new THREE.BoxGeometry(0.14, 0.11, 0.06);
  const chestBox = new THREE.Mesh(chestBoxGeo, accentMat ?? bootMat);
  chestBox.position.set(0, 0.47, 0.13);

  // Articulated Arm Pivots (pivot at shoulder y = 0.52)
  const armLPivot = new THREE.Group();
  armLPivot.position.set(-0.2, 0.52, 0);
  const armRPivot = new THREE.Group();
  armRPivot.position.set(0.2, 0.52, 0);

  const armGeo = new THREE.CapsuleGeometry(0.052, 0.18, 4, 8);
  const armL = new THREE.Mesh(armGeo, suitMat);
  armL.position.set(-0.02, -0.12, 0);
  armL.rotation.z = -0.15;
  armL.castShadow = !isSoftwareGl;
  armLPivot.add(armL);

  const armR = new THREE.Mesh(armGeo, suitMat);
  armR.position.set(0.02, -0.12, 0);
  armR.rotation.z = 0.15;
  armR.castShadow = !isSoftwareGl;
  armRPivot.add(armR);

  // Head / Helmet Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.71, 0);

  const helmetGeo = new THREE.SphereGeometry(0.14, 16, 16);
  const helmet = new THREE.Mesh(helmetGeo, suitMat);
  helmet.castShadow = !isSoftwareGl;

  const visorGeo = new THREE.SphereGeometry(0.115, 14, 14, -Math.PI * 0.42, Math.PI * 0.84, 0.35, 1.45);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0, 0.048);
  headGroup.add(helmet, visor);

  if (accentMat) {
    const stripeGeo = new THREE.TorusGeometry(0.142, 0.016, 6, 16, Math.PI);
    stripeGeo.rotateY(Math.PI / 2);
    const crest = new THREE.Mesh(stripeGeo, accentMat);
    crest.position.set(0, 0.02, 0);
    headGroup.add(crest);

    const bandGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.045, 10);
    const bandL = new THREE.Mesh(bandGeo, accentMat);
    bandL.position.set(-0.015, -0.05, 0);
    const bandR = new THREE.Mesh(bandGeo, accentMat);
    bandR.position.set(0.015, -0.05, 0);
    armLPivot.add(bandL);
    armRPivot.add(bandR);
    disposables.push(stripeGeo, bandGeo);
  }

  astro.add(legLPivot, legRPivot, torso, pack, chestBox, armLPivot, armRPivot, headGroup);
  astro.userData.rig = { legLPivot, legRPivot, armLPivot, armRPivot, headGroup };
  disposables.push(legGeo, bootGeo, torsoGeo, packGeo, chestBoxGeo, armGeo, helmetGeo, visorGeo);
  return astro;
}

export function buildOutpostWorld(
  site: OutpostSite,
  maxAnisotropy: number,
  shadowTex: THREE.Texture,
  isSoftwareGl: boolean
): Outpost3DRefs {
  const disposables: Array<{ dispose: () => void }> = [];
  const root = new THREE.Group();

  // 1. Sculpted Canyon Rim / Crater Terrain
  const planeGeo = new THREE.PlaneGeometry(86, 86, 76, 76);
  planeGeo.rotateX(-Math.PI / 2);
  const posAttr = planeGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    posAttr.setY(i, groundHeightAt(vx, vz, site));
  }
  planeGeo.computeVertexNormals();

  const terrainTex = createTerrainTexture(site, maxAnisotropy);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: terrainTex,
    roughness: site === 'europa' ? 0.42 : site === 'moon' ? 0.92 : 0.88,
    metalness: site === 'europa' ? 0.12 : 0.04,
  });
  const terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
  terrainMesh.receiveShadow = !isSoftwareGl;
  root.add(terrainMesh);
  disposables.push(planeGeo, terrainTex, terrainMat);

  // 2. Instanced Perimeter Rocks
  const rockGeo = new THREE.DodecahedronGeometry(0.42, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.05,
  });
  const rockCount = 52;
  const rocksMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocksMesh.castShadow = !isSoftwareGl;
  rocksMesh.receiveShadow = !isSoftwareGl;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2 + (i % 3) * 0.19;
    const radius = 10.8 + ((i * 7) % 14);
    const rx = Math.cos(angle) * radius;
    const rz = Math.sin(angle) * radius;
    const ry = groundHeightAt(rx, rz, site);
    const s = 0.45 + ((i * 13) % 10) * 0.12;
    dummy.position.set(rx, ry + s * 0.18, rz);
    dummy.rotation.set((i % 5) * 0.4, angle, (i % 3) * 0.3);
    dummy.scale.set(s * 1.25, s * 0.72, s);
    dummy.updateMatrix();
    rocksMesh.setMatrixAt(i, dummy.matrix);

    if (site === 'moon') {
      const shade = 0.38 + ((i * 11) % 10) * 0.025;
      color.setRGB(shade, shade + 0.02, shade + 0.05);
    } else if (site === 'mars') {
      const r = 0.52 + ((i * 11) % 10) * 0.025;
      color.setRGB(r, r * 0.52, r * 0.32);
    } else {
      const ice = 0.68 + ((i * 11) % 10) * 0.025;
      color.setRGB(ice * 0.78, ice * 0.95, ice);
    }
    rocksMesh.setColorAt(i, color);
  }
  rocksMesh.instanceMatrix.needsUpdate = true;
  if (rocksMesh.instanceColor) rocksMesh.instanceColor.needsUpdate = true;
  rocksMesh.computeBoundingSphere();
  root.add(rocksMesh);
  disposables.push(rockGeo, rockMat);

  // 3. Distant Celestial Body (Earth for Moon, Twin Moons Phobos/Deimos for Mars, Jupiter for Europa)
  const jupiterTex = site === 'europa' ? createJupiterTexture(maxAnisotropy) : null;
  const planetRadius = site === 'europa' ? 4.2 : site === 'moon' ? 2.1 : 0.95;
  const planetGeo = new THREE.SphereGeometry(planetRadius, 28, 28);
  const planetMat = new THREE.MeshStandardMaterial({
    color: site === 'europa' ? 0xffffff : site === 'moon' ? 0x38bdf8 : 0xc2b29b,
    map: jupiterTex,
    emissive: site === 'europa' ? 0x3b2416 : site === 'moon' ? 0x0c4a6e : 0x2a1d17,
    emissiveIntensity: site === 'europa' ? 0.35 : site === 'moon' ? 0.55 : 0.25,
    roughness: 0.75,
  });
  const planetBody = new THREE.Mesh(planetGeo, planetMat);
  planetBody.position.set(
    site === 'europa' ? -4.2 : site === 'moon' ? -5.5 : 4.8,
    site === 'europa' ? 13.5 : 12.5,
    site === 'europa' ? -26 : -24
  );
  root.add(planetBody);
  disposables.push(planetGeo, planetMat);
  if (jupiterTex) disposables.push(jupiterTex);

  if (site === 'mars') {
    const deimosGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const deimos = new THREE.Mesh(deimosGeo, planetMat);
    deimos.position.set(7.2, 10.6, -24);
    root.add(deimos);
    disposables.push(deimosGeo);
  }

  // Shared Outpost Materials matching reference palette (warm cream/white composite + dark trim + gold foil)
  const hullCreamMat = new THREE.MeshStandardMaterial({
    color: 0xe6dfd3,
    roughness: 0.45,
    metalness: 0.18,
  });
  const hullWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.34,
    metalness: 0.25,
  });
  const darkFrameMat = new THREE.MeshStandardMaterial({
    color: 0x27303f,
    roughness: 0.55,
    metalness: 0.65,
  });
  const brushedGoldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.88,
  });
  const warmWinMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 1.0,
    roughness: 0.2,
  });
  const gravelPathMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.94,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  disposables.push(
    hullCreamMat,
    hullWhiteMat,
    darkFrameMat,
    brushedGoldMat,
    warmWinMat,
    gravelPathMat
  );

  // Foreground Gravel Footpath leading out from the central outpost
  const pathPoints = [
    new THREE.Vector3(-0.35, 0.03, 0.8),
    new THREE.Vector3(-0.25, 0.03, 3.0),
    new THREE.Vector3(-0.65, 0.03, 5.2),
    new THREE.Vector3(-0.3, 0.03, 7.6),
  ];
  const pathCurve = new THREE.CatmullRomCurve3(pathPoints);
  const pathTubeGeo = new THREE.TubeGeometry(pathCurve, 20, 0.45, 6, false);
  pathTubeGeo.scale(1, 0.08, 1);
  const pathMesh = new THREE.Mesh(pathTubeGeo, gravelPathMat);
  pathMesh.receiveShadow = true;
  root.add(pathMesh);
  disposables.push(pathTubeGeo);

  // Foreground Hero Astronaut Commander (Maya) + Crewmate on the plateau
  const commanderAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xc2410c,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.2,
  });
  disposables.push(commanderAccentMat);

  const astro1 = buildAstronaut(
    hullWhiteMat,
    hullCreamMat,
    brushedGoldMat,
    darkFrameMat,
    commanderAccentMat,
    isSoftwareGl,
    disposables
  );
  astro1.scale.setScalar(1.58);
  astro1.position.set(-0.55, 0, 3.45);
  astro1.rotation.y = 0.2;
  addContactShadow(astro1, 0.45, shadowTex, disposables);

  const astro2 = buildAstronaut(
    hullWhiteMat,
    hullCreamMat,
    brushedGoldMat,
    darkFrameMat,
    null,
    isSoftwareGl,
    disposables
  );
  astro2.scale.setScalar(1.2);
  astro2.position.set(0.6, 0, 5.15);
  astro2.rotation.y = -0.25;
  addContactShadow(astro2, 0.38, shadowTex, disposables);
  root.add(astro1, astro2);

  // 4. Central Octagonal Command Hub (connects all modules)
  const hubPos = new THREE.Vector3(0, 0, -0.6);
  const hubGroup = new THREE.Group();
  hubGroup.position.copy(hubPos);
  addContactShadow(hubGroup, 2.1, shadowTex, disposables);

  const hubBaseGeo = new THREE.CylinderGeometry(1.48, 1.65, 0.22, 8);
  const hubBase = new THREE.Mesh(hubBaseGeo, darkFrameMat);
  hubBase.position.y = 0.11;
  hubBase.receiveShadow = true;
  hubGroup.add(hubBase);

  const hubBodyGeo = new THREE.CylinderGeometry(1.32, 1.48, 0.66, 8);
  const hubBody = new THREE.Mesh(hubBodyGeo, hullCreamMat);
  hubBody.position.y = 0.55;
  hubBody.castShadow = !isSoftwareGl;
  hubBody.receiveShadow = true;
  hubGroup.add(hubBody);

  const hubCupolaGeo = new THREE.CylinderGeometry(0.68, 1.05, 0.26, 8);
  const hubCupola = new THREE.Mesh(hubCupolaGeo, hullWhiteMat);
  hubCupola.position.y = 1.0;
  hubGroup.add(hubCupola);

  // Central Lattice Comms Mast behind the hub
  const mastGeo = new THREE.CylinderGeometry(0.05, 0.12, 2.4, 6);
  const mast = new THREE.Mesh(mastGeo, darkFrameMat);
  mast.position.set(0.25, 1.9, -1.25);
  mast.castShadow = !isSoftwareGl;
  hubGroup.add(mast);

  const dishMinGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 10);
  [1.6, 2.1, 2.6].forEach((dy) => {
    const disc = new THREE.Mesh(dishMinGeo, hullWhiteMat);
    disc.position.set(0.25, dy, -1.25);
    hubGroup.add(disc);
  });

  root.add(hubGroup);
  disposables.push(hubBaseGeo, hubBodyGeo, hubCupolaGeo, mastGeo, dishMinGeo);

  // Left Mesa Landing Pads + 4-Legged Ascent/Supply Lander
  const padTex = createLandingPadTexture(maxAnisotropy);
  const padTopMat = new THREE.MeshStandardMaterial({
    map: padTex,
    roughness: 0.78,
    metalness: 0.12,
  });
  const padGeo = new THREE.CylinderGeometry(1.55, 1.72, 0.16, 8);
  const pad1 = new THREE.Mesh(padGeo, [darkFrameMat, padTopMat, darkFrameMat]);
  pad1.position.set(-6.8, 0.08, 1.0);
  pad1.receiveShadow = true;
  const pad2 = new THREE.Mesh(padGeo, [darkFrameMat, padTopMat, darkFrameMat]);
  pad2.position.set(-7.1, 0.08, -2.9);
  pad2.receiveShadow = true;
  root.add(pad1, pad2);
  disposables.push(padTex, padTopMat, padGeo);

  // 4-Legged Supply Lander perched on Pad 1
  const landerGroup = new THREE.Group();
  landerGroup.position.set(-6.8, 0.16, 1.0);
  const landerDeckGeo = new THREE.CylinderGeometry(0.45, 0.52, 0.28, 8);
  const landerDeck = new THREE.Mesh(landerDeckGeo, brushedGoldMat);
  landerDeck.position.y = 0.46;
  landerDeck.castShadow = !isSoftwareGl;
  const landerCabGeo = new THREE.CylinderGeometry(0.32, 0.42, 0.36, 8);
  const landerCab = new THREE.Mesh(landerCabGeo, hullWhiteMat);
  landerCab.position.y = 0.78;
  landerCab.castShadow = !isSoftwareGl;
  landerGroup.add(landerDeck, landerCab);

  const strutGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 6);
  [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].forEach((a) => {
    const leg = new THREE.Mesh(strutGeo, darkFrameMat);
    leg.position.set(Math.cos(a) * 0.48, 0.24, Math.sin(a) * 0.48);
    leg.rotation.z = Math.cos(a) * 0.45;
    leg.rotation.x = -Math.sin(a) * 0.45;
    landerGroup.add(leg);
  });
  root.add(landerGroup);
  disposables.push(landerDeckGeo, landerCabGeo, strutGeo);

  // Clickable Module Coordinates (widely spaced around Central Hub with longer connecting tunnels!)
  const modulePositions: Record<ModuleKey, THREE.Vector3> = {
    scrubber: new THREE.Vector3(-3.35, 0, 1.65),
    shield: new THREE.Vector3(1.15, 0, 2.35),
    greenhouse: new THREE.Vector3(4.65, 0, 0.65),
    lab: new THREE.Vector3(2.65, 0, -3.25),
  };

  // Corrugated Tunnels linking Hub to every module + Rear Biodome
  const rearDomePos = new THREE.Vector3(-3.0, 0, -3.1);
  addCorrugatedTunnel(root, hubPos, modulePositions.scrubber, hullCreamMat, darkFrameMat, isSoftwareGl, disposables);
  addCorrugatedTunnel(root, hubPos, modulePositions.shield, hullCreamMat, darkFrameMat, isSoftwareGl, disposables);
  addCorrugatedTunnel(root, hubPos, modulePositions.greenhouse, hullCreamMat, darkFrameMat, isSoftwareGl, disposables);
  addCorrugatedTunnel(root, hubPos, modulePositions.lab, hullCreamMat, darkFrameMat, isSoftwareGl, disposables);
  addCorrugatedTunnel(root, hubPos, rearDomePos, hullCreamMat, darkFrameMat, isSoftwareGl, disposables);

  // Rear-Left Geodesic Biodome (Visual completeness matching reference photo)
  const rearGeo = new THREE.SphereGeometry(1.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const rearGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcbd5e1,
    roughness: 0.2,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const rearWireMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    wireframe: true,
  });
  const rearDome = new THREE.Mesh(rearGeo, rearGlassMat);
  rearDome.position.set(rearDomePos.x, 0.12, rearDomePos.z);
  const rearWire = new THREE.Mesh(rearGeo, rearWireMat);
  rearWire.position.set(rearDomePos.x, 0.13, rearDomePos.z);
  root.add(rearDome, rearWire);
  disposables.push(rearGeo, rearGlassMat, rearWireMat);

  // 5. Dual Solar Panel Arrays (Behind Hub & Front-Right behind Rover)
  const solarTex = createSolarGridTexture(maxAnisotropy);
  const solarPanelMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    roughness: 0.22,
    metalness: 0.72,
    emissive: 0x0b1f44,
    emissiveIntensity: 0.3,
  });
  const solarWings = new THREE.Group();
  const solarPanelWings: THREE.Mesh[] = [];
  const buildSolarBank = (bx: number, bz: number, rotY: number) => {
    const bank = new THREE.Group();
    bank.position.set(bx, 0, bz);
    bank.rotation.y = rotY;
    const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.75, 8);
    const postL = new THREE.Mesh(postGeo, darkFrameMat);
    postL.position.set(-0.7, 0.38, 0);
    const postR = new THREE.Mesh(postGeo, darkFrameMat);
    postR.position.set(0.7, 0.38, 0);
    bank.add(postL, postR);

    const wingGeo = new THREE.BoxGeometry(2.1, 0.05, 0.95);
    const wing = new THREE.Mesh(wingGeo, solarPanelMat);
    wing.position.y = 0.78;
    wing.rotation.x = 0.48;
    wing.castShadow = !isSoftwareGl;
    bank.add(wing);
    solarPanelWings.push(wing);
    solarWings.add(bank);
    disposables.push(postGeo, wingGeo);
  };
  buildSolarBank(-0.45, -4.75, 0.1);
  buildSolarBank(5.2, 3.6, -0.35);
  root.add(solarWings);
  disposables.push(solarTex, solarPanelMat);

  // Helper to attach invisible simplified hitbox on Layer 1 for raycasting
  const clickableTargets: THREE.Mesh[] = [];
  const registerHitbox = (key: ModuleKey, pos: THREE.Vector3, radius: number, height: number) => {
    const hitGeo = new THREE.CylinderGeometry(radius, radius, height, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.set(pos.x, height / 2, pos.z);
    hitMesh.userData.moduleKey = key;
    hitMesh.layers.set(1);
    root.add(hitMesh);
    clickableTargets.push(hitMesh);
    disposables.push(hitGeo, hitMat);
  };

  // 6. Module 1: Crew Hab & O2 Scrubber Octagon (Front-Left)
  const scrubberGroup = new THREE.Group();
  scrubberGroup.position.copy(modulePositions.scrubber);
  addContactShadow(scrubberGroup, 1.65, shadowTex, disposables);

  const habOctGeo = new THREE.CylinderGeometry(1.12, 1.24, 0.85, 8);
  const habOct = new THREE.Mesh(habOctGeo, hullCreamMat);
  habOct.position.y = 0.44;
  habOct.castShadow = !isSoftwareGl;
  habOct.receiveShadow = true;
  scrubberGroup.add(habOct);

  const habRoofGeo = new THREE.CylinderGeometry(0.75, 1.12, 0.22, 8);
  const habRoof = new THREE.Mesh(habRoofGeo, hullWhiteMat);
  habRoof.position.y = 0.96;
  scrubberGroup.add(habRoof);

  const habPorchGeo = new THREE.BoxGeometry(0.55, 0.62, 0.65);
  const habPorch = new THREE.Mesh(habPorchGeo, hullCreamMat);
  habPorch.position.set(-0.35, 0.32, 1.05);
  habPorch.rotation.y = -0.3;
  scrubberGroup.add(habPorch);

  // Twin O2 Electrolysis Tanks
  const tankGeo = new THREE.CapsuleGeometry(0.16, 0.48, 6, 10);
  const tankMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    roughness: 0.3,
    metalness: 0.6,
  });
  const tank1 = new THREE.Mesh(tankGeo, tankMat);
  tank1.position.set(0.95, 0.45, 0.65);
  const tank2 = new THREE.Mesh(tankGeo, tankMat);
  tank2.position.set(1.22, 0.45, 0.42);
  scrubberGroup.add(tank1, tank2);

  // Glowing Cyan/Amber Hab Porthole Windows
  const scrubberWindowsMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.1,
    roughness: 0.15,
  });
  const winGeo = new THREE.BoxGeometry(0.24, 0.22, 0.1);
  [0.18, 0.58].forEach((wx) => {
    const w = new THREE.Mesh(winGeo, scrubberWindowsMat);
    w.position.set(wx, 0.55, 1.12);
    scrubberGroup.add(w);
  });

  // Animated rising 3D O2 bubbles
  const o2BubblesGroup = new THREE.Group();
  const bubbleGeo = new THREE.SphereGeometry(0.1, 10, 10);
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });
  for (let b = 0; b < 4; b++) {
    const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    bubble.position.set(-0.3 + b * 0.22, 1.3 + (b % 2) * 0.3, (b % 2 === 0 ? 1 : -1) * 0.2);
    bubble.userData.phase = b * 1.55;
    o2BubblesGroup.add(bubble);
  }
  scrubberGroup.add(o2BubblesGroup);
  root.add(scrubberGroup);
  registerHitbox('scrubber', modulePositions.scrubber, 1.45, 2.0);
  disposables.push(
    habOctGeo,
    habRoofGeo,
    habPorchGeo,
    tankGeo,
    tankMat,
    scrubberWindowsMat,
    winGeo,
    bubbleGeo,
    bubbleMat
  );

  // 7. Module 2: Geodesic Glass Hydroponic Greenhouse Dome (Right)
  const greenhouseGroup = new THREE.Group();
  greenhouseGroup.position.copy(modulePositions.greenhouse);
  addContactShadow(greenhouseGroup, 1.85, shadowTex, disposables);

  const ghRingGeo = new THREE.CylinderGeometry(1.48, 1.58, 0.22, 20);
  const ghRing = new THREE.Mesh(ghRingGeo, hullCreamMat);
  ghRing.position.y = 0.11;
  ghRing.receiveShadow = true;
  greenhouseGroup.add(ghRing);

  const ghDomeGeo = new THREE.SphereGeometry(1.42, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const ghGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd1fae5,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: isSoftwareGl ? 0.36 : 0.28,
    transmission: isSoftwareGl ? 0 : 0.65,
    ior: 1.45,
    depthWrite: false,
  });
  const ghGlass = new THREE.Mesh(ghDomeGeo, ghGlassMat);
  ghGlass.position.y = 0.2;
  ghGlass.renderOrder = 4;
  greenhouseGroup.add(ghGlass);

  // Geodesic wireframe lattice matching reference greenhouse
  const ghLatticeMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    wireframe: true,
  });
  const ghWireHemi = new THREE.Mesh(ghDomeGeo, ghLatticeMat);
  ghWireHemi.position.y = 0.21;
  greenhouseGroup.add(ghWireHemi);

  // Overhead Hydroponic Grow LED Ring
  const greenhouseLedMat = new THREE.MeshStandardMaterial({
    color: 0xf0abfc,
    emissive: 0xd946ef,
    emissiveIntensity: 1.0,
    roughness: 0.25,
  });
  const ledGeo = new THREE.TorusGeometry(0.65, 0.05, 8, 18);
  ledGeo.rotateX(Math.PI / 2);
  const ledRing = new THREE.Mesh(ledGeo, greenhouseLedMat);
  ledRing.position.y = 1.05;
  greenhouseGroup.add(ledRing);

  // Lush Green Hydroponic Crop Beds inside
  const greenhousePlants = new THREE.Group();
  const cropGeo = new THREE.SphereGeometry(0.24, 10, 10);
  const cropMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.72,
    metalness: 0.05,
  });
  for (let angle = 0; angle < 6; angle++) {
    const a = (angle / 6) * Math.PI * 2;
    const plant = new THREE.Mesh(cropGeo, cropMat);
    plant.position.set(Math.cos(a) * 0.68, 0.42, Math.sin(a) * 0.68);
    plant.scale.set(1.1, 0.8, 1.1);
    greenhousePlants.add(plant);
  }
  const centerCrop = new THREE.Mesh(cropGeo, cropMat);
  centerCrop.position.set(0, 0.48, 0);
  centerCrop.scale.set(1.4, 0.9, 1.4);
  greenhousePlants.add(centerCrop);
  greenhouseGroup.add(greenhousePlants);
  root.add(greenhouseGroup);
  registerHitbox('greenhouse', modulePositions.greenhouse, 1.65, 2.0);
  disposables.push(
    ghRingGeo,
    ghDomeGeo,
    ghGlassMat,
    ghLatticeMat,
    greenhouseLedMat,
    ledGeo,
    cropGeo,
    cropMat
  );

  // 8. Module 3: Ribbed Regolith Radiation Shelter Dome + Overarching Shield (Front-Center-Right)
  const shieldGroup = new THREE.Group();
  shieldGroup.position.copy(modulePositions.shield);
  addContactShadow(shieldGroup, 1.55, shadowTex, disposables);

  // Ribbed Inflatable / 3D-printed Shelter Dome
  const shelterDomeGeo = new THREE.SphereGeometry(1.08, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const shelterDome = new THREE.Mesh(shelterDomeGeo, hullCreamMat);
  shelterDome.position.y = 0.08;
  shelterDome.castShadow = !isSoftwareGl;
  shelterDome.receiveShadow = true;
  shieldGroup.add(shelterDome);

  // Radial Inflatable Ribs around dome
  const ribGeo = new THREE.TorusGeometry(1.09, 0.04, 6, 16, Math.PI);
  for (let r = 0; r < 6; r++) {
    const rib = new THREE.Mesh(ribGeo, hullWhiteMat);
    rib.position.y = 0.08;
    rib.rotation.y = (r / 6) * Math.PI;
    shieldGroup.add(rib);
  }

  // Front rectangular airlock vestibule
  const vestibuleGeo = new THREE.BoxGeometry(0.56, 0.66, 0.68);
  const vestibule = new THREE.Mesh(vestibuleGeo, hullCreamMat);
  vestibule.position.set(-0.22, 0.34, 0.98);
  vestibule.rotation.y = -0.25;
  shieldGroup.add(vestibule);

  // Copper Shield Emitter Coil & Beacon atop the shelter
  const shieldCoilMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.6,
    roughness: 0.28,
    metalness: 0.82,
  });
  const coilGeo = new THREE.TorusGeometry(0.32, 0.055, 8, 18);
  coilGeo.rotateX(Math.PI / 2);
  const coilTop = new THREE.Mesh(coilGeo, shieldCoilMat);
  coilTop.position.y = 1.24;
  shieldGroup.add(coilTop);

  const shieldBeaconMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });
  const beaconGeo = new THREE.SphereGeometry(0.2, 14, 14);
  const beacon = new THREE.Mesh(beaconGeo, shieldBeaconMat);
  beacon.position.y = 1.42;
  shieldGroup.add(beacon);

  // Protective Translucent Energy Shield Dome over the central interconnected base
  const shieldDomeGeo = new THREE.SphereGeometry(7.8, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const shieldDomeMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shieldDomeMesh = new THREE.Mesh(shieldDomeGeo, shieldDomeMat);
  shieldDomeMesh.position.set(0.4, 0, -0.2);
  shieldDomeMesh.renderOrder = 6;
  root.add(shieldDomeMesh);
  root.add(shieldGroup);
  registerHitbox('shield', modulePositions.shield, 1.4, 2.0);
  disposables.push(
    shelterDomeGeo,
    ribGeo,
    vestibuleGeo,
    shieldCoilMat,
    coilGeo,
    shieldBeaconMat,
    beaconGeo,
    shieldDomeGeo,
    shieldDomeMat
  );

  // 9. Module 4: Science & Comms Wing (Back-Right) + Crane-Arm Explorer Rover
  const labGroup = new THREE.Group();
  labGroup.position.copy(modulePositions.lab);
  addContactShadow(labGroup, 1.5, shadowTex, disposables);

  const labOctGeo = new THREE.CylinderGeometry(1.05, 1.15, 0.78, 8);
  const labOct = new THREE.Mesh(labOctGeo, hullCreamMat);
  labOct.position.y = 0.4;
  labOct.castShadow = !isSoftwareGl;
  labOct.receiveShadow = true;
  labGroup.add(labOct);

  const labWinGeo = new THREE.BoxGeometry(0.38, 0.2, 0.1);
  const labWin = new THREE.Mesh(labWinGeo, warmWinMat);
  labWin.position.set(0, 0.48, 1.05);
  labGroup.add(labWin);

  // Deep-Space Parabolic Comms Dish atop Science Pod
  const commsDishPivot = new THREE.Group();
  commsDishPivot.position.set(0.32, 0.85, -0.15);
  const dishMastGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.45, 8);
  const dishMast = new THREE.Mesh(dishMastGeo, darkFrameMat);
  dishMast.position.y = 0.22;
  commsDishPivot.add(dishMast);

  const dishPoints = [
    new THREE.Vector2(0.02, 0),
    new THREE.Vector2(0.32, 0.08),
    new THREE.Vector2(0.58, 0.26),
  ];
  const dishGeo = new THREE.LatheGeometry(dishPoints, 18);
  const dishMesh = new THREE.Mesh(dishGeo, hullWhiteMat);
  dishMesh.position.y = 0.48;
  dishMesh.rotation.x = 0.65;
  commsDishPivot.add(dishMesh);

  const commsBeamGeo = new THREE.ConeGeometry(0.85, 6.5, 16, 1, true);
  commsBeamGeo.translate(0, 3.25, 0);
  const commsBeamMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const commsBeamMesh = new THREE.Mesh(commsBeamGeo, commsBeamMat);
  commsBeamMesh.position.y = 0.55;
  commsBeamMesh.rotation.x = 0.65;
  commsDishPivot.add(commsBeamMesh);

  labGroup.add(commsDishPivot);
  root.add(labGroup);
  registerHitbox('lab', modulePositions.lab, 1.45, 2.0);
  disposables.push(labOctGeo, labWinGeo, dishMastGeo, dishGeo, commsBeamGeo, commsBeamMat);

  // 10. 6-Wheel Pressurized Rover with Articulated Crane Arm (Foreground Right)
  const roverGroup = new THREE.Group();
  roverGroup.position.set(3.6, 0, 4.9);
  addContactShadow(roverGroup, 0.78, shadowTex, disposables);

  const roverBodyGeo = new THREE.BoxGeometry(0.76, 0.34, 1.05);
  const roverBody = new THREE.Mesh(roverBodyGeo, hullWhiteMat);
  roverBody.position.y = 0.36;
  roverBody.castShadow = !isSoftwareGl;
  roverGroup.add(roverBody);

  const roverCabGeo = new THREE.BoxGeometry(0.68, 0.24, 0.34);
  const roverCab = new THREE.Mesh(roverCabGeo, darkFrameMat);
  roverCab.position.set(0, 0.44, 0.52);
  roverCab.rotation.x = 0.32;
  roverGroup.add(roverCab);

  // Articulated Robotic Crane Boom Arm matching reference photo!
  const craneBaseGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.22, 8);
  const craneBase = new THREE.Mesh(craneBaseGeo, hullCreamMat);
  craneBase.position.set(0, 0.62, -0.18);
  const craneArmGeo = new THREE.BoxGeometry(0.1, 0.1, 0.85);
  const craneArm = new THREE.Mesh(craneArmGeo, hullWhiteMat);
  craneArm.position.set(0, 0.82, 0.16);
  craneArm.rotation.x = -0.35;
  roverGroup.add(craneBase, craneArm);

  const wheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.11, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const roverWheels: THREE.Mesh[] = [];
  [-0.44, 0.44].forEach((wx) => {
    [-0.36, 0, 0.36].forEach((wz) => {
      const wheel = new THREE.Mesh(wheelGeo, darkFrameMat);
      wheel.position.set(wx, 0.15, wz);
      wheel.castShadow = !isSoftwareGl;
      roverGroup.add(wheel);
      roverWheels.push(wheel);
    });
  });
  root.add(roverGroup);
  disposables.push(roverBodyGeo, roverCabGeo, craneBaseGeo, craneArmGeo, wheelGeo);

  // 11. Ground Selection Ring + Expanding Tap Pulse Ring
  const hoverRingGeo = new THREE.RingGeometry(1.42, 1.68, 32);
  hoverRingGeo.rotateX(-Math.PI / 2);
  const hoverRingMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const hoverRingMesh = new THREE.Mesh(hoverRingGeo, hoverRingMat);
  hoverRingMesh.position.y = 0.05;
  root.add(hoverRingMesh);

  const pulseRingGeo = new THREE.RingGeometry(1.25, 1.48, 32);
  pulseRingGeo.rotateX(-Math.PI / 2);
  const pulseRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pulseRingMesh = new THREE.Mesh(pulseRingGeo, pulseRingMat);
  pulseRingMesh.position.y = 0.07;
  pulseRingMesh.visible = false;
  root.add(pulseRingMesh);

  // 12. Atmospheric Weather / Dust / Radiation Particles
  const particleCount = 120;
  const particlePos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    particlePos[i * 3] = (((i * 73) % 100) / 100 - 0.5) * 16;
    particlePos[i * 3 + 1] = 0.4 + ((i * 37) % 100) * 0.045;
    particlePos[i * 3 + 2] = (((i * 53) % 100) / 100 - 0.5) * 14;
  }
  const weatherParticleGeo = new THREE.BufferGeometry();
  weatherParticleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  const weatherParticleMat = new THREE.PointsMaterial({
    color: site === 'mars' ? 0xfdba74 : site === 'europa' ? 0xbae6fd : 0xfef08a,
    size: site === 'mars' ? 0.14 : 0.11,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const weatherParticles = new THREE.Points(weatherParticleGeo, weatherParticleMat);
  root.add(weatherParticles);

  disposables.push(
    hoverRingGeo,
    hoverRingMat,
    pulseRingGeo,
    pulseRingMat,
    weatherParticleGeo,
    weatherParticleMat
  );

  return {
    root,
    terrainMesh,
    terrainMat,
    rocksMesh,
    planetBody,
    solarWings,
    solarPanelWings,
    solarPanelMat,
    scrubberWindowsMat,
    o2BubblesGroup,
    greenhouseLedMat,
    greenhousePlants,
    shieldDomeMat,
    shieldDomeMesh,
    shieldCoilMat,
    shieldBeaconMat,
    commsDishPivot,
    commsBeamMesh,
    commsBeamMat,
    roverGroup,
    roverWheels,
    hoverRingMesh,
    hoverRingMat,
    pulseRingMesh,
    pulseRingMat,
    weatherParticles,
    weatherParticleMat,
    astronauts: [astro1, astro2],
    heroAstronaut: astro1,
    clickableTargets,
    modulePositions,
    disposables,
  };
}

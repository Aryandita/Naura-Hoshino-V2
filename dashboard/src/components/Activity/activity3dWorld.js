import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Activity3DWorld - Authentic 3D Multi-Player Open World Hub for Naura Wilds (Discord Activity)
 * 
 * Fitur Utama:
 * 1. Open World Hub Desa Adisha: Satu peta kontinu tanpa portal terpisah:
 *    - Balai Desa (Pusat): Paviliun kayu, Pak Kades Tirto, Monumen Bintang Adisha.
 *    - Bengkel Tempa (Barat): Tungku batu menyala, paron besi, Pandai Besi Bagas.
 *    - Hutan Pinus (Barat Laut): Rimbun pohon pinus, log kayu, node gathering Tebang Kayu.
 *    - Bukit Tambang (Timur Laut): Tebing andesit, kristal mineral, node gathering Tambang Batu/Bijih.
 *    - Kolam Bintang (Tenggara): Danau air transparan, dermaga kayu, node gathering Mancing Ikan.
 * 2. 3D Model Karakter Asli:
 *    - Memuat model 3D asli Naura (/models/naura NEW.glb atau naura.glb).
 *    - Avatar proxy siap seketika agar pemain bisa langsung bergerak tanpa menunggu download 20MB.
 *    - Transisi mulus ke model 3D asli lengkap dengan animasi gerak (Idle, Walk/Run, Chop, Mine, Fish, Talk).
 * 3. Real-time Spatial Multiplayer:
 *    - Sinkronisasi posisi, rotasi, dan animasi antar-pemain di voice channel / server yang sama via Socket.io.
 *    - Nametag Discord 3D melayang di atas kepala setiap pemain (avatar, username, level badge).
 *    - Notifikasi aksi spasial saat pemain lain berhasil memanen sumber daya.
 * 4. Skema Kontrol Dual & Kamera:
 *    - Desktop: WASD / Panah + Space / E untuk interaksi.
 *    - Mobile: Virtual Joystick analog di kiri bawah + Tombol Interaksi sentuh dinamis di kanan bawah.
 *    - Kamera Isometric / Third-Person RPG yang mengikuti karakter secara halus (lerp).
 * 5. Efek Spasial & Floating RPG Feedback:
 *    - Teks melayang 3D (+Kayu, +NSF, +EXP) saat melakukan gathering atau menerima berkah NPC.
 */
export class Activity3DWorld {
  constructor(canvasContainer, options = {}) {
    this.container = typeof canvasContainer === 'string'
      ? document.getElementById(canvasContainer)
      : canvasContainer;

    if (!this.container) {
      console.warn('[Activity3DWorld] Container canvas tidak ditemukan.');
      return;
    }

    this.options = {
      user: options.user || { id: 'guest_' + Math.random().toString(36).slice(2, 7), username: 'Petualang Adisha', level: 1 },
      socket: options.socket || null,
      channelId: options.channelId || 'global_sanctuary',
      modelPath: options.modelPath || '/models/naura%20NEW.glb',
      onInteract: options.onInteract || null,
      onProximityChange: options.onProximityChange || null,
      ...options,
    };

    // State pemain lokal
    this.localPlayerPos = new THREE.Vector3(0, 0, 0);
    this.moveVelocity = new THREE.Vector3();
    this.keys = { forward: false, backward: false, left: false, right: false };
    this.joystickVector = { x: 0, y: 0 };
    this.isMoving = false;
    this.currentAction = 'idle';
    this.actionTimer = 0;
    this.facingAngle = 0;

    // Multiplayer tracking
    this.players = new Map(); // id -> { group, targetPos, targetRot, username, level, nametag, isMoving, modelGroup }

    // Kamera & Orbit
    this.cameraDistance = 11.5;
    this.cameraAngleH = 0;
    this.cameraAngleV = 0.58;
    this.isDraggingCamera = false;
    this.prevMousePos = { x: 0, y: 0 };

    // Floating text items
    this.floatingTexts = [];

    // Interactivity POIs across 7 Expanded Adisha Zones (Radius ~90m)
    this.poiNodes = [
      {
        id: 'kades_tirto',
        name: 'Pak Kades Tirto',
        title: 'Kepala Desa Adisha',
        zone: 'desa',
        type: 'NPC',
        icon: '💬',
        actionLabel: 'Bicara dengan Pak Kades',
        pos: new THREE.Vector3(0, 0, -4.5),
        radius: 4.5,
      },
      {
        id: 'bagas',
        name: 'Pandai Besi Bagas',
        title: 'Bengkel Tempa Adisha',
        zone: 'desa',
        type: 'NPC',
        icon: '🔨',
        actionLabel: 'Tempa & Servis Perkakas',
        pos: new THREE.Vector3(-8.5, 0, 1.5),
        radius: 4.5,
      },
      {
        id: 'bu_yati',
        name: 'Warung Bu Yati',
        title: 'Kuliner & Pemulihan Stamina',
        zone: 'desa',
        type: 'NPC',
        icon: '🍲',
        actionLabel: 'Mampir ke Warung Bu Yati',
        pos: new THREE.Vector3(8.5, 0, 1.5),
        radius: 4.5,
      },
      {
        id: 'pine_tree',
        name: 'Hutan Pinus Adisha',
        title: 'Sumber Kayu Pinus & Serat',
        zone: 'hutan',
        type: 'GATHER_CHOP',
        icon: '🪓',
        actionLabel: 'Tebang Kayu Pinus',
        pos: new THREE.Vector3(-24.0, 0, -19.0),
        radius: 5.5,
      },
      {
        id: 'ancient_tree',
        name: 'Pohon Damar Raksasa Dha Mhai',
        title: 'Kayu Purba & Serat Rimba',
        zone: 'hutan',
        type: 'GATHER_CHOP',
        icon: '🌲',
        actionLabel: 'Panen Kayu Rimba Dha Mhai',
        pos: new THREE.Vector3(-34.0, 0, -28.0),
        radius: 5.8,
      },
      {
        id: 'kakek_danu',
        name: 'Kakek Danu',
        title: 'Penjaga Rimba Dha Mhai',
        zone: 'hutan',
        type: 'NPC',
        icon: '🌿',
        actionLabel: 'Bicara dengan Kakek Danu',
        pos: new THREE.Vector3(-29.0, 0, -23.0),
        radius: 4.8,
      },
      {
        id: 'ore_rock',
        name: 'Bukit Tambang Andesit & Bijih',
        title: 'Deposit Batu & Mineral',
        zone: 'tambang',
        type: 'GATHER_MINE',
        icon: '⛏️',
        actionLabel: 'Tambang Batu & Bijih',
        pos: new THREE.Vector3(24.0, 0, -19.0),
        radius: 5.5,
      },
      {
        id: 'crystal_vein',
        name: 'Kawah Kristal Aether',
        title: 'Urat Bijih Besi & Kristal Murni',
        zone: 'tambang',
        type: 'GATHER_MINE',
        icon: '💎',
        actionLabel: 'Tambang Kristal Kawah',
        pos: new THREE.Vector3(35.0, 0, -29.0),
        radius: 5.8,
      },
      {
        id: 'fishing_pier',
        name: 'Dermaga Kolam Bintang',
        title: 'Spot Pemancingan Ikan',
        zone: 'dermaga',
        type: 'GATHER_FISH',
        icon: '🎣',
        actionLabel: 'Mancing di Kolam Bintang',
        pos: new THREE.Vector3(22.5, 0, 22.5),
        radius: 5.8,
      },
      {
        id: 'mang_ujang',
        name: 'Mang Ujang',
        title: 'Nelayan Kolam Bintang & Lauh Than',
        zone: 'dermaga',
        type: 'NPC',
        icon: '⚓',
        actionLabel: 'Sapa Mang Ujang',
        pos: new THREE.Vector3(18.0, 0, 18.5),
        radius: 4.8,
      },
      {
        id: 'barista_chloe',
        name: 'Neo-Cyber Cafe Pratama',
        title: 'Barista Laras & Arkade Kota',
        zone: 'pratama',
        type: 'NPC',
        icon: '☕',
        actionLabel: 'Pesan Kopi di Cyber Cafe',
        pos: new THREE.Vector3(-25.0, 0, 22.0),
        radius: 5.2,
      },
      {
        id: 'syeikh_malik',
        name: 'Altar Es Khul\'Khas & Syeikh Malik',
        title: 'Puncak Salju Utara Adisha',
        zone: 'khulkhas',
        type: 'NPC',
        icon: '❄️',
        actionLabel: 'Meditasi di Puncak Khul\'Khas',
        pos: new THREE.Vector3(0, 0, -42.0),
        radius: 5.5,
      },
      {
        id: 'draken_archivist',
        name: 'Obelisk Riset Kampus Draken',
        title: 'Gerbang Akademi Selatan',
        zone: 'draken',
        type: 'NPC',
        icon: '🏛️',
        actionLabel: 'Teliti Obelisk Hextech Draken',
        pos: new THREE.Vector3(0, 0, 40.0),
        radius: 5.5,
      },
    ];

    this.interactableMeshes = [];
    this.autoWalkTarget = null;
    this.autoWalkPoi = null;
    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();

    this.activePoi = null;
    this.isRunning = false;
    this.clock = new THREE.Clock();
    this.lastNetworkBroadcast = 0;

    this.initScene();
    this.buildDesaAdisha();
    this.createLocalPlayerAvatar();
    this.setupDesktopControls();
    this.setupMobileControls();
    this.setupNetworkMultiplayer();
    this.startRenderLoop();
  }

  initScene() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 520;

    this.scene = new THREE.Scene();
    // Warna langit Benua Adisha (siang tropis cerah dengan cakrawala luas)
    this.scene.background = new THREE.Color(0x7cc4e8);
    this.scene.fog = new THREE.FogExp2(0x7cc4e8, 0.0065);

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.2, 280);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Pencahayaan Luar Ruangan Desa Tropis
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.2);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xdff0fc, 0x3d5a36, 0.9);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    sunLight.position.set(42, 68, 36);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 180;
    const shadowD = 62;
    sunLight.shadow.camera.left = -shadowD;
    sunLight.shadow.camera.right = shadowD;
    sunLight.shadow.camera.top = shadowD;
    sunLight.shadow.camera.bottom = -shadowD;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // Lampu temaram aksen bengkel tempa
    const forgeFireLight = new THREE.PointLight(0xf97316, 2.8, 16);
    forgeFireLight.position.set(-8.5, 1.8, 1.5);
    this.scene.add(forgeFireLight);
    this.forgeLight = forgeFireLight;

    // Lampu pendar kristal danau
    const pondBeaconLight = new THREE.PointLight(0x38bdf8, 2.5, 18);
    pondBeaconLight.position.set(22.5, 2.0, 22.5);
    this.scene.add(pondBeaconLight);

    this.boundResize = this.onResize.bind(this);
    window.addEventListener('resize', this.boundResize);
  }

  /**
   * Membangun lanskap luas Benua Adisha (Radius ~78m, 7 Zona Terhubung):
   * 1. Pusat Alun-alun Desa Adisha (Balai Desa, Bengkel Bagas, Warung Bu Yati)
   * 2. Hutan Pinus & Rimba Dha Mhai (Barat Laut)
   * 3. Bukit Tambang Andesit & Kawah Kristal (Timur Laut)
   * 4. Danau Kolam Bintang & Dermaga Lauh Than (Tenggara)
   * 5. Distrik Neon Kota Pratama & Cyber Cafe (Barat Daya)
   * 6. Puncak Salju & Altar Es Khul'Khas (Utara)
   * 7. Gerbang Akademi & Obelisk Kampus Draken (Selatan)
   */
  buildDesaAdisha() {
    this.worldGroup = new THREE.Group();

    // Samudra Luar Mengelilingi Pulau Adisha
    const oceanGeo = new THREE.CircleGeometry(180, 64);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.18,
      metalness: 0.35,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.y = -0.65;
    this.worldGroup.add(oceanMesh);

    // Pesisir Pasir Pantai Pulau Adisha
    const beachGeo = new THREE.CylinderGeometry(74, 78, 3.6, 64);
    const beachMat = new THREE.MeshStandardMaterial({
      color: 0xd6b87c,
      roughness: 0.9,
    });
    const beachMesh = new THREE.Mesh(beachGeo, beachMat);
    beachMesh.position.y = -1.85;
    beachMesh.receiveShadow = true;
    this.worldGroup.add(beachMesh);

    // 1. Daratan Utama Benua Adisha (radius ~70m)
    const islandGeo = new THREE.CylinderGeometry(68, 72, 4, 64);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x3e7b3e,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });
    const islandMesh = new THREE.Mesh(islandGeo, islandMat);
    islandMesh.position.y = -2;
    islandMesh.receiveShadow = true;
    this.worldGroup.add(islandMesh);

    const groundGeo = new THREE.CircleGeometry(67.8, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x478c45,
      roughness: 0.9,
      metalness: 0.02,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0.01;
    groundMesh.receiveShadow = true;
    this.groundMesh = groundMesh;
    this.worldGroup.add(groundMesh);

    // 2. Alun-alun Pusat Desa (Cobblestone Village Square)
    const plazaGeo = new THREE.CircleGeometry(13.5, 40);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x71717a,
      roughness: 0.75,
      metalness: 0.1,
    });
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.rotation.x = -Math.PI / 2;
    plazaMesh.position.set(0, 0.02, 0);
    plazaMesh.receiveShadow = true;
    this.worldGroup.add(plazaMesh);

    // Jaringan Jalan Raya & Setapak Penghubung 7 Zona
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x926c48, roughness: 0.95 });
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });

    const createRoad = (x, z, width, length, angleZ, mat = pathMat) => {
      const geo = new THREE.PlaneGeometry(width, length);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = angleZ;
      mesh.position.set(x, 0.025, z);
      mesh.receiveShadow = true;
      this.worldGroup.add(mesh);
    };

    // Jalan ke Hutan Pinus & Dha Mhai (Barat Laut)
    createRoad(-19, -15, 3.6, 36, Math.PI / 3.8, pathMat);
    // Jalan ke Bukit Tambang & Kawah (Timur Laut)
    createRoad(19, -15, 3.6, 36, -Math.PI / 3.8, pathMat);
    // Jalan ke Kolam Bintang & Dermaga (Tenggara)
    createRoad(14, 14, 3.6, 28, -Math.PI / 4, pathMat);
    // Jalan Aspal ke Distrik Kota Pratama (Barat Daya)
    createRoad(-15, 14, 4.0, 28, Math.PI / 4, asphaltMat);
    // Jalan Tanjakan ke Puncak Salju Khul'Khas (Utara)
    createRoad(0, -26, 3.6, 32, 0, pathMat);
    // Jalan Boulevard ke Gerbang Kampus Draken (Selatan)
    createRoad(0, 26, 4.0, 30, 0, asphaltMat);

    // 3. Monumen Bintang Adisha (Pusat Alun-alun)
    const monumentBaseGeo = new THREE.CylinderGeometry(1.8, 2.3, 0.65, 8);
    const monumentBaseMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6 });
    const monumentBase = new THREE.Mesh(monumentBaseGeo, monumentBaseMat);
    monumentBase.position.set(0, 0.32, 0);
    monumentBase.castShadow = true;
    monumentBase.receiveShadow = true;
    this.worldGroup.add(monumentBase);

    const crystalGeo = new THREE.OctahedronGeometry(0.85, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.92,
    });
    this.centralCrystal = new THREE.Mesh(crystalGeo, crystalMat);
    this.centralCrystal.position.set(0, 1.55, 0);
    this.centralCrystal.castShadow = true;
    this.worldGroup.add(this.centralCrystal);

    // 4. Balai Desa Adisha, Warung Bu Yati & NPC Pak Kades Tirto
    this.buildBalaiDesa();

    // 5. Bengkel Tempa Pandai Besi & NPC Bagas
    this.buildBlacksmithForge();

    // 6. Zona Hutan Pinus & Rimba Dha Mhai (North-West)
    this.buildPineForest();

    // 7. Zona Bukit Tambang & Kawah Kristal (North-East)
    this.buildMiningQuarry();

    // 8. Zona Danau Kolam Bintang & Dermaga Mang Ujang (South-East)
    this.buildStarlightPond();

    // 9. Zona Distrik Kota Pratama, Puncak Salju Khul'Khas & Kampus Draken
    this.buildExpandedRegions();

    // 10. Partikel Spora Bintang Seluruh Peta
    this.buildFencesAndParticles();

    this.scene.add(this.worldGroup);
  }

  registerInteractable(meshOrGroup, poiId) {
    meshOrGroup.userData.poiId = poiId;
    meshOrGroup.traverse((child) => {
      child.userData.poiId = poiId;
    });
    this.interactableMeshes.push(meshOrGroup);
  }

  buildBalaiDesa() {
    const balaiGroup = new THREE.Group();
    balaiGroup.position.set(0, 0, -7.5);

    const floorGeo = new THREE.BoxGeometry(7.5, 0.4, 5.0);
    const woodFloorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    const floor = new THREE.Mesh(floorGeo, woodFloorMat);
    floor.position.y = 0.2;
    floor.castShadow = true;
    floor.receiveShadow = true;
    balaiGroup.add(floor);

    const pillarGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.0, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const pillarPositions = [
      [-3.3, 1.7, -2.1],
      [3.3, 1.7, -2.1],
      [-3.3, 1.7, 2.1],
      [3.3, 1.7, 2.1],
    ];
    for (const pos of pillarPositions) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(...pos);
      pillar.castShadow = true;
      balaiGroup.add(pillar);
    }

    const roofGeo = new THREE.ConeGeometry(5.8, 2.0, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.65 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 4.0;
    roof.castShadow = true;
    balaiGroup.add(roof);

    const boardGeo = new THREE.BoxGeometry(2.6, 0.6, 0.1);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 2.5, 2.15);
    balaiGroup.add(board);

    this.registerInteractable(balaiGroup, 'kades_tirto');
    this.worldGroup.add(balaiGroup);

    // NPC: Pak Kades Tirto
    this.createNpcMesh('kades_tirto', 'Pak Kades Tirto [Klik]', 0x2563eb, new THREE.Vector3(0, 0, -4.5));

    // Warung Bu Yati di sisi Timur Alun-alun
    const warungGroup = new THREE.Group();
    warungGroup.position.set(9.2, 0, 1.5);
    const wBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 3.6), woodFloorMat);
    wBase.position.y = 0.15;
    warungGroup.add(wBase);
    const wRoof = new THREE.Mesh(
      new THREE.ConeGeometry(3.4, 1.4, 4),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
    );
    wRoof.rotation.y = Math.PI / 4;
    wRoof.position.y = 2.8;
    warungGroup.add(wRoof);
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.9, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 })
    );
    counter.position.set(-0.4, 0.6, 0.8);
    warungGroup.add(counter);
    this.registerInteractable(warungGroup, 'bu_yati');
    this.worldGroup.add(warungGroup);

    this.createNpcMesh('bu_yati', '🍲 Warung Bu Yati [Klik]', 0xec4899, new THREE.Vector3(8.5, 0, 1.5));
  }

  buildBlacksmithForge() {
    const forgeGroup = new THREE.Group();
    forgeGroup.position.set(-9.0, 0, 1.5);

    const baseGeo = new THREE.BoxGeometry(4.6, 0.3, 4.0);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.9 });
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.15;
    base.castShadow = true;
    forgeGroup.add(base);

    const furnaceGeo = new THREE.BoxGeometry(1.8, 2.4, 1.8);
    const furnace = new THREE.Mesh(furnaceGeo, stoneMat);
    furnace.position.set(-1.0, 1.35, -0.6);
    furnace.castShadow = true;
    forgeGroup.add(furnace);

    const fireGeo = new THREE.BoxGeometry(0.8, 0.55, 0.55);
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const fire = new THREE.Mesh(fireGeo, fireMat);
    fire.position.set(-1.0, 0.75, 0.25);
    forgeGroup.add(fire);

    const anvilGeo = new THREE.BoxGeometry(0.9, 0.75, 0.5);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.3 });
    const anvil = new THREE.Mesh(anvilGeo, metalMat);
    anvil.position.set(0.7, 0.55, 0.45);
    anvil.castShadow = true;
    forgeGroup.add(anvil);

    this.registerInteractable(forgeGroup, 'bagas');
    this.worldGroup.add(forgeGroup);

    // NPC: Pandai Besi Bagas
    this.createNpcMesh('bagas', '🔨 Pandai Besi Bagas [Klik]', 0xb45309, new THREE.Vector3(-8.5, 0, 1.5));
  }

  buildPineForest() {
    const forestGroup = new THREE.Group();

    // Hamparan tanah lumut Hutan Pinus & Dha Mhai
    const forestFloor = new THREE.Mesh(
      new THREE.CircleGeometry(21, 32),
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.95 })
    );
    forestFloor.rotation.x = -Math.PI / 2;
    forestFloor.position.set(-29, 0.018, -23);
    forestGroup.add(forestFloor);

    // 24 Pohon Pinus & Pohon Purba Dha Mhai
    const pineCoords = [
      [-24, -19], [-34, -28], [-20, -23], [-27, -15],
      [-31, -19], [-22, -29], [-36, -21], [-28, -33],
      [-18, -17], [-39, -26], [-33, -35], [-25, -26],
      [-41, -19], [-16, -25], [-30, -13], [-43, -31],
      [-21, -35], [-37, -15], [-45, -23], [-27, -39],
      [-15, -20], [-32, -24], [-38, -33], [-23, -14],
    ];

    for (let i = 0; i < pineCoords.length; i++) {
      const [x, z] = pineCoords[i];
      const isPrimaryChop = (i === 0);
      const isAncientChop = (i === 1);
      const isMystic = (i % 4 === 2);
      const tree = this.createPineTreeMesh(isPrimaryChop || isAncientChop, isMystic, isAncientChop ? '🌲 Damar Purba [Tebang]' : '🪓 Pohon Pinus [Tebang]');
      tree.position.set(x, 0, z);
      if (isPrimaryChop) this.registerInteractable(tree, 'pine_tree');
      if (isAncientChop) this.registerInteractable(tree, 'ancient_tree');
      forestGroup.add(tree);
    }

    // NPC: Kakek Danu Penjaga Rimba
    this.createNpcMesh('kakek_danu', '🌿 Kakek Danu [Klik]', 0x15803d, new THREE.Vector3(-29.0, 0, -23.0));

    // Kayu pinus tumbang dekoratif
    const logGeo = new THREE.CylinderGeometry(0.32, 0.36, 3.8, 8);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.85 });
    const log = new THREE.Mesh(logGeo, logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.4;
    log.position.set(-26.5, 0.3, -21.0);
    log.castShadow = true;
    forestGroup.add(log);

    this.worldGroup.add(forestGroup);
  }

  createPineTreeMesh(isGatheringNode = false, isMystic = false, labelText = '🌲 Pohon Pinus [Tebang]') {
    const tree = new THREE.Group();

    const trunkH = isGatheringNode ? 3.2 : 2.4;
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, trunkH, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    const leavesColor = isMystic ? 0x6d28d9 : (isGatheringNode ? 0x166534 : 0x15803d);
    const leavesMat = new THREE.MeshStandardMaterial({ color: leavesColor, roughness: 0.8 });

    const tiers = [
      { r: isGatheringNode ? 2.6 : 2.1, h: 2.4, y: trunkH + 0.6 },
      { r: isGatheringNode ? 2.0 : 1.6, h: 2.0, y: trunkH + 1.9 },
      { r: isGatheringNode ? 1.3 : 1.0, h: 1.6, y: trunkH + 3.0 },
    ];

    for (const t of tiers) {
      const coneGeo = new THREE.ConeGeometry(t.r, t.h, 7);
      const cone = new THREE.Mesh(coneGeo, leavesMat);
      cone.position.y = t.y;
      cone.castShadow = true;
      tree.add(cone);
    }

    if (isGatheringNode) {
      const beaconGeo = new THREE.RingGeometry(1.8, 2.2, 20);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.rotation.x = -Math.PI / 2;
      beacon.position.y = 0.05;
      tree.add(beacon);

      const tag = this.createFloatingBillboard(labelText, '#22c55e');
      tag.position.set(0, 6.2, 0);
      tree.add(tag);
    }

    return tree;
  }

  buildMiningQuarry() {
    const quarryGroup = new THREE.Group();

    // Lantai Batu Kawah Tambang
    const quarryFloor = new THREE.Mesh(
      new THREE.CircleGeometry(20, 32),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.95 })
    );
    quarryFloor.rotation.x = -Math.PI / 2;
    quarryFloor.position.set(29, 0.018, -24);
    quarryGroup.add(quarryFloor);

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.9, flatShading: true });
    const boulderCoords = [
      [22, -24, 3.2], [28, -17, 3.8], [32, -23, 2.9],
      [38, -26, 4.2], [26, -31, 3.4], [34, -35, 3.9],
      [41, -20, 3.5], [19, -15, 2.2], [39, -32, 4.5],
    ];

    for (const [x, z, scale] of boulderCoords) {
      const rockGeo = new THREE.DodecahedronGeometry(scale, 1);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, scale * 0.65, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      quarryGroup.add(rock);
    }

    // Helper pembuat node tambang kristal
    const createOreCluster = (posX, posZ, poiId, label, hexColor, hexEmissive, borderHex) => {
      const oreNode = new THREE.Group();
      oreNode.position.set(posX, 0, posZ);

      const oreRockGeo = new THREE.DodecahedronGeometry(1.8, 1);
      const oreRockMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.85, flatShading: true });
      const oreRock = new THREE.Mesh(oreRockGeo, oreRockMat);
      oreRock.position.y = 1.2;
      oreRock.castShadow = true;
      oreNode.add(oreRock);

      const crystalMat = new THREE.MeshStandardMaterial({
        color: hexColor,
        emissive: hexEmissive,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.6,
      });
      for (let c = 0; c < 6; c++) {
        const cg = new THREE.ConeGeometry(0.32, 1.05, 5);
        const cm = new THREE.Mesh(cg, crystalMat);
        cm.position.set((Math.random() - 0.5) * 1.8, 1.5 + Math.random() * 0.7, (Math.random() - 0.5) * 1.8);
        cm.rotation.set(Math.random() * 0.6, Math.random() * 3, Math.random() * 0.6);
        oreNode.add(cm);
      }

      const ringGeo = new THREE.RingGeometry(1.9, 2.3, 20);
      const ringMat = new THREE.MeshBasicMaterial({ color: hexColor, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      oreNode.add(ring);

      const tag = this.createFloatingBillboard(label, borderHex);
      tag.position.set(0, 3.6, 0);
      oreNode.add(tag);

      this.registerInteractable(oreNode, poiId);
      quarryGroup.add(oreNode);
    };

    createOreCluster(24.0, -19.0, 'ore_rock', '⛏️ Tambang Bijih [Klik]', 0x06b6d4, 0x0891b2, '#06b6d4');
    createOreCluster(35.0, -29.0, 'crystal_vein', '💎 Kawah Kristal [Klik]', 0xf59e0b, 0xd97706, '#f59e0b');

    this.worldGroup.add(quarryGroup);
  }

  buildStarlightPond() {
    const pondGroup = new THREE.Group();
    pondGroup.position.set(24.0, 0, 24.0);

    // Danau Kolam Bintang diperluas (Radius 12m)
    const waterGeo = new THREE.CircleGeometry(11.5, 40);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.08,
      metalness: 0.4,
      transparent: true,
      opacity: 0.85,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = 0.04;
    pondGroup.add(this.waterMesh);

    const rimGeo = new THREE.RingGeometry(11.2, 12.6, 40);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd6b87c, roughness: 0.9 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.05;
    pondGroup.add(rim);

    // Dermaga Kayu Memanjang ke Kolam
    const pierGeo = new THREE.BoxGeometry(2.4, 0.3, 8.2);
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const pier = new THREE.Mesh(pierGeo, pierMat);
    pier.position.set(-2.5, 0.25, -2.5);
    pier.rotation.y = -Math.PI / 4;
    pier.castShadow = true;
    pondGroup.add(pier);

    const beaconGeo = new THREE.RingGeometry(1.8, 2.2, 20);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.rotation.x = -Math.PI / 2;
    beacon.position.set(-1.5, 0.42, -1.5);
    pondGroup.add(beacon);

    const tag = this.createFloatingBillboard('🎣 Dermaga Bintang [Mancing]', '#38bdf8');
    tag.position.set(-1.5, 2.8, -1.5);
    pondGroup.add(tag);

    this.registerInteractable(pondGroup, 'fishing_pier');
    this.worldGroup.add(pondGroup);

    // NPC: Mang Ujang di tepi dermaga
    this.createNpcMesh('mang_ujang', '⚓ Mang Ujang [Klik]', 0x0284c7, new THREE.Vector3(18.0, 0, 18.5));
  }

  buildExpandedRegions() {
    // 1. Distrik Neon Kota Pratama (Barat Daya: -26, 23)
    const pratamaGroup = new THREE.Group();
    pratamaGroup.position.set(-26, 0, 23);

    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(12, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    pratamaGroup.add(plaza);

    const cafeTower = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 5.2, 4.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.5 })
    );
    cafeTower.position.set(-2, 2.6, -2);
    cafeTower.castShadow = true;
    pratamaGroup.add(cafeTower);

    const neonSign = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.9, 0.2),
      new THREE.MeshBasicMaterial({ color: 0xf472b6 })
    );
    neonSign.position.set(-2, 4.2, 0.3);
    pratamaGroup.add(neonSign);

    this.registerInteractable(pratamaGroup, 'barista_chloe');
    this.worldGroup.add(pratamaGroup);
    this.createNpcMesh('barista_chloe', '☕ Cyber Cafe Pratama [Klik]', 0xf472b6, new THREE.Vector3(-25.0, 0, 22.0));

    // 2. Puncak Salju & Altar Es Khul'Khas (Utara: 0, -44)
    const snowGroup = new THREE.Group();
    snowGroup.position.set(0, 0, -44);

    const snowField = new THREE.Mesh(
      new THREE.CircleGeometry(14, 32),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.6 })
    );
    snowField.rotation.x = -Math.PI / 2;
    snowField.position.y = 0.025;
    snowGroup.add(snowField);

    const iceSpire = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 6.5, 6),
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
        roughness: 0.15,
        metalness: 0.3,
      })
    );
    iceSpire.position.set(0, 3.2, -3.5);
    iceSpire.castShadow = true;
    snowGroup.add(iceSpire);

    this.registerInteractable(snowGroup, 'syeikh_malik');
    this.worldGroup.add(snowGroup);
    this.createNpcMesh('syeikh_malik', '❄️ Syeikh Malik [Klik]', 0x38bdf8, new THREE.Vector3(0, 0, -42.0));

    // 3. Gerbang Kampus & Obelisk Hextech Draken (Selatan: 0, 42)
    const drakenGroup = new THREE.Group();
    drakenGroup.position.set(0, 0, 42);

    const court = new THREE.Mesh(
      new THREE.CircleGeometry(13, 32),
      new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.65 })
    );
    court.rotation.x = -Math.PI / 2;
    court.position.y = 0.025;
    drakenGroup.add(court);

    const obelisk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 1.3, 6.8, 4),
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x6b21a8,
        emissiveIntensity: 0.6,
        roughness: 0.25,
      })
    );
    obelisk.position.set(0, 3.4, 3.2);
    obelisk.castShadow = true;
    drakenGroup.add(obelisk);

    this.registerInteractable(drakenGroup, 'draken_archivist');
    this.worldGroup.add(drakenGroup);
    this.createNpcMesh('draken_archivist', '🏛️ Profesor Draken [Klik]', 0xa855f7, new THREE.Vector3(0, 0, 40.0));
  }

  buildFencesAndParticles() {
    // Partikel Spora Bintang Seluruh Peta Adisha
    const particleCount = 260;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * 120;
      particlePos[i + 1] = Math.random() * 10 + 0.5;
      particlePos[i + 2] = (Math.random() - 0.5) * 120;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.18,
      transparent: true,
      opacity: 0.65,
    });
    this.starlightParticles = new THREE.Points(particleGeo, particleMat);
    this.worldGroup.add(this.starlightParticles);
  }

  createNpcMesh(id, name, color, position) {
    const npcGroup = new THREE.Group();
    npcGroup.position.copy(position);

    // Tubuh NPC Stylized
    const bodyGeo = new THREE.CapsuleGeometry(0.38, 0.75, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.72;
    body.castShadow = true;
    npcGroup.add(body);

    // Kepala
    const headGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.6 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.5;
    head.castShadow = true;
    npcGroup.add(head);

    // Cincin Aura NPC
    const auraGeo = new THREE.RingGeometry(0.65, 0.85, 20);
    const auraMat = new THREE.MeshBasicMaterial({ color: 0xfbcfe8, side: THREE.DoubleSide });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.04;
    npcGroup.add(aura);

    // Label Billboard
    const tag = this.createFloatingBillboard(name, '#f472b6');
    tag.position.set(0, 2.45, 0);
    npcGroup.add(tag);

    this.registerInteractable(npcGroup, id);
    this.worldGroup.add(npcGroup);
  }

  createFloatingBillboard(text, borderColor = '#38bdf8') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Rounded rectangle card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect(4, 4, 248, 56, 12);
    ctx.fill();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.roundRect(4, 4, 248, 56, 12);
    ctx.stroke();

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.6, 1);
    return sprite;
  }

  /**
   * Menampilkan Teks Melayang 3D (Floating RPG Text) yang naik dan memudar
   */
  spawnFloatingRpgText(text, color = '#34d399') {
    const sprite = this.createFloatingBillboard(text, color);
    sprite.position.copy(this.localPlayerPos).add(new THREE.Vector3(0, 2.2, 0));
    this.scene.add(sprite);

    this.floatingTexts.push({
      sprite,
      vy: 1.6,
      life: 1.8,
      age: 0,
    });
  }

  createLocalPlayerAvatar() {
    this.localPlayerGroup = new THREE.Group();
    this.localPlayerGroup.position.copy(this.localPlayerPos);

    // Proxy Avatar Instan (stylized anime character)
    this.proxyAvatar = new THREE.Group();

    // Badan / Rok Anime
    const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.55, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.35 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.65;
    body.castShadow = true;
    this.proxyAvatar.add(body);

    // Kepala
    const headGeo = new THREE.SphereGeometry(0.36, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.35;
    head.castShadow = true;
    this.proxyAvatar.add(head);

    // Rambut / Kuncir Ahoge
    const hairGeo = new THREE.ConeGeometry(0.12, 0.45, 8);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
    const ahoge = new THREE.Mesh(hairGeo, hairMat);
    ahoge.position.set(0, 1.82, 0.1);
    ahoge.rotation.x = 0.35;
    this.proxyAvatar.add(ahoge);

    // Tangan (Left & Right) untuk animasi ayun
    const armGeo = new THREE.CapsuleGeometry(0.09, 0.38, 4, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xffedd5 });

    this.leftArm = new THREE.Mesh(armGeo, armMat);
    this.leftArm.position.set(-0.42, 0.72, 0);
    this.proxyAvatar.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, armMat);
    this.rightArm.position.set(0.42, 0.72, 0);
    this.proxyAvatar.add(this.rightArm);

    // Kaki (Left & Right) untuk animasi langkah kaki
    const legGeo = new THREE.CapsuleGeometry(0.11, 0.42, 4, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });

    this.leftLeg = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.position.set(-0.16, 0.28, 0);
    this.proxyAvatar.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, legMat);
    this.rightLeg.position.set(0.16, 0.28, 0);
    this.proxyAvatar.add(this.rightLeg);

    // Aura Cincin Pemain Lokal
    const ringGeo = new THREE.RingGeometry(0.45, 0.58, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf472b6, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    this.localPlayerGroup.add(ring);

    // Nametag Lokal
    const tag = this.createFloatingBillboard(`⭐ ${this.options.user.username || 'Petualang'} [Lv. ${this.options.user.level || 1}]`, '#f472b6');
    tag.position.set(0, 2.3, 0);
    this.localPlayerGroup.add(tag);
    this.localNametag = tag;

    this.localPlayerGroup.add(this.proxyAvatar);
    this.scene.add(this.localPlayerGroup);

    // Pemuatan Asinkron 3D Model Asli Naura
    this.loadAuthentic3DNauraModel();
  }

  async loadAuthentic3DNauraModel() {
    try {
      const candidates = [
        this.options.modelPath,
        '/models/naura%20NEW.glb',
        '/models/naura.glb',
        '/assets/3d/naura%20NEW.glb',
        '/assets/3d/naura.glb',
      ];

      const loader = new GLTFLoader();
      let gltfResult = null;

      for (const url of candidates) {
        if (!url) continue;
        try {
          gltfResult = await new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
          });
          if (gltfResult && gltfResult.scene) break;
        } catch (_) {}
      }

      if (gltfResult && gltfResult.scene) {
        this.authenticModel = gltfResult.scene;
        this.authenticModel.scale.set(0.85, 0.85, 0.85);
        this.authenticModel.position.set(0, 0, 0);

        this.authenticModel.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
              node.material.side = THREE.DoubleSide;
            }
          }
        });

        // Sembunyikan proxy avatar dan pasang model 3D asli
        if (this.proxyAvatar) {
          this.proxyAvatar.visible = false;
        }
        this.localPlayerGroup.add(this.authenticModel);

        if (gltfResult.animations && gltfResult.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.authenticModel);
          this.authenticActions = new Map();
          for (const clip of gltfResult.animations) {
            const action = this.mixer.clipAction(clip);
            this.authenticActions.set(clip.name.toLowerCase(), action);
          }
          const idleAction = this.authenticActions.get('idle') || this.mixer.clipAction(gltfResult.animations[0]);
          this.currentAuthenticAction = idleAction;
          idleAction.play();
        }
      }
    } catch (err) {
      console.warn('[Activity3DWorld] Menggunakan Stylized Avatar Proxy (Fallback):', err);
    }
  }

  playAuthenticClip(name, loopOnce = true) {
    if (!this.mixer || !this.authenticActions) return;
    const clipKey = name.toLowerCase();
    const targetAction = this.authenticActions.get(clipKey);
    if (!targetAction || targetAction === this.currentAuthenticAction) return;

    const prevAction = this.currentAuthenticAction;
    if (loopOnce) {
      targetAction.setLoop(THREE.LoopOnce);
      targetAction.clampWhenFinished = true;
    } else {
      targetAction.setLoop(THREE.LoopRepeat);
    }

    targetAction.reset();
    if (prevAction) {
      targetAction.crossFadeFrom(prevAction, 0.25, true);
    }
    targetAction.play();
    this.currentAuthenticAction = targetAction;

    if (loopOnce) {
      const onFinished = (e) => {
        if (e.action === targetAction) {
          this.mixer.removeEventListener('finished', onFinished);
          const idleAction = this.authenticActions.get('idle');
          if (idleAction) {
            idleAction.reset();
            idleAction.crossFadeFrom(targetAction, 0.25, true);
            idleAction.play();
            this.currentAuthenticAction = idleAction;
          }
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    }
  }

  createRemotePlayerAvatar(id, username, level = 1, avatarUrl = null) {
    const group = new THREE.Group();

    // Tubuh Remote Player (Cyan Starlight Theme)
    const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.55, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.65;
    body.castShadow = true;
    group.add(body);

    const headGeo = new THREE.SphereGeometry(0.36, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    // Kaki untuk animasi langkah remote
    const legGeo = new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0369a1 });

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.16, 0.28, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.16, 0.28, 0);
    group.add(rightLeg);

    const ringGeo = new THREE.RingGeometry(0.42, 0.54, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);

    // Nametag Billboard Remote Player
    const tag = this.createFloatingBillboard(`🌐 ${username} [Lv. ${level}]`, '#38bdf8');
    tag.position.set(0, 2.3, 0);
    group.add(tag);

    this.scene.add(group);
    const playerObj = {
      group,
      targetPos: new THREE.Vector3(0, 0, 0),
      targetRot: 0,
      username,
      level,
      leftLeg,
      rightLeg,
      isMoving: false,
    };
    this.players.set(id, playerObj);
    return playerObj;
  }

  setupDesktopControls() {
    this.boundKeydown = (e) => {
      if (['KeyW', 'ArrowUp'].includes(e.code)) this.keys.forward = true;
      if (['KeyS', 'ArrowDown'].includes(e.code)) this.keys.backward = true;
      if (['KeyA', 'ArrowLeft'].includes(e.code)) this.keys.left = true;
      if (['KeyD', 'ArrowRight'].includes(e.code)) this.keys.right = true;
      if (['Space', 'KeyE'].includes(e.code)) {
        e.preventDefault();
        this.triggerContextInteraction();
      }
    };

    this.boundKeyup = (e) => {
      if (['KeyW', 'ArrowUp'].includes(e.code)) this.keys.forward = false;
      if (['KeyS', 'ArrowDown'].includes(e.code)) this.keys.backward = false;
      if (['KeyA', 'ArrowLeft'].includes(e.code)) this.keys.left = false;
      if (['KeyD', 'ArrowRight'].includes(e.code)) this.keys.right = false;
    };

    window.addEventListener('keydown', this.boundKeydown);
    window.addEventListener('keyup', this.boundKeyup);

    // Orbit kamera & Raycast Click-to-Interact / Click-to-Move
    let pointerDownScreen = { x: 0, y: 0, time: 0 };
    this.boundMousedown = (e) => {
      this.isDraggingCamera = true;
      this.prevMousePos = { x: e.clientX, y: e.clientY };
      pointerDownScreen = { x: e.clientX, y: e.clientY, time: performance.now() };
    };
    this.container.addEventListener('mousedown', this.boundMousedown);

    this.boundMousemove = (e) => {
      if (!this.isDraggingCamera) return;
      const dx = e.clientX - this.prevMousePos.x;
      const dy = e.clientY - this.prevMousePos.y;
      this.cameraAngleH -= dx * 0.006;
      this.cameraAngleV = Math.max(0.2, Math.min(1.2, this.cameraAngleV + dy * 0.005));
      this.prevMousePos = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', this.boundMousemove);

    this.boundMouseup = (e) => {
      this.isDraggingCamera = false;
      const moveDist = Math.hypot(e.clientX - pointerDownScreen.x, e.clientY - pointerDownScreen.y);
      const elapsedMs = performance.now() - pointerDownScreen.time;
      if (moveDist < 6 && elapsedMs < 400 && e.target === this.renderer?.domElement) {
        this.handleCanvasTapOrClick(e.clientX, e.clientY);
      }
    };
    window.addEventListener('mouseup', this.boundMouseup);

    // Zoom mouse wheel (diperluas hingga 34m untuk melihat benua Adisha)
    this.boundWheel = (e) => {
      this.cameraDistance = Math.max(6.0, Math.min(34.0, this.cameraDistance + e.deltaY * 0.014));
    };
    this.container.addEventListener('wheel', this.boundWheel, { passive: true });
  }

  handleCanvasTapOrClick(clientX, clientY) {
    if (!this.renderer || !this.camera) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    // 1. Cek apakah pemain mengklik salah satu 3D POI / NPC
    if (this.interactableMeshes.length > 0) {
      const hits = this.raycaster.intersectObjects(this.interactableMeshes, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj && !obj.userData?.poiId) {
          obj = obj.parent;
        }
        const clickedPoiId = obj?.userData?.poiId;
        const poi = this.poiNodes.find((p) => p.id === clickedPoiId);
        if (poi) {
          const dist = this.localPlayerPos.distanceTo(poi.pos);
          if (dist <= poi.radius + 1.2) {
            this.activePoi = poi;
            this.triggerContextInteraction();
          } else {
            this.autoWalkTarget = poi.pos.clone();
            this.autoWalkPoi = poi;
            this.spawnFloatingRpgText(`🚶 Menuju ${poi.name}...`, '#38bdf8');
          }
          return;
        }
      }
    }

    // 2. Jika mengklik tanah lapang, berjalan otomatis ke titik tersebut
    if (this.groundMesh) {
      const groundHits = this.raycaster.intersectObject(this.groundMesh, false);
      if (groundHits.length > 0) {
        const pt = groundHits[0].point;
        this.autoWalkTarget = new THREE.Vector3(pt.x, 0, pt.z);
        this.autoWalkPoi = null;
      }
    }
  }

  teleportToZone(zoneKey) {
    const ZONE_COORDS = {
      desa: { x: 0, z: 0, label: 'Alun-Alun Desa Adisha' },
      hutan: { x: -24, z: -17, label: 'Hutan Pinus & Rimba Dha Mhai' },
      tambang: { x: 22, z: -17, label: 'Bukit Tambang & Kawah Kristal' },
      dermaga: { x: 18, z: 18, label: 'Dermaga Kolam Bintang' },
      pratama: { x: -21, z: 19, label: 'Distrik Neon Kota Pratama' },
      khulkhas: { x: 0, z: -37, label: 'Puncak Salju Khul\'Khas' },
      draken: { x: 0, z: 35, label: 'Gerbang Kampus Draken' },
    };
    const dest = ZONE_COORDS[zoneKey] || ZONE_COORDS.desa;
    this.autoWalkTarget = null;
    this.autoWalkPoi = null;
    this.localPlayerPos.set(dest.x, 0, dest.z);
    if (this.localPlayerGroup) {
      this.localPlayerGroup.position.copy(this.localPlayerPos);
    }
    this.checkPoiProximity();
    this.spawnFloatingRpgText(`⚡ Pindah ke ${dest.label}`, '#38bdf8');
  }

  setupMobileControls() {
    // 1. Virtual Joystick Analog (Touch in bottom-left)
    const joyBase = document.getElementById('activityJoystickBase');
    const joyStick = document.getElementById('activityJoystickStick');

    if (joyBase && joyStick) {
      let touchId = null;
      let startX = 0;
      let startY = 0;
      const maxRadius = 45;

      this.boundJoyBase = joyBase;
      this.boundTouchStart = (e) => {
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        const rect = joyBase.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
      };
      joyBase.addEventListener('touchstart', this.boundTouchStart, { passive: true });

      this.boundTouchMove = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === touchId) {
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            const dist = Math.hypot(dx, dy);
            const clampedDist = Math.min(maxRadius, dist);
            const angle = Math.atan2(dy, dx);

            const knobX = Math.cos(angle) * clampedDist;
            const knobY = Math.sin(angle) * clampedDist;

            joyStick.style.transform = `translate(${knobX}px, ${knobY}px)`;
            this.joystickVector = {
              x: knobX / maxRadius,
              y: knobY / maxRadius,
            };
            break;
          }
        }
      };

      this.boundTouchEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            touchId = null;
            joyStick.style.transform = 'translate(0px, 0px)';
            this.joystickVector = { x: 0, y: 0 };
            break;
          }
        }
      };

      window.addEventListener('touchmove', this.boundTouchMove, { passive: true });
      window.addEventListener('touchend', this.boundTouchEnd, { passive: true });
      window.addEventListener('touchcancel', this.boundTouchEnd, { passive: true });
    }

    // 2. Tombol Aksi Sentuh Dinamis (Touch button in bottom-right)
    const actionBtn = document.getElementById('activityTouchActionBtn');
    if (actionBtn) {
      this.boundActionBtn = actionBtn;
      this.boundActionClick = (e) => {
        e.preventDefault();
        this.triggerContextInteraction();
      };
      actionBtn.addEventListener('pointerdown', this.boundActionClick);
      actionBtn.addEventListener('click', this.boundActionClick);
    }
  }

  setupNetworkMultiplayer() {
    if (!this.options.socket) return;
    const socket = this.options.socket;

    socket.emit('activity:join', {
      channelId: this.options.channelId,
      user: this.options.user,
      position: { x: this.localPlayerPos.x, z: this.localPlayerPos.z, rotation: this.facingAngle },
    });

    socket.on('activity:room_players', (playersList) => {
      if (!Array.isArray(playersList)) return;
      playersList.forEach((data) => {
        if (!data || data.userId === this.options.user.id) return;
        let player = this.players.get(data.userId);
        if (!player) {
          player = this.createRemotePlayerAvatar(data.userId, data.username || 'Explorer', data.level || 1, data.avatar);
        }
        player.targetPos.set(data.x || 0, 0, data.z || 0);
        player.group.position.set(data.x || 0, 0, data.z || 0);
        player.targetRot = Number(data.rotation) || 0;
        player.isMoving = !!data.isMoving;
      });
      this.updateOnlineVoiceHud();
    });

    socket.on('activity:player_move', (data) => {
      if (data.userId === this.options.user.id) return;
      let player = this.players.get(data.userId);
      const isNew = !player;
      if (!player) {
        player = this.createRemotePlayerAvatar(data.userId, data.username || 'Explorer', data.level || 1, data.avatar);
      }
      player.targetPos.set(data.x, 0, data.z);
      player.targetRot = Number(data.rotation) || 0;
      player.isMoving = !!data.isMoving;
      if (isNew) this.updateOnlineVoiceHud();
    });

    socket.on('activity:player_action', (data) => {
      if (data.userId === this.options.user.id) return;
      const player = this.players.get(data.userId);
      if (player && data.resultText) {
        const textSprite = this.createFloatingBillboard(data.resultText, '#38bdf8');
        textSprite.position.copy(player.group.position).add(new THREE.Vector3(0, 2.2, 0));
        this.scene.add(textSprite);
        this.floatingTexts.push({ sprite: textSprite, vy: 1.4, life: 1.6, age: 0 });
      }
    });

    socket.on('activity:player_leave', (data) => {
      const player = this.players.get(data.userId);
      if (player) {
        this.scene.remove(player.group);
        this.players.delete(data.userId);
        this.updateOnlineVoiceHud();
      }
    });
  }

  updateOnlineVoiceHud() {
    const el = document.getElementById('hudVoiceCount');
    if (el) {
      const count = this.players.size + 1;
      el.textContent = `${count} Online`;
    }
  }

  triggerContextInteraction() {
    if (!this.activePoi) {
      this.playGatherAnimation('cheers');
      this.spawnFloatingRpgText('✨ Desa Adisha Damai', '#f472b6');
      return;
    }

    const poi = this.activePoi;

    if (poi.type === 'GATHER_CHOP') {
      this.playGatherAnimation('chop');
    } else if (poi.type === 'GATHER_MINE') {
      this.playGatherAnimation('mine');
    } else if (poi.type === 'GATHER_FISH') {
      this.playGatherAnimation('fish');
    } else {
      this.playGatherAnimation('talk');
    }

    if (this.options.onInteract) {
      this.options.onInteract({
        type: poi.type,
        nodeId: poi.id,
        targetName: poi.name,
      });
    }

    if (this.options.socket) {
      this.options.socket.emit('activity:action', {
        channelId: this.options.channelId,
        userId: this.options.user.id,
        username: this.options.user.username,
        actionType: poi.type,
        targetName: poi.name,
        resultText: `${this.options.user.username} aktif di ${poi.name}!`,
      });
    }
  }

  playGatherAnimation(actionType) {
    this.currentAction = actionType;
    this.actionTimer = 1.2;

    if (actionType === 'talk') {
      this.playAuthenticClip('wave');
    } else if (actionType === 'cheers') {
      this.playAuthenticClip('cheers');
    } else if (actionType === 'chop' || actionType === 'mine') {
      this.playAuthenticClip('thinking');
    }
  }

  updateMovement(delta, elapsed) {
    const baseSpeed = 7.4;
    this.moveVelocity.set(0, 0, 0);

    // Vektor gerak keyboard
    let inputX = 0;
    let inputZ = 0;
    if (this.keys.forward) inputZ -= 1;
    if (this.keys.backward) inputZ += 1;
    if (this.keys.left) inputX -= 1;
    if (this.keys.right) inputX += 1;

    // Gabungkan joystick mobile
    if (Math.hypot(this.joystickVector.x, this.joystickVector.y) > 0.15) {
      inputX = this.joystickVector.x;
      inputZ = this.joystickVector.y;
    }

    const manualInputLen = Math.hypot(inputX, inputZ);
    if (manualInputLen > 0.05) {
      this.autoWalkTarget = null;
      this.autoWalkPoi = null;
    }

    let autoMoveAngle = null;
    if (manualInputLen <= 0.05 && this.autoWalkTarget) {
      const dx = this.autoWalkTarget.x - this.localPlayerPos.x;
      const dz = this.autoWalkTarget.z - this.localPlayerPos.z;
      const dist = Math.hypot(dx, dz);
      const stopRadius = this.autoWalkPoi ? Math.max(1.8, this.autoWalkPoi.radius - 1.2) : 0.6;
      if (dist <= stopRadius) {
        const targetPoi = this.autoWalkPoi;
        this.autoWalkTarget = null;
        this.autoWalkPoi = null;
        if (targetPoi) {
          this.activePoi = targetPoi;
          this.triggerContextInteraction();
        }
      } else {
        autoMoveAngle = Math.atan2(dx, dz);
      }
    }

    this.isMoving = manualInputLen > 0.05 || autoMoveAngle !== null;

    if (this.isMoving) {
      // Rotasikan input relatif terhadap orientasi horizontal kamera (atau sudut auto-walk)
      const moveAngle = autoMoveAngle !== null
        ? autoMoveAngle
        : Math.atan2(inputX, inputZ) + this.cameraAngleH;
      this.moveVelocity.x = Math.sin(moveAngle) * baseSpeed * delta;
      this.moveVelocity.z = Math.cos(moveAngle) * baseSpeed * delta;

      this.localPlayerPos.add(this.moveVelocity);

      // Batasi pemain di area daratan pulau Adisha (radius max 65.5m)
      if (this.localPlayerPos.length() > 65.5) {
        this.localPlayerPos.setLength(65.5);
      }

      this.localPlayerGroup.position.copy(this.localPlayerPos);

      // Putar karakter menghadap arah jalan
      this.facingAngle = THREE.MathUtils.lerp(this.facingAngle, moveAngle, 0.2);
      this.localPlayerGroup.rotation.y = this.facingAngle;

      // Broadcast Socket.IO terbatasi (10 Hz)
      if (this.options.socket && (performance.now() - this.lastNetworkBroadcast > 100)) {
        this.lastNetworkBroadcast = performance.now();
        this.options.socket.emit('activity:move', {
          channelId: this.options.channelId,
          userId: this.options.user.id,
          username: this.options.user.username,
          x: this.localPlayerPos.x,
          z: this.localPlayerPos.z,
          rotation: this.facingAngle,
          isMoving: true,
          action: this.currentAction,
        });
      }
    } else {
      if (this.options.socket && (performance.now() - this.lastNetworkBroadcast > 600)) {
        this.lastNetworkBroadcast = performance.now();
        this.options.socket.emit('activity:move', {
          channelId: this.options.channelId,
          userId: this.options.user.id,
          username: this.options.user.username,
          x: this.localPlayerPos.x,
          z: this.localPlayerPos.z,
          rotation: this.facingAngle,
          isMoving: false,
          action: this.currentAction,
        });
      }
    }

    // Animasi Prosedural Kaki/Tangan
    if (this.actionTimer > 0) {
      this.actionTimer -= delta;
      if (this.actionTimer <= 0) this.currentAction = 'idle';

      // Aksi Gathering
      if (this.currentAction === 'chop' || this.currentAction === 'mine') {
        if (this.rightArm) {
          this.rightArm.rotation.x = Math.sin(elapsed * 18) * 1.2 - 0.5;
        }
      } else if (this.currentAction === 'fish') {
        if (this.rightArm) {
          this.rightArm.rotation.x = -1.1;
        }
      } else if (this.currentAction === 'talk') {
        if (this.rightArm) {
          this.rightArm.rotation.z = Math.sin(elapsed * 12) * 0.6 + 0.8;
        }
      }
    } else if (this.isMoving) {
      // Animasi Langkah Kaki Berjalan
      const strideFreq = 11.0;
      const legSwing = Math.sin(elapsed * strideFreq) * 0.65;
      const armSwing = Math.sin(elapsed * strideFreq) * 0.5;

      if (this.leftLeg) this.leftLeg.rotation.x = legSwing;
      if (this.rightLeg) this.rightLeg.rotation.x = -legSwing;
      if (this.leftArm) this.leftArm.rotation.x = -armSwing;
      if (this.rightArm) this.rightArm.rotation.x = armSwing;

      if (this.proxyAvatar) {
        this.proxyAvatar.position.y = Math.abs(Math.sin(elapsed * strideFreq * 2)) * 0.08;
      }
      if (this.authenticModel) {
        this.authenticModel.position.y = Math.abs(Math.sin(elapsed * strideFreq * 2)) * 0.08;
        this.authenticModel.rotation.z = Math.sin(elapsed * strideFreq) * 0.03;
      }
    } else {
      // Idle Breathing
      const breath = Math.sin(elapsed * 2.2) * 0.03;
      if (this.proxyAvatar) this.proxyAvatar.position.y = breath;
      if (this.authenticModel) {
        this.authenticModel.position.y = breath;
        this.authenticModel.rotation.z = 0;
      }
      if (this.leftLeg) this.leftLeg.rotation.x = 0;
      if (this.rightLeg) this.rightLeg.rotation.x = 0;
      if (this.leftArm) this.leftArm.rotation.x = 0;
      if (this.rightArm) this.rightArm.rotation.x = 0;
    }

    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Interpolasi posisi pemain lain
    this.players.forEach((p) => {
      p.group.position.lerp(p.targetPos, 0.18);
      p.group.rotation.y = THREE.MathUtils.lerp(p.group.rotation.y, p.targetRot, 0.2);
      if (p.isMoving) {
        const rSwing = Math.sin(elapsed * 10) * 0.5;
        if (p.leftLeg) p.leftLeg.rotation.x = rSwing;
        if (p.rightLeg) p.rightLeg.rotation.x = -rSwing;
      } else {
        if (p.leftLeg) p.leftLeg.rotation.x = 0;
        if (p.rightLeg) p.rightLeg.rotation.x = 0;
      }
    });

    // Periksa Proksimitas POI terdekat
    this.checkPoiProximity();
  }

  checkPoiProximity() {
    let nearestPoi = null;
    let minDistance = Infinity;

    for (const poi of this.poiNodes) {
      const dist = this.localPlayerPos.distanceTo(poi.pos);
      if (dist <= poi.radius && dist < minDistance) {
        minDistance = dist;
        nearestPoi = poi;
      }
    }

    if (this.activePoi !== nearestPoi) {
      this.activePoi = nearestPoi;
      if (this.options.onProximityChange) {
        this.options.onProximityChange(nearestPoi);
      }
      this.updateTouchActionButtonUi(nearestPoi);
    }
  }

  updateTouchActionButtonUi(poi) {
    const btn = document.getElementById('activityTouchActionBtn');
    const label = document.getElementById('activityTouchActionLabel');
    const icon = document.getElementById('activityTouchActionIcon');
    if (!btn || !label || !icon) return;

    if (poi) {
      btn.classList.add('active-proximity');
      icon.innerHTML = `<span style="font-size:20px;">${poi.icon}</span>`;
      label.textContent = poi.actionLabel || 'Aksi';
    } else {
      btn.classList.remove('active-proximity');
      icon.innerHTML = '<i class="fa-solid fa-sparkles"></i>';
      label.textContent = 'Aksi Spasial';
    }
  }

  updateCameraPosition() {
    const cx = this.localPlayerPos.x + Math.sin(this.cameraAngleH) * Math.cos(this.cameraAngleV) * this.cameraDistance;
    const cy = this.localPlayerPos.y + Math.sin(this.cameraAngleV) * this.cameraDistance;
    const cz = this.localPlayerPos.z + Math.cos(this.cameraAngleH) * Math.cos(this.cameraAngleV) * this.cameraDistance;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, cx, 0.1);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, cy, 0.1);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, cz, 0.1);

    this.camera.lookAt(this.localPlayerPos.x, this.localPlayerPos.y + 1.1, this.localPlayerPos.z);
  }

  updateFloatingTexts(delta) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const item = this.floatingTexts[i];
      item.age += delta;
      item.sprite.position.y += item.vy * delta;
      const progress = item.age / item.life;
      item.sprite.material.opacity = Math.max(0, 1.0 - progress);

      if (item.age >= item.life) {
        this.scene.remove(item.sprite);
        if (item.sprite.material.map) item.sprite.material.map.dispose();
        item.sprite.material.dispose();
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  startRenderLoop() {
    this.isRunning = true;
    const animate = () => {
      if (!this.isRunning) return;
      requestAnimationFrame(animate);

      const delta = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.getElapsedTime();

      this.updateMovement(delta, elapsed);
      this.updateCameraPosition();
      this.updateFloatingTexts(delta);

      // Animasi lembut elemen pemandangan
      if (this.centralCrystal) {
        this.centralCrystal.rotation.y += delta * 0.8;
      }
      if (this.starlightParticles) {
        this.starlightParticles.rotation.y += delta * 0.02;
      }
      if (this.forgeLight) {
        this.forgeLight.intensity = 2.4 + Math.sin(elapsed * 12) * 0.4;
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 520;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    this.isRunning = false;

    if (this.boundResize) {
      window.removeEventListener('resize', this.boundResize);
    }
    if (this.boundKeydown) {
      window.removeEventListener('keydown', this.boundKeydown);
    }
    if (this.boundKeyup) {
      window.removeEventListener('keyup', this.boundKeyup);
    }
    if (this.boundMousedown && this.container) {
      this.container.removeEventListener('mousedown', this.boundMousedown);
    }
    if (this.boundMousemove) {
      window.removeEventListener('mousemove', this.boundMousemove);
    }
    if (this.boundMouseup) {
      window.removeEventListener('mouseup', this.boundMouseup);
    }
    if (this.boundWheel && this.container) {
      this.container.removeEventListener('wheel', this.boundWheel);
    }
    if (this.boundTouchStart && this.boundJoyBase) {
      this.boundJoyBase.removeEventListener('touchstart', this.boundTouchStart);
    }
    if (this.boundTouchMove) {
      window.removeEventListener('touchmove', this.boundTouchMove);
    }
    if (this.boundTouchEnd) {
      window.removeEventListener('touchend', this.boundTouchEnd);
      window.removeEventListener('touchcancel', this.boundTouchEnd);
    }
    if (this.boundActionClick && this.boundActionBtn) {
      this.boundActionBtn.removeEventListener('pointerdown', this.boundActionClick);
      this.boundActionBtn.removeEventListener('click', this.boundActionClick);
    }

    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.floatingTexts.forEach((item) => {
      this.scene.remove(item.sprite);
    });
  }
}

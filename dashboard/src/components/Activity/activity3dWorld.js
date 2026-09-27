import * as THREE from 'three';

/**
 * Activity3DWorld - Interactive 3D Multi-Player Virtual Sanctuary for Discord Activity
 * Memungkinkan anggota server menjelajahi pulau virtual Cyber-Wilds, berinteraksi
 * dengan sesama pemain di Voice Channel secara real-time, dan bermain mini-game spasial.
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
      user: options.user || { id: 'guest', username: 'Explorer' },
      socket: options.socket || null,
      channelId: options.channelId || 'global_sanctuary',
      onInteract: options.onInteract || null,
      ...options,
    };

    this.players = new Map(); // other players id -> { mesh, nameTag, targetPos }
    this.localPlayerPos = new THREE.Vector3(0, 0, 0);
    this.moveVelocity = new THREE.Vector3();
    this.keys = { forward: false, backward: false, left: false, right: false };
    this.isRunning = false;
    this.clock = new THREE.Clock();

    this.initScene();
    this.buildWorldEnvironment();
    this.createLocalAvatar();
    this.setupControls();
    this.setupNetworkSync();
    this.startLoop();
  }

  initScene() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913);
    this.scene.fog = new THREE.FogExp2(0x060913, 0.035);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.camera.position.set(0, 7, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Pencahayaan Cyberpunk-Aether
    const ambientLight = new THREE.AmbientLight(0x4b5563, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xf472b6, 1.8);
    dirLight.position.set(5, 12, 6);
    this.scene.add(dirLight);

    const cyanLight = new THREE.PointLight(0x22d3ee, 2.5, 20);
    cyanLight.position.set(-4, 3, -2);
    this.scene.add(cyanLight);

    window.addEventListener('resize', this.onResize.bind(this));
  }

  buildWorldEnvironment() {
    // 1. Floating Hexagonal Sanctuary Island
    const islandGeo = new THREE.CylinderGeometry(8, 7.2, 1.2, 6);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.6,
      metalness: 0.3,
      flatShading: true,
    });
    this.islandMesh = new THREE.Mesh(islandGeo, islandMat);
    this.islandMesh.position.y = -0.6;
    this.scene.add(this.islandMesh);

    // Neon Border Grid
    const ringGeo = new THREE.RingGeometry(7.8, 8.1, 6);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    this.scene.add(ringMesh);

    // 2. Starlight Pond (Fishing Spot)
    const pondGeo = new THREE.CircleGeometry(2.2, 32);
    const pondMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85,
    });
    this.pondMesh = new THREE.Mesh(pondGeo, pondMat);
    this.pondMesh.rotation.x = -Math.PI / 2;
    this.pondMesh.position.set(3.5, 0.03, -2.5);
    this.scene.add(this.pondMesh);

    // Fishing spot marker beacon
    const beaconGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(3.5, 1.25, -2.5);
    this.scene.add(beacon);

    // 3. Cyber Jukebox (Center Stage)
    const jukeboxGeo = new THREE.BoxGeometry(1.2, 1.8, 1.2);
    const jukeboxMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      emissive: 0xf472b6,
      emissiveIntensity: 0.4,
      roughness: 0.4,
    });
    this.jukebox = new THREE.Mesh(jukeboxGeo, jukeboxMat);
    this.jukebox.position.set(-3.5, 0.9, -1.5);
    this.scene.add(this.jukebox);

    // 4. Starlight Particles
    const starCount = 120;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 22;
      starPos[i + 1] = Math.random() * 8;
      starPos[i + 2] = (Math.random() - 0.5) * 22;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xfbcfe8, size: 0.12, transparent: true, opacity: 0.7 });
    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);
  }

  createLocalAvatar() {
    this.localAvatar = new THREE.Group();

    // Body Chibi Capsule
    const bodyGeo = new THREE.CapsuleGeometry(0.35, 0.6, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.3, metalness: 0.1 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.65;
    this.localAvatar.add(bodyMesh);

    // Head
    const headGeo = new THREE.SphereGeometry(0.38, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.5 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.35;
    this.localAvatar.add(headMesh);

    // Hair / Ahoge
    const hairGeo = new THREE.ConeGeometry(0.12, 0.4, 8);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e });
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.set(0, 1.8, 0.1);
    hairMesh.rotation.x = 0.3;
    this.localAvatar.add(hairMesh);

    // Aura ring under player
    const auraGeo = new THREE.RingGeometry(0.45, 0.55, 16);
    const auraMat = new THREE.MeshBasicMaterial({ color: 0xf472b6, side: THREE.DoubleSide });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.04;
    this.localAvatar.add(aura);

    this.scene.add(this.localAvatar);
  }

  createRemotePlayer(playerId, username) {
    const group = new THREE.Group();

    const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.55, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.6;
    group.add(bodyMesh);

    const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffedd5 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.25;
    group.add(headMesh);

    const auraGeo = new THREE.RingGeometry(0.4, 0.5, 16);
    const auraMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.04;
    group.add(aura);

    this.scene.add(group);
    this.players.set(playerId, { group, targetPos: new THREE.Vector3(0, 0, 0), username });
    return group;
  }

  setupControls() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
      if (e.code === 'KeyE' || e.code === 'Space') this.triggerSpatialInteraction();
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
    });
  }

  setupNetworkSync() {
    if (!this.options.socket) return;
    const socket = this.options.socket;

    socket.emit('activity:join', {
      channelId: this.options.channelId,
      user: this.options.user,
      position: { x: this.localPlayerPos.x, z: this.localPlayerPos.z },
    });

    socket.on('activity:player_move', (data) => {
      if (data.userId === this.options.user.id) return;
      let player = this.players.get(data.userId);
      if (!player) {
        player = this.createRemotePlayer(data.userId, data.username || 'Explorer');
      }
      player.targetPos.set(data.x, 0, data.z);
    });

    socket.on('activity:player_leave', (data) => {
      const player = this.players.get(data.userId);
      if (player) {
        this.scene.remove(player.group);
        this.players.delete(data.userId);
      }
    });
  }

  triggerSpatialInteraction() {
    const distToPond = this.localPlayerPos.distanceTo(new THREE.Vector3(3.5, 0, -2.5));
    const distToJukebox = this.localPlayerPos.distanceTo(new THREE.Vector3(-3.5, 0, -1.5));

    if (distToPond < 2.5) {
      if (this.options.onInteract) {
        this.options.onInteract({ type: 'FISHING', location: 'Starlight Pond' });
      }
    } else if (distToJukebox < 2.5) {
      if (this.options.onInteract) {
        this.options.onInteract({ type: 'JUKEBOX', location: 'Cyber Jukebox' });
      }
    }
  }

  updateMovement(delta) {
    const speed = 4.5;
    this.moveVelocity.set(0, 0, 0);

    if (this.keys.forward) this.moveVelocity.z -= speed;
    if (this.keys.backward) this.moveVelocity.z += speed;
    if (this.keys.left) this.moveVelocity.x -= speed;
    if (this.keys.right) this.moveVelocity.x += speed;

    if (this.moveVelocity.lengthSq() > 0) {
      this.moveVelocity.normalize().multiplyScalar(speed * delta);
      this.localPlayerPos.add(this.moveVelocity);

      // Clamp ke batas pulau heksagonal (radius max ~7.2)
      if (this.localPlayerPos.length() > 7.2) {
        this.localPlayerPos.setLength(7.2);
      }

      this.localAvatar.position.copy(this.localPlayerPos);

      // Rotasi avatar mengikuti arah hadap
      const targetRotation = Math.atan2(this.moveVelocity.x, this.moveVelocity.z);
      this.localAvatar.rotation.y = targetRotation;

      // Broadcast pergerakan ke Socket.IO secara terbatasi
      if (this.options.socket && (!this.lastBroadcast || performance.now() - this.lastBroadcast > 100)) {
        this.lastBroadcast = performance.now();
        this.options.socket.emit('activity:move', {
          channelId: this.options.channelId,
          userId: this.options.user.id,
          username: this.options.user.username,
          x: this.localPlayerPos.x,
          z: this.localPlayerPos.z,
        });
      }
    }

    // Kamera mengikuti local avatar secara lembut
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.localPlayerPos.x, 0.08);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, this.localPlayerPos.z + 8.5, 0.08);
    this.camera.lookAt(this.localPlayerPos.x, 0.8, this.localPlayerPos.z);

    // Interpolasi posisi pemain lain
    this.players.forEach((p) => {
      p.group.position.lerp(p.targetPos, 0.15);
    });
  }

  startLoop() {
    this.isRunning = true;
    const animate = () => {
      if (!this.isRunning) return;
      requestAnimationFrame(animate);

      const delta = Math.min(this.clock.getDelta(), 0.1);
      this.updateMovement(delta);

      // Rotasi lembut partikel starlight
      if (this.stars) {
        this.stars.rotation.y += 0.001;
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 480;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    this.isRunning = false;
    window.removeEventListener('resize', this.onResize);
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

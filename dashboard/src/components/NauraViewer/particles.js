/**
 * particles.js - Sistem Partikel Cyber-Anime & Star Fragments Naura Hoshino.
 *
 * Menghasilkan:
 *   1. Ambient Cyber Sparks & Star Fragments (NSF) yang mengorbit di sekitar model.
 *   2. Tiga jenis bentuk partikel via kustom GLSL Shader:
 *      - Type 0: Soft Glowing Celestial Orb (Aura mist)
 *      - Type 1: 4-Pointed Star Fragment (Bintang Hoshino berpendar tajam)
 *      - Type 2: Cyber Sakura Petal (Kelopak bunga sakura bercahaya)
 *   3. Palet Warna Khas Brand: Sakura Pink (#FFB6C1), Starlight Gold (#FFD700),
 *      Celestial Purple (#C084FC), dan Cyber Cyan (#38BDF8).
 *   4. Interaktivitas Burst & Star Shower: Semburan bintang berputar saat klik atau jurus sihir.
 */

import * as THREE from "three";

/**
 * Buat sistem partikel cyber-anime dan star fragments.
 * @param {THREE.Scene} scene - Three.js scene tempat partikel ditambahkan
 * @returns {{ points: THREE.Points, update: (delta: number, elapsed: number) => void, burst: (count: number) => void, starShower: (count: number) => void, dispose: () => void }}
 */
export function createParticleSystem(scene) {
  const particleCount = 300;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const types = new Float32Array(particleCount); // 0 = Orb, 1 = Star, 2 = Sakura
  const rotations = new Float32Array(particleCount);

  // Data tambahan untuk animasi individual
  const animData = [];

  const COLOR_PINK = new THREE.Color("#FFB6C1");
  const COLOR_PURPLE = new THREE.Color("#C084FC");
  const COLOR_GOLD = new THREE.Color("#FFD700");
  const COLOR_CYAN = new THREE.Color("#38BDF8");

  const basePositions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const radius = 0.8 + Math.random() * 1.8;
    const y = (Math.random() - 0.4) * 3.0 + 0.8;

    positions[i * 3 + 0] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * radius;

    basePositions[i * 3 + 0] = positions[i * 3 + 0];
    basePositions[i * 3 + 1] = positions[i * 3 + 1];
    basePositions[i * 3 + 2] = positions[i * 3 + 2];

    // Distribusi tipe partikel: 45% Bintang, 35% Orb, 20% Sakura
    const randType = Math.random();
    let pType = 0.0;
    let mixedColor = COLOR_PINK.clone();

    if (randType < 0.45) {
      pType = 1.0; // 4-Point Star Fragment
      mixedColor =
        Math.random() < 0.65
          ? COLOR_GOLD.clone()
          : COLOR_PINK.clone().lerp(COLOR_CYAN, 0.4);
      sizes[i] = Math.random() * 0.08 + 0.04;
    } else if (randType < 0.8) {
      pType = 0.0; // Soft Glowing Orb
      mixedColor = COLOR_PINK.clone().lerp(COLOR_PURPLE, Math.random());
      sizes[i] = Math.random() * 0.04 + 0.02;
    } else {
      pType = 2.0; // Sakura Petal
      mixedColor = COLOR_PINK.clone().lerp(COLOR_PURPLE, 0.3);
      sizes[i] = Math.random() * 0.06 + 0.035;
    }

    types[i] = pType;
    colors[i * 3 + 0] = mixedColor.r;
    colors[i * 3 + 1] = mixedColor.g;
    colors[i * 3 + 2] = mixedColor.b;
    rotations[i] = Math.random() * Math.PI * 2;

    animData.push({
      pType,
      phase: Math.random() * Math.PI * 2,
      speed: (Math.random() - 0.5) * 0.55 + 0.12,
      rY: (Math.random() - 0.5) * 0.25,
      rotSpeed: (Math.random() - 0.5) * 2.5,
      burstVelX: 0,
      burstVelY: 0,
      burstVelZ: 0,
      isBursting: false,
      burstDecay: 0,
    });
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("pType", new THREE.BufferAttribute(types, 1));
  geometry.setAttribute("rotation", new THREE.BufferAttribute(rotations, 1));

  // Kustom GLSL Shader untuk Render Bentuk Bintang 4-Sisi, Sakura, & Orb
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      attribute float pType;
      attribute float rotation;
      varying vec3 vColor;
      varying float vType;
      varying float vRotation;
      uniform float time;

      void main() {
        vColor = color;
        vType = pType;
        vRotation = rotation + time * 1.5;

        // Berdenyut dinamis
        float pulse = sin(time * 2.5 + position.y * 4.0) * 0.25 + 0.75;
        if (pType > 0.5) {
          pulse = sin(time * 4.0 + position.x * 6.0) * 0.35 + 0.85;
        }

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * pulse * (340.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vType;
      varying float vRotation;

      void main() {
        // Rotasikan koordinat pointSprite di sekitar pusat (0.5, 0.5)
        vec2 uv = gl_PointCoord - vec2(0.5);
        float s = sin(vRotation);
        float c = cos(vRotation);
        vec2 p = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

        float dist = length(p);
        float alpha = 0.0;

        if (vType > 1.5) {
          // Type 2: Cyber Sakura Petal (Bentuk elips kelopak melengkung)
          float petalDist = length(vec2(p.x * 1.6, p.y + abs(p.x) * 0.3));
          if (petalDist > 0.48) discard;
          alpha = (0.48 - petalDist) * 2.2;
        } else if (vType > 0.5) {
          // Type 1: 4-Pointed Star Fragment (Bintang Hoshino)
          // Cross-diamond distance calculation
          float starArmX = max(abs(p.x) * 2.8, abs(p.y) * 0.35);
          float starArmY = max(abs(p.y) * 2.8, abs(p.x) * 0.35);
          float starDist = min(starArmX, starArmY);
          float coreDist = dist * 1.4;
          float finalDist = min(starDist, coreDist);

          if (finalDist > 0.45) discard;
          alpha = (0.45 - finalDist) * 2.5;
        } else {
          // Type 0: Soft Glowing Orb
          if (dist > 0.5) discard;
          alpha = (0.5 - dist) * 2.0;
        }

        gl_FragColor = vec4(vColor, alpha * 0.9);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  /**
   * Update partikel setiap frame tick.
   */
  function update(delta, elapsed) {
    material.uniforms.time.value = elapsed;
    const pos = geometry.attributes.position.array;
    const rot = geometry.attributes.rotation.array;

    for (let i = 0; i < particleCount; i++) {
      const data = animData[i];

      // Update rotasi sudut partikel
      rot[i] += data.rotSpeed * delta;

      if (data.isBursting && data.burstDecay > 0) {
        pos[i * 3 + 0] += data.burstVelX * delta;
        pos[i * 3 + 1] += data.burstVelY * delta;
        pos[i * 3 + 2] += data.burstVelZ * delta;

        // Sedikit gravitasi/floating upward untuk starlight
        data.burstVelY += 0.4 * delta;

        data.burstDecay -= delta;
        if (data.burstDecay <= 0) {
          data.isBursting = false;
        }
      } else {
        // Orbit independen di sekitar pusat
        const x = pos[i * 3 + 0];
        const z = pos[i * 3 + 2];

        const cosA = Math.cos(data.speed * delta);
        const sinA = Math.sin(data.speed * delta);

        pos[i * 3 + 0] = x * cosA - z * sinA;
        pos[i * 3 + 2] = x * sinA + z * cosA;

        // Vertical drift lembut
        pos[i * 3 + 1] += Math.sin(elapsed + data.phase) * data.rY * delta;
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.rotation.needsUpdate = true;
  }

  /**
   * Trigger burst efek sparkle dan star fragments (saat klik avatar).
   */
  function burst(count = 35) {
    const numToBurst = Math.min(count, particleCount);
    const pos = geometry.attributes.position.array;
    const cols = geometry.attributes.color.array;
    const typs = geometry.attributes.pType.array;

    for (let i = 0; i < numToBurst; i++) {
      const idx = Math.floor(Math.random() * particleCount);
      const data = animData[idx];

      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.3) * Math.PI;
      const speed = 1.8 + Math.random() * 2.8;

      data.burstVelX = Math.cos(angle) * Math.cos(elevation) * speed;
      data.burstVelY = Math.sin(elevation) * speed * 1.3;
      data.burstVelZ = Math.sin(angle) * Math.cos(elevation) * speed;
      data.burstDecay = 0.5 + Math.random() * 0.4;
      data.isBursting = true;

      // Jadikan partikel burst berbentuk Bintang Emas atau Sakura Pink
      typs[idx] = Math.random() < 0.7 ? 1.0 : 2.0;
      const pickColor = Math.random() < 0.65 ? COLOR_GOLD : COLOR_PINK;
      cols[idx * 3 + 0] = pickColor.r;
      cols[idx * 3 + 1] = pickColor.g;
      cols[idx * 3 + 2] = pickColor.b;

      // Spawn dekat dada/tangan model
      pos[idx * 3 + 0] = (Math.random() - 0.5) * 0.35;
      pos[idx * 3 + 1] = 0.6 + Math.random() * 0.7;
      pos[idx * 3 + 2] = (Math.random() - 0.5) * 0.35;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.pType.needsUpdate = true;
  }

  /**
   * Hujan Bintang Astral (Dipanggil saat jurus AstralCast atau pose kemenangan).
   */
  function starShower(count = 75) {
    burst(count);
  }

  /**
   * Bersihkan resource GPU.
   */
  function dispose() {
    geometry.dispose();
    material.dispose();
    scene.remove(points);
  }

  return { points, update, burst, starShower, dispose };
}

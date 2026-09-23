/**
 * brand3d.js - Modul Elemen 3D Khas Brand Naura Hoshino (Astral Halo & Holographic Pedestal).
 *
 * Mengelola:
 *   1. Astral Halo of Hoshino (Celestial Crown 3D):
 *      - Cincin ganda holografik melayang di atas/belakang kepala Naura.
 *      - 4 permata bintang bercahaya (Octahedron Diamond) berwarna Starlight Gold (#FFD700).
 *      - Rotasi berlawanan arah (counter-rotating) dan denyutan pernapasan halus.
 *   2. Holographic Cyber Pedestal (Rune Dais & Floor Projection):
 *      - Cincin data cyber konsentris di bagian bawah kaki (y: ~ -0.88).
 *      - Grid heksagonal berpendar di tengah dengan pendaran Additive Blending.
 *      - Berkas cahaya vertikal (Starlight Beams) yang memancar lembut ke atas.
 *   3. Reaktivitas Audio & Emosi:
 *      - Merespons denyut irama musik dan lonjakan sihir saat animasi khusus dimainkan.
 */

import * as THREE from "three";

/**
 * Membuat subsistem elemen 3D khas brand Naura Hoshino.
 * @param {THREE.Scene} scene - Scene Three.js aktif.
 * @param {Object} options - Opsi konfigurasi posisi dan visibilitas awal.
 * @returns {Object} Controller objek brand 3D.
 */
export function createNauraBrand3D(scene, options = {}) {
  const rootGroup = new THREE.Group();
  rootGroup.name = "NauraBrand3D_Root";
  scene.add(rootGroup);

  // Palet Warna Khas Brand Naura Hoshino (DESIGN.md)
  const COLOR_PINK = new THREE.Color("#FFB6C1");
  const COLOR_PURPLE = new THREE.Color("#C084FC");
  const COLOR_GOLD = new THREE.Color("#FFD700");
  const COLOR_CYAN = new THREE.Color("#38BDF8");

  // State reaktivitas
  let isVisible = options.visible ?? true;
  let pulseIntensity = 0.0;
  let audioEnergy = 0.0;
  const haloBaseY = options.haloY ?? 0.52;
  const pedestalBaseY = options.pedestalY ?? -0.88;

  // -------------------------------------------------------------
  // 1. ASTRAL HALO OF HOSHINO (Celestial Crown 3D)
  // -------------------------------------------------------------
  const haloGroup = new THREE.Group();
  haloGroup.name = "Naura_AstralHalo";
  haloGroup.position.set(0, haloBaseY, -0.05);
  // Sedikit miring ke belakang untuk estetika anime angelic/cyber halo
  haloGroup.rotation.x = Math.PI * 0.12;
  rootGroup.add(haloGroup);

  // Cincin Luar (Celestial Purple Ring)
  const outerTorusGeo = new THREE.TorusGeometry(0.24, 0.005, 16, 64);
  const outerTorusMat = new THREE.MeshBasicMaterial({
    color: COLOR_PURPLE,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const outerRingMesh = new THREE.Mesh(outerTorusGeo, outerTorusMat);
  haloGroup.add(outerRingMesh);

  // Cincin Dalam (Sakura Pink Segmented Ring)
  const innerTorusGeo = new THREE.TorusGeometry(0.18, 0.004, 16, 48);
  const innerTorusMat = new THREE.MeshBasicMaterial({
    color: COLOR_PINK,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerRingMesh = new THREE.Mesh(innerTorusGeo, innerTorusMat);
  haloGroup.add(innerRingMesh);

  // Cincin Berkas Elips Tipis (Cyber Accent Ring)
  const accentTorusGeo = new THREE.TorusGeometry(0.21, 0.002, 12, 48);
  const accentTorusMat = new THREE.MeshBasicMaterial({
    color: COLOR_CYAN,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const accentRingMesh = new THREE.Mesh(accentTorusGeo, accentTorusMat);
  accentRingMesh.rotation.y = Math.PI * 0.25;
  haloGroup.add(accentRingMesh);

  // 4 Orbiting 3D Star Nodes (Diamond / Octahedron Crystals)
  const starDiamonds = [];
  const starGeo = new THREE.OctahedronGeometry(0.022, 0);
  const starMatGold = new THREE.MeshBasicMaterial({
    color: COLOR_GOLD,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const starMatPink = new THREE.MeshBasicMaterial({
    color: COLOR_PINK,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (let i = 0; i < 4; i++) {
    const isGold = i % 2 === 0;
    const starMesh = new THREE.Mesh(
      starGeo,
      isGold ? starMatGold : starMatPink,
    );
    const starPivot = new THREE.Group();
    starPivot.rotation.z = (Math.PI / 2) * i;
    starMesh.position.x = 0.24; // Bertengger di cincin luar
    starPivot.add(starMesh);
    haloGroup.add(starPivot);
    starDiamonds.push({
      pivot: starPivot,
      mesh: starMesh,
      baseAngle: (Math.PI / 2) * i,
    });
  }

  // -------------------------------------------------------------
  // 2. HOLOGRAPHIC CYBER PEDESTAL (Floor Projection & Rune Dais)
  // -------------------------------------------------------------
  const pedestalGroup = new THREE.Group();
  pedestalGroup.name = "Naura_CyberPedestal";
  pedestalGroup.position.set(0, pedestalBaseY, 0);
  pedestalGroup.rotation.x = -Math.PI / 2; // Rebahkan mendatar di lantai
  rootGroup.add(pedestalGroup);

  // Cincin Luar Pedestal (Cyan/Pink Neon Rune Border)
  const outerPedestalGeo = new THREE.RingGeometry(0.48, 0.51, 64);
  const outerPedestalMat = new THREE.MeshBasicMaterial({
    color: COLOR_PINK,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const outerPedestalMesh = new THREE.Mesh(outerPedestalGeo, outerPedestalMat);
  pedestalGroup.add(outerPedestalMesh);

  // Cincin Tengah Pedestal (Celestial Purple Ring)
  const midPedestalGeo = new THREE.RingGeometry(0.34, 0.365, 48);
  const midPedestalMat = new THREE.MeshBasicMaterial({
    color: COLOR_PURPLE,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const midPedestalMesh = new THREE.Mesh(midPedestalGeo, midPedestalMat);
  pedestalGroup.add(midPedestalMesh);

  // Grid Heksagonal Tengah (Cyber Star Core)
  const hexCoreGeo = new THREE.CircleGeometry(0.22, 6);
  const hexCoreMat = new THREE.MeshBasicMaterial({
    color: COLOR_CYAN,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: true,
  });
  const hexCoreMesh = new THREE.Mesh(hexCoreGeo, hexCoreMat);
  pedestalGroup.add(hexCoreMesh);

  // Cincin Aksen Tipis Bertitik (Starlight Accent Ring)
  const starlightRingGeo = new THREE.RingGeometry(0.12, 0.13, 32);
  const starlightRingMat = new THREE.MeshBasicMaterial({
    color: COLOR_GOLD,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const starlightRingMesh = new THREE.Mesh(starlightRingGeo, starlightRingMat);
  pedestalGroup.add(starlightRingMesh);

  // Berkas Cahaya Vertikal Halus (Vertical Starlight Rays)
  const raysGroup = new THREE.Group();
  raysGroup.position.set(0, pedestalBaseY, 0);
  rootGroup.add(raysGroup);

  const rayCount = 8;
  const rayMeshes = [];
  const rayGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.5, 6);
  const rayMat = new THREE.MeshBasicMaterial({
    color: COLOR_PINK,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (let i = 0; i < rayCount; i++) {
    const angle = ((Math.PI * 2) / rayCount) * i;
    const r = 0.42;
    const rayMesh = new THREE.Mesh(rayGeo, rayMat);
    rayMesh.position.set(Math.cos(angle) * r, 0.25, Math.sin(angle) * r);
    raysGroup.add(rayMesh);
    rayMeshes.push({
      mesh: rayMesh,
      angle,
      baseHeight: 0.25,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // -------------------------------------------------------------
  // 3. UPDATE & ANIMASI LOOP
  // -------------------------------------------------------------
  function update(delta, elapsed, extOptions = {}) {
    if (!isVisible) {
      rootGroup.visible = false;
      return;
    }
    rootGroup.visible = true;

    // Decay lonjakan starlight pulse
    if (pulseIntensity > 0.001) {
      pulseIntensity = Math.max(0, pulseIntensity - delta * 1.8);
    }

    // Decay atau lerp audio energy
    const targetAudio = extOptions.audioEnergy ?? 0.0;
    audioEnergy += (targetAudio - audioEnergy) * Math.min(1.0, delta * 8.0);

    const combinedBoost = pulseIntensity + audioEnergy * 0.45;

    // A. Animasi Astral Halo:
    // Rotasi berlawanan arah cincin luar dan dalam
    outerRingMesh.rotation.z += delta * (0.45 + combinedBoost * 1.2);
    innerRingMesh.rotation.z -= delta * (0.65 + combinedBoost * 1.5);
    accentRingMesh.rotation.z += delta * (0.3 + combinedBoost * 0.8);
    accentRingMesh.rotation.x = Math.sin(elapsed * 1.2) * 0.2;

    // Breathing float pada Halo
    const haloBob = Math.sin(elapsed * 2.2) * 0.015;
    haloGroup.position.y = haloBaseY + haloBob + combinedBoost * 0.04;

    // Skala denyut dinamis pada Halo
    const haloScale =
      1.0 + Math.sin(elapsed * 2.5) * 0.03 + combinedBoost * 0.15;
    haloGroup.scale.set(haloScale, haloScale, haloScale);

    // Animasi 4 Star Diamonds (rotasi individual dan orbit)
    starDiamonds.forEach((sd, idx) => {
      sd.pivot.rotation.z = sd.baseAngle + outerRingMesh.rotation.z * 1.4;
      sd.mesh.rotation.x += delta * 2.2;
      sd.mesh.rotation.y += delta * 3.1;
      const starPulse =
        1.0 + Math.sin(elapsed * 3.5 + idx) * 0.15 + combinedBoost * 0.35;
      sd.mesh.scale.set(starPulse, starPulse, starPulse);
    });

    // B. Animasi Holographic Cyber Pedestal:
    // Cincin luar berputar searah jarum jam, cincin tengah berlawanan arah
    outerPedestalMesh.rotation.z -= delta * (0.2 + combinedBoost * 0.6);
    midPedestalMesh.rotation.z += delta * (0.35 + combinedBoost * 0.8);
    hexCoreMesh.rotation.z -= delta * (0.15 + combinedBoost * 0.4);
    starlightRingMesh.rotation.z += delta * (0.5 + combinedBoost * 1.0);

    // Denyut skala pedestal
    const pedestalScale =
      1.0 + Math.sin(elapsed * 1.8) * 0.025 + combinedBoost * 0.08;
    pedestalGroup.scale.set(pedestalScale, pedestalScale, 1.0);

    // C. Animasi Vertical Starlight Rays:
    rayMeshes.forEach((rm) => {
      const rayBob = Math.sin(elapsed * 2.8 + rm.phase) * 0.08;
      rm.mesh.position.y = rm.baseHeight + rayBob;
      const rayScaleY =
        1.0 + Math.sin(elapsed * 3.0 + rm.phase) * 0.3 + combinedBoost * 0.6;
      rm.mesh.scale.set(1.0, rayScaleY, 1.0);
    });

    // Opasitas dinamis merespons emosi / pulse
    const baseOpacity = 0.85 + combinedBoost * 0.15;
    outerTorusMat.opacity = Math.min(1.0, baseOpacity);
    innerTorusMat.opacity = Math.min(1.0, baseOpacity + 0.1);
    outerPedestalMat.opacity = Math.min(1.0, 0.75 + combinedBoost * 0.25);
  }

  // -------------------------------------------------------------
  // 4. METODE PUBLIK PENGENDALI
  // -------------------------------------------------------------
  return {
    rootGroup,
    haloGroup,
    pedestalGroup,

    /**
     * Memperbarui frame visual setiap tick animasi Three.js.
     */
    update,

    /**
     * Menampilkan atau menyembunyikan efek holografik brand.
     * @param {boolean} val - Status visibilitas.
     */
    setVisibility(val) {
      isVisible = Boolean(val);
      rootGroup.visible = isVisible;
    },

    /**
     * Mendapatkan status visibilitas saat ini.
     * @returns {boolean}
     */
    getVisibility() {
      return isVisible;
    },

    /**
     * Memicu lonjakan pendaran starlight (misal saat jurus/animasi astral dimainkan).
     * @param {number} [intensity=1.0] - Kekuatan pulse (0.0 s/d 1.5).
     */
    pulse(intensity = 1.0) {
      pulseIntensity = Math.min(1.5, Math.max(pulseIntensity, intensity));
    },

    /**
     * Mengatur energi reaktivitas audio secara dinamis (DJ mode).
     * @param {number} energy - Normalisasi amplitudo audio 0.0 s/d 1.0.
     */
    setAudioEnergy(energy) {
      audioEnergy = Math.max(0, Math.min(1.0, energy));
    },

    /**
     * Membersihkan seluruh geometri, material, dan mesh dari memori WebGL.
     */
    dispose() {
      if (rootGroup.parent) {
        rootGroup.parent.remove(rootGroup);
      }
      [
        outerTorusGeo,
        innerTorusGeo,
        accentTorusGeo,
        starGeo,
        outerPedestalGeo,
        midPedestalGeo,
        hexCoreGeo,
        starlightRingGeo,
        rayGeo,
      ].forEach((g) => g?.dispose?.());

      [
        outerTorusMat,
        innerTorusMat,
        accentTorusMat,
        starMatGold,
        starMatPink,
        outerPedestalMat,
        midPedestalMat,
        hexCoreMat,
        starlightRingMat,
        rayMat,
      ].forEach((m) => m?.dispose?.());
    },
  };
}

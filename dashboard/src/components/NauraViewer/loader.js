/**
 * loader.js - Abstraksi loader GLB dan VRM untuk NauraViewer & NauraHero3DViewer.
 *
 * Fitur:
 *   - .glb/.gltf via GLTFLoader (Three.js)
 *   - .vrm       via VRMLoaderPlugin (@pixiv/three-vrm)
 *   - Shared ArrayBuffer Cache: Mencegah unduhan ganda 21 MB antar-komponen di halaman yang sama.
 *   - Smart Multi-Level Fallback:
 *       1. /models/naura.vrm (VRM resmi)
 *       2. /models/naura.glb (GLB padat 30 FPS)
 *       3. /assets/3d/naura.glb (Asset path fallback)
 *       4. Raw GLTF parse bila VRM plugin parsing melempar exception.
 */
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

/** Cache Promise ArrayBuffer untuk mencegah download dobel */
const bufferCache = new Map();

/**
 * Deteksi format model berdasarkan path.
 * @param {string} path
 * @returns {'vrm' | 'glb'}
 */
function detectFormat(path) {
  return String(path).toLowerCase().endsWith(".vrm") ? "vrm" : "glb";
}

/**
 * Buat GLTFLoader dengan plugin VRM.
 * @param {boolean} [enableVrm=true]
 * @returns {GLTFLoader}
 */
function createLoader(enableVrm = true) {
  const loader = new GLTFLoader();

  if (enableVrm) {
    try {
      loader.register(
        (parser) =>
          new VRMLoaderPlugin(parser, {
            autoUpdateHumanBones: true,
          }),
      );
    } catch (e) {
      console.warn("[NauraViewer/loader] Gagal mendaftarkan VRMLoaderPlugin, fallback ke GLTF biasa:", e);
    }
  }

  return loader;
}

/**
 * Unduh berkas model sebagai ArrayBuffer dengan cache bersama dan pelacakan progres.
 * @param {string} url
 * @param {function(number): void} [onProgress]
 * @returns {Promise<ArrayBuffer>}
 */
async function fetchModelBuffer(url, onProgress) {
  if (bufferCache.has(url)) {
    if (typeof onProgress === "function") onProgress(100);
    return bufferCache.get(url);
  }

  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} saat mengambil ${url}`);
    }

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body || total === 0) {
      const buffer = await response.arrayBuffer();
      if (typeof onProgress === "function") onProgress(100);
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (typeof onProgress === "function" && total > 0) {
        onProgress(Math.min(99, Math.round((received / total) * 100)));
      }
    }

    const fullBuffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      fullBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    if (typeof onProgress === "function") onProgress(100);
    return fullBuffer.buffer;
  })();

  bufferCache.set(url, promise);
  return promise;
}

/**
 * Load model dari path yang diberikan dengan fallback berantai otomatis.
 * @param {string} modelPath - Path ke file .glb atau .vrm
 * @param {function(number): void} [onProgress] - Callback progress 0–100
 * @returns {Promise<{ scene: THREE.Group, vrm: import('@pixiv/three-vrm').VRM | null, animations: THREE.AnimationClip[], format: string }>}
 */
export async function loadModel(modelPath = "/models/naura.glb", onProgress = null) {
  // Susun daftar kandidat URL fallback
  const isVrm = String(modelPath).toLowerCase().endsWith(".vrm");
  const candidates = [
    modelPath,
    "/models/naura.glb",
    "/models/naura.vrm",
    "/models/naura_pbr.glb",
    isVrm ? modelPath.replace(/\.vrm$/i, ".glb") : modelPath.replace(/\.glb$/i, ".vrm"),
    "/assets/3d/naura.glb",
    "/assets/3d/Naura Hoshino 3D.glb"
  ];

  // Hapus duplikat
  const uniqueCandidates = Array.from(new Set(candidates));

  let lastError = null;

  for (const candidateUrl of uniqueCandidates) {
    try {
      console.info(`[NauraViewer/loader] Mencoba memuat model 3D: ${candidateUrl}`);
      const arrayBuffer = await fetchModelBuffer(candidateUrl, onProgress);

      // Coba parse dengan VRMLoaderPlugin terlebih dahulu
      let gltf = null;

      try {
        const loaderWithVrm = createLoader(true);
        gltf = await new Promise((resolve, reject) => {
          loaderWithVrm.parse(arrayBuffer, "", resolve, reject);
        });
      } catch (err) {
        console.warn(`[NauraViewer/loader] Gagal parse dengan ekstensi VRM di ${candidateUrl}, mencoba parse GLTF murni:`, err.message);
      }

      // Jika parsing VRM gagal, fallback ke GLTFLoader murni tanpa plugin VRM
      if (!gltf) {
        const rawLoader = createLoader(false);
        gltf = await new Promise((resolve, reject) => {
          rawLoader.parse(arrayBuffer, "", resolve, reject);
        });
      }

      if (gltf && gltf.scene) {
        let format = detectFormat(candidateUrl);
        const vrm = gltf.userData?.vrm || null;

        if (vrm) {
          format = "vrm";
          // Model naura.vrm sudah berorientasi +Z menghadap kamera (identik dengan naura.glb).
          // Hindari rotateVRM0 agar model tidak terputar 180 derajat membelakangi kamera.
          if (vrm.scene) {
            vrm.scene.rotation.y = 0;
          }
        }

        // Optimasi bayangan dan material
        gltf.scene.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = false;
            if (node.material) {
              node.material.depthWrite = true;
            }
          }
        });

        console.info(`✨ [NauraViewer/loader] Sukses memuat model 3D (${format.toUpperCase()}) dari ${candidateUrl}!`);
        return {
          scene: gltf.scene,
          vrm,
          animations: gltf.animations || [],
          format,
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`[NauraViewer/loader] Gagal memuat dari ${candidateUrl}:`, err.message);
    }
  }

  throw lastError || new Error(`Semua kandidat model 3D gagal dimuat (${modelPath})`);
}

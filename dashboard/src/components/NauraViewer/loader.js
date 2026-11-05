/**
 * loader.js - Abstraksi loader GLB dan VRM untuk NauraViewer & NauraHero3DViewer.
 *
 * Fitur:
 *   - .glb/.gltf via GLTFLoader (Three.js)
 *   - .vrm       via VRMLoaderPlugin (@pixiv/three-vrm)
 *   - Shared ArrayBuffer Cache: Mencegah unduhan ganda 21 MB antar-komponen di halaman yang sama.
 *   - Smart Multi-Level Fallback:
 *       1. modelPath yang diminta (mis. /models/naura%20NEW.vrm)
 *       2. /models/naura.glb (GLB padat 30 FPS)
 *       3. /models/naura%20NEW.vrm
 *       4. Raw GLTF parse bila VRM plugin parsing melempar exception.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

/** Cache Promise ArrayBuffer untuk mencegah download dobel */
const bufferCache = new Map();

/**
 * Ekstrak dan pasang tekstur PNG langsung via HTMLImageElement / TextureLoader
 * dari bufferView GLB bila ImageBitmapLoader gagal akibat pembatasan CSP fetch(blob:).
 * @param {ArrayBuffer} arrayBuffer
 * @param {THREE.Object3D} scene
 */
async function ensureGlbEmbeddedTextures(arrayBuffer, scene) {
  try {
    let hasMissingMap = false;
    scene.traverse((node) => {
      if ((node.isMesh || node.isSkinnedMesh) && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const m of mats) {
          if (m && !m.map) hasMissingMap = true;
        }
      }
    });
    if (!hasMissingMap) return;

    const view = new DataView(arrayBuffer);
    if (view.getUint32(0, true) !== 0x46546c67) return; // 'glTF'
    const jsonLen = view.getUint32(12, true);
    const jsonBytes = new Uint8Array(arrayBuffer, 20, jsonLen);
    const json = JSON.parse(new TextDecoder("utf-8").decode(jsonBytes));
    const binStart = 20 + jsonLen + 8;

    const loadTexFromImageIndex = (imgIdx, isColor = false) =>
      new Promise((resolve) => {
        const imgDef = json.images && json.images[imgIdx];
        if (!imgDef || imgDef.bufferView === undefined) return resolve(null);
        const bv = json.bufferViews && json.bufferViews[imgDef.bufferView];
        if (!bv) return resolve(null);
        const slice = new Uint8Array(arrayBuffer, binStart + (bv.byteOffset || 0), bv.byteLength);
        const blob = new Blob([slice], { type: imgDef.mimeType || "image/png" });
        const url = URL.createObjectURL(blob);
        const imgEl = new Image();
        imgEl.onload = () => {
          URL.revokeObjectURL(url);
          const tex = new THREE.Texture(imgEl);
          tex.flipY = false;
          tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.needsUpdate = true;
          resolve(tex);
        };
        imgEl.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        imgEl.src = url;
      });

    const baseTexDef = json.textures && json.textures[0];
    const normTexDef = json.textures && json.textures[1];
    const [baseMap, normalMap] = await Promise.all([
      baseTexDef ? loadTexFromImageIndex(baseTexDef.source ?? 0, true) : Promise.resolve(null),
      normTexDef ? loadTexFromImageIndex(normTexDef.source ?? 1, false) : Promise.resolve(null),
    ]);

    if (!baseMap) return;

    scene.traverse((node) => {
      if ((node.isMesh || node.isSkinnedMesh) && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          if (m && !m.map) {
            m.map = baseMap;
            if (normalMap && !m.normalMap) m.normalMap = normalMap;
            m.needsUpdate = true;
          }
        });
      }
    });
  } catch (err) {
    console.warn("[NauraViewer/loader] Fallback tekstur embedded gagal:", err);
  }
}

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
    const fetchUrl = url.includes("?") ? `${url}&v=2.3.5` : `${url}?v=2.3.5`;
    const response = await globalThis.fetch(fetchUrl);
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
  // Susun daftar kandidat URL fallback.
  // PENTING: nama file model di disk memuat SPASI ("naura NEW.vrm"), sehingga
  // URL harus ter-encode. Rantai fallback lama menunjuk ke "/assets/3d/..."
  // yang tidak pernah ada sebagai folder, sehingga saat model utama gagal
  // tidak ada jalur pemulihan sama sekali dan model hilang permanen.
  const isVrm = String(modelPath).toLowerCase().endsWith(".vrm");
  const candidates = [
    modelPath,
    "/models/naura_animated.glb",
    "/models/naura.glb",
    "/models/naura%20NEW.glb",
    "/models/naura%20NEW.vrm",
    isVrm ? modelPath.replace(/\.vrm$/i, ".glb") : modelPath.replace(/\.glb$/i, ".vrm"),
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

        // Pastikan tekstur terpasang meskipun browser/CSP sempat memblokir ImageBitmapLoader(blob:)
        await ensureGlbEmbeddedTextures(arrayBuffer, gltf.scene);

        // Optimasi bayangan dan material
        gltf.scene.traverse((node) => {
          if (node.isMesh || node.isSkinnedMesh) {
            node.castShadow = true;
            node.receiveShadow = false;
            const mats = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
            mats.forEach((mat) => {
              if (mat) {
                mat.depthWrite = true;
                if (mat.map && mat.map.colorSpace !== THREE.SRGBColorSpace) {
                  mat.map.colorSpace = THREE.SRGBColorSpace;
                  mat.map.needsUpdate = true;
                }
                mat.needsUpdate = true;
              }
            });
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

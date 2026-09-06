/**
 * loader.js - Abstraksi loader GLB dan VRM untuk NauraViewer.
 *
 * Mendukung dua format:
 *   - .glb/.gltf via GLTFLoader (Three.js)
 *   - .vrm       via VRMLoader (@pixiv/three-vrm)
 *
 * Swap format: cukup ubah `modelPath` di NauraViewer.init(),
 * tidak perlu menyentuh kode animasi atau reaktivitas.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

/**
 * Deteksi format model berdasarkan ekstensi file.
 * @param {string} path
 * @returns {'vrm' | 'glb'}
 */
function detectFormat(path) {
  return path.toLowerCase().endsWith(".vrm") ? "vrm" : "glb";
}

/**
 * Buat GLTFLoader yang sudah dikonfigurasi dengan:
 * - DRACOLoader untuk kompresi mesh (bila model pakai Draco)
 * - VRMLoaderPlugin untuk support VRM humanoid bone & morph target
 *
 * @returns {GLTFLoader}
 */
function createLoader() {
  const loader = new GLTFLoader();

  // Draco: beberapa model GLB pakai kompresi Draco
  const draco = new DRACOLoader();
  draco.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
  );
  loader.setDRACOLoader(draco);

  // Plugin VRM: aktifkan parsing skeleton humanoid & ekspresi
  loader.register(
    (parser) =>
      new VRMLoaderPlugin(parser, {
        autoUpdateHumanBones: true,
      }),
  );

  return loader;
}

/**
 * Load model dari path yang diberikan.
 * Mengembalikan objek { scene, vrm, animations, format }.
 *
 * @param {string} modelPath - Path ke file .glb atau .vrm
 * @param {function(number): void} [onProgress] - Callback progress 0–100
 * @returns {Promise<{ scene: THREE.Group, vrm: import('@pixiv/three-vrm').VRM | null, animations: THREE.AnimationClip[], format: string }>}
 */
export async function loadModel(modelPath, onProgress) {
  const loader = createLoader();
  let format = detectFormat(modelPath);

  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      loader.load(
        modelPath,
        resolve,
        (event) => {
          if (onProgress && event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
        reject
      );
    });
  } catch (err) {
    // Fallback otomatis bila ekstensi .vrm / .glb tidak ditemukan
    const altPath = modelPath.toLowerCase().endsWith(".vrm")
      ? modelPath.replace(/\.vrm$/i, ".glb")
      : modelPath.replace(/\.glb$/i, ".vrm");

    if (altPath !== modelPath) {
      console.warn(`[NauraViewer/loader] Gagal memuat ${modelPath}, mencoba alternatif: ${altPath}`);
      format = detectFormat(altPath);
      gltf = await new Promise((resolve, reject) => {
        loader.load(
          altPath,
          resolve,
          (event) => {
            if (onProgress && event.lengthComputable) {
              onProgress(Math.round((event.loaded / event.total) * 100));
            }
          },
          reject
        );
      });
    } else {
      throw err;
    }
  }

  let vrm = gltf.userData?.vrm || null;

  if (vrm) {
    format = "vrm";
    try {
      // Rotasi VRM: koordinat VRM 0.0 menghadap -Z, Three.js mengharap +Z
      VRMUtils.rotateVRM0(vrm);
    } catch (_) {}
  }

  // Optimasi: aktifkan shadow cast/receive pada semua mesh
  gltf.scene.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = false;
      // Cegah clipping aneh pada model karakter
      if (node.material) {
        node.material.depthWrite = true;
      }
    }
  });

  return {
    scene: gltf.scene,
    vrm,
    animations: gltf.animations || [],
    format,
  };
}

'use strict';

/**
 * naura3d.js, Handler & Interactive Controller untuk Model 3D Naura Hoshino
 *
 * Mengontrol model-viewer WebGL component dengan event listener, progress tracking,
 * double-click camera reset, dan fallback Three.js bila dibutuhkan.
 */

(function () {
    const VIEWER_ID = 'naura3d-viewer';
    const WRAPPER_ID = 'naura3d-canvas-wrapper';
    const MODEL_URL = '/assets/3d/Naura%20Hoshino%203D.glb';

    function init3DController() {
        const viewer = document.getElementById(VIEWER_ID);
        const wrapper = document.getElementById(WRAPPER_ID);
        if (!viewer || !wrapper) return;

        // Progress listener
        viewer.addEventListener('progress', (event) => {
            const progress = event.detail.totalProgress;
            const pct = Math.round(progress * 100);
            const span = viewer.querySelector('.naura3d-loading span');
            if (span && pct < 100) {
                span.textContent = `Memuat Model 3D... ${pct}%`;
            }
        });

        // Load success listener
        viewer.addEventListener('load', () => {
            console.log('✨ [Naura3D] Model 3D Naura Hoshino berhasil dimuat ke viewport WebGL!');
            wrapper.style.borderColor = 'rgba(255, 182, 193, 0.4)';
            wrapper.style.boxShadow = '0 0 25px rgba(255, 182, 193, 0.15), 0 10px 30px rgba(0, 0, 0, 0.6)';
        });

        // Error listener
        viewer.addEventListener('error', (err) => {
            console.warn('⚠️ [Naura3D] Gagal memuat model via model-viewer, mencoba fallback Three.js...', err);
            initThreeFallback(wrapper);
        });

        // Double click reset camera
        wrapper.addEventListener('dblclick', () => {
            if (viewer.cameraOrbit) {
                viewer.cameraOrbit = '0deg 75deg auto';
                viewer.resetTurntableRotation();
            }
        });
    }

    // Three.js Fallback Engine
    async function initThreeFallback(wrapper) {
        try {
            const THREE = await import('three');
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
            const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

            wrapper.innerHTML = '';
            const width = wrapper.clientWidth || 320;
            const height = wrapper.clientHeight || 250;

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
            camera.position.set(0, 1.2, 3.5);

            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            wrapper.appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffb6c1, 0.9);
            scene.add(ambientLight);
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
            dirLight.position.set(2, 4, 3);
            scene.add(dirLight);

            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.autoRotate = true;
            controls.autoRotateSpeed = 1.0;

            const loader = new GLTFLoader();
            loader.load(MODEL_URL, (gltf) => {
                const model = gltf.scene;
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2.6 / maxDim;

                model.scale.setScalar(scale);
                model.position.sub(center.multiplyScalar(scale));
                scene.add(model);

                function animate() {
                    requestAnimationFrame(animate);
                    controls.update();
                    renderer.render(scene, camera);
                }
                animate();
            });
        } catch (e) {
            console.error('❌ [Naura3D] Fallback Three.js gagal:', e);
            wrapper.innerHTML = `
                <div class="naura3d-error">
                    <img src="/assets/core/avatar.png" style="width: 50px; height: 50px; border-radius: 50%; margin-bottom: 8px;" />
                    <span>Model 3D Offline</span>
                </div>
            `;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init3DController);
    } else {
        init3DController();
    }
})();

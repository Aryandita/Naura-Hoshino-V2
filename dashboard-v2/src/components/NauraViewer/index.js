/**
 * index.js - Entry point komponen NauraViewer.
 * Menyatukan loader, animations, particles, dan UI DOM.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadModel } from './loader.js';
import { createAnimationController } from './animations.js';
import { createParticleSystem } from './particles.js';
import './viewer.css';

class NauraViewerClass {
    constructor() {
        this.initialized = false;
        this.isExpanded = true;
        this.currentMood = 'idle';
        this.contextHandler = null;
        this.modelPath = '';
    }

    /**
     * Inisialisasi widget NauraViewer ke dalam DOM.
     * @param {Object} options
     * @param {string} options.modelPath - Path ke .glb / .vrm
     * @param {string} options.context - Nama context (misal 'index', 'status')
     */
    async init(options) {
        if (this.initialized) return;
        this.modelPath = options.modelPath || '/models/naura.glb';
        
        this._createUI();
        this._initThree();
        
        this.initialized = true;

        try {
            await this._loadModelAsync();
            this._setupEvents();
            this.setContext(options.context || 'default');
            this.startLoop();
        } catch (err) {
            console.error('[NauraViewer] Failed to init:', err);
            this.ui.loadingText.textContent = 'ERROR LOADING';
            this.ui.spinner.style.borderColor = 'red';
        }
    }

    _createUI() {
        const container = document.createElement('div');
        container.id = 'naura-viewer-container';
        container.innerHTML = `
            <div class="nv-panel is-expanded" id="nv-panel">
                <div class="nv-loading" id="nv-loading">
                    <div class="nv-spinner" id="nv-spinner"></div>
                    <span id="nv-loading-text">LOADING SYSTEM...</span>
                </div>
                
                <div class="nv-canvas-wrapper">
                    <canvas id="naura-viewer-canvas"></canvas>
                </div>
                
                <div class="nv-overlay">
                    <div class="nv-header">
                        <h3 class="nv-title">
                            <span class="nv-status-dot"></span>
                            NAURA OS
                        </h3>
                        <button class="nv-btn" id="nv-btn-min" title="Minimize">
                            <i class="fa-solid fa-compress"></i>
                        </button>
                    </div>
                    <div class="nv-mood-badge" id="nv-mood-badge">IDLE</div>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        this.ui = {
            container,
            panel: container.querySelector('#nv-panel'),
            canvas: container.querySelector('#naura-viewer-canvas'),
            loading: container.querySelector('#nv-loading'),
            loadingText: container.querySelector('#nv-loading-text'),
            spinner: container.querySelector('#nv-spinner'),
            btnMin: container.querySelector('#nv-btn-min'),
            moodBadge: container.querySelector('#nv-mood-badge'),
        };

        this.ui.btnMin.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Klik panel saat minimized untuk expand
        this.ui.panel.addEventListener('click', () => {
            if (!this.isExpanded) this.toggle();
        });
        
        // Klik area canvas (bukan UI button) untuk interaksi wave
        this.ui.canvas.addEventListener('click', () => {
            if (this.isExpanded && this.animController) {
                this.animController.triggerWave();
            }
        });
    }

    _initThree() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.ui.canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        // Kita tidak nyalakan shadowMap penuh agar ringan, hanya basic lighting

        this.scene = new THREE.Scene();
        // Jangan beri background color, biarkan transparan (alpha: true)

        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        // Posisi default kamera menatap dada/wajah karakter
        this.camera.position.set(0, 1.2, 3.5);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enablePan = false;
        this.controls.enableZoom = true;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 6;
        this.controls.target.set(0, 1.0, 0); // Target dada/leher
        // Batasi orbit agar tidak bisa lihat dari bawah rok/lantai (UX & safety)
        this.controls.minPolarAngle = Math.PI / 4;
        this.controls.maxPolarAngle = Math.PI / 2;

        // Pencahayaan Cyber-anime
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        // Pink glow dari depan-kanan
        const dirLightPink = new THREE.DirectionalLight(0xFFB6C1, 1.5);
        dirLightPink.position.set(5, 5, 5);
        this.scene.add(dirLightPink);

        // Purple glow dari belakang-kiri (rim light)
        const dirLightPurple = new THREE.DirectionalLight(0xC084FC, 2.0);
        dirLightPurple.position.set(-5, 3, -5);
        this.scene.add(dirLightPurple);

        this.clock = new THREE.Clock();

        // Handle resize lokal
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    async _loadModelAsync() {
        const { scene, vrm, animations, format } = await loadModel(this.modelPath, (prog) => {
            if(this.ui.loadingText) this.ui.loadingText.textContent = `LOADING ${prog}%`;
        });

        // Sesuaikan ukuran & posisi jika diperlukan berdasarkan format
        if (format === 'glb') {
            // GLB mungkin tidak standard ukurannya. Asumsikan humanoid tinggi ~1.6m
            const box = new THREE.Box3().setFromObject(scene);
            const size = box.getSize(new THREE.Vector3());
            if (size.y > 3) {
                const scale = 1.6 / size.y;
                scene.scale.setScalar(scale);
            }
            // Turunkan sedikit agar berdiri di lantai imajiner Y=0
            scene.position.y = 0;
        }

        this.scene.add(scene);
        this.modelScene = scene;

        // Inisialisasi controller animasi
        this.animController = createAnimationController(scene, animations, vrm);
        
        // Inisialisasi particle system cyber-anime
        this.particleSystem = createParticleSystem(scene);
        this.scene.add(this.particleSystem.points);

        // Sembunyikan loading
        setTimeout(() => {
            this.ui.loading.classList.add('is-hidden');
            this.setMood('idle');
        }, 500);
    }

    _resize() {
        if (!this.ui) return;
        const rect = this.ui.panel.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    startLoop() {
        this.renderer.setAnimationLoop(() => {
            const delta = this.clock.getDelta();
            const elapsed = this.clock.getElapsedTime();

            if (this.controls) this.controls.update();
            
            if (this.animController) {
                this.animController.update(delta, elapsed);
            }
            
            if (this.particleSystem) {
                this.particleSystem.update(delta, elapsed);
            }

            this.renderer.render(this.scene, this.camera);
        });
    }

    toggle() {
        this.isExpanded = !this.isExpanded;
        if (this.isExpanded) {
            this.ui.panel.classList.remove('is-minimized');
            this.ui.panel.classList.add('is-expanded');
            
            // Adjust camera untuk mode besar
            this.camera.position.set(0, 1.2, 3.5);
            this.controls.target.set(0, 1.0, 0);
            
            if(this.particleSystem) this.particleSystem.points.visible = true;
        } else {
            this.ui.panel.classList.remove('is-expanded');
            this.ui.panel.classList.add('is-minimized');
            
            // Adjust camera fokus ke wajah untuk avatar kecil
            this.camera.position.set(0, 1.4, 1.5);
            this.controls.target.set(0, 1.4, 0);
            
            // Matikan partikel saat minimized agar tidak ribut
            if(this.particleSystem) this.particleSystem.points.visible = false;
        }
        
        // Beri waktu transisi CSS selesai baru resize Three.js
        setTimeout(() => this._resize(), 300);
    }

    setMood(mood) {
        if (this.currentMood === mood) return;
        this.currentMood = mood;
        
        if (this.animController) {
            this.animController.setMood(mood);
        }
        
        if (this.ui.moodBadge) {
            this.ui.moodBadge.textContent = mood.toUpperCase();
            this.ui.moodBadge.classList.add('is-visible');
            
            clearTimeout(this._moodTimeout);
            this._moodTimeout = setTimeout(() => {
                this.ui.moodBadge.classList.remove('is-visible');
            }, 3000);
        }
    }

    /**
     * Set konteks halaman untuk meload logic reaktivitas spesifik.
     */
    async setContext(contextName) {
        try {
            // Hapus handler lama
            if (this.contextHandler && this.contextHandler.cleanup) {
                this.contextHandler.cleanup();
            }
            
            // Dynamic import file konteks
            const contextModule = await import(`./contexts/${contextName}.context.js`);
            this.contextHandler = contextModule.default(this);
            
            if (this.contextHandler && this.contextHandler.init) {
                this.contextHandler.init();
            }
        } catch (err) {
            console.warn(`[NauraViewer] Context '${contextName}' not found or failed to load, falling back to default.`);
            if (contextName !== 'default') {
                this.setContext('default');
            }
        }
    }
}

export const NauraViewer = new NauraViewerClass();

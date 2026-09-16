/**
 * heroController.js - Pengendali Interaksi UI & DOM untuk NauraHero3DViewer.
 *
 * Menghubungkan antarmuka halaman web (tombol animasi, toggle model VRM/GLB,
 * efek Halo, reset kamera, dan snapshot foto) dengan mesin 3D NauraHero3DViewer.
 */

import { NauraHero3DViewer } from './hero3d.js';

/**
 * Inisialisasi controller interaktif pada canvas dan elemen UI pendukung.
 * @param {HTMLCanvasElement|null} [targetCanvas=null] - Elemen canvas target.
 * @param {Object} [customOptions={}] - Opsi kustom untuk NauraHero3DViewer.
 * @returns {NauraHero3DViewer|null} Instance viewer aktif.
 */
export function initHeroViewer(targetCanvas = null, customOptions = {}) {
    const canvasElement = targetCanvas || document.getElementById('naura-hero-3d-canvas');
    if (!canvasElement) {
        return null;
    }

    const wrapperElement = document.getElementById('naura3d-canvas-wrapper');
    const loadingBox = document.getElementById('naura3d-loading');
    const loadingText = document.getElementById('naura3d-loading-text');
    const errorBox = document.getElementById('naura3d-error');
    const statusText = document.getElementById('naura3d-status-text');
    const formatBadge = document.getElementById('naura3d-format-badge');
    const buttonModelGlb = document.getElementById('btn-model-glb');
    const buttonModelVrm = document.getElementById('btn-model-vrm');
    const buttonHalo = document.getElementById('naura3d-btn-halo');
    const buttonReset = document.getElementById('naura3d-btn-reset');
    const buttonSnapshot = document.getElementById('naura3d-btn-snapshot');
    const animationButtons = document.querySelectorAll('.naura3d-anim-btn');

    let currentActiveModel = '/models/naura.vrm';

    const viewerInstance = new NauraHero3DViewer(canvasElement, {
        modelPath: currentActiveModel,
        lookAtCursor: true,
        brandFxVisible: true,
        onProgress: (percent) => {
            if (!loadingText) return;
            loadingText.textContent = `Memuat Avatar 3D... ${Math.round(percent)}%`;
        },
        onLoad: () => {
            if (loadingBox) {
                loadingBox.style.opacity = '0';
                setTimeout(() => {
                    loadingBox.style.display = 'none';
                }, 300);
            }
            if (errorBox) {
                errorBox.style.display = 'none';
            }
            if (statusText) {
                statusText.textContent = '🌸 Idle';
            }
            if (formatBadge) {
                const isVrm = currentActiveModel.endsWith('.vrm');
                formatBadge.textContent = isVrm ? 'VRM' : 'GLB';
            }
            if (wrapperElement) {
                wrapperElement.style.borderColor = 'rgba(244, 114, 182, 0.35)';
            }
        },
        onError: (loadError) => {
            console.warn('[NauraHero3D] Gagal memuat avatar 3D:', loadError);
            if (loadingBox) {
                loadingBox.style.display = 'none';
            }
            if (errorBox) {
                errorBox.style.display = 'flex';
            }
        },
        ...customOptions,
    });

    viewerInstance.init();
    if (typeof window !== 'undefined') {
        window.__heroViewer = viewerInstance;
    }

    // --- 1. Binding Pergantian Model (GLB vs VRM) ---
    const updateModelButtonsState = (isVrmActive) => {
        if (buttonModelGlb) {
            buttonModelGlb.style.background = isVrmActive ? 'var(--bg-elevated)' : 'var(--primary-dim)';
            buttonModelGlb.style.color = isVrmActive ? 'var(--text-muted)' : 'var(--primary)';
            buttonModelGlb.style.borderColor = isVrmActive ? 'var(--border-subtle)' : 'var(--border-primary)';
        }
        if (buttonModelVrm) {
            buttonModelVrm.style.background = isVrmActive ? 'var(--primary-dim)' : 'var(--bg-elevated)';
            buttonModelVrm.style.color = isVrmActive ? 'var(--primary)' : 'var(--text-muted)';
            buttonModelVrm.style.borderColor = isVrmActive ? 'var(--border-primary)' : 'var(--border-subtle)';
        }
        if (formatBadge) {
            formatBadge.textContent = isVrmActive ? 'VRM' : 'GLB';
        }
    };

    const handleModelSwitch = async (modelPath) => {
        if (!modelPath || modelPath === currentActiveModel) return;

        currentActiveModel = modelPath;
        const isVrm = modelPath.endsWith('.vrm');
        updateModelButtonsState(isVrm);

        if (loadingBox) {
            loadingBox.style.display = 'flex';
            loadingBox.style.opacity = '1';
        }
        if (loadingText) {
            loadingText.textContent = `Memuat ${isVrm ? 'VRM Avatar' : 'GLB Model'}...`;
        }

        await viewerInstance.switchModel(modelPath);
    };

    if (buttonModelGlb) {
        buttonModelGlb.addEventListener('click', (event) => {
            event.stopPropagation();
            handleModelSwitch(buttonModelGlb.dataset.model || '/models/naura.glb');
        });
    }

    if (buttonModelVrm) {
        buttonModelVrm.addEventListener('click', (event) => {
            event.stopPropagation();
            handleModelSwitch(buttonModelVrm.dataset.model || '/models/naura.vrm');
        });
    }

    // --- 2. Binding Tombol Pose & Animasi ---
    animationButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const animationName = button.dataset.anim;
            const displayLabel = button.dataset.label || animationName;
            if (!animationName) return;

            animationButtons.forEach((btn) => {
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-muted)';
                btn.style.borderColor = 'var(--border-subtle)';
                btn.style.fontWeight = '600';
            });

            button.style.background = 'var(--primary-dim)';
            button.style.color = 'var(--primary)';
            button.style.borderColor = 'var(--border-primary)';
            button.style.fontWeight = '700';

            viewerInstance.playAnimation(animationName, {
                loop: animationName === 'Idle',
            });

            if (statusText) {
                statusText.textContent = displayLabel;
            }
        });
    });

    // --- 3. Binding Fitur Tambahan (Halo, Reset Kamera, Snapshot Foto) ---
    if (buttonHalo) {
        buttonHalo.addEventListener('click', (event) => {
            event.stopPropagation();
            const isVisible = viewerInstance.toggleBrandFx();
            buttonHalo.style.opacity = isVisible ? '1' : '0.5';
            if (typeof window.showToast === 'function') {
                window.showToast(isVisible ? '✨ Astral Halo Diaktifkan' : 'Astral Halo Disembunyikan', 'info', 2000);
            }
        });
    }

    if (buttonReset) {
        buttonReset.addEventListener('click', (event) => {
            event.stopPropagation();
            viewerInstance.resetCamera();
            if (typeof window.showToast === 'function') {
                window.showToast('↺ Kamera Berhasil Direset', 'info', 2000);
            }
        });
    }

    if (buttonSnapshot) {
        buttonSnapshot.addEventListener('click', (event) => {
            event.stopPropagation();
            const fileName = `naura-pose-${Date.now()}.png`;
            viewerInstance.takeSnapshot(fileName);
            if (typeof window.showToast === 'function') {
                window.showToast('📷 Snapshot Berhasil Disimpan', 'success', 2500);
            }
        });
    }

    return viewerInstance;
}

// Inisialisasi otomatis jika DOM sudah siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initHeroViewer();
    });
} else {
    initHeroViewer();
}

/**
 * heroController.js - Pengendali Interaksi UI & DOM untuk NauraHero3DViewer.
 *
 * Menghubungkan antarmuka halaman web (tombol animasi, toggle model VRM/GLB,
 * efek Halo, reset kamera, dan snapshot foto) dengan mesin 3D NauraHero3DViewer.
 */

import { NauraHero3DViewer } from './hero3d.js';

/**
 * Instance viewer yang sudah hidup untuk canvas tersebut.
 * Dipakai sebagai pagar agar initHeroViewer() tidak membangun mesin 3D kedua
 * di atas canvas yang sama.
 * @type {WeakMap<HTMLCanvasElement, NauraHero3DViewer>}
 */
const activeViewers = new WeakMap();

/**
 * Inisialisasi controller interaktif pada canvas dan elemen UI pendukung.
 * @param {HTMLCanvasElement|null} [targetCanvas=null] - Elemen canvas target.
 * @param {Object} [customOptions={}] - Opsi kustom untuk NauraHero3DViewer.
 * @returns {NauraHero3DViewer|null} Instance viewer aktif, atau null bila gagal.
 */
export function initHeroViewer(targetCanvas = null, customOptions = {}) {
    const canvasElement = targetCanvas || document.getElementById('naura-hero-3d-canvas');
    if (!canvasElement) {
        return null;
    }

    // Pagar init ganda. Modul ini dipanggil oleh blok auto-init di bawah
    // DAN oleh script halaman, sehingga tanpa pagar ini dua mesin 3D akan
    // berbagi satu canvas: render saling menimpa, event listener menumpuk,
    // dan setiap pergantian model mengalokasikan buffer GPU baru.
    if (activeViewers.has(canvasElement)) {
        return activeViewers.get(canvasElement);
    }

    const wrapperElement = document.getElementById('naura3d-canvas-wrapper');
    const loadingBox = document.getElementById('naura3d-loading');
    const loadingText = document.getElementById('naura3d-loading-text');
    const errorBox = document.getElementById('naura3d-error');
    const statusText = document.getElementById('naura3d-status-text');
    const formatBadge = document.getElementById('naura3d-format-badge');
    const buttonModelNew = document.getElementById('btn-model-new');
    const buttonModelGlb = document.getElementById('btn-model-glb');
    const buttonModelVrm = document.getElementById('btn-model-vrm');
    const buttonHalo = document.getElementById('naura3d-btn-halo');
    const buttonReset = document.getElementById('naura3d-btn-reset');
    const buttonSnapshot = document.getElementById('naura3d-btn-snapshot');
    const animationButtons = document.querySelectorAll('.naura3d-anim-btn');

    // Path model WAJIB ter-encode. Nama file aslinya memuat SPASI, sehingga
    // string dengan spasi mentah gagal dimuat browser. %20 adalah
    // representasi URL yang benar untuk karakter spasi.
    let currentActiveModel = '/models/naura%20NEW.vrm';

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
                if (currentActiveModel.includes('NEW')) {
                    formatBadge.textContent = currentActiveModel.endsWith('.vrm') ? 'NEW VRM' : 'NEW GLB';
                } else {
                    formatBadge.textContent = currentActiveModel.endsWith('.vrm') ? 'VRM' : 'GLB';
                }
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

    // --- 1. Binding Pergantian Model (NEW vs VRM vs GLB) ---
    const updateModelButtonsState = (activeModelPath) => {
        const isNewActive = activeModelPath.includes('NEW.vrm');
        const isVrmOldActive = !activeModelPath.includes('NEW') && activeModelPath.endsWith('.vrm');
        const isGlbActive = activeModelPath.endsWith('.glb');

        const setBtnStyle = (btn, isActive) => {
            if (!btn) return;
            btn.style.background = isActive ? 'var(--primary-dim)' : 'var(--bg-elevated)';
            btn.style.color = isActive ? 'var(--primary)' : 'var(--text-muted)';
            btn.style.borderColor = isActive ? 'var(--border-primary)' : 'var(--border-subtle)';
            btn.style.fontWeight = isActive ? '700' : '600';
        };

        setBtnStyle(buttonModelNew, isNewActive);
        setBtnStyle(buttonModelVrm, isVrmOldActive);
        setBtnStyle(buttonModelGlb, isGlbActive);

        if (formatBadge) {
            if (activeModelPath.includes('NEW')) {
                formatBadge.textContent = activeModelPath.endsWith('.vrm') ? 'NEW VRM' : 'NEW GLB';
            } else {
                formatBadge.textContent = activeModelPath.endsWith('.vrm') ? 'VRM' : 'GLB';
            }
        }
    };

    const handleModelSwitch = async (modelPath) => {
        if (!modelPath || modelPath === currentActiveModel) return;

        currentActiveModel = modelPath;
        updateModelButtonsState(modelPath);

        if (loadingBox) {
            loadingBox.style.display = 'flex';
            loadingBox.style.opacity = '1';
        }
        if (loadingText) {
            loadingText.textContent = `Memuat Avatar 3D...`;
        }

        await viewerInstance.switchModel(modelPath);
    };

    if (buttonModelNew) {
        buttonModelNew.addEventListener('click', (event) => {
            event.stopPropagation();
            handleModelSwitch(buttonModelNew.dataset.model || '/models/naura%20NEW.vrm');
        });
    }

    if (buttonModelGlb) {
        buttonModelGlb.addEventListener('click', (event) => {
            event.stopPropagation();
            handleModelSwitch(buttonModelGlb.dataset.model || '/models/naura%20NEW.glb');
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

            try {
                let phrase = 'Hmm, ada yang bisa aku bantu?';
                let fallbackSound = '/assets/audio/soundboard/magic.mp3';
                const animLower = animationName.toLowerCase();
                
                if (animLower.includes('joy') || animLower.includes('happy') || animLower.includes('nod')) {
                    phrase = 'Asyik! Senang banget rasanya.';
                    fallbackSound = '/assets/audio/soundboard/applause.mp3';
                } else if (animLower.includes('sad') || animLower.includes('cry') || animLower.includes('sorrow')) {
                    phrase = 'Aduh, sedih deh rasanya.';
                    fallbackSound = '/assets/audio/soundboard/gameover.mp3';
                } else if (animLower.includes('angry')) {
                    phrase = 'Hmpf! Jangan iseng ya!';
                    fallbackSound = '/assets/audio/soundboard/bruh.mp3';
                } else if (animLower.includes('surprised') || animLower.includes('fun')) {
                    phrase = 'Wah, mengejutkan sekali!';
                    fallbackSound = '/assets/audio/soundboard/cheer.mp3';
                }

                // Coba panggil TTS agar Naura bersuara asli
                fetch('/api/ai/companion/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: phrase })
                })
                .then(res => {
                    if (res.ok && res.headers.get('Content-Type')?.includes('audio')) {
                        return res.blob();
                    }
                    throw new Error('TTS audio tidak tersedia');
                })
                .then(blob => {
                    const audioUrl = URL.createObjectURL(blob);
                    const audio = new Audio(audioUrl);
                    audio.volume = 0.8;
                    audio.play().catch(() => {});
                })
                .catch(() => {
                    // Fallback ke efek suara bawaan bila TTS gagal atau rate limited
                    const audio = new Audio(fallbackSound);
                    audio.volume = 0.4;
                    audio.play().catch(() => {});
                });
            } catch (err) {}

            animationButtons.forEach((btn) => {
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-muted)';
                btn.style.borderColor = 'var(--border-subtle)';
                btn.style.fontWeight = '600';
            });

            button.style.background = 'var(--primary-dim)';
            button.style.color = 'var(--primary)';
            button.style.borderColor = 'var(--border-primary)';
            const isIdleAction = animationName.toLowerCase() === 'idle';

            viewerInstance.playAnimation(animationName, {
                loop: isIdleAction,
                onFinish: () => {
                    if (statusText) {
                        statusText.textContent = '🌸 Idle';
                    }
                    animationButtons.forEach((btn) => {
                        const isIdleBtn = (btn.dataset.anim || '').toLowerCase() === 'idle';
                        btn.style.background = isIdleBtn ? 'var(--primary-dim)' : 'transparent';
                        btn.style.color = isIdleBtn ? 'var(--primary)' : 'var(--text-muted)';
                        btn.style.borderColor = isIdleBtn ? 'var(--border-primary)' : 'var(--border-subtle)';
                        btn.style.fontWeight = isIdleBtn ? '700' : '600';
                    });
                },
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
                // Toast ini hanya mengulang kondisi tombol yang sudah berubah,
                // jadi cukup sebutan singkat tanpa kata "Berhasil".
                window.showToast(isVisible ? '✨ Halo aktif' : 'Halo mati', 'info', 1500);
            }
        });
    }

    if (buttonReset) {
        buttonReset.addEventListener('click', (event) => {
            event.stopPropagation();
            viewerInstance.resetCamera();
            // Tidak perlu toast: tombol reset selalu bekerja, dan kalimat
            // "Kamera Berhasil Direset" hanya mengulang apa yang ditekan user.
        });
    }

    if (buttonSnapshot) {
        buttonSnapshot.addEventListener('click', (event) => {
            event.stopPropagation();
            const fileName = `naura-pose-${Date.now()}.png`;
            viewerInstance.takeSnapshot(fileName);
            if (typeof window.showToast === 'function') {
                // Toast di sini bukan pengulangan: unduhan file tidak terlihat
                // user, jadi dia perlu tahu apa yang baru saja terjadi.
                window.showToast('📷 Foto tersimpan sebagai naura-pose.png', 'success', 2500);
            }
        });
    }

    // Daftarkan instance agar pemanggilan berikutnya pada canvas yang sama
    // mengembalikan viewer ini, bukan membangun yang baru.
    activeViewers.set(canvasElement, viewerInstance);
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

// 🔊 AUDIO & SFX MANAGER (GLOBAL CLIENT SCRIPT)
// Safe client script without Node.js dependencies

let bgmPlayer = null;
let sfxPlayer = null;

function initAudio() {
    if (!bgmPlayer) {
        bgmPlayer = new Audio('/assets/dashboard/bgmusic.mp3');
        bgmPlayer.loop = true;
    }
    if (!sfxPlayer) {
        sfxPlayer = new Audio('/assets/dashboard/click.mp3');
    }

    const bgmEnabled = localStorage.getItem('bgmEnabled') !== 'false';
    const sfxEnabled = localStorage.getItem('sfxEnabled') !== 'false';
    const masterVol = localStorage.getItem('masterVolume') !== null ? parseFloat(localStorage.getItem('masterVolume')) : 50;

    const bgmToggleEl = document.getElementById('bgmToggle');
    const sfxToggleEl = document.getElementById('sfxToggle');
    const volSliderEl = document.getElementById('volSlider');

    if (bgmToggleEl) bgmToggleEl.checked = bgmEnabled;
    if (sfxToggleEl) sfxToggleEl.checked = sfxEnabled;
    if (volSliderEl) volSliderEl.value = masterVol;

    bgmPlayer.volume = masterVol / 100;

    if (bgmEnabled) {
        const startBgm = () => {
            bgmPlayer.play().catch(() => {});
        };
        startBgm();
        document.body.addEventListener('click', startBgm, { once: true });
        document.body.addEventListener('touchstart', startBgm, { once: true });
    }

    const registerAudioListeners = () => {
        document.querySelectorAll('button, a, [onclick]').forEach(el => {
            if (!el.dataset.hasAudioListener) {
                el.addEventListener('click', playClickSfx);
                el.dataset.hasAudioListener = 'true';
            }
        });
    };
    registerAudioListeners();
    const observer = new MutationObserver(registerAudioListeners);
    observer.observe(document.body, { childList: true, subtree: true });
}

function playClickSfx() {
    const sfxEnabled = localStorage.getItem('sfxEnabled') !== 'false';
    if (sfxEnabled && sfxPlayer) {
        sfxPlayer.currentTime = 0;
        sfxPlayer.play().catch(() => {});
    }
}

function toggleBgm() {
    const checked = document.getElementById('bgmToggle').checked;
    localStorage.setItem('bgmEnabled', checked);
    if (checked && bgmPlayer) {
        bgmPlayer.play().catch(() => {});
    } else if (bgmPlayer) {
        bgmPlayer.pause();
    }
    playClickSfx();
}

function toggleSfx() {
    const checked = document.getElementById('sfxToggle').checked;
    localStorage.setItem('sfxEnabled', checked);
    playClickSfx();
}

function adjustBgmVolume() {
    const vol = document.getElementById('volSlider').value;
    localStorage.setItem('masterVolume', vol);
    if (bgmPlayer) {
        bgmPlayer.volume = vol / 100;
    }
}
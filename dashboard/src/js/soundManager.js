/**
 * soundManager.js - Naura Hoshino V2 Adaptive Audio & Interactive SFX Engine.
 *
 * Mengelola BGM adaptif dinamis yang berganti nuansa sesuai menu/halaman aktif:
 * - Dashboard: Cyber Lo-Fi Pulse (Neo-Soul Warm Chords, Sub-Bass, Bell Plucks)
 * - Map: Aetheria Frontier RPG (Ambient Wilderness Pads, Bamboo Flute, Tribal Beats)
 * - Config: Cyber Synth Atelier (16th-note Arpeggios, Focus Analog Waves)
 * - System: Kawaii Neon Beats (Future Bass Chords, Pluck Melody, Bouncy Bass)
 * - Settings: Midnight Velvet Lounge (Smooth Rhodes Jazz Chords, Walking Bass)
 *
 * Dilengkapi Interactive SFX Engine untuk tactile click, hover, tab switch, toggle,
 * modal whoosh, dan coin success chime.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SoundManager = factory();
    root.soundManager = new root.SoundManager();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Tabel nada dasar (Hz)
  const NOTES = {
    C2: 65.41,
    D2: 73.42,
    E2: 82.41,
    F2: 87.31,
    G2: 98.0,
    A2: 110.0,
    B2: 123.47,
    C3: 130.81,
    D3: 146.83,
    E3: 164.81,
    F3: 174.61,
    G3: 196.0,
    A3: 220.0,
    B3: 246.94,
    C4: 261.63,
    D4: 293.66,
    E4: 329.63,
    F4: 349.23,
    G4: 392.0,
    A4: 440.0,
    B4: 493.88,
    C5: 523.25,
    D5: 587.33,
    E5: 659.25,
    F5: 698.46,
    G5: 783.99,
    A5: 880.0,
    B5: 987.77,
    C6: 1046.5,
    D6: 1174.66,
    E6: 1318.51,
    G6: 1567.98,
    A6: 1760.0,
  };

  // Konfigurasi 5 Tema Nuansa BGM Adaptif
  const THEMES = {
    dashboard: {
      id: "dashboard",
      title: "Cyber Lo-Fi Pulse",
      bpm: 80,
      chords: [
        [NOTES.F3, NOTES.A3, NOTES.C4, NOTES.E4], // Fmaj7
        [NOTES.E3, NOTES.G3, NOTES.B3, NOTES.D4], // Em7
        [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.C4], // Dm7
        [NOTES.C3, NOTES.E3, NOTES.G3, NOTES.B3], // Cmaj7
      ],
      bass: [NOTES.F2, NOTES.E2, NOTES.D2, NOTES.C2],
      melody: [
        NOTES.A4,
        NOTES.C5,
        NOTES.E5,
        NOTES.G5,
        NOTES.E5,
        NOTES.D5,
        NOTES.C5,
        NOTES.A4,
      ],
      type: "warm_rhodes",
      leadType: "sine",
    },
    map: {
      id: "map",
      title: "Aetheria Frontier RPG",
      bpm: 75,
      chords: [
        [NOTES.A3, NOTES.C4, NOTES.E4, NOTES.A4], // Am
        [NOTES.F3, NOTES.A3, NOTES.C4, NOTES.E4], // Fmaj7
        [NOTES.C3, NOTES.E3, NOTES.G3, NOTES.C4], // C
        [NOTES.G3, NOTES.B3, NOTES.D4, NOTES.G4], // G
      ],
      bass: [NOTES.A2, NOTES.F2, NOTES.C2, NOTES.G2],
      melody: [
        NOTES.E5,
        NOTES.G5,
        NOTES.A5,
        NOTES.C6,
        NOTES.A5,
        NOTES.G5,
        NOTES.E5,
        NOTES.D5,
      ],
      type: "ambient_pad",
      leadType: "bamboo_flute",
    },
    config: {
      id: "config",
      title: "Cyber Synth Atelier",
      bpm: 96,
      chords: [
        [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.C4], // Dm7
        [NOTES.B3, NOTES.D4, NOTES.F4, NOTES.A4], // Bbmaj7
        [NOTES.G3, NOTES.B3, NOTES.D4, NOTES.F4], // Gm7
        [NOTES.A3, NOTES.D4, NOTES.E4, NOTES.A4], // Asus4
      ],
      bass: [NOTES.D2, NOTES.B2, NOTES.G2, NOTES.A2],
      melody: [
        NOTES.D5,
        NOTES.F5,
        NOTES.A5,
        NOTES.D6,
        NOTES.A5,
        NOTES.F5,
        NOTES.E5,
        NOTES.C5,
      ],
      type: "focus_analog",
      leadType: "crisp_arp",
    },
    system: {
      id: "system",
      title: "Kawaii Neon Beats",
      bpm: 116,
      chords: [
        [NOTES.C3, NOTES.E3, NOTES.G3, NOTES.B3], // Cmaj7
        [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.D4], // D
        [NOTES.E3, NOTES.G3, NOTES.B3, NOTES.E4], // Em7
        [NOTES.B3, NOTES.D4, NOTES.F4, NOTES.B4], // Bm7
      ],
      bass: [NOTES.C2, NOTES.D2, NOTES.E2, NOTES.B2],
      melody: [
        NOTES.G5,
        NOTES.B5,
        NOTES.C6,
        NOTES.E6,
        NOTES.D6,
        NOTES.B5,
        NOTES.A5,
        NOTES.G5,
      ],
      type: "neon_pump",
      leadType: "sparkle_chime",
    },
    settings: {
      id: "settings",
      title: "Midnight Velvet Lounge",
      bpm: 72,
      chords: [
        [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.C4], // Dm9
        [NOTES.G3, NOTES.B3, NOTES.D4, NOTES.F4], // G13
        [NOTES.C3, NOTES.E3, NOTES.G3, NOTES.B3], // Cmaj9
        [NOTES.A3, NOTES.C4, NOTES.E4, NOTES.G4], // A7alt
      ],
      bass: [NOTES.D2, NOTES.G2, NOTES.C2, NOTES.A2],
      melody: [
        NOTES.E5,
        NOTES.G5,
        NOTES.A5,
        NOTES.B5,
        NOTES.A5,
        NOTES.F5,
        NOTES.E5,
        NOTES.D5,
      ],
      type: "velvet_jazz",
      leadType: "mellow_rhodes",
    },
  };

  class SoundManagerClass {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.bgmGain = null;
      this.sfxGain = null;
      this.unlocked = false;

      // Preferensi tersimpan
      this.bgmEnabled = localStorage.getItem("naura_bgm_enabled") !== "false";
      this.sfxEnabled = localStorage.getItem("naura_sfx_enabled") !== "false";
      this.bgmVolume = parseFloat(
        localStorage.getItem("naura_bgm_vol") || "0.35",
      );
      this.sfxVolume = parseFloat(
        localStorage.getItem("naura_sfx_vol") || "0.50",
      );
      this.playlistMode = localStorage.getItem("naura_bgm_playlist") || "auto";

      // State Generator
      this.currentThemeId = null;
      this.isPlaying = false;
      this.stepTimer = null;
      this.stepIndex = 0;
      this.activeNodes = [];

      // Fallback audio element untuk master OST
      this.ostAudio = null;
      this.clickAudio = null;

      // Inisialisasi pendengar interaksi pertama
      this._setupUnlockListener();
    }

    _setupUnlockListener() {
      const unlockHandler = () => {
        this.unlock();
        window.removeEventListener("pointerdown", unlockHandler);
        window.removeEventListener("keydown", unlockHandler);
        window.removeEventListener("touchstart", unlockHandler);
      };
      window.addEventListener("pointerdown", unlockHandler, { passive: true });
      window.addEventListener("keydown", unlockHandler, { passive: true });
      window.addEventListener("touchstart", unlockHandler, { passive: true });
    }

    initContext() {
      if (this.ctx) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // BGM Gain
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(
        this.bgmEnabled ? this.bgmVolume : 0.0001,
        this.ctx.currentTime,
      );
      this.bgmGain.connect(this.masterGain);

      // SFX Gain
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(
        this.sfxEnabled ? this.sfxVolume : 0.0001,
        this.ctx.currentTime,
      );
      this.sfxGain.connect(this.masterGain);
    }

    unlock() {
      this.initContext();
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      this.unlocked = true;

      // Putar tema yang sesuai bila BGM aktif
      if (this.bgmEnabled && !this.isPlaying) {
        this.playAdaptiveTheme();
      }
    }

    getCurrentGroupTheme() {
      if (
        this.playlistMode &&
        this.playlistMode !== "auto" &&
        THEMES[this.playlistMode]
      ) {
        return this.playlistMode;
      }
      const path = window.location.pathname.replace(/\/$/, "") || "/";
      if (
        path === "/world" ||
        path.startsWith("/survival") ||
        path === "/war-room"
      ) {
        return "map";
      }
      if (
        path === "/automations" ||
        path === "/welcomer" ||
        path === "/builder" ||
        path === "/tickets"
      ) {
        return "config";
      }
      if (
        path === "/music" ||
        path === "/jam" ||
        path === "/karaoke" ||
        path === "/soundboard" ||
        path === "/lounge" ||
        path === "/topology" ||
        path === "/portfolio"
      ) {
        return "system";
      }
      if (path === "/settings" || path === "/economy") {
        return "settings";
      }
      return "dashboard";
    }

    playAdaptiveTheme() {
      const themeId = this.getCurrentGroupTheme();
      this.playTheme(themeId);
    }

    playTheme(themeId) {
      if (!this.unlocked) return;
      this.initContext();
      if (!this.ctx) return;

      // Jika mode file audio master dipilih
      if (themeId === "original") {
        this.stopTheme();
        this._playMasterOst();
        this._updateUiWidget("Naura Master OST");
        return;
      }

      const theme = THEMES[themeId] || THEMES.dashboard;
      if (this.currentThemeId === theme.id && this.isPlaying) {
        return;
      }

      this.stopTheme();
      this.currentThemeId = theme.id;
      this.isPlaying = true;
      this.stepIndex = 0;

      // Fade-in BGM Gain lembut
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setValueAtTime(0.0001, now);
      this.bgmGain.gain.linearRampToValueAtTime(
        this.bgmEnabled ? this.bgmVolume : 0.0001,
        now + 1.2,
      );

      const stepDurationMs = (60 / theme.bpm / 2) * 1000; // 8th note steps
      const stepRunner = () => {
        if (!this.isPlaying) return;
        this._renderThemeStep(theme, this.stepIndex);
        this.stepIndex++;
        this.stepTimer = setTimeout(stepRunner, stepDurationMs);
      };
      stepRunner();

      this._updateUiWidget(theme.title);
    }

    _renderThemeStep(theme, step) {
      if (!this.ctx || !this.bgmGain) return;
      const now = this.ctx.currentTime;
      const chordIndex = Math.floor(step / 8) % theme.chords.length;
      const isBarStart = step % 8 === 0;
      const isHalfBar = step % 4 === 0;

      // 1. Akord Pads (tiap awal bar & setengah bar)
      if (isBarStart || isHalfBar) {
        const chord = theme.chords[chordIndex];
        chord.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = theme.type === "warm_rhodes" ? "triangle" : "sine";
          osc.frequency.setValueAtTime(freq, now);

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(
            theme.type === "focus_analog" ? 1400 : 850,
            now,
          );

          const duration = isBarStart ? 1.8 : 1.1;
          noteGain.gain.setValueAtTime(0.0001, now);
          noteGain.gain.linearRampToValueAtTime(0.045 / (i + 1), now + 0.15);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

          osc.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(this.bgmGain);

          osc.start(now);
          osc.stop(now + duration + 0.05);
        });
      }

      // 2. Bassline ritmik
      if (step % 4 === 0 || step % 8 === 6) {
        const bassFreq = theme.bass[chordIndex];
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();

        bassOsc.type = "triangle";
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassGain.gain.setValueAtTime(0.0001, now);
        bassGain.gain.linearRampToValueAtTime(0.09, now + 0.04);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        bassOsc.connect(bassGain);
        bassGain.connect(this.bgmGain);

        bassOsc.start(now);
        bassOsc.stop(now + 0.5);
      }

      // 3. Arpeggio / Melody Plucks (nada pentatonik bersinar)
      if (step % 2 === 0) {
        const noteIndex = (step * 3) % theme.melody.length;
        const melFreq = theme.melody[noteIndex];

        const melOsc = this.ctx.createOscillator();
        const melGain = this.ctx.createGain();

        melOsc.type = theme.leadType === "crisp_arp" ? "sawtooth" : "sine";
        melOsc.frequency.setValueAtTime(melFreq, now);

        melGain.gain.setValueAtTime(0.0001, now);
        melGain.gain.linearRampToValueAtTime(0.035, now + 0.02);
        melGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

        melOsc.connect(melGain);
        melGain.connect(this.bgmGain);

        melOsc.start(now);
        melOsc.stop(now + 0.35);
      }
    }

    _playMasterOst() {
      if (!this.ostAudio) {
        this.ostAudio = new Audio("/assets/dashboard/bgmusic.mp3");
        this.ostAudio.loop = true;
      }
      this.ostAudio.volume = this.bgmEnabled ? this.bgmVolume : 0;
      this.ostAudio.play().catch(() => {});
      this.isPlaying = true;
      this.currentThemeId = "original";
    }

    stopTheme() {
      this.isPlaying = false;
      if (this.stepTimer) {
        clearTimeout(this.stepTimer);
        this.stepTimer = null;
      }
      if (this.ostAudio) {
        this.ostAudio.pause();
        this.ostAudio.currentTime = 0;
      }
      this._updateUiWidget("Hening (Pause)");
    }

    setBgmEnabled(enabled) {
      this.bgmEnabled = !!enabled;
      localStorage.setItem("naura_bgm_enabled", String(this.bgmEnabled));
      if (this.ctx && this.bgmGain) {
        const now = this.ctx.currentTime;
        this.bgmGain.gain.cancelScheduledValues(now);
        this.bgmGain.gain.linearRampToValueAtTime(
          this.bgmEnabled ? this.bgmVolume : 0.0001,
          now + 0.3,
        );
      }
      if (this.ostAudio) {
        this.ostAudio.volume = this.bgmEnabled ? this.bgmVolume : 0;
      }
      if (this.bgmEnabled && !this.isPlaying) {
        this.playAdaptiveTheme();
      }
      this._syncSettingsUi();
    }

    setBgmVolume(volume) {
      const vol = Math.max(0, Math.min(1, parseFloat(volume) || 0));
      this.bgmVolume = vol;
      localStorage.setItem("naura_bgm_vol", String(vol));
      if (this.ctx && this.bgmGain && this.bgmEnabled) {
        this.bgmGain.gain.setValueAtTime(vol, this.ctx.currentTime);
      }
      if (this.ostAudio && this.bgmEnabled) {
        this.ostAudio.volume = vol;
      }
      this._syncSettingsUi();
    }

    setSfxEnabled(enabled) {
      this.sfxEnabled = !!enabled;
      localStorage.setItem("naura_sfx_enabled", String(this.sfxEnabled));
      if (this.ctx && this.sfxGain) {
        this.sfxGain.gain.setValueAtTime(
          this.sfxEnabled ? this.sfxVolume : 0.0001,
          this.ctx.currentTime,
        );
      }
      this._syncSettingsUi();
    }

    setPlaylistMode(mode) {
      this.playlistMode = mode;
      localStorage.setItem("naura_bgm_playlist", mode);
      this.playAdaptiveTheme();
      this._syncSettingsUi();
    }

    // ── Interactive SFX Methods ─────────────────────────────────────

    playClick() {
      if (!this.sfxEnabled) return;
      if (!this.unlocked) this.unlock();

      // Coba file audio click asli terlebih dahulu
      try {
        if (!this.clickAudio) {
          this.clickAudio = new Audio("/assets/dashboard/click.mp3");
        }
        this.clickAudio.currentTime = 0;
        this.clickAudio.volume = this.sfxVolume;
        this.clickAudio.play().catch(() => this._synthClick());
      } catch (_) {
        this._synthClick();
      }
    }

    _synthClick() {
      if (!this.ctx || !this.sfxGain) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.045);
    }

    playHover() {
      if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1350, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.03);
    }

    playTab() {
      if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
      const now = this.ctx.currentTime;
      [NOTES.C5, NOTES.G5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + i * 0.04;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(start);
        osc.stop(start + 0.13);
      });
    }

    playToggle(state) {
      if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      const fStart = state ? 440 : 880;
      const fEnd = state ? 880 : 440;

      osc.frequency.setValueAtTime(fStart, now);
      osc.frequency.exponentialRampToValueAtTime(fEnd, now + 0.08);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.09);
    }

    playModal() {
      if (!this.sfxEnabled || !this.ctx || !this.sfxGain) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.15);
    }

    playCoin() {
      if (!this.sfxEnabled) return;
      if (!this.unlocked) this.unlock();
      try {
        const coinAudio = new Audio("/assets/audio/soundboard/coin.wav");
        coinAudio.volume = this.sfxVolume;
        coinAudio.play().catch(() => this._synthCoin());
      } catch (_) {
        this._synthCoin();
      }
    }

    _synthCoin() {
      if (!this.ctx || !this.sfxGain) return;
      const now = this.ctx.currentTime;
      [987.77, 1318.51].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + i * 0.06;

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.22, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(start);
        osc.stop(start + 0.3);
      });
    }

    _updateUiWidget(trackTitle) {
      const label = document.getElementById("audioTrackLabel");
      if (label) label.textContent = trackTitle;

      const eq = document.getElementById("audioEqBars");
      if (eq) eq.classList.toggle("playing", this.isPlaying && this.bgmEnabled);

      const muteBtn = document.getElementById("audioBtnMute");
      if (muteBtn) {
        muteBtn.innerHTML = this.bgmEnabled
          ? '<i class="fa-solid fa-volume-high"></i>'
          : '<i class="fa-solid fa-volume-xmark" style="color:var(--accent-pink);"></i>';
      }
    }

    _syncSettingsUi() {
      const toggleBgm = document.getElementById("toggleBgm");
      if (toggleBgm) toggleBgm.checked = this.bgmEnabled;

      const rangeBgmVol = document.getElementById("rangeBgmVol");
      const bgmVolLabel = document.getElementById("bgmVolLabel");
      if (rangeBgmVol) rangeBgmVol.value = Math.round(this.bgmVolume * 100);
      if (bgmVolLabel)
        bgmVolLabel.textContent = Math.round(this.bgmVolume * 100) + "%";

      const selectBgmPlaylist = document.getElementById("selectBgmPlaylist");
      if (selectBgmPlaylist) selectBgmPlaylist.value = this.playlistMode;

      const toggleSfx = document.getElementById("toggleSfx");
      if (toggleSfx) toggleSfx.checked = this.sfxEnabled;

      this._updateUiWidget(
        this.isPlaying
          ? THEMES[this.currentThemeId]?.title || "Aktif"
          : "Pause",
      );
    }
  }

  return SoundManagerClass;
});

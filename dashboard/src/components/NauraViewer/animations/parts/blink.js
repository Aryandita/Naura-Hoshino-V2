/**
 * parts/blink.js - Pengendali Kedipan Kelopak Mata (Blink & Eyelids).
 *
 * Mengendalikan:
 * 1. Siklus kedipan otonom alami (interval acak 2.8s s/d 5.5s).
 * 2. Single blink (durasi 160ms) & Double blink micro-reaction (durasi 280ms, 20% probabilitas).
 * 3. Blendshape weights mapping (Blink, Blink_L, Blink_R).
 * 4. Pemicu manual kedipan (misal saat kursor diklik atau interaksi gembira).
 */

export class BlinkController {
  constructor(options = {}) {
    this.vrm = null;
    this.options = options;
    this.timer = 0;
    this.interval = 3.0 + Math.random() * 2.0;
    this.isBlinking = false;
    this.isDoubleBlink = false;
    this.duration = 0.16;
    this.progress = 0;
    this.currentWeight = 0;
  }

  init(vrm) {
    this.vrm = vrm;
    this.reset();
  }

  /**
   * Memicu kedipan langsung secara imperatif.
   * @param {boolean} [isDouble=false]
   */
  triggerBlink(isDouble = false) {
    this.isBlinking = true;
    this.isDoubleBlink = isDouble;
    this.progress = 0;
    this.duration = isDouble ? 0.28 : 0.16;
    this.timer = 0;
  }

  update(delta, elapsed, context = {}) {
    try {
      if (!this.vrm) return;

      this.timer += delta;
      if (!this.isBlinking && this.timer >= this.interval) {
        this.isBlinking = true;
        this.progress = 0;
        this.isDoubleBlink = Math.random() < 0.2;
        this.duration = this.isDoubleBlink ? 0.28 : 0.16;
      }

      if (this.isBlinking) {
        this.progress += delta / this.duration;
        const p = this.progress;

        let blinkVal = 0;
        if (this.isDoubleBlink) {
          blinkVal = Math.max(0, Math.sin(p * Math.PI * 2));
        } else {
          if (p <= 0.35) {
            blinkVal = p / 0.35;
          } else if (p <= 1.0) {
            blinkVal = 1.0 - (p - 0.35) / 0.65;
          }
        }

        this.currentWeight = Math.max(0, Math.min(1, blinkVal));

        if (p >= 1.0) {
          this.isBlinking = false;
          this.timer = 0;
          this.interval = 2.8 + Math.random() * 2.5;
          this.currentWeight = 0;
        }
      }

      // Terapkan ke VRM
      this._applyWeight(this.currentWeight);
    } catch (err) {
      console.warn(
        "[NauraAnimation:Blink] Error updating blinking:",
        err.message,
      );
    }
  }

  _applyWeight(weight) {
    if (!this.vrm) return;
    if (this.vrm.blendShapeProxy) {
      try {
        this.vrm.blendShapeProxy.setValue("Blink", weight);
      } catch (_) {}
    } else if (this.vrm.expressionManager) {
      try {
        this.vrm.expressionManager.setValue("blink", weight);
      } catch (_) {}
    }
  }

  reset() {
    this.timer = 0;
    this.isBlinking = false;
    this.currentWeight = 0;
    this.progress = 0;
    this._applyWeight(0);
  }

  destroy() {
    this.reset();
    this.vrm = null;
  }
}

"use strict";

const STORAGE_KEY = "naura-floating-avatar-position";

class NauraFloatingAvatar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._isDragging = false;
    this._dragOffset = { x: 0, y: 0 };
    this._position = { x: 20, y: 80 };
    this._velocity = { x: 0, y: 0 };
    this._lastTime = 0;
    this._animationFrame = null;
  }

  connectedCallback() {
    this._loadPosition();
    this._render();
    this._setupEventListeners();
    this._startPhysicsLoop();
  }

  disconnectedCallback() {
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
    }
    this._removeEventListeners();
  }

  _loadPosition() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this._position = {
          x: Math.max(0, Math.min(window.innerWidth - 80, parsed.x || 20)),
          y: Math.max(0, Math.min(window.innerHeight - 80, parsed.y || 80)),
        };
      }
    } catch {
      // Use default position
    }
  }

  _savePosition() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._position));
    } catch {
      // Storage unavailable
    }
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          z-index: 9999;
          pointer-events: auto;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
        }

        .avatar-container {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          cursor: grab;
          position: relative;
          transition: transform 0.1s ease-out, box-shadow 0.2s ease;
        }

        .avatar-container:active {
          cursor: grabbing;
        }

        .avatar-container.dragging {
          transform: scale(1.1);
          box-shadow: 0 8px 32px rgba(244, 114, 182, 0.5);
        }

        .avatar-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 3px solid var(--primary, #f472b6);
          box-shadow: 
            0 0 20px rgba(244, 114, 182, 0.4),
            inset 0 0 20px rgba(244, 114, 182, 0.1);
          animation: ring-pulse 2s ease-in-out infinite;
        }

        @keyframes ring-pulse {
          0%, 100% { 
            box-shadow: 
              0 0 20px rgba(244, 114, 182, 0.4),
              inset 0 0 20px rgba(244, 114, 182, 0.1);
          }
          50% { 
            box-shadow: 
              0 0 30px rgba(244, 114, 182, 0.6),
              inset 0 0 30px rgba(244, 114, 182, 0.2);
          }
        }

        .avatar-image {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          background: linear-gradient(135deg, #1a1d2e 0%, #0f1119 100%);
          border: 2px solid rgba(255, 255, 255, 0.1);
        }

        .status-indicator {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent-green, #10b981);
          border: 3px solid var(--bg-primary, #0a0d14);
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
        }

        .status-indicator.offline {
          background: var(--text-muted, #6b7280);
          box-shadow: none;
        }

        .tooltip {
          position: absolute;
          bottom: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%) translateY(8px);
          background: var(--bg-elevated, #1a1d2e);
          color: var(--text-primary, #fff);
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-family: var(--font-body, 'Outfit', sans-serif);
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s, transform 0.2s;
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: var(--bg-elevated, #1a1d2e);
        }

        .avatar-container:hover .tooltip {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        .reset-hint {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          color: var(--text-muted, #6b7280);
          opacity: 0;
          transition: opacity 0.2s;
          white-space: nowrap;
        }

        .avatar-container:hover .reset-hint {
          opacity: 0.7;
        }
      </style>

      <div class="avatar-container" id="avatarContainer">
        <div class="avatar-ring"></div>
        <img class="avatar-image" id="avatarImage" 
             src="/assets/core/avatar.png" 
             alt="Naura Avatar"
             draggable="false" />
        <div class="status-indicator" id="statusIndicator"></div>
        <div class="tooltip">Drag to move • Double-click to reset</div>
        <div class="reset-hint">Double-click to reset position</div>
      </div>
    `;

    this._container = this.shadowRoot.getElementById("avatarContainer");
    this._image = this.shadowRoot.getElementById("avatarImage");
    this._status = this.shadowRoot.getElementById("statusIndicator");

    this._updateTransform();
  }

  _updateTransform() {
    this.style.transform = `translate(${this._position.x}px, ${this._position.y}px)`;
  }

  _setupEventListeners() {
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onDoubleClick = this._handleDoubleClick.bind(this);
    this._onResize = this._handleResize.bind(this);

    this._container.addEventListener("pointerdown", this._onPointerDown);
    this._container.addEventListener("dblclick", this._onDoubleClick);
    window.addEventListener("resize", this._onResize);
  }

  _removeEventListeners() {
    this._container.removeEventListener("pointerdown", this._onPointerDown);
    this._container.removeEventListener("dblclick", this._onDoubleClick);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("resize", this._onResize);
  }

  _handlePointerDown(e) {
    e.preventDefault();
    this._isDragging = true;
    this._container.classList.add("dragging");
    this._container.setPointerCapture(e.pointerId);

    const rect = this.getBoundingClientRect();
    this._dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    this._velocity = { x: 0, y: 0 };
    this._lastTime = performance.now();

    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
  }

  _handlePointerMove(e) {
    if (!this._isDragging) return;
    e.preventDefault();

    const now = performance.now();
    const dt = (now - this._lastTime) / 1000;
    this._lastTime = now;

    const newX = e.clientX - this._dragOffset.x;
    const newY = e.clientY - this._dragOffset.y;

    this._velocity = {
      x: (newX - this._position.x) / dt,
      y: (newY - this._position.y) / dt,
    };

    this._position = {
      x: Math.max(0, Math.min(window.innerWidth - 64, newX)),
      y: Math.max(0, Math.min(window.innerHeight - 64, newY)),
    };

    this._updateTransform();
  }

  _handlePointerUp(e) {
    if (!this._isDragging) return;
    this._isDragging = false;
    this._container.classList.remove("dragging");
    this._container.releasePointerCapture(e.pointerId);

    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);

    this._savePosition();
  }

  _handleDoubleClick() {
    this._position = { x: 20, y: 80 };
    this._velocity = { x: 0, y: 0 };
    this._updateTransform();
    this._savePosition();

    this._container.style.transition = "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
    setTimeout(() => {
      this._container.style.transition = "";
    }, 300);
  }

  _handleResize() {
    this._position = {
      x: Math.max(0, Math.min(window.innerWidth - 64, this._position.x)),
      y: Math.max(0, Math.min(window.innerHeight - 64, this._position.y)),
    };
    this._updateTransform();
    this._savePosition();
  }

  _startPhysicsLoop() {
    const loop = () => {
      if (!this._isDragging && (Math.abs(this._velocity.x) > 1 || Math.abs(this._velocity.y) > 1)) {
        const friction = 0.92;
        this._velocity.x *= friction;
        this._velocity.y *= friction;

        this._position.x += this._velocity.x * 0.016;
        this._position.y += this._velocity.y * 0.016;

        if (this._position.x <= 0 || this._position.x >= window.innerWidth - 64) {
          this._velocity.x *= -0.5;
          this._position.x = Math.max(0, Math.min(window.innerWidth - 64, this._position.x));
        }
        if (this._position.y <= 0 || this._position.y >= window.innerHeight - 64) {
          this._velocity.y *= -0.5;
          this._position.y = Math.max(0, Math.min(window.innerHeight - 64, this._position.y));
        }

        this._updateTransform();

        if (Math.abs(this._velocity.x) < 1 && Math.abs(this._velocity.y) < 1) {
          this._velocity = { x: 0, y: 0 };
          this._savePosition();
        }
      }

      this._animationFrame = requestAnimationFrame(loop);
    };

    this._animationFrame = requestAnimationFrame(loop);
  }

  setAvatar(src) {
    if (this._image) {
      this._image.src = src;
    }
  }

  setStatus(online) {
    if (this._status) {
      this._status.classList.toggle("offline", !online);
    }
  }
}

customElements.define("naura-floating-avatar", NauraFloatingAvatar);

export default NauraFloatingAvatar;

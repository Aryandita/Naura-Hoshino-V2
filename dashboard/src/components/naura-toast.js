/**
 * naura-toast.js - Reusable Toast Notification Web Component
 * 
 * Usage:
 *   <naura-toast type="success" message="Operation completed!" duration="4000"></naura-toast>
 * 
 * Types: info, success, warning, error
 * Auto-dismisses after duration (default 4000ms)
 */

class NauraToast extends HTMLElement {
  static get observedAttributes() {
    return ['type', 'title', 'message', 'duration'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._timeoutId = null;
  }

  connectedCallback() {
    this.render();
    this.startAutoDismiss();
  }

  disconnectedCallback() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
    }
  }

  attributeChangedCallback() {
    this.render();
  }

  startAutoDismiss() {
    const duration = parseInt(this.getAttribute('duration') || '4000', 10);
    if (duration > 0) {
      this._timeoutId = setTimeout(() => {
        this.dismiss();
      }, duration);
    }
  }

  dismiss() {
    this.classList.add('toast--dismissing');
    setTimeout(() => {
      this.remove();
    }, 300);
  }

  render() {
    const type = this.getAttribute('type') || 'info';
    const title = this.getAttribute('title') || '';
    const message = this.getAttribute('message') || '';

    const icons = {
      info: 'fa-circle-info',
      success: 'fa-circle-check',
      warning: 'fa-triangle-exclamation',
      error: 'fa-circle-xmark',
    };

    const iconClass = icons[type] || icons.info;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          animation: slideIn 0.3s var(--ease-spring, cubic-bezier(0.16, 1, 0.3, 1));
        }

        :host(.toast--dismissing) {
          animation: slideOut 0.3s ease forwards;
        }

        .toast {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: var(--r-lg, 14px);
          background: var(--bg-layer-elevated, #171b26);
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.07));
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), var(--glass-specular, inset 0 1px 0 0 rgba(255, 255, 255, 0.08));
          backdrop-filter: blur(16px);
          min-width: 280px;
          max-width: 400px;
        }

        /* Type variants */
        .toast--info { border-left: 3px solid var(--accent-cyan, #22d3ee); }
        .toast--success { border-left: 3px solid var(--status-online, #22c55e); }
        .toast--warning { border-left: 3px solid var(--status-idle, #f59e0b); }
        .toast--error { border-left: 3px solid var(--status-dnd, #ef4444); }

        .toast__icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .toast--info .toast__icon { color: var(--accent-cyan, #22d3ee); }
        .toast--success .toast__icon { color: var(--status-online, #22c55e); }
        .toast--warning .toast__icon { color: var(--status-idle, #f59e0b); }
        .toast--error .toast__icon { color: var(--status-dnd, #ef4444); }

        .toast__content {
          flex: 1;
          min-width: 0;
        }

        .toast__title {
          font-family: var(--font-heading, 'Outfit', sans-serif);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #f1f5f9);
          margin-bottom: 2px;
        }

        .toast__message {
          font-size: 12px;
          color: var(--text-secondary, #94a3b8);
          line-height: 1.4;
        }

        .toast__close {
          background: none;
          border: none;
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--r-sm, 6px);
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .toast__close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary, #f1f5f9);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(20px);
          }
        }
      </style>

      <div class="toast toast--${type}">
        <div class="toast__icon">
          <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="toast__content">
          ${title ? `<div class="toast__title">${title}</div>` : ''}
          <div class="toast__message">${message}</div>
        </div>
        <button class="toast__close" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;

    // Add close button handler
    const closeBtn = this.shadowRoot.querySelector('.toast__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.dismiss());
    }
  }
}

customElements.define('naura-toast', NauraToast);

/**
 * Toast Manager - Global toast notification system
 */
class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'naura-toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  }

  show(options = {}) {
    const toast = document.createElement('naura-toast');
    
    if (typeof options === 'string') {
      toast.setAttribute('message', options);
      toast.setAttribute('type', 'info');
    } else {
      if (options.type) toast.setAttribute('type', options.type);
      if (options.title) toast.setAttribute('title', options.title);
      if (options.message) toast.setAttribute('message', options.message);
      if (options.duration) toast.setAttribute('duration', String(options.duration));
    }

    toast.style.pointerEvents = 'auto';
    this.container.appendChild(toast);

    // Auto-remove after animation
    toast.addEventListener('animationend', (e) => {
      if (e.animationName === 'slideOut') {
        toast.remove();
      }
    });

    return toast;
  }

  info(message, title = '') {
    return this.show({ type: 'info', message, title });
  }

  success(message, title = 'Success') {
    return this.show({ type: 'success', message, title });
  }

  warning(message, title = 'Warning') {
    return this.show({ type: 'warning', message, title });
  }

  error(message, title = 'Error') {
    return this.show({ type: 'error', message, title });
  }
}

// Global instance
const toastManager = new ToastManager();

// Expose globally for legacy compatibility
if (typeof window !== 'undefined') {
  window.nauraToast = toastManager;
  // Legacy showToast compatibility
  window.showToast = (message, type = 'info', duration = 4000) => {
    return toastManager.show({ message, type, duration });
  };
}

export { NauraToast, ToastManager, toastManager };

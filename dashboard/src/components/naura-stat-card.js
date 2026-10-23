/**
 * naura-stat-card.js - Reusable Stat Card Web Component
 * 
 * Usage:
 *   <naura-stat-card 
 *     value="1,234" 
 *     label="Total Users" 
 *     icon="fa-users"
 *     delta="+12%"
 *     delta-type="up"
 *     color="primary">
 *   </naura-stat-card>
 * 
 * Colors: primary, cyan, amber, green, violet
 * Delta types: up, down, neutral
 */

class NauraStatCard extends HTMLElement {
  static get observedAttributes() {
    return ['value', 'label', 'icon', 'delta', 'delta-type', 'color', 'loading'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const value = this.getAttribute('value') || '0';
    const label = this.getAttribute('label') || '';
    const icon = this.getAttribute('icon') || '';
    const delta = this.getAttribute('delta') || '';
    const deltaType = this.getAttribute('delta-type') || 'neutral';
    const color = this.getAttribute('color') || 'primary';
    const isLoading = this.hasAttribute('loading');

    const colorClasses = {
      primary: 'stat--primary',
      cyan: 'stat--cyan',
      amber: 'stat--amber',
      green: 'stat--green',
      violet: 'stat--violet',
    };

    const deltaClasses = {
      up: 'delta--up',
      down: 'delta--down',
      neutral: 'delta--neutral',
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          container-type: inline-size;
          container-name: stat-card;
        }

        .stat-card {
          background: var(--bg-surface, rgba(255, 255, 255, 0.04));
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.07));
          border-radius: var(--r-xl, 18px);
          padding: var(--sp-card-padding, 20px);
          backdrop-filter: var(--blur-md, blur(16px));
          -webkit-backdrop-filter: var(--blur-md, blur(16px));
          position: relative;
          display: flex;
          flex-direction: column;
          gap: var(--sp-card-gap, 8px);
          box-shadow: var(--glass-specular, inset 0 1px 0 0 rgba(255, 255, 255, 0.08)), 0 6px 20px rgba(6, 8, 16, 0.25);
          transition: transform var(--t-base, 200ms) var(--ease-spring, cubic-bezier(0.16, 1, 0.3, 1)), 
                      border-color var(--t-base, 200ms ease), 
                      box-shadow var(--t-base, 200ms ease);
        }

        .stat-card:hover {
          border-color: var(--border-primary, rgba(244, 114, 182, 0.35));
          transform: translateY(-2px);
          box-shadow: var(--glass-specular-primary, inset 0 1px 0 0 rgba(255, 192, 203, 0.2)), 0 10px 28px var(--primary-deep, rgba(244, 114, 182, 0.12));
        }

        /* Color variants */
        .stat--primary .stat__icon { background: var(--primary-dim, rgba(244, 114, 182, 0.15)); color: var(--primary, #f472b6); }
        .stat--cyan .stat__icon { background: var(--cyan-dim, rgba(34, 211, 238, 0.15)); color: var(--accent-cyan, #22d3ee); }
        .stat--amber .stat__icon { background: var(--amber-dim, rgba(245, 158, 11, 0.15)); color: var(--accent-amber, #f59e0b); }
        .stat--green .stat__icon { background: var(--green-dim, rgba(52, 211, 153, 0.15)); color: var(--accent-green, #34d399); }
        .stat--violet .stat__icon { background: var(--violet-dim, rgba(167, 139, 250, 0.15)); color: var(--accent-violet, #a78bfa); }

        .stat__top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .stat__icon {
          width: 36px;
          height: 36px;
          border-radius: var(--r-md, 10px);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: var(--glass-specular, inset 0 1px 0 0 rgba(255, 255, 255, 0.08));
        }

        .stat__value {
          font-family: var(--font-mono, 'JetBrains Mono', monospace);
          font-size: var(--fs-stat-val, 28px);
          font-weight: 700;
          color: var(--text-primary, #f1f5f9);
          line-height: 1.1;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
        }

        .stat__label {
          font-size: 13px;
          color: var(--text-secondary, #94a3b8);
          font-weight: 500;
        }

        .stat__delta {
          font-size: 11px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: var(--r-full, 9999px);
          font-variant-numeric: tabular-nums;
        }

        .delta--up {
          color: var(--status-online, #22c55e);
          background: rgba(34, 197, 94, 0.12);
        }

        .delta--down {
          color: var(--status-dnd, #ef4444);
          background: rgba(239, 68, 68, 0.12);
        }

        .delta--neutral {
          color: var(--text-muted, #6b7280);
          background: rgba(255, 255, 255, 0.06);
        }

        /* Loading state */
        .stat-card--loading .stat__value,
        .stat-card--loading .stat__label {
          position: relative;
          overflow: hidden;
          background: var(--surface-glass, rgba(255, 255, 255, 0.03));
          border-radius: 4px;
          color: transparent !important;
        }

        .stat-card--loading .stat__value::after,
        .stat-card--loading .stat__label::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.05) 35%, rgba(255, 192, 203, 0.12) 50%, rgba(255, 255, 255, 0.05) 65%, transparent 100%);
          animation: shimmer 1.6s ease-in-out infinite;
        }

        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }

        /* Container query responsiveness */
        @container stat-card (max-width: 220px) {
          .stat__value { font-size: 22px; }
        }
      </style>

      <div class="stat-card ${colorClasses[color] || ''} ${isLoading ? 'stat-card--loading' : ''}">
        <div class="stat__top">
          <div class="stat__icon">
            <i class="fa-solid ${icon}"></i>
          </div>
          ${delta ? `<span class="stat__delta ${deltaClasses[deltaType] || ''}">${delta}</span>` : ''}
        </div>
        <div class="stat__value">${value}</div>
        <div class="stat__label">${label}</div>
      </div>
    `;
  }
}

customElements.define('naura-stat-card', NauraStatCard);

export { NauraStatCard };

/**
 * naura-card.js - Reusable Card Web Component
 * 
 * Usage:
 *   <naura-card variant="solid" padding="comfortable">
 *     <span slot="header">Card Title</span>
 *     <p>Card content goes here</p>
 *     <span slot="footer">Footer content</span>
 *   </naura-card>
 * 
 * Variants: solid, glass, elevated
 * Padding: compact, comfortable, spacious
 */

class NauraCard extends HTMLElement {
  static get observedAttributes() {
    return ['variant', 'padding', 'hoverable', 'clickable'];
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
    const variant = this.getAttribute('variant') || 'solid';
    const padding = this.getAttribute('padding') || 'comfortable';
    const hoverable = this.hasAttribute('hoverable');
    const clickable = this.hasAttribute('clickable');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          container-type: inline-size;
          container-name: card;
        }

        .card {
          background: var(--bg-surface, rgba(255, 255, 255, 0.04));
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.07));
          border-radius: var(--r-xl, 18px);
          backdrop-filter: var(--blur-md, blur(16px));
          -webkit-backdrop-filter: var(--blur-md, blur(16px));
          position: relative;
          overflow: hidden;
          box-shadow: var(--glass-specular, inset 0 1px 0 0 rgba(255, 255, 255, 0.08)), 0 8px 24px rgba(6, 8, 16, 0.35);
          transition: transform var(--t-base, 200ms) var(--ease-spring, cubic-bezier(0.16, 1, 0.3, 1)), 
                      border-color var(--t-base, 200ms ease), 
                      box-shadow var(--t-base, 200ms ease);
        }

        /* Variants */
        .card--solid {
          background: var(--bg-layer, #12151f);
        }

        .card--glass {
          background: var(--surface-glass, rgba(255, 255, 255, 0.03));
        }

        .card--elevated {
          background: var(--bg-layer-elevated, #171b26);
          box-shadow: var(--glass-specular-strong, inset 0 1px 0 0 rgba(255, 255, 255, 0.14)), 0 14px 36px rgba(6, 8, 16, 0.45);
        }

        /* Padding */
        .card--compact { padding: 12px; }
        .card--comfortable { padding: 20px; }
        .card--spacious { padding: 28px; }

        /* Hover effects */
        .card--hoverable:hover,
        .card--clickable:hover {
          border-color: var(--border-medium, rgba(255, 255, 255, 0.14));
          transform: translateY(-2px);
          box-shadow: var(--glass-specular-strong, inset 0 1px 0 0 rgba(255, 255, 255, 0.14)), 0 14px 36px rgba(6, 8, 16, 0.45);
        }

        .card--clickable {
          cursor: pointer;
        }

        .card--clickable:active {
          transform: scale(0.98);
        }

        /* Focus visible */
        .card:focus-visible {
          outline: none;
          box-shadow: var(--focus-ring), 0 14px 36px rgba(6, 8, 16, 0.45);
        }

        /* Header */
        .card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--sp-card-gap, 16px);
          gap: 12px;
        }

        ::slotted([slot="header"]) {
          font-family: var(--font-heading, 'Outfit', sans-serif);
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary, #f1f5f9);
          display: flex;
          align-items: center;
          gap: 8px;
          text-wrap: balance;
        }

        /* Body */
        .card__body {
          position: relative;
          z-index: 1;
        }

        /* Footer */
        .card__footer {
          margin-top: var(--sp-card-gap, 16px);
          padding-top: 12px;
          border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.07));
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-secondary, #94a3b8);
        }

        /* Container query responsiveness */
        @container card (max-width: 340px) {
          .card__header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
      </style>

      <div class="card card--${variant} card--${padding} ${hoverable ? 'card--hoverable' : ''} ${clickable ? 'card--clickable' : ''}" 
           tabindex="${clickable ? '0' : '-1'}"
           role="${clickable ? 'button' : 'article'}">
        <div class="card__header">
          <slot name="header"></slot>
        </div>
        <div class="card__body">
          <slot></slot>
        </div>
        <div class="card__footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;

    // Add click handler for clickable cards
    if (clickable) {
      const card = this.shadowRoot.querySelector('.card');
      card.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true }));
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true }));
        }
      });
    }
  }
}

customElements.define('naura-card', NauraCard);

export { NauraCard };

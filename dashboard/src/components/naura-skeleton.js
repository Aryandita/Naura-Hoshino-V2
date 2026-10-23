/**
 * naura-skeleton.js - Reusable Skeleton Loading Web Component
 * 
 * Usage:
 *   <naura-skeleton type="card" count="3"></naura-skeleton>
 *   <naura-skeleton type="stat" count="4"></naura-skeleton>
 *   <naura-skeleton type="table" count="5"></naura-skeleton>
 *   <naura-skeleton type="text" width="80%"></naura-skeleton>
 *   <naura-skeleton type="circle" size="48px"></naura-skeleton>
 * 
 * Types: card, stat, table, feed, text, circle, avatar
 */

class NauraSkeleton extends HTMLElement {
  static get observedAttributes() {
    return ['type', 'count', 'width', 'height', 'size'];
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
    const type = this.getAttribute('type') || 'card';
    const count = parseInt(this.getAttribute('count') || '1', 10);
    const width = this.getAttribute('width') || '';
    const size = this.getAttribute('size') || '';

    let skeletonHtml = '';

    switch (type) {
      case 'card':
        skeletonHtml = this.renderCardSkeleton(count);
        break;
      case 'stat':
        skeletonHtml = this.renderStatSkeleton(count);
        break;
      case 'table':
        skeletonHtml = this.renderTableSkeleton(count);
        break;
      case 'feed':
        skeletonHtml = this.renderFeedSkeleton(count);
        break;
      case 'text':
        skeletonHtml = this.renderTextSkeleton(width);
        break;
      case 'circle':
      case 'avatar':
        skeletonHtml = this.renderCircleSkeleton(size);
        break;
      default:
        skeletonHtml = this.renderCardSkeleton(count);
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .skeleton-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .skeleton-container--grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        /* Base skeleton box */
        .skeleton-box {
          background: var(--surface-glass, rgba(255, 255, 255, 0.03));
          border: 1px solid var(--hairline, rgba(255, 192, 203, 0.15));
          border-radius: var(--r-md, 10px);
          position: relative;
          overflow: hidden;
        }

        .skeleton-box::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg, 
            transparent 0%, 
            rgba(255, 255, 255, 0.05) 35%, 
            rgba(255, 192, 203, 0.12) 50%, 
            rgba(255, 255, 255, 0.05) 65%, 
            transparent 100%
          );
          animation: shimmer 1.6s ease-in-out infinite;
        }

        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }

        /* Card skeleton */
        .skeleton-card {
          padding: 20px;
          border-radius: var(--r-xl, 18px);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .skeleton-card__header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .skeleton-card__icon {
          width: 36px;
          height: 36px;
          border-radius: var(--r-md, 10px);
        }

        .skeleton-card__title {
          height: 20px;
          width: 60%;
        }

        .skeleton-card__line {
          height: 14px;
          width: 100%;
        }

        .skeleton-card__line--short {
          width: 70%;
        }

        /* Stat skeleton */
        .skeleton-stat {
          padding: 20px;
          border-radius: var(--r-xl, 18px);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .skeleton-stat__top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .skeleton-stat__icon {
          width: 36px;
          height: 36px;
          border-radius: var(--r-md, 10px);
        }

        .skeleton-stat__badge {
          width: 48px;
          height: 18px;
          border-radius: var(--r-full, 9999px);
        }

        .skeleton-stat__value {
          height: 28px;
          width: 70%;
          margin-top: 8px;
        }

        .skeleton-stat__label {
          height: 14px;
          width: 40%;
        }

        /* Table skeleton */
        .skeleton-table-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--r-md, 10px);
        }

        .skeleton-table__avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .skeleton-table__content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .skeleton-table__name {
          height: 14px;
          width: 50%;
        }

        .skeleton-table__sub {
          height: 12px;
          width: 30%;
        }

        .skeleton-table__action {
          width: 60px;
          height: 20px;
          border-radius: var(--r-sm, 6px);
        }

        /* Feed skeleton */
        .skeleton-feed-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 10px;
        }

        .skeleton-feed__avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .skeleton-feed__content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .skeleton-feed__text {
          height: 14px;
          width: 65%;
        }

        .skeleton-feed__time {
          height: 12px;
          width: 40%;
        }

        .skeleton-feed__meta {
          width: 50px;
          height: 12px;
          border-radius: var(--r-sm, 6px);
        }

        /* Text skeleton */
        .skeleton-text {
          height: 14px;
          border-radius: var(--r-sm, 6px);
        }

        /* Circle skeleton */
        .skeleton-circle {
          border-radius: 50%;
        }

        /* Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .skeleton-box::after {
            animation: none;
          }
        }
      </style>

      <div class="skeleton-container ${type === 'stat' ? 'skeleton-container--grid' : ''}">
        ${skeletonHtml}
      </div>
    `;
  }

  renderCardSkeleton(count) {
    return Array.from({ length: count }).map(() => `
      <div class="skeleton-box skeleton-card">
        <div class="skeleton-card__header">
          <div class="skeleton-box skeleton-card__icon"></div>
          <div class="skeleton-box skeleton-card__title"></div>
        </div>
        <div class="skeleton-box skeleton-card__line"></div>
        <div class="skeleton-box skeleton-card__line skeleton-card__line--short"></div>
      </div>
    `).join('');
  }

  renderStatSkeleton(count) {
    return Array.from({ length: count }).map(() => `
      <div class="skeleton-box skeleton-stat">
        <div class="skeleton-stat__top">
          <div class="skeleton-box skeleton-stat__icon"></div>
          <div class="skeleton-box skeleton-stat__badge"></div>
        </div>
        <div class="skeleton-box skeleton-stat__value"></div>
        <div class="skeleton-box skeleton-stat__label"></div>
      </div>
    `).join('');
  }

  renderTableSkeleton(count) {
    return Array.from({ length: count }).map(() => `
      <div class="skeleton-box skeleton-table-row">
        <div class="skeleton-box skeleton-table__avatar"></div>
        <div class="skeleton-table__content">
          <div class="skeleton-box skeleton-table__name"></div>
          <div class="skeleton-box skeleton-table__sub"></div>
        </div>
        <div class="skeleton-box skeleton-table__action"></div>
      </div>
    `).join('');
  }

  renderFeedSkeleton(count) {
    return Array.from({ length: count }).map(() => `
      <div class="skeleton-box skeleton-feed-item">
        <div class="skeleton-box skeleton-feed__avatar"></div>
        <div class="skeleton-feed__content">
          <div class="skeleton-box skeleton-feed__text"></div>
          <div class="skeleton-box skeleton-feed__time"></div>
        </div>
        <div class="skeleton-box skeleton-feed__meta"></div>
      </div>
    `).join('');
  }

  renderTextSkeleton(width) {
    const style = width ? `width: ${width};` : 'width: 80%;';
    return `<div class="skeleton-box skeleton-text" style="${style}"></div>`;
  }

  renderCircleSkeleton(size) {
    const dimension = size || '48px';
    return `<div class="skeleton-box skeleton-circle" style="width: ${dimension}; height: ${dimension};"></div>`;
  }
}

customElements.define('naura-skeleton', NauraSkeleton);

export { NauraSkeleton };

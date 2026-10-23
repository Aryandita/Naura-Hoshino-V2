/**
 * Unit Tests for NauraCard Component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NauraCard } from '../src/components/naura-card.js';

describe('NauraCard', () => {
  beforeEach(() => {
    // Clean up any existing elements
    document.body.innerHTML = '';
  });

  it('should register as custom element', () => {
    expect(customElements.get('naura-card')).toBe(NauraCard);
  });

  it('should render with default attributes', () => {
    const card = document.createElement('naura-card');
    document.body.appendChild(card);

    const shadowRoot = card.shadowRoot;
    expect(shadowRoot).toBeTruthy();
    
    const cardDiv = shadowRoot.querySelector('.card');
    expect(cardDiv).toBeTruthy();
    expect(cardDiv.classList.contains('card--solid')).toBe(true);
    expect(cardDiv.classList.contains('card--comfortable')).toBe(true);
  });

  it('should apply variant attribute', () => {
    const card = document.createElement('naura-card');
    card.setAttribute('variant', 'glass');
    document.body.appendChild(card);

    const cardDiv = card.shadowRoot.querySelector('.card');
    expect(cardDiv.classList.contains('card--glass')).toBe(true);
  });

  it('should apply padding attribute', () => {
    const card = document.createElement('naura-card');
    card.setAttribute('padding', 'compact');
    document.body.appendChild(card);

    const cardDiv = card.shadowRoot.querySelector('.card');
    expect(cardDiv.classList.contains('card--compact')).toBe(true);
  });

  it('should apply hoverable class when attribute present', () => {
    const card = document.createElement('naura-card');
    card.setAttribute('hoverable', '');
    document.body.appendChild(card);

    const cardDiv = card.shadowRoot.querySelector('.card');
    expect(cardDiv.classList.contains('card--hoverable')).toBe(true);
  });

  it('should be clickable when clickable attribute present', () => {
    const card = document.createElement('naura-card');
    card.setAttribute('clickable', '');
    document.body.appendChild(card);

    const cardDiv = card.shadowRoot.querySelector('.card');
    expect(cardDiv.classList.contains('card--clickable')).toBe(true);
    expect(cardDiv.getAttribute('role')).toBe('button');
    expect(cardDiv.getAttribute('tabindex')).toBe('0');
  });

  it('should dispatch card-click event when clicked', async () => {
    const card = document.createElement('naura-card');
    card.setAttribute('clickable', '');
    document.body.appendChild(card);

    let eventFired = false;
    card.addEventListener('card-click', () => {
      eventFired = true;
    });

    const cardDiv = card.shadowRoot.querySelector('.card');
    cardDiv.click();

    expect(eventFired).toBe(true);
  });

  it('should render header slot', () => {
    const card = document.createElement('naura-card');
    const header = document.createElement('span');
    header.slot = 'header';
    header.textContent = 'Test Header';
    card.appendChild(header);
    document.body.appendChild(card);

    const slot = card.shadowRoot.querySelector('slot[name="header"]');
    expect(slot).toBeTruthy();
  });

  it('should render footer slot', () => {
    const card = document.createElement('naura-card');
    const footer = document.createElement('span');
    footer.slot = 'footer';
    footer.textContent = 'Test Footer';
    card.appendChild(footer);
    document.body.appendChild(card);

    const slot = card.shadowRoot.querySelector('slot[name="footer"]');
    expect(slot).toBeTruthy();
  });

  it('should update when attributes change', async () => {
    const card = document.createElement('naura-card');
    document.body.appendChild(card);

    let cardDiv = card.shadowRoot.querySelector('.card');
    expect(cardDiv.classList.contains('card--solid')).toBe(true);

    card.setAttribute('variant', 'elevated');
    
    // Wait for attributeChangedCallback
    await new Promise(resolve => setTimeout(resolve, 0));
    
    cardDiv = card.shadowRoot.querySelector('.card');
    expect(cardDiv.classList.contains('card--elevated')).toBe(true);
  });
});

/**
 * aiTierBadge.js - Dynamic AI Tiering Status Badge Manager
 *
 * Renders and synchronizes the active AI engine tier badge across the Naura OS Web Dashboard:
 * - Free Tier: "🟢 OpenRouter Engine (Free Tier)" (.ai-tier-badge--free)
 * - VIP Premium: "💎 Ultra Fast Groq / Gemini (VIP Premium)" (.ai-tier-badge--vip)
 *
 * Adheres strictly to the zero em-dash policy and WCAG contrast guidelines.
 */

/**
 * Evaluates whether a session represents a VIP Premium user.
 * @param {Object|null} session
 * @returns {boolean}
 */
export function isVipSession(session) {
  if (!session) return false;
  if (session.isOwner || session.isPremium) return true;

  const roleOrTier = String(
    session.premiumTier ||
    session.premium_tier ||
    session.role ||
    session.roleTag ||
    ''
  ).toLowerCase();

  return [
    'tier1',
    'tier2',
    'tier3',
    'vip',
    'premium',
    'owner',
    'administrator',
    'booster'
  ].includes(roleOrTier);
}

/**
 * Renders a reactive AI Tiering status badge into the given element or selector.
 * @param {HTMLElement|string} target - Target DOM element or CSS selector
 * @param {Object|null} [customSession] - Optional pre-resolved session object
 * @returns {Promise<boolean>} Resolves true if VIP tier was applied, false if Free tier
 */
export async function syncAiTierBadge(target, customSession = null) {
  const targetElement = typeof target === 'string' ? document.querySelector(target) : target;
  if (!targetElement) return false;

  let session = customSession;

  // 1. Check cached session in sessionStorage
  if (!session) {
    try {
      const stored = sessionStorage.getItem('naura_auth_session');
      if (stored) {
        session = JSON.parse(stored);
      }
    } catch (_) {}
  }

  // 2. Fallback to /api/me if session is not cached
  if (!session) {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.loggedIn) {
          session = {
            isOwner: Boolean(data.isOwner),
            isPremium: Boolean(data.db?.isPremium),
            premiumTier: data.db?.premium_tier || 'free',
            username: data.user?.username || 'User',
          };
        }
      }
    } catch (_) {}
  }

  const isVip = isVipSession(session);

  if (isVip) {
    targetElement.className = 'ai-tier-badge ai-tier-badge--vip';
    targetElement.innerHTML = `💎 Ultra Fast Groq / Gemini (VIP Premium)`;
    targetElement.setAttribute('title', 'Jalur prioritas VIP: Respons kilat Gemini 2.5 Flash & Groq');
  } else {
    targetElement.className = 'ai-tier-badge ai-tier-badge--free';
    targetElement.innerHTML = `🟢 OpenRouter Engine (Free Tier)`;
    targetElement.setAttribute('title', 'Jalur standard: Didukung OpenRouter Cascade LLaMA 3.3 70B');
  }

  return isVip;
}

// Global browser window export for non-ESM contexts
if (typeof window !== 'undefined') {
  window.syncAiTierBadge = syncAiTierBadge;
  window.isVipSession = isVipSession;
}

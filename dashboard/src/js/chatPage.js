/**
 * chatPage.js - Companion Script for Dedicated AI Chat Terminal
 *
 * Coordinates dynamic AI Tiering status badge synchronization and interactive
 * communication with the Naura Hoshino AI Ensemble via /api/ai/companion/chat.
 */

import { syncAiTierBadge } from './aiTierBadge.js';

(function () {
  'use strict';

  const chatStreamBox = document.getElementById('chatStreamBox');
  const chatInput = document.getElementById('chatInput');
  const btnSendChat = document.getElementById('btnSendChat');
  const chatChipsBar = document.getElementById('chatChipsBar');
  const chatEngineStatus = document.getElementById('chatEngineStatus');
  const chatMascotAvatar = document.getElementById('chatMascotAvatar');
  const aiTierBadge = document.getElementById('aiTierBadge');
  const chatHeaderTierSlot = document.getElementById('chatHeaderTierSlot');

  const chatHistory = [];
  let isSending = false;

  /**
   * Refresh tier badges across header and inline card
   */
  async function refreshTierBadges(customSession = null) {
    if (aiTierBadge) {
      await syncAiTierBadge(aiTierBadge, customSession);
    }
    if (chatHeaderTierSlot) {
      await syncAiTierBadge(chatHeaderTierSlot, customSession);
    }
  }

  /**
   * Updates mascot mood image
   * @param {string} mood
   * @param {string} [statusText]
   */
  function setMascotMood(mood, statusText) {
    const validMoods = ['Happy', 'Cheers', 'Thinking', 'Shy', 'Sleepy', 'Angry', 'Blow kiss'];
    const selected = validMoods.includes(mood) ? mood : 'Happy';
    const src = `/assets/Naura_Expression/${selected}.png`;

    if (chatMascotAvatar) {
      chatMascotAvatar.src = src;
    }
    if (chatEngineStatus && statusText) {
      chatEngineStatus.textContent = statusText;
    }
  }

  /**
   * Append message bubble into chat stream
   * @param {'bot'|'user'} sender
   * @param {string} text
   * @param {string} [metaInfo]
   */
  function appendMessage(sender, text, metaInfo = '') {
    if (!chatStreamBox) return;

    const row = document.createElement('div');
    row.className = `chat-message-row is-${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-message-bubble';
    bubble.textContent = text;

    const meta = document.createElement('div');
    meta.className = 'chat-message-meta';
    if (sender === 'bot') {
      meta.innerHTML = `<i class="fa-solid fa-robot"></i> ${metaInfo || 'Naura AI · Sekarang'}`;
    } else {
      meta.innerHTML = `<i class="fa-solid fa-user"></i> Kamu · Sekarang`;
    }

    row.appendChild(bubble);
    row.appendChild(meta);
    chatStreamBox.appendChild(row);
    chatStreamBox.scrollTop = chatStreamBox.scrollHeight;
  }

  /**
   * Append temporary typing indicator
   * @returns {HTMLElement}
   */
  function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'chat-message-row is-bot';
    row.id = 'chatTypingIndicator';

    const bubble = document.createElement('div');
    bubble.className = 'chat-message-bubble';
    bubble.style.display = 'inline-flex';
    bubble.style.alignItems = 'center';
    bubble.style.gap = '6px';
    bubble.innerHTML = `
      <i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i>
      <span style="font-size:12px;color:var(--text-muted);">Naura sedang berpikir...</span>
    `;

    row.appendChild(bubble);
    chatStreamBox.appendChild(row);
    chatStreamBox.scrollTop = chatStreamBox.scrollHeight;
    return row;
  }

  /**
   * Remove typing indicator
   */
  function removeTypingIndicator() {
    const indicator = document.getElementById('chatTypingIndicator');
    if (indicator) {
      indicator.remove();
    }
  }

  /**
   * Send chat message to backend
   * @param {string} [customText]
   */
  async function sendMessage(customText) {
    if (isSending) return;

    const text = customText || (chatInput ? chatInput.value.trim() : '');
    if (!text) return;

    if (chatInput && !customText) {
      chatInput.value = '';
    }

    appendMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    isSending = true;
    if (btnSendChat) btnSendChat.disabled = true;

    setMascotMood('Thinking', 'Sedang memproses jawaban lewat AI Ensemble...');
    const typingIndicator = showTypingIndicator();

    try {
      const res = await fetch('/api/ai/companion/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatHistory.slice(-8),
          context: { path: '/chat', surface: 'chat_terminal' },
        }),
      });

      removeTypingIndicator();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data && data.success) {
        const replyText = data.reply || 'Halo! Naura siap mendampingimu.';
        const providerMeta = data.provider
          ? `Engine: ${data.provider.toUpperCase()} (${data.tier || 'Standard'})`
          : 'Naura AI Ensemble';

        setMascotMood(data.mood || 'Happy', data.status || 'Aktif Menemani 🌸✨');
        appendMessage('bot', replyText, providerMeta);
        chatHistory.push({ role: 'model', content: replyText });

        // If backend returned tier info, refresh badge
        if (data.tier) {
          refreshTierBadges({
            premiumTier: data.tier,
            isPremium: data.tier === 'vip' || data.tier === 'premium',
          });
        }
      } else {
        setMascotMood('Shy', 'Sedikit kendala jaringan');
        appendMessage(
          'bot',
          'Wah, sepertinya Naura tersendat saat memproses jawaban. Boleh coba tanyakan sekali lagi ya Sensei? 🌸',
          'Sistem AI'
        );
      }
    } catch (err) {
      removeTypingIndicator();
      setMascotMood('Sleepy', 'Koneksi sementara offline');
      appendMessage(
        'bot',
        'Koneksi ke AI gateway sedang beristirahat. Tenang, kamu bisa mengulang beberapa saat lagi! ⚡',
        'Offline Fallback'
      );
    } finally {
      isSending = false;
      if (btnSendChat) btnSendChat.disabled = false;
      if (chatInput) chatInput.focus();
    }
  }

  // Event Listeners
  if (btnSendChat) {
    btnSendChat.addEventListener('click', () => sendMessage());
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Quick Chips Click Handling
  if (chatChipsBar) {
    chatChipsBar.querySelectorAll('.chat-prompt-chip[data-prompt]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          sendMessage(prompt);
        }
      });
    });
  }

  // Synchronize on load and on auth updates
  window.addEventListener('DOMContentLoaded', () => refreshTierBadges());
  window.addEventListener('storage', (e) => {
    if (e.key === 'naura_auth_session') {
      refreshTierBadges();
    }
  });

  // Immediate init
  refreshTierBadges();
})();

/**
 * arcade.js - Logic Halaman Mini-Game Retro Arcade Naura OS Mobile.
 *
 * Mengoperasikan mini-game "Cyber Star Catcher" berbasis touch canvas,
 * menangani penukaran skor menjadi Star Fragments secara aman via /api/arcade/claim,
 * dan memuat papan peringkat arcade live dari /api/arcade/leaderboard.
 */

import { initBottomNav } from "../components/bottomNav.js";
import { applyTheme, loadTheme } from "../core/theme.js";
import { apiFetch, apiPost } from "../core/api.js";
import { toast } from "../components/toaster.js";

let score = 0;
let timeLeft = 30;
let timerId = null;
let animId = null;
let isPlaying = false;

// Game State
let canvas, ctx;
const paddle = { x: 100, y: 240, width: 60, height: 12 };
let stars = [];

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(loadTheme());
  initBottomNav();
  _initCanvas();
  _setupControls();
  await loadArcadeLeaderboard();
});

function _initCanvas() {
  canvas = document.getElementById("arcade-canvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");

  // Resize canvas to match display size
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  paddle.y = canvas.height - 20;
  paddle.x = (canvas.width - paddle.width) / 2;

  // Touch listener
  const updatePaddlePos = (clientX) => {
    if (!isPlaying) return;
    const cRect = canvas.getBoundingClientRect();
    const relX = clientX - cRect.left;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, relX - paddle.width / 2));
  };

  canvas.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches[0]) {
      updatePaddlePos(e.touches[0].clientX);
    }
  }, { passive: true });

  canvas.addEventListener("mousemove", (e) => {
    updatePaddlePos(e.clientX);
  });
}

function _setupControls() {
  const startBtn = document.getElementById("btn-start-game");
  const claimBtn = document.getElementById("btn-claim-reward");

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      startGame();
    });
  }

  if (claimBtn) {
    claimBtn.addEventListener("click", async () => {
      if (score <= 0) return;
      claimBtn.disabled = true;
      claimBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menukarkan...';

      const { data, error } = await apiPost("/api/arcade/claim", { score });
      claimBtn.innerHTML = '<i class="fa-solid fa-gift"></i> Tukar Hadiah NSF';

      if (error) {
        toast({
          title: "Klaim Gagal",
          body: error,
          variant: "danger",
        });
        return;
      }

      toast({
        title: "Hadiah Diterima! ⭐",
        body: data.message || `+${data.reward} Star Fragments ditambahkan ke petualanganmu!`,
        variant: "success",
      });

      score = 0;
      const scoreEl = document.getElementById("game-score");
      if (scoreEl) scoreEl.textContent = "0";
      await loadArcadeLeaderboard();
    });
  }
}

function startGame() {
  const overlay = document.getElementById("game-overlay");
  const scoreEl = document.getElementById("game-score");
  const timerEl = document.getElementById("game-timer");
  const claimBtn = document.getElementById("btn-claim-reward");

  if (overlay) overlay.classList.add("is-hidden");
  if (claimBtn) claimBtn.disabled = true;

  score = 0;
  timeLeft = 30;
  stars = [];
  isPlaying = true;

  if (scoreEl) scoreEl.textContent = "0";
  if (timerEl) timerEl.textContent = `${timeLeft}s`;

  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    timeLeft--;
    if (timerEl) timerEl.textContent = `${timeLeft}s`;

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);

  if (animId) cancelAnimationFrame(animId);
  _gameLoop();
}

function endGame() {
  isPlaying = false;
  clearInterval(timerId);
  cancelAnimationFrame(animId);

  const overlay = document.getElementById("game-overlay");
  const claimBtn = document.getElementById("btn-claim-reward");

  if (overlay) {
    overlay.classList.remove("is-hidden");
    const title = overlay.querySelector("h3");
    if (title) title.textContent = `Waktu Habis! Skor: ${score}`;
  }

  if (claimBtn && score > 0) {
    claimBtn.disabled = false;
    claimBtn.classList.remove("nm-btn--glass");
    claimBtn.classList.add("nm-btn--primary");
  }
}

function _gameLoop() {
  if (!isPlaying) return;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Spawn star randomly
  if (Math.random() < 0.08) {
    stars.push({
      x: Math.random() * (canvas.width - 16) + 8,
      y: 0,
      radius: Math.random() * 4 + 4,
      speed: Math.random() * 2 + 2.5,
      color: Math.random() > 0.3 ? "#FFD700" : "#F43F5E",
    });
  }

  // Draw paddle
  ctx.fillStyle = "#F43F5E";
  ctx.shadowColor = "#F43F5E";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Update & Draw stars
  for (let i = stars.length - 1; i >= 0; i--) {
    const s = stars[i];
    s.y += s.speed;

    // Draw
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Hit detection
    if (
      s.y + s.radius >= paddle.y &&
      s.y - s.radius <= paddle.y + paddle.height &&
      s.x >= paddle.x &&
      s.x <= paddle.x + paddle.width
    ) {
      score += 50;
      const scoreEl = document.getElementById("game-score");
      if (scoreEl) scoreEl.textContent = score.toLocaleString("id-ID");
      stars.splice(i, 1);
      continue;
    }

    // Out of bounds
    if (s.y > canvas.height + 10) {
      stars.splice(i, 1);
    }
  }

  animId = requestAnimationFrame(_gameLoop);
}

async function loadArcadeLeaderboard() {
  const container = document.getElementById("arcade-leaderboard-list");
  if (!container) return;

  const { data } = await apiFetch("/api/arcade/leaderboard");
  if (!data || !Array.isArray(data.leaderboard)) {
    container.innerHTML = `
      <div style="text-align:center; padding:var(--sp-sm); color:var(--muted); font-size:0.8rem">
        Belum ada catatan skor arcade.
      </div>
    `;
    return;
  }

  container.innerHTML = data.leaderboard.map((u, idx) => `
    <div class="nm-card" style="display:flex; align-items:center; justify-content:space-between; padding:var(--sp-xs) var(--sp-sm); background:rgba(255,255,255,0.02)">
      <div style="display:flex; align-items:center; gap:var(--sp-xs)">
        <span style="font-size:0.875rem; font-weight:700; width:20px; color:${idx === 0 ? "var(--accent-gold)" : idx === 1 ? "#94a3b8" : "var(--muted)"}">
          #${u.rank || idx + 1}
        </span>
        <span style="font-size:0.8125rem; font-weight:600; color:var(--ink)">
          ${u.name}
        </span>
      </div>
      <span style="font-size:0.8125rem; font-weight:700; font-family:var(--font-mono); color:var(--accent-pink)">
        ${(u.highScore || 0).toLocaleString("id-ID")} Pts
      </span>
    </div>
  `).join("");
}

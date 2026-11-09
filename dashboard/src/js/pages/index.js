/**
 * Index Page - Dashboard Home
 * Real-time telemetry, charts, leaderboard, music player, survival vitals
 */

class IndexPage {
  constructor() {
    this.socket = null;
    this.telemetryChart = null;
    this.commandChart = null;
    this.init();
  }

  init() {
    this.connectSocket();
    this.initCharts();
    this.loadInitialData();
    this.startPeriodicUpdates();
  }

  connectSocket() {
    this.socket = io('/dashboard', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[Index] Socket connected');
      this.socket.emit('subscribe', { rooms: ['telemetry', 'leaderboard', 'music', 'survival'] });
    });

    this.socket.on('telemetry', (data) => this.updateTelemetry(data));
    this.socket.on('leaderboard:top5', (data) => this.updateLeaderboard(data));
    this.socket.on('music:state', (data) => this.updateMusicPlayer(data));
    this.socket.on('survival:vitals', (data) => this.updateVitals(data));
    this.socket.on('disconnect', () => console.log('[Index] Socket disconnected'));
  }

  initCharts() {
    // Telemetry Line Chart
    const telemetryCtx = document.getElementById('telemetryChart');
    if (telemetryCtx) {
      this.telemetryChart = new Chart(telemetryCtx, {
        type: 'line',
        data: {
          labels: Array(30).fill(''),
          datasets: [
            {
              label: 'Ping (ms)',
              data: Array(30).fill(0),
              borderColor: '#f472b6',
              backgroundColor: 'rgba(244,114,182,0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              yAxisID: 'y',
            },
            {
              label: 'RAM (MB)',
              data: Array(30).fill(0),
              borderColor: '#22d3ee',
              backgroundColor: 'rgba(34,211,238,0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
            y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#94a3b8' } },
          },
        },
      });
    }

    // Command Distribution Doughnut
    const commandCtx = document.getElementById('homeCommandChart');
    if (commandCtx) {
      this.commandChart = new Chart(commandCtx, {
        type: 'doughnut',
        data: {
          labels: ['Music', 'AI', 'RPG', 'Admin', 'Utility'],
          datasets: [{
            data: [24, 20, 18, 15, 23],
            backgroundColor: ['#f472b6', '#8a2be2', '#34d399', '#a855f7', '#60a5fa'],
            borderWidth: 0,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: { legend: { display: false } },
        },
      });
    }
  }

  updateTelemetry(data) {
    const pingEl = document.getElementById('statPing');
    const uptimeEl = document.getElementById('statUptime');
    const usersEl = document.getElementById('statUsers');
    const serversEl = document.getElementById('statServers');

    if (pingEl) pingEl.textContent = data.ping || 0;
    if (uptimeEl) uptimeEl.textContent = this.formatUptime(data.uptime || 0);
    if (usersEl) usersEl.textContent = data.users?.toLocaleString() || 0;
    if (serversEl) serversEl.textContent = data.guilds || 0;

    // Update trend indicators
    this.updateTrend('pingTrend', data.pingTrend);
    this.updateTrend('uptimeTrend', data.uptimeTrend);
    this.updateTrend('usersTrend', data.usersTrend);
    this.updateTrend('guildsTrend', data.guildsTrend);

    // Update chart
    if (this.telemetryChart && data.history) {
      this.telemetryChart.data.labels = data.history.labels;
      this.telemetryChart.data.datasets[0].data = data.history.ping;
      this.telemetryChart.data.datasets[1].data = data.history.ram;
      this.telemetryChart.update('none');
    }
  }

  updateTrend(id, trend) {
    const el = document.getElementById(id);
    if (!el) return;
    if (trend > 0) {
      el.className = 'stat-trend positive';
      el.innerHTML = `<i class="fa-solid fa-arrow-up" style="font-size:0.7em;"></i> +${trend}%`;
    } else if (trend < 0) {
      el.className = 'stat-trend negative';
      el.innerHTML = `<i class="fa-solid fa-arrow-down" style="font-size:0.7em;"></i> ${trend}%`;
    } else {
      el.className = 'stat-trend neutral';
      el.innerHTML = `<i class="fa-solid fa-minus" style="font-size:0.7em;"></i> 0%`;
    }
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}j ${hours}j`;
    if (hours > 0) return `${hours}j ${mins}m`;
    return `${mins}m`;
  }

  updateLeaderboard(data) {
    const container = document.getElementById('homeTopLeaderboard');
    if (!container || !data?.length) return;

    container.innerHTML = data.slice(0, 5).map((user, i) => `
      <div class="card" style="padding:var(--space-3); display:flex; align-items:center; gap:var(--space-3); background:${i === 0 ? 'linear-gradient(135deg, var(--bg-layer) 0%, rgba(255,215,0,0.08) 100%)' : 'var(--bg-layer)'}; border-color:${i === 0 ? 'rgba(255,215,0,0.3)' : 'var(--hairline)'};">
        <div style="width:32px; height:32px; border-radius:var(--radius-full); background:${i === 0 ? 'rgba(255,215,0,0.2)' : i === 1 ? 'rgba(192,192,192,0.15)' : 'rgba(205,127,50,0.15)'}; color:${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32'}; display:flex; align-items:center; justify-content:center; font-weight:700; font-family:var(--font-mono); font-size:var(--text-sm); flex-shrink:0;">${i + 1}</div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(user.username)}</div>
          <div style="font-size:var(--text-xs); color:var(--text-muted);">Level ${user.level} · ${user.nc?.toLocaleString()} NC</div>
        </div>
        <div style="font-family:var(--font-mono); font-size:var(--text-sm); color:var(--color-warning); font-weight:700;">${user.nc?.toLocaleString() || 0} NC</div>
      </div>
    `).join('');
  }

  updateMusicPlayer(data) {
    const titleEl = document.getElementById('nowPlayingTitle');
    const artistEl = document.getElementById('nowPlayingArtist');
    const progressEl = document.getElementById('nowPlayingProgress');
    const currentTimeEl = document.getElementById('nowPlayingCurrentTime');
    const totalTimeEl = document.getElementById('nowPlayingTotalTime');
    const playIcon = document.getElementById('musicPlayIcon');

    if (titleEl) titleEl.textContent = data.title || 'Idle, Tidak Ada Lagu';
    if (artistEl) artistEl.textContent = data.author || 'Queue kosong';
    if (progressEl) progressEl.style.width = `${data.progress || 0}%`;
    if (currentTimeEl) currentTimeEl.textContent = this.formatTime(data.currentTime || 0);
    if (totalTimeEl) totalTimeEl.textContent = this.formatTime(data.totalTime || 0);
    if (playIcon) {
      playIcon.className = data.playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  updateVitals(data) {
    const updateVital = (barId, valId, value) => {
      if (value === undefined) return;
      const bar = document.getElementById(barId);
      const val = document.getElementById(valId);
      const pct = window.NauraVitalPercent ? window.NauraVitalPercent.clampVitalPercent(value) : 100;
      if (bar) bar.style.width = `${pct}%`;
      if (val) val.textContent = `${pct}%`;
    };
    updateVital('vitalHp', 'vitalHpVal', data.hp);
    updateVital('vitalHydration', 'vitalHydrationVal', data.hydration);
    updateVital('vitalSatiation', 'vitalSatiationVal', data.satiation);
    updateVital('vitalEnergy', 'vitalEnergyVal', data.energy);
  }

  loadInitialData() {
    fetch('/api/dashboard/initial')
      .then(r => r.json())
      .then(data => {
        if (data.telemetry) this.updateTelemetry(data.telemetry);
        if (data.leaderboard) this.updateLeaderboard(data.leaderboard);
        if (data.music) this.updateMusicPlayer(data.music);
        if (data.survival) this.updateVitals(data.survival);
      })
      .catch(err => console.warn('[Index] Initial data load failed:', err));
  }

  startPeriodicUpdates() {
    setInterval(() => {
      fetch('/api/dashboard/telemetry')
        .then(r => r.json())
        .then(data => this.updateTelemetry(data))
        .catch(() => {});
    }, 5000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.indexPage = new IndexPage();
});
/**
 * Status Page - Live System Status
 * Real-time service health, incidents, uptime, shard details
 */

class StatusPage {
  constructor() {
    this.socket = null;
    this.uptimeChart = null;
    this.autoRefresh = true;
    this.init();
  }

  init() {
    this.connectSocket();
    this.initCharts();
    this.loadInitialData();
    this.setupEventListeners();
    this.startPeriodicUpdates();
  }

  connectSocket() {
    this.socket = io('/dashboard', {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    this.socket.on('connect', () => {
      this.socket.emit('subscribe', { rooms: ['status', 'incidents', 'shards'] });
    });

    this.socket.on('status:update', (data) => this.updateServices(data));
    this.socket.on('incidents:update', (data) => this.updateIncidents(data));
    this.socket.on('shards:update', (data) => this.updateShards(data));
    this.socket.on('uptime:history', (data) => this.updateUptimeChart(data));
  }

  initCharts() {
    if (typeof Chart === "undefined") return;
    const ctx = document.getElementById('uptimeChart');
    if (ctx) {
      this.uptimeChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: Array(24).fill(''),
          datasets: [{
            label: 'Uptime %',
            data: Array(24).fill(100),
            borderColor: '#34d399',
            backgroundColor: 'rgba(52,211,153,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { min: 90, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          },
        },
      });
    }
  }

  updateUptimeChart(data) {
    if (this.uptimeChart && data) {
      this.uptimeChart.data.labels = data.labels;
      this.uptimeChart.data.datasets[0].data = data.values;
      this.uptimeChart.update('none');
    }
  }

  updateServices(data) {
    const grid = document.getElementById('servicesGrid');
    if (!grid || !data) return;

    const pillarIcons = {
      gateway: 'fa-solid fa-signal',
      database: 'fa-solid fa-database',
      audio: 'fa-solid fa-music',
      ai: 'fa-solid fa-brain',
      wilds: 'fa-solid fa-tree',
      hosting: 'fa-solid fa-server',
    };

    const pillarColors = {
      gateway: 'var(--ui-primary)',
      database: 'var(--color-success)',
      audio: 'var(--ui-primary)',
      ai: 'var(--color-maintenance)',
      wilds: 'var(--color-success)',
      hosting: 'var(--accent-cyan)',
    };

    grid.innerHTML = Object.entries(data).map(([key, service]) => `
      <article class="card service-card ${service.status}" style="cursor:pointer; transition:all var(--spring-gentle);" data-service="${key}">
        <div style="width:48px; height:48px; border-radius:var(--radius-lg); background:${pillarColors[key] || 'var(--ui-primary)'}20; border:1px solid ${pillarColors[key] || 'var(--ui-primary)'}40; display:flex; align-items:center; justify-content:center; color:${pillarColors[key] || 'var(--ui-primary)'}; font-size:1.25rem; flex-shrink:0;">
          <i class="${pillarIcons[key] || 'fa-solid fa-cube'}" aria-hidden="true"></i>
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-2); margin-bottom:var(--space-1);">
            <h4 style="font-family:var(--font-heading); font-size:var(--text-sm); font-weight:600; color:var(--ink);">${this.formatServiceName(key)}</h4>
            <span class="badge ${this.getStatusBadgeClass(service.status)}" style="font-size:var(--text-xs);">${this.formatStatus(service.status)}</span>
          </div>
          <div style="font-size:var(--text-xs); color:var(--text-muted);">${service.description || 'Tidak ada deskripsi'}</div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:var(--space-1); min-width:80px;">
          <div class="uptime-bar" style="width:100%; height:12px;" role="img" aria-label="Uptime 24 jam">
            ${this.renderUptimeTicks(service.uptimeHistory || [])}
          </div>
          <div style="font-size:var(--text-xs); color:var(--text-muted); font-family:var(--font-mono);">${service.latency ? `${service.latency}ms` : '-'}</div>
        </div>
      </article>
    `).join('');

    // Add click handlers for service cards
    grid.querySelectorAll('.service-card').forEach(card => {
      card.addEventListener('click', () => this.showServiceDetail(card.dataset.service));
    });

    // Update global status pill
    this.updateGlobalStatus(data);
  }

  renderUptimeTicks(history) {
    if (!history || !history.length) {
      return '<div class="uptime-tick operational" style="flex:1;" title="No data"></div>'.repeat(20);
    }
    return history.map(h => `
      <div class="uptime-tick ${h.status}" style="flex:1;" title="${h.time}: ${h.status}"></div>
    `).join('');
  }

  formatServiceName(key) {
    const names = {
      gateway: 'Discord Gateway',
      database: 'Polyglot Database',
      audio: 'Audio Cluster',
      ai: 'AI Ensemble',
      wilds: 'Naura Wilds RPG',
      hosting: 'Pterodactyl Hosting',
    };
    return names[key] || key;
  }

  formatStatus(status) {
    const labels = {
      online: 'Operasional',
      degraded: 'Degradasi',
      offline: 'Offline',
      maintenance: 'Pemeliharaan',
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(status) {
    const classes = {
      online: 'badge-success',
      degraded: 'badge-warning',
      offline: 'badge-error',
      maintenance: 'badge-neutral',
    };
    return classes[status] || 'badge-neutral';
  }

  updateGlobalStatus(services) {
    const pill = document.getElementById('globalStatusPill');
    if (!pill) return;

    const allOnline = Object.values(services).every(s => s.status === 'online');
    const anyDegraded = Object.values(services).some(s => s.status === 'degraded');
    const anyOffline = Object.values(services).some(s => s.status === 'offline');

    let html = '';
    if (allOnline) {
      html = `<span class="status-dot online"></span><span style="color:var(--color-success);">All Systems Online</span>`;
    } else if (anyOffline) {
      html = `<span class="status-dot" style="background:var(--color-error);"></span><span style="color:var(--color-error);">Partial Outage</span>`;
    } else if (anyDegraded) {
      html = `<span class="status-dot" style="background:var(--color-warning);"></span><span style="color:var(--color-warning);">Degraded Performance</span>`;
    } else {
      html = `<span class="status-dot" style="background:var(--color-maintenance);"></span><span style="color:var(--color-maintenance);">Maintenance</span>`;
    }
    pill.innerHTML = html;
  }

  updateIncidents(data) {
    const container = document.getElementById('incidentsList');
    if (!container) return;

    if (!data || !data.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6); border:none; background:transparent;">
          <div class="empty-state-icon" style="background:var(--green-dim); border-color:rgba(52,211,153,0.3); color:var(--color-success);">
            <i class="fa-solid fa-check-circle" style="font-size:1.5rem;"></i>
          </div>
          <h3 class="empty-state-title">Tidak Ada Insiden Aktif</h3>
          <p class="empty-state-body">Semua layanan beroperasi normal.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.map(inc => `
      <div style="padding:var(--space-4); border-bottom:1px solid var(--hairline); display:flex; gap:var(--space-3); align-items:flex-start;">
        <div style="width:10px; height:10px; border-radius:var(--radius-full); background:${inc.status === 'resolved' ? 'var(--color-success)' : inc.status === 'investigating' ? 'var(--color-warning)' : 'var(--color-error)'}; margin-top:4px; flex-shrink:0; box-shadow:0 0 8px ${inc.status === 'resolved' ? 'var(--color-success)' : inc.status === 'investigating' ? 'var(--color-warning)' : 'var(--color-error)'};"></div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; font-size:var(--text-sm); color:var(--ink);">${this.escapeHtml(inc.title)}</div>
          <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:2px;">${this.escapeHtml(inc.description)}</div>
          <div style="font-size:10px; font-family:var(--font-mono); color:var(--text-muted); margin-top:4px;">${new Date(inc.startTime).toLocaleString('id-ID')}${inc.endTime ? ' &ndash; ' + new Date(inc.endTime).toLocaleString('id-ID') : ''}</div>
        </div>
        <span style="font-size:10px; padding:2px 8px; border-radius:var(--radius-full); background:${inc.status === 'resolved' ? 'rgba(52,211,153,0.2)' : inc.status === 'investigating' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}; color:${inc.status === 'resolved' ? 'var(--color-success)' : inc.status === 'investigating' ? 'var(--color-warning)' : 'var(--color-error)'}; font-weight:600;">${inc.status}</span>
      </div>
    `).join('');
  }

  updateShards(data) {
    const tbody = document.getElementById('shardTableBody');
    const countEl = document.getElementById('shardCount');
    if (!tbody || !data) return;

    if (countEl) countEl.textContent = `${data.length} Shard`;

    tbody.innerHTML = data.map(shard => `
      <tr style="transition:background var(--duration-fast) var(--ease-out);">
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--text-primary);">#${shard.id}</td>
        <td><span class="badge ${this.getStatusBadgeClass(shard.status)}" style="font-size:var(--text-xs);">${this.formatStatus(shard.status)}</span></td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${shard.ping || 0}ms</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${shard.guilds || 0}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${shard.users || 0}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${shard.voice || 0}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${shard.memory || 0}MB</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${shard.cpu || 0}%</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${this.formatUptime(shard.uptime || 0)}</td>
      </tr>
    `).join('') || '<tr><td colspan="9" style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Tidak ada data shard</td></tr>';
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}j ${hours}j`;
    if (hours > 0) return `${hours}j ${mins}m`;
    return `${mins}m`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  loadInitialData() {
    Promise.all([
      fetch('/api/status/services').then(r => r.json()),
      fetch('/api/status/incidents').then(r => r.json()),
      fetch('/api/status/shards').then(r => r.json()),
      fetch('/api/status/uptime/history').then(r => r.json()),
    ]).then(([services, incidents, shards, uptime]) => {
      this.updateServices(services);
      this.updateIncidents(incidents);
      this.updateShards(shards);
      this.updateUptimeChart(uptime);
    }).catch(err => console.warn('[Status] Initial load failed:', err));
  }

  setupEventListeners() {
    const refreshBtn = document.getElementById('btnRefreshStatus');
    const autoBtn = document.getElementById('btnAutoRefreshToggle');

    refreshBtn?.addEventListener('click', () => this.loadInitialData());
    autoBtn?.addEventListener('click', () => {
      this.autoRefresh = !this.autoRefresh;
      autoBtn.setAttribute('aria-pressed', this.autoRefresh);
      autoBtn.innerHTML = this.autoRefresh
        ? '<i class="fa-solid fa-sync" aria-hidden="true"></i> Auto'
        : '<i class="fa-solid fa-pause" aria-hidden="true"></i> Paused';
    });
  }

  startPeriodicUpdates() {
    setInterval(() => {
      if (this.autoRefresh) this.loadInitialData();
    }, 30000);
  }

  showServiceDetail(serviceKey) {
    // Could open a modal with detailed service info
    NauraOS.showToast({
      title: 'Detail Layanan',
      message: `Detail untuk ${this.formatServiceName(serviceKey)} - Coming soon`,
      type: 'info',
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.statusPage = new StatusPage();
});
/**
 * World Page - Naura Wilds World Map
 * Interactive map, region details, vitals, resources
 */

class WorldPage {
  constructor() {
    this.mapCanvas = null;
    this.mapCtx = null;
    this.regions = {};
    this.selectedRegion = null;
    this.playerPos = { x: 0, y: 0 };
    this.init();
  }

  init() {
    this.setupMapCanvas();
    this.loadRegions();
    this.loadPlayerData();
    this.setupEventListeners();
    this.startPeriodicUpdates();
  }

  setupMapCanvas() {
    this.mapCanvas = document.getElementById('worldMapCanvas');
    if (!this.mapCanvas) return;

    this.mapCtx = this.mapCanvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.mapCanvas.addEventListener('click', (e) => this.onMapClick(e));
    this.mapCanvas.addEventListener('mousemove', (e) => this.onMapHover(e));

    this.renderMap();
  }

  resizeCanvas() {
    if (!this.mapCanvas) return;
    const rect = this.mapCanvas.parentElement.getBoundingClientRect();
    this.mapCanvas.width = rect.width;
    this.mapCanvas.height = rect.height;
    this.renderMap();
  }

  loadRegions() {
    fetch('/api/survival/world/regions')
      .then(r => r.json())
      .then(data => {
        this.regions = data.regions || {};
        this.renderMap();
      })
      .catch(err => console.warn('[World] Failed to load regions:', err));
  }

  loadPlayerData() {
    fetch('/api/survival/player')
      .then(r => r.json())
      .then(data => {
        if (data.vitals) this.updateVitals(data.vitals);
        if (data.position) this.playerPos = data.position;
        if (data.resources) this.updateResources(data.resources);
        this.renderMap();
      })
      .catch(err => console.warn('[World] Failed to load player data:', err));
  }

  updateVitals(vitals) {
    const map = {
      hp: ['worldVitalHp', 'worldVitalHpVal'],
      hydration: ['worldVitalHydration', 'worldVitalHydrationVal'],
      satiation: ['worldVitalSatiation', 'worldVitalSatiationVal'],
      energy: ['worldVitalEnergy', 'worldVitalEnergyVal'],
    };

    Object.entries(vitals).forEach(([key, value]) => {
      const ids = map[key];
      if (ids) {
        const pct = Math.min(100, Math.max(0, value));
        const bar = document.getElementById(ids[0]);
        const val = document.getElementById(ids[1]);
        if (bar) bar.style.width = `${pct}%`;
        if (val) val.textContent = `${pct}%`;
      }
    });
  }

  updateResources(resources) {
    const grid = document.getElementById('worldResourcesGrid');
    if (!grid || !resources) return;

    grid.innerHTML = Object.entries(resources).map(([key, data]) => `
      <article class="stat-card">
        <div class="stat-top">
          <div class="stat-meta">
            <span class="stat-label">${this.formatResourceName(key)}</span>
            <span class="stat-trend positive"><i class="fa-solid fa-gem" style="color:var(--color-success);font-size:0.85em;"></i> Tersedia</span>
          </div>
          <div class="stat-icon" style="background:var(--green-dim); color:var(--color-success);" aria-hidden="true">
            <i class="fa-solid ${this.getResourceIcon(key)}"></i>
          </div>
        </div>
        <div class="stat-value">${data.amount?.toLocaleString() || 0}</div>
        <div class="stat-delta">Rate: ${data.rate || 0}/jam</div>
      </article>
    `).join('');
  }

  formatResourceName(key) {
    const names = {
      wood: 'Kayu',
      stone: 'Batu',
      iron: 'Besi',
      gold: 'Emas',
      diamond: 'Diamon',
      herb: 'Ramuan',
      fish: 'Ikan',
      meat: 'Daging',
    };
    return names[key] || key;
  }

  getResourceIcon(key) {
    const icons = {
      wood: 'fa-tree',
      stone: 'fa-rock',
      iron: 'fa-anvil',
      gold: 'fa-coins',
      diamond: 'fa-gem',
      herb: 'fa-leaf',
      fish: 'fa-fish',
      meat: 'fa-drumstick-bite',
    };
    return icons[key] || 'fa-box';
  }

  renderMap() {
    if (!this.mapCtx || !this.mapCanvas) return;

    const ctx = this.mapCtx;
    const width = this.mapCanvas.width;
    const height = this.mapCanvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#061209');
    bgGrad.addColorStop(1, '#0b1c11');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(134,239,172,0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Regions
    Object.entries(this.regions).forEach(([key, region]) => {
      if (!region.bounds) return;

      const { x, y, w, h } = region.bounds;
      const scaleX = width / 1000;
      const scaleY = height / 1000;

      const rx = x * scaleX;
      const ry = y * scaleY;
      const rw = w * scaleX;
      const rh = h * scaleY;

      const isSelected = this.selectedRegion === key;
      const isHovered = this.hoveredRegion === key;

      // Region color based on type
      const colors = {
        starter: '#86efac',
        forest: '#34d399',
        mountain: '#fbbf24',
        ocean: '#7dd3fc',
        city: '#f472b6',
        snow: '#bfdbfe',
        dungeon: '#a78bfa',
      };

      const color = colors[region.type] || '#86efac';
      const alpha = isSelected ? 0.4 : isHovered ? 0.3 : 0.15;

      ctx.fillStyle = this.hexToRgba(color, alpha);
      ctx.strokeStyle = this.hexToRgba(color, isSelected ? 0.8 : 0.5);
      ctx.lineWidth = isSelected ? 3 : 2;

      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 8);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = this.hexToRgba(color, 1);
      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(region.name, rx + rw / 2, ry - 4);
    });

    // Player position
    if (this.playerPos) {
      const scaleX = width / 1000;
      const scaleY = height / 1000;
      const px = this.playerPos.x * scaleX;
      const py = this.playerPos.y * scaleY;

      // Pulse animation
      const time = Date.now() / 500;
      const pulseSize = 8 + Math.sin(time) * 3;

      ctx.fillStyle = '#ffc0cb';
      ctx.shadowColor = '#ffc0cb';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(px, py, pulseSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Player label
      ctx.fillStyle = '#ffc0cb';
      ctx.font = '11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Kamu', px, py - pulseSize - 4);
    }
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  onMapClick(e) {
    if (!this.mapCanvas) return;
    const rect = this.mapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = 1000 / this.mapCanvas.width;
    const scaleY = 1000 / this.mapCanvas.height;
    const worldX = x * scaleX;
    const worldY = y * scaleY;

    // Find clicked region
    let clicked = null;
    Object.entries(this.regions).forEach(([key, region]) => {
      if (region.bounds &&
          worldX >= region.bounds.x &&
          worldX <= region.bounds.x + region.bounds.w &&
          worldY >= region.bounds.y &&
          worldY <= region.bounds.y + region.bounds.h) {
        clicked = key;
      }
    });

    if (clicked) {
      this.selectRegion(clicked);
    }
  }

  onMapHover(e) {
    if (!this.mapCanvas) return;
    const rect = this.mapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = 1000 / this.mapCanvas.width;
    const scaleY = 1000 / this.mapCanvas.height;
    const worldX = x * scaleX;
    const worldY = y * scaleY;

    let hovered = null;
    Object.entries(this.regions).forEach(([key, region]) => {
      if (region.bounds &&
          worldX >= region.bounds.x &&
          worldX <= region.bounds.x + region.bounds.w &&
          worldY >= region.bounds.y &&
          worldY <= region.bounds.y + region.bounds.h) {
        hovered = key;
      }
    });

    this.hoveredRegion = hovered;
    this.renderMap();

    // Show tooltip
    const tooltip = document.getElementById('worldMapTooltip');
    if (tooltip && hovered && this.regions[hovered]) {
      const region = this.regions[hovered];
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.clientX - rect.left + 16}px`;
      tooltip.style.top = `${e.clientY - rect.top - 16}px`;
      tooltip.innerHTML = `
        <strong>${region.name}</strong><br>
        <small>Tipe: ${region.type} · Level: ${region.minLevel || 1}-${region.maxLevel || 50}</small><br>
        <small>Monster: ${region.monsters?.join(', ') || 'Tidak ada'}</small>
      `;
    } else if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  selectRegion(key) {
    this.selectedRegion = key;
    const region = this.regions[key];
    if (!region) return;

    document.getElementById('regionName').textContent = region.name;
    document.getElementById('regionBadge').textContent = region.type;
    document.getElementById('regionBadge').className = `badge badge-${this.getRegionBadgeClass(region.type)}`;

    document.getElementById('worldRegionInfo').innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-4);">
        <div class="stat-card">
          <div class="stat-label">Level Range</div>
          <div class="stat-value">${region.minLevel || 1} - ${region.maxLevel || 50}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tipe Wilayah</div>
          <div class="stat-value" style="font-size:var(--text-sm); font-family:var(--font-body);">${region.type}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Monster</div>
          <div class="stat-value" style="font-size:var(--text-sm); font-family:var(--font-body);">${region.monsters?.join(', ') || 'Tidak ada'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">NPC</div>
          <div class="stat-value" style="font-size:var(--text-sm); font-family:var(--font-body);">${region.npcs?.join(', ') || 'Tidak ada'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Sumber Daya</div>
          <div class="stat-value" style="font-size:var(--text-sm); font-family:var(--font-body);">${region.resources?.join(', ') || 'Tidak ada'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Dungeon</div>
          <div class="stat-value" style="font-size:var(--text-sm); font-family:var(--font-body);">${region.dungeons?.join(', ') || 'Tidak ada'}</div>
        </div>
      </div>
      <div style="margin-top:var(--space-4); display:flex; gap:var(--space-2); flex-wrap:wrap;">
        <button type="button" class="btn btn-primary" id="worldBtnExplore" data-region="${key}"><i class="fa-solid fa-compass" aria-hidden="true"></i> Jelajahi</button>
        <button type="button" class="btn btn-ghost" id="worldBtnGather" data-region="${key}"><i class="fa-solid fa-hand-sparkles" aria-hidden="true"></i> Kumpulkan</button>
        <button type="button" class="btn btn-ghost" id="worldBtnCraft" data-region="${key}"><i class="fa-solid fa-hammer" aria-hidden="true"></i> Crafting</button>
        <button type="button" class="btn btn-ghost" id="worldBtnDungeon" data-region="${key}"><i class="fa-solid fa-door-open" aria-hidden="true"></i> Dungeon</button>
      </div>
    `;

    // Enable action buttons
    document.getElementById('worldBtnExplore')?.removeAttribute('disabled');
    document.getElementById('worldBtnGather')?.removeAttribute('disabled');
    document.getElementById('worldBtnCraft')?.removeAttribute('disabled');
    document.getElementById('worldBtnDungeon')?.removeAttribute('disabled');
    document.getElementById('worldBtnClan')?.removeAttribute('disabled');
    document.getElementById('worldBtnMarket')?.removeAttribute('disabled');

    // Add click handlers
    ['Explore', 'Gather', 'Craft', 'Dungeon'].forEach(action => {
      const btn = document.getElementById(`worldBtn${action}`);
      btn?.addEventListener('click', () => this.regionAction(action.toLowerCase(), key));
    });

    this.renderMap();
  }

  getRegionBadgeClass(type) {
    const classes = {
      starter: 'success',
      forest: 'success',
      mountain: 'warning',
      ocean: 'info',
      city: 'primary',
      snow: 'info',
      dungeon: 'neutral',
    };
    return classes[type] || 'info';
  }

  regionAction(action, regionKey) {
    NauraOS.showToast({
      title: `Aksi: ${action}`,
      message: `Memulai ${action} di ${this.regions[regionKey]?.name || regionKey}...`,
      type: 'info',
    });
    // Would emit socket event here
  }

  setupEventListeners() {
    document.getElementById('worldBtnRefresh')?.addEventListener('click', () => this.loadRegions());
    document.getElementById('worldBtnFullscreen')?.addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('worldRegionSelect')?.addEventListener('change', (e) => {
      if (e.target.value && e.target.value !== 'overview') {
        this.selectRegion(e.target.value);
      }
    });
    document.getElementById('worldBtnLegend')?.addEventListener('click', () => this.showLegend());
    document.getElementById('worldBtnTravel')?.addEventListener('click', () => this.openTravelMenu());
    document.getElementById('worldMapRetry')?.addEventListener('click', () => this.loadRegions());
  }

  toggleFullscreen() {
    const card = document.querySelector('.stage-card');
    if (card) {
      if (!document.fullscreenElement) {
        card.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  showLegend() {
    NauraOS.showModal({
      title: 'Legenda Peta',
      content: `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--space-3);">
          <div class="card" style="padding:var(--space-3); border-left:4px solid #86efac;">
            <div style="font-weight:600; color:var(--ink);">🟢 Starter (Desa Adisha)</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Area aman untuk pemula</div>
          </div>
          <div class="card" style="padding:var(--space-3); border-left:4px solid #34d399;">
            <div style="font-weight:600; color:var(--ink);">🌲 Hutan</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Sumber daya kayu & ramuan</div>
          </div>
          <div class="card" style="padding:var(--space-3); border-left:4px solid #fbbf24;">
            <div style="font-weight:600; color:var(--ink);">⛰️ Gunung</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Batu, besi, emas</div>
          </div>
          <div class="card" style="padding:var(--space-3); border-left:4px solid #7dd3fc;">
            <div style="font-weight:600; color:var(--ink);">🌊 Lautan</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Ikan & perjalanan cepat</div>
          </div>
          <div class="card" style="padding:var(--space-3); border-left:4px solid #f472b6;">
            <div style="font-weight:600; color:var(--ink);">🏙️ Kota (Pratama)</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Pasar, NPC, klan</div>
          </div>
          <div class="card" style="padding:var(--space-3); border-left:4px solid #bfdbfe;">
            <div style="font-weight:600; color:var(--ink);">❄️ Khul'Khas (Salju)</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Area endgame, boss raid</div>
          </div>
          <div class="card" style="padding:var(--space-3); border-left:4px solid #a78bfa;">
            <div style="font-weight:600; color:var(--ink);">🏰 Dungeon</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted);">Combat instanced</div>
          </div>
        </div>
      `,
      actions: [{ label: 'Tutup', variant: 'btn-primary', onClick: () => {} }],
    });
  }

  openTravelMenu() {
    NauraOS.showModal({
      title: 'Travel Menu',
      content: `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-3);">
          ${Object.entries(this.regions).map(([key, r]) => `
            <button type="button" class="btn btn-ghost" style="padding:var(--space-3); text-align:left;" onclick="window.worldPage.selectRegion('${key}'); NauraOS.modal?.close();">
              <div style="font-weight:600; color:var(--ink);">${r.name}</div>
              <div style="font-size:var(--text-xs); color:var(--text-muted);">${r.type} · Lv ${r.minLevel}-${r.maxLevel}</div>
            </button>
          `).join('')}
        </div>
      `,
      actions: [{ label: 'Batal', variant: 'btn-ghost', onClick: () => {} }],
    });
  }

  startPeriodicUpdates() {
    setInterval(() => {
      this.loadPlayerData();
    }, 10000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.worldPage = new WorldPage();
});
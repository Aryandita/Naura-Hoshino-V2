/**
 * Music Page - Music Hub
 * Lavalink player, queue, search, AI DJ, node management
 */

class MusicPage {
  constructor() {
    this.socket = null;
    this.currentGuild = null;
    this.searchSource = 'youtube';
    this.init();
  }

  init() {
    this.connectSocket();
    this.setupEventListeners();
    this.loadGuilds();
  }

  connectSocket() {
    this.socket = io('/dashboard', {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    this.socket.on('connect', () => {
      this.socket.emit('subscribe', { rooms: ['music', 'music:queue', 'music:nodes'] });
    });

    this.socket.on('music:state', (data) => this.updatePlayer(data));
    this.socket.on('music:queue', (data) => this.updateQueue(data));
    this.socket.on('music:nodes', (data) => this.updateNodes(data));
    this.socket.on('music:search:results', (data) => this.updateSearchResults(data));
  }

  setupEventListeners() {
    // Guild selector
    const guildSelect = document.getElementById('musicGuildDropdown');
    guildSelect?.addEventListener('change', (e) => this.switchGuild(e.target.value));

    // Player controls
    document.getElementById('musicBtnPlayPause')?.addEventListener('click', () => this.togglePlayPause());
    document.getElementById('musicBtnPrev')?.addEventListener('click', () => this.sendCommand('previous'));
    document.getElementById('musicBtnNext')?.addEventListener('click', () => this.sendCommand('next'));
    document.getElementById('musicBtnShuffle')?.addEventListener('click', () => this.sendCommand('shuffle'));
    document.getElementById('musicBtnLoop')?.addEventListener('click', () => this.sendCommand('loop'));
    document.getElementById('musicBtnLyrics')?.addEventListener('click', () => this.showLyrics());
    document.getElementById('musicBtnQueue')?.addEventListener('click', () => this.focusQueue());

    // Volume
    const volumeSlider = document.getElementById('musicVolume');
    volumeSlider?.addEventListener('input', (e) => this.sendCommand('volume', { volume: parseInt(e.target.value) }));

    // Search
    document.getElementById('musicBtnSearch')?.addEventListener('click', () => this.search());
    document.getElementById('musicSearchInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.search();
    });

    // Source buttons
    document.querySelectorAll('[data-source]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.searchSource = btn.dataset.source;
        document.querySelectorAll('[data-source]').forEach(b => {
          b.className = b === btn ? 'btn btn-ghost btn-sm' : 'btn btn-ghost btn-sm';
          if (b === btn) b.classList.add('btn-primary');
        });
      });
    });

    // Queue actions
    document.getElementById('musicBtnAddSearch')?.addEventListener('click', () => this.focusSearch());
    document.getElementById('musicBtnClearQueue')?.addEventListener('click', () => this.clearQueue());
    document.getElementById('musicQueueSearch')?.addEventListener('input', (e) => this.filterQueue(e.target.value));

    // AI DJ
    document.getElementById('musicBtnStartDJ')?.addEventListener('click', () => this.startDJ());
    document.getElementById('musicBtnStopDJ')?.addEventListener('click', () => this.stopDJ());

    // Empty state search
    document.getElementById('musicEmptyBtnSearch')?.addEventListener('click', () => this.focusSearch());

    // Settings save
    document.getElementById('musicSettingsBtnSave')?.addEventListener('click', () => this.saveMusicSettings());
  }

  loadGuilds() {
    fetch('/api/music/guilds')
      .then(r => r.json())
      .then(data => {
        const select = document.getElementById('musicGuildDropdown');
        if (!select) return;
        select.innerHTML = '<option value="">Pilih Server</option>' +
          (data.guilds || []).map(g => `<option value="${g.id}">${this.escapeHtml(g.name)} (${g.memberCount} users)</option>`).join('');
        if (data.current) {
          select.value = data.current;
          this.currentGuild = data.current;
          this.joinGuildRoom(data.current);
        }
      })
      .catch(err => console.warn('[Music] Failed to load guilds:', err));
  }

  switchGuild(guildId) {
    if (!guildId) return;
    this.currentGuild = guildId;
    this.joinGuildRoom(guildId);
    this.loadGuildSettings(guildId);
  }

  joinGuildRoom(guildId) {
    if (this.socket?.connected) {
      this.socket.emit('music:join', { guildId });
    }
  }

  loadGuildSettings(guildId) {
    fetch(`/api/music/guild/${guildId}/settings`)
      .then(r => r.json())
      .then(data => {
        if (data.volume) document.getElementById('musicVolume').value = data.volume;
        if (data.djRole) document.getElementById('musicDJRole').value = data.djRole;
      })
      .catch(() => {});
  }

  updatePlayer(data) {
    const titleEl = document.getElementById('nowPlayingTitle');
    const artistEl = document.getElementById('nowPlayingArtist');
    const progressEl = document.getElementById('nowPlayingProgress');
    const currentTimeEl = document.getElementById('nowPlayingCurrentTime');
    const totalTimeEl = document.getElementById('nowPlayingTotalTime');
    const playIcon = document.getElementById('musicPlayIcon');
    const artworkImg = document.getElementById('musicArtworkImg');
    const disc = document.getElementById('musicArtworkDisc');
    const eqBars = document.getElementById('musicEqualizerBars');

    if (titleEl) titleEl.textContent = data.title || 'Idle, Tidak Ada Lagu';
    if (artistEl) artistEl.textContent = data.author || 'Queue kosong';
    if (progressEl) progressEl.style.width = `${data.progress || 0}%`;
    if (currentTimeEl) currentTimeEl.textContent = this.formatTime(data.currentTime || 0);
    if (totalTimeEl) totalTimeEl.textContent = this.formatTime(data.totalTime || 0);
    if (playIcon) playIcon.className = data.playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    if (disc) disc.classList.toggle('playing', data.playing);
    if (eqBars) eqBars.classList.toggle('eq-playing', data.playing);

    // Artwork
    if (artworkImg && data.thumbnail) {
      artworkImg.src = data.thumbnail;
      artworkImg.style.opacity = '1';
    } else if (artworkImg) {
      artworkImg.style.opacity = '0';
    }

    // Source badge
    const sourceBadge = document.getElementById('musicSourceBadge');
    if (sourceBadge) sourceBadge.textContent = data.source || 'Lavalink v4';

    // Node badge
    const nodeBadge = document.getElementById('musicNodeBadge');
    if (nodeBadge) nodeBadge.textContent = `Node: ${data.node || '-'}`;

    // Bitrate & ping
    document.getElementById('musicBitrate').textContent = `${data.bitrate || '-'} kbps`;
    document.getElementById('musicPing').textContent = `${data.ping || '-'} ms`;
  }

  updateQueue(data) {
    const container = document.getElementById('musicQueueList');
    if (!container) return;

    if (!data || !data.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-8); border:none; background:transparent;">
          <div class="empty-state-icon" style="background:var(--ui-primary-glow); border-color:var(--hairline-brand); color:var(--ui-primary);">
            <i class="fa-solid fa-music" style="font-size:2rem;"></i>
          </div>
          <h3 class="empty-state-title">Antrian Kosong</h3>
          <p class="empty-state-body">Tambahkan lagu dari YouTube, Spotify, SoundCloud, atau cari langsung.</p>
          <button type="button" class="btn btn-primary btn-sm" id="musicEmptyBtnSearch2" style="margin-top:var(--space-3);">
            <i class="fa-solid fa-search" aria-hidden="true"></i> Cari Lagu
          </button>
        </div>
      `;
      document.getElementById('musicEmptyBtnSearch2')?.addEventListener('click', () => this.focusSearch());
      return;
    }

    container.innerHTML = data.map((track, i) => `
      <div class="card" style="padding:var(--space-3); display:flex; align-items:center; gap:var(--space-3); ${i === 0 ? 'border-color:var(--hairline-brand); background:var(--ui-primary-glow);' : ''} ${data.current === i ? 'box-shadow:0 0 16px var(--ui-primary-glow);' : ''}" data-index="${i}">
        <div style="width:44px; height:44px; border-radius:var(--radius-md); background:var(--ui-primary-glow); border:1px solid var(--hairline-brand); display:flex; align-items:center; justify-content:center; font-size:1.1rem; color:var(--ui-primary); flex-shrink:0;">${i + 1}</div>
        <img src="${track.thumbnail || ''}" alt="" style="width:44px; height:44px; border-radius:var(--radius-md); object-fit:cover; flex-shrink:0;" onerror="this.style.display='none'">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(track.title)}</div>
          <div style="font-size:var(--text-xs); color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(track.author)} · ${this.formatTime(track.duration)}</div>
        </div>
        <div style="display:flex; gap:var(--space-1);">
          <button type="button" class="btn btn-icon-only btn-ghost btn-sm" data-action="moveUp" aria-label="Naikkan" title="Naikkan"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
          <button type="button" class="btn btn-icon-only btn-ghost btn-sm" data-action="moveDown" aria-label="Turunkan" title="Turunkan"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
          <button type="button" class="btn btn-icon-only btn-ghost btn-sm" data-action="remove" aria-label="Hapus" title="Hapus"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div>
      </div>
    `).join('');

    // Add action listeners
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.closest('[data-index]')?.dataset.index);
        const action = btn.dataset.action;
        this.queueAction(action, index);
      });
    });
  }

  filterQueue(query) {
    const items = document.querySelectorAll('#musicQueueList [data-index]');
    const q = query.toLowerCase();
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(q) ? 'flex' : 'none';
    });
  }

  queueAction(action, index) {
    if (!this.currentGuild) return;
    this.socket?.emit('music:queue:action', { guildId: this.currentGuild, action, index });
  }

  updateNodes(data) {
    const tbody = document.getElementById('musicNodesTable');
    if (!tbody || !data) return;

    tbody.innerHTML = (data.nodes || []).map(node => `
      <tr>
        <td style="font-weight:600; color:var(--ink);">${this.escapeHtml(node.name)}</td>
        <td><span class="badge ${node.status === 'connected' ? 'badge-success' : 'badge-error'}" style="font-size:var(--text-xs);">${node.status}</span></td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${node.region || '-'}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${node.players || 0}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${node.cpu || 0}%</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${node.memory || 0}MB</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${node.ping || 0}ms</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${this.formatUptime(node.uptime || 0)}</td>
        <td>
          <button type="button" class="btn btn-ghost btn-sm" data-action="restart" data-node="${node.name}" aria-label="Restart node"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="9" style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Tidak ada node Lavalink</td></tr>';

    tbody.querySelectorAll('[data-action="restart"]').forEach(btn => {
      btn.addEventListener('click', () => this.restartNode(btn.dataset.node));
    });
  }

  updateSearchResults(data) {
    const container = document.getElementById('musicSearchResults');
    if (!container || !data) return;

    if (!data.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6); border:none; background:transparent;">
          <div class="empty-state-icon" style="background:var(--amber-dim); border-color:rgba(245,158,11,0.3); color:var(--color-warning);">
            <i class="fa-solid fa-search" style="font-size:1.5rem;"></i>
          </div>
          <h3 class="empty-state-title">Tidak Ditemukan</h3>
          <p class="empty-state-body">Coba kata kunci lain atau sumber berbeda.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.map(track => `
      <div class="card" style="padding:var(--space-3); display:flex; align-items:center; gap:var(--space-3); cursor:pointer;" data-track='${JSON.stringify(track).replace(/'/g, '&apos;')}'>
        <img src="${track.thumbnail || ''}" alt="" style="width:48px; height:48px; border-radius:var(--radius-md); object-fit:cover; flex-shrink:0;" onerror="this.style.display='none'">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(track.title)}</div>
          <div style="font-size:var(--text-xs); color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(track.author)} · ${this.formatTime(track.duration)} · ${track.source}</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-action="add" aria-label="Tambah ke antrian">
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('[data-action="add"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const track = JSON.parse(btn.closest('[data-track]')?.dataset.track || '{}');
        this.addToQueue(track);
      });
    });
  }

  search() {
    const input = document.getElementById('musicSearchInput');
    const query = input?.value?.trim();
    if (!query || !this.currentGuild) return;

    this.socket?.emit('music:search', {
      guildId: this.currentGuild,
      query,
      source: this.searchSource,
    });
  }

  addToQueue(track) {
    if (!this.currentGuild) return;
    this.socket?.emit('music:queue:add', { guildId: this.currentGuild, track });
    NauraOS.showToast({ title: 'Ditambahkan', message: `${track.title} masuk antrian`, type: 'success' });
  }

  clearQueue() {
    if (!this.currentGuild) return;
    if (confirm('Bersihkan seluruh antrian?')) {
      this.socket?.emit('music:queue:clear', { guildId: this.currentGuild });
    }
  }

  togglePlayPause() {
    this.sendCommand('playpause');
  }

  sendCommand(command, params = {}) {
    if (!this.currentGuild) return;
    this.socket?.emit('music:command', { guildId: this.currentGuild, command, ...params });
  }

  focusSearch() {
    document.getElementById('musicSearchInput')?.focus();
  }

  focusQueue() {
    document.getElementById('musicQueueSearch')?.focus();
  }

  startDJ() {
    if (!this.currentGuild) return;
    const mode = document.getElementById('musicDJMode')?.value;
    const genre = document.getElementById('musicDJGenre')?.value;
    const energy = document.getElementById('musicDJEnergy')?.value;
    const duration = document.getElementById('musicDJDuration')?.value;

    this.socket?.emit('music:dj:start', {
      guildId: this.currentGuild,
      mode,
      genre,
      energy: parseFloat(energy),
      duration: parseInt(duration),
    });
    NauraOS.showToast({ title: 'AI DJ Dimulai', message: `Mode ${mode} aktif`, type: 'success' });
  }

  stopDJ() {
    if (!this.currentGuild) return;
    this.socket?.emit('music:dj:stop', { guildId: this.currentGuild });
    NauraOS.showToast({ title: 'AI DJ Dihentikan', type: 'info' });
  }

  showLyrics() {
    NauraOS.showModal({
      title: 'Lirik Lagu',
      content: '<div class="empty-state" style="padding:var(--space-8);"><div class="empty-state-icon"><i class="fa-solid fa-music" style="font-size:2rem;"></i></div><h3 class="empty-state-title">Lirik Belum Tersedia</h3><p class="empty-state-body">Fitur lirik akan hadir di update mendatang.</p></div>',
      actions: [{ label: 'Tutup', variant: 'btn-primary', onClick: () => {} }],
    });
  }

  restartNode(nodeName) {
    if (!this.currentGuild) return;
    if (confirm(`Restart node ${nodeName}?`)) {
      this.socket?.emit('music:node:restart', { guildId: this.currentGuild, node: nodeName });
    }
  }

  saveMusicSettings() {
    if (!this.currentGuild) return;
    const settings = {
      defaultVolume: document.getElementById('musicDefaultVolume')?.value,
      defaultQuality: document.getElementById('musicDefaultQuality')?.value,
      normalize: document.getElementById('musicNormalize')?.checked,
      autoplay: document.getElementById('musicAutoplay')?.checked,
      crossfadeEnabled: document.getElementById('musicCrossfadeEnabled')?.checked,
      crossfadeDuration: document.getElementById('musicCrossfadeDuration')?.value,
      djEnabled: document.getElementById('musicDJEnabled')?.checked,
      djDefaultMode: document.getElementById('musicDJDefaultMode')?.value,
      djCooldown: document.getElementById('musicDJCooldown')?.value,
      allowDJ: document.getElementById('musicAllowDJ')?.checked,
      djRoleOnly: document.getElementById('musicDJRoleOnly')?.checked,
      djRole: document.getElementById('musicDJRole')?.value,
      maxQueue: document.getElementById('musicMaxQueue')?.value,
      maxSongDuration: document.getElementById('musicMaxSongDuration')?.value,
    };

    fetch(`/api/music/guild/${this.currentGuild}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
      .then(r => r.json())
      .then(data => {
        NauraOS.showToast({ title: 'Tersimpan', message: 'Pengaturan musik diperbarui', type: 'success' });
      })
      .catch(err => {
        NauraOS.showToast({ title: 'Error', message: 'Gagal menyimpan pengaturan', type: 'error' });
        console.error('[Music] Save settings failed:', err);
      });
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
}

document.addEventListener('DOMContentLoaded', () => {
  window.musicPage = new MusicPage();
});
/**
 * Arcade Page - Retro Arcade Games
 * Game grid, leaderboard, game detail modal
 */

class ArcadePage {
  constructor() {
    this.currentCategory = 'all';
    this.games = [];
    this.init();
  }

  init() {
    this.loadGames();
    this.setupEventListeners();
    this.loadLeaderboard();
  }

  loadGames() {
    fetch('/api/arcade/games')
      .then(r => r.json())
      .then(data => {
        this.games = data.games || [];
        this.renderGames();
      })
      .catch(err => console.warn('[Arcade] Failed to load games:', err));
  }

  renderGames() {
    const grid = document.getElementById('arcadeGameGrid');
    if (!grid) return;

    const filtered = this.currentCategory === 'all'
      ? this.games
      : this.games.filter(g => g.category === this.currentCategory);

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1; padding:var(--space-8);">
          <div class="empty-state-icon" style="background:var(--ui-primary-glow); border-color:var(--hairline-brand); color:var(--ui-primary);">
            <i class="fa-solid fa-gamepad" style="font-size:2.5rem;"></i>
          </div>
          <h3 class="empty-state-title">Tidak Ada Game</h3>
          <p class="empty-state-body">Tidak ada game di kategori "${this.currentCategory}".</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(game => `
      <article class="card game-card" style="cursor:pointer; transition:all var(--spring-standard);" data-game-id="${game.id}" data-category="${game.category}">
        <div style="aspect-ratio:16/9; border-radius:var(--radius-lg); background:linear-gradient(135deg, ${game.colorPrimary}20 0%, ${game.colorSecondary}20 100%); border:1px solid ${game.colorPrimary}40; display:flex; align-items:center; justify-content:center; font-size:3rem; color:${game.colorPrimary}; margin-bottom:var(--space-3); overflow:hidden; position:relative;">
          <i class="${game.icon}" aria-hidden="true"></i>
          <div style="position:absolute; top:var(--space-2); right:var(--space-2);">
            <span class="badge badge-${this.getCategoryBadgeClass(game.category)}" style="font-size:var(--text-xs);">${game.category}</span>
          </div>
        </div>
        <div class="card-body" style="padding-top:0;">
          <h3 style="font-family:var(--font-heading); font-size:var(--text-sm); font-weight:600; color:var(--ink); margin-bottom:var(--space-1);">${game.name}</h3>
          <p style="font-size:var(--text-xs); color:var(--text-muted); margin-bottom:var(--space-3); line-height:1.4;">${game.description}</p>
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-2);">
            <div style="display:flex; gap:var(--space-1);">
              ${this.renderBetRange(game.minBet, game.maxBet)}
            </div>
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <span class="badge badge-success" style="font-size:var(--text-xs);">+${game.winReward} MP</span>
              <button type="button" class="btn btn-primary btn-sm" style="padding:var(--space-1) var(--space-3); font-size:var(--text-xs);">Mainkan</button>
            </div>
          </div>
        </div>
      </article>
    `).join('');

    // Add click handlers
    grid.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.showGameDetail(card.dataset.gameId);
      });

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = '0 16px 40px rgba(6,8,16,0.45)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '';
      });
    });

    grid.querySelectorAll('.game-card button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showGameDetail(btn.closest('.game-card').dataset.gameId);
      });
    });
  }

  renderBetRange(min, max) {
    if (min === 0 && max === 0) {
      return '<span class="badge badge-info" style="font-size:var(--text-xs);">Free</span>';
    }
    return `
      <span class="badge badge-warning" style="font-size:var(--text-xs);">Min ${min.toLocaleString()} MP</span>
      <span class="badge badge-warning" style="font-size:var(--text-xs);">Max ${max.toLocaleString()} MP</span>
    `;
  }

  getCategoryBadgeClass(category) {
    const classes = {
      classic: 'primary',
      card: 'warning',
      word: 'info',
      puzzle: 'success',
      edu: 'primary',
      pvp: 'error',
    };
    return classes[category] || 'neutral';
  }

  showGameDetail(gameId) {
    const game = this.games.find(g => g.id === gameId);
    if (!game) return;

    document.getElementById('arcadeGameDetail').style.display = 'block';
    document.getElementById('arcadeDetailName').textContent = game.name;
    document.getElementById('arcadeDetailDesc').textContent = game.description;
    document.getElementById('arcadeDetailMinBet').textContent = `${game.minBet.toLocaleString()} MP`;
    document.getElementById('arcadeDetailMaxBet').textContent = `${game.maxBet.toLocaleString()} MP`;
    document.getElementById('arcadeDetailWinReward').textContent = `${game.winReward.toLocaleString()} MP`;
    document.getElementById('arcadeDetailType').textContent = game.category;

    // Artwork
    const artwork = document.getElementById('arcadeDetailArtwork');
    artwork.innerHTML = `<i class="${game.icon}" style="font-size:4rem; color:${game.colorPrimary};"></i>`;

    // Badges
    const badges = document.getElementById('arcadeDetailBadges');
    badges.innerHTML = `
      <span class="badge badge-${this.getCategoryBadgeClass(game.category)}">${game.category}</span>
      <span class="badge badge-info">MP System</span>
      <span class="badge badge-${game.multiplayer ? 'success' : 'neutral'}">${game.multiplayer ? 'Multiplayer' : 'Single Player'}</span>
    `;

    // Play button
    document.getElementById('arcadeBtnPlayNow').onclick = () => this.playGame(game.id);
    document.getElementById('arcadeBtnLeaderboard').onclick = () => window.location.href = `/leaderboard?category=arcade&game=${game.id}`;

    // Scroll to detail
    document.getElementById('arcadeGameDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  playGame(gameId) {
    NauraOS.showToast({
      title: 'Memulai Game',
      message: 'Game akan dibuka di Discord...',
      type: 'info',
    });
    // Would emit socket event to start game
  }

  loadLeaderboard() {
    fetch('/api/arcade/leaderboard')
      .then(r => r.json())
      .then(data => this.renderLeaderboard(data))
      .catch(err => console.warn('[Arcade] Failed to load leaderboard:', err));
  }

  renderLeaderboard(data) {
    const tbody = document.getElementById('arcadeLeaderboardBody');
    if (!tbody || !data) return;

    tbody.innerHTML = (data.top || []).map((entry, i) => `
      <tr style="transition:background var(--duration-fast) var(--ease-out);">
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; color:${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text-primary)'};">${i + 1}</td>
        <td style="font-weight:600; color:var(--ink);">${this.escapeHtml(entry.username)}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-warning);">${entry.mp?.toLocaleString() || 0} MP</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-success);">${entry.wins || 0}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-error);">${entry.losses || 0}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${entry.totalGames ? ((entry.wins / entry.totalGames) * 100).toFixed(1) : 0}%</td>
        <td style="font-size:var(--text-xs); color:var(--text-muted);">${entry.favoriteGame || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Belum ada data leaderboard</td></tr>';
  }

  setupEventListeners() {
    // Category tabs
    document.querySelectorAll('.arcade-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentCategory = btn.dataset.cat;
        document.querySelectorAll('.arcade-cat-btn').forEach(b => {
          b.className = b === btn ? 'btn btn-primary btn-sm arcade-cat-btn' : 'btn btn-ghost btn-sm arcade-cat-btn';
        });
        this.renderGames();
      });
    });

    // Search
    document.getElementById('arcadeGameSearch')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('#arcadeGameGrid .game-card').forEach(card => {
        const name = card.querySelector('h3')?.textContent?.toLowerCase() || '';
        const desc = card.querySelector('p')?.textContent?.toLowerCase() || '';
        card.style.display = (name.includes(query) || desc.includes(query)) ? 'block' : 'none';
      });
    });

    // Sort
    document.getElementById('arcadeSortSelect')?.addEventListener('change', (e) => {
      this.sortGames(e.target.value);
      this.renderGames();
    });

    // Close detail
    document.getElementById('arcadeBtnCloseDetail')?.addEventListener('click', () => {
      document.getElementById('arcadeGameDetail').style.display = 'none';
    });
  }

  sortGames(sortBy) {
    switch (sortBy) {
      case 'name':
        this.games.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'reward':
        this.games.sort((a, b) => b.winReward - a.winReward);
        break;
      case 'new':
        // Would need createdAt field
        break;
      default:
        // popular - would need playCount field
        break;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.arcadePage = new ArcadePage();
});
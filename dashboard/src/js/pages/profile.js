/**
 * Profile Page - Profil Petualang
 * Vitalitas, Inventaris, Pencapaian, Statistik, Riwayat, Keterampilan, Klan
 */

class ProfilePage {
  constructor() {
    this.onLoad = this.onLoad.bind(this);
    this.fetchProfileData = this.fetchProfileData.bind(this);
    this.activateTab = this.activateTab.bind(this);
    this.init();
  }

  init() {
    this.splitNavObserver = new IntersectionObserver(() => this.onLoad(), {
      threshold: 0.01,
    });
    this.splitNavObserver.observe(document.documentElement);
    window.addEventListener("load", this.onLoad, { once: true });
    setTimeout(this.onLoad, 1200);
  }

  onLoad() {
    this.fetchProfileData();
    this.setupTabs();
    this.setupEventListeners();
  }

  fetchProfileData() {
    fetch("/api/profile/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) this.updateProfileHeader(data.profile);
        if (data.vitals) this.updateVitals(data.vitals);
        if (data.currencies) this.updateCurrencies(data.currencies);
        if (data.inventory) this.updateInventory(data.inventory);
        if (data.achievements) this.updateAchievements(data.achievements);
        if (data.stats) this.updateStats(data.stats);
        if (data.history) this.updateHistory(data.history);
        if (data.skills) this.updateSkills(data.skills);
        if (data.clan) this.updateClan(data.clan);
      })
      .catch((err) => console.warn("[Profile] Failed to load profile:", err));
  }

  updateProfileHeader(profile) {
    document.getElementById("profileName").textContent =
      profile.username || "Petualang";
    document.getElementById("profileTag").textContent =
      `#${profile.discriminator || "0000"}`;
    document.getElementById("profileAvatar").src =
      profile.avatar || "/assets/core/avatar.png";
    document.getElementById("profileLevel").textContent = profile.level || 1;
    document.getElementById("profileXp").textContent =
      `${profile.xp || 0} / ${profile.xpMax || 100} XP`;
    document.getElementById("profileTotalXp").textContent = (
      profile.totalXp || 0
    ).toLocaleString();
    document.getElementById("profileDaysActive").textContent =
      profile.daysActive || 0;
    document.getElementById("profileGlobalRank").textContent =
      profile.globalRank ? `#${profile.globalRank}` : "#-";

    const badges = document.getElementById("profileBadges");
    if (badges && profile.badges) {
      badges.innerHTML = profile.badges
        .map(
          (b) =>
            `<span class="badge badge-${b.type}">${this.escapeHtml(b.label)}</span>`,
        )
        .join("");
    }
  }

  updateVitals(vitals) {
    const map = {
      hp: ["profileVitalHp", "profileVitalHpVal"],
      hydration: ["profileVitalHydration", "profileVitalHydrationVal"],
      satiation: ["profileVitalSatiation", "profileVitalSatiationVal"],
      energy: ["profileVitalEnergy", "profileVitalEnergyVal"],
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

  updateCurrencies(curr) {
    document.getElementById("profileNC").textContent = (
      curr.nc || 0
    ).toLocaleString();
    document.getElementById("profileBank").textContent = (
      curr.bank || 0
    ).toLocaleString();
    document.getElementById("profileVP").textContent = (
      curr.vp || 0
    ).toLocaleString();
    document.getElementById("profileBP").textContent = (
      curr.bp || 0
    ).toLocaleString();
  }

  updateInventory(items) {
    const tbody = document.getElementById("inventoryTable");
    if (!tbody) return;

    const filter = document.getElementById("invFilter")?.value || "all";
    const search =
      document.getElementById("invSearch")?.value?.toLowerCase() || "";
    const sort = document.getElementById("invSort")?.value || "name";

    let filtered = (items || []).filter((item) => {
      if (filter !== "all" && item.type !== filter) return false;
      if (search && !item.name?.toLowerCase().includes(search)) return false;
      return true;
    });

    // Sort
    switch (sort) {
      case "quantity":
        filtered.sort((a, b) => b.quantity - a.quantity);
        break;
      case "rarity":
        filtered.sort((a, b) => (b.rarity || 0) - (a.rarity || 0));
        break;
      case "value":
        filtered.sort((a, b) => b.value - a.value);
        break;
      default:
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Tas kosong</td></tr>';
      document.getElementById("invSummary").textContent = "0 item";
      return;
    }

    tbody.innerHTML = filtered
      .slice(0, 50)
      .map(
        (item) => `
      <tr style="transition:background var(--duration-fast) var(--ease-out);">
        <td><div style="width:44px; height:44px; border-radius:var(--radius-md); background:var(--bg-deep); border:1px solid var(--hairline); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">${item.icon || "📦"}</div></td>
        <td style="font-weight:600; color:var(--ink); font-size:var(--text-sm);">${this.escapeHtml(item.name)}</td>
        <td style="font-size:var(--text-xs); color:var(--text-muted);">${item.type}</td>
        <td><span class="badge badge-${this.getRarityClass(item.rarity)}" style="font-size:var(--text-xs);">${item.rarityName || "Common"}</span></td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${item.quantity}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${(item.value || 0).toLocaleString()} NC</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-warning);">${((item.value || 0) * (item.quantity || 1)).toLocaleString()} NC</td>
        <td>
          <button type="button" class="btn btn-ghost btn-sm" data-action="use" data-item-id="${item.id}" style="padding:var(--space-1) var(--space-2);" aria-label="Gunakan item"><i class="fa-solid fa-bolt" aria-hidden="true"></i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="info" data-item-id="${item.id}" style="padding:var(--space-1) var(--space-2);" aria-label="Info item"><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button>
        </td>
      </tr>
    `,
      )
      .join("");

    document.getElementById("invSummary").textContent =
      `${filtered.length} item · ${filtered.reduce((sum, i) => sum + (i.quantity || 0), 0)} slot digunakan`;

    tbody.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.action === "use") this.useItem(btn.dataset.itemId);
        else this.showItemInfo(btn.dataset.itemId);
      });
    });
  }

  getRarityClass(rarity) {
    const classes = {
      0: "neutral",
      1: "success",
      2: "info",
      3: "neutral",
      4: "warning",
      5: "primary",
    };
    return classes[rarity] || "neutral";
  }

  useItem(itemId) {
    NauraOS.showToast({
      title: "Menggunakan Item",
      message: "Item digunakan",
      type: "info",
    });
  }

  showItemInfo(itemId) {
    NauraOS.showToast({
      title: "Info Item",
      message: "Detail item - Coming soon",
      type: "info",
    });
  }

  updateAchievements(achievements) {
    const grid = document.getElementById("achievementsGrid");
    if (!grid) return;

    const filter = document.getElementById("achFilter")?.value || "all";
    let filtered = achievements || [];

    if (filter !== "all") {
      filtered = filtered.filter((a) => a.status === filter);
    }

    if (!filtered.length) {
      grid.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1; padding:var(--space-8);"><div class="empty-state-icon"><i class="fa-solid fa-trophy" style="font-size:2.5rem;"></i></div><h3 class="empty-state-title">Belum Ada Pencapaian</h3></div>';
      return;
    }

    grid.innerHTML = filtered
      .map(
        (ach) => `
      <article class="card" style="padding:var(--space-4);">
        <div style="display:flex; gap:var(--space-3); align-items:flex-start;">
          <div style="width:56px; height:56px; border-radius:var(--radius-xl); background:${ach.unlocked ? "var(--ui-primary-glow)" : "var(--surface-glass)"}; border:1px solid ${ach.unlocked ? "var(--hairline-brand)" : "var(--hairline)"}; display:flex; align-items:center; justify-content:center; font-size:1.5rem; color:${ach.unlocked ? "var(--ui-primary)" : "var(--text-faint)"}; flex-shrink:0;">
            <i class="${ach.icon || "fa-solid fa-trophy"}" aria-hidden="true"></i>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; color:${ach.unlocked ? "var(--ink)" : "var(--text-muted)"}; font-size:var(--text-sm);">${this.escapeHtml(ach.name)}</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:2px;">${this.escapeHtml(ach.description)}</div>
            ${
              ach.unlocked
                ? `<div style="font-size:var(--text-xs); color:var(--color-success); margin-top:4px;">${new Date(ach.unlockedAt).toLocaleDateString("id-ID")}</div>`
                : ach.progress !== undefined
                  ? `
              <div style="margin-top:var(--space-2);">
                <div class="progress-bar" style="height:6px;"><div class="progress-fill" style="width:${((ach.progress / ach.target) * 100).toFixed(0)}%;"></div></div>
                <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:2px;">${ach.progress}/${ach.target}</div>
              </div>`
                  : ""
            }
          </div>
          <span class="badge ${ach.unlocked ? "badge-success" : "badge-neutral"}" style="font-size:var(--text-xs);">${ach.unlocked ? "Terbuka" : "Terkunci"}</span>
        </div>
      </article>
    `,
      )
      .join("");
  }

  updateStats(stats) {
    document.getElementById("statKills").textContent =
      stats.kills?.toLocaleString() || 0;
    document.getElementById("statKD").textContent = stats.deaths
      ? (stats.kills / stats.deaths).toFixed(2)
      : `${stats.kills || 0}.00`;
    document.getElementById("statGathered").textContent =
      stats.gathered?.toLocaleString() || 0;
    document.getElementById("statCrafted").textContent =
      stats.crafted?.toLocaleString() || 0;
    document.getElementById("statExplored").textContent =
      stats.explored?.toLocaleString() || 0;
    document.getElementById("statDungeons").textContent =
      stats.dungeons?.toLocaleString() || 0;
    document.getElementById("statPvPWins").textContent =
      stats.pvpWins?.toLocaleString() || 0;
    document.getElementById("statPvPRatio").textContent =
      `${stats.pvpWins || 0}/${stats.pvpLosses || 0}`;
  }

  updateHistory(history) {
    const tbody = document.getElementById("historyTable");
    if (!tbody) return;

    if (!history?.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Tidak ada riwayat</td></tr>';
      return;
    }

    tbody.innerHTML = history
      .slice(0, 20)
      .map(
        (h) => `
      <tr style="transition:background var(--duration-fast) var(--ease-out);">
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--text-muted);">${new Date(h.timestamp).toLocaleString("id-ID")}</td>
        <td><span class="badge badge-${this.getHistoryBadgeClass(h.type)}" style="font-size:var(--text-xs);">${h.type}</span></td>
        <td style="font-size:var(--text-sm); color:var(--ink);">${this.escapeHtml(h.description)}</td>
        <td style="font-size:var(--text-xs); color:var(--text-muted);">${this.escapeHtml(h.location || "-")}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-success);">${h.reward || "-"}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${h.duration || "-"}</td>
      </tr>
    `,
      )
      .join("");
  }

  getHistoryBadgeClass(type) {
    const classes = {
      combat: "error",
      gather: "success",
      craft: "warning",
      trade: "info",
      dungeon: "primary",
      pvp: "error",
      levelup: "success",
    };
    return classes[type] || "neutral";
  }

  updateSkills(skills) {
    const container = document.getElementById("skillsTree");
    if (!container) return;

    container.innerHTML =
      Object.entries(skills || {})
        .map(
          ([branch, data]) => `
      <div class="card">
        <div class="card-header">
          <div class="card-title" style="color:var(--ui-primary);">${this.escapeHtml(branch)}</div>
          <span class="badge badge-info" style="font-size:var(--text-xs);">${data.points || 0} pts</span>
        </div>
        <div class="card-body" style="padding-top:0;">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:var(--space-3);">
            ${(data.skills || [])
              .map(
                (skill) => `
              <div class="stat-card" style="padding:var(--space-3); ${skill.unlocked ? "border-color:var(--hairline-brand); background:var(--ui-primary-glow);" : ""}">
                <div style="display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-2);">
                  <i class="${skill.icon || "fa-solid fa-star"}" style="color:${skill.unlocked ? "var(--ui-primary)" : "var(--text-faint)"};" aria-hidden="true"></i>
                  <span style="font-weight:600; font-size:var(--text-sm); color:${skill.unlocked ? "var(--ink)" : "var(--text-muted)"};">${this.escapeHtml(skill.name)}</span>
                </div>
                <div style="font-size:var(--text-xs); color:var(--text-muted); margin-bottom:var(--space-2);">${this.escapeHtml(skill.description)}</div>
                <div class="progress-bar" style="height:4px; margin-bottom:var(--space-1);"><div class="progress-fill" style="width:${skill.unlocked ? 100 : (skill.progress / skill.max) * 100}%;"></div></div>
                <div style="font-size:var(--text-xs); color:var(--text-muted);">${skill.unlocked ? "Terbuka" : `${skill.progress || 0}/${skill.max}`}</div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      </div>
    `,
        )
        .join("") ||
      '<div style="text-align:center; padding:var(--space-8); color:var(--text-muted);">Tidak ada skill</div>';
  }

  updateClan(clan) {
    const container = document.getElementById("clanInfo");
    if (!container) return;

    if (!clan) {
      container.innerHTML = `
        <div class="empty-state-icon" style="background:var(--ui-primary-glow); border-color:var(--hairline-brand); color:var(--ui-primary);">
          <i class="fa-solid fa-users-rays" style="font-size:2.5rem;"></i>
        </div>
        <h3 class="empty-state-title">Belum Bergabung Klan</h3>
        <p class="empty-state-body">Gabung atau buat klan untuk bermain bersama.</p>
        <button type="button" class="btn btn-primary" style="margin-top:var(--space-4);" id="clanBtnBrowse2">
          <i class="fa-solid fa-search" aria-hidden="true"></i> Telusuri Klan
        </button>
      `;
      document
        .getElementById("clanBtnBrowse2")
        ?.addEventListener("click", () => (window.location.href = "/clan"));
      return;
    }

    container.innerHTML = `
      <div class="card" style="padding:var(--space-4);">
        <div style="display:flex; align-items:center; gap:var(--space-4);">
          <div style="width:64px; height:64px; border-radius:var(--radius-xl); background:var(--ui-primary-glow); border:1px solid var(--hairline-brand); display:flex; align-items:center; justify-content:center; font-size:1.5rem; color:var(--ui-primary);">
            <i class="fa-solid fa-shield" aria-hidden="true"></i>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:var(--text-h3); color:var(--ink);">${this.escapeHtml(clan.name)}</div>
            <div style="font-size:var(--text-sm); color:var(--text-muted);">Level ${clan.level} · ${clan.members} member · ${this.escapeHtml(clan.role)}</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:var(--space-1);">${this.escapeHtml(clan.description || "")}</div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" onclick="window.location.href='/clan'">
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i> Lihat Klan
          </button>
        </div>
      </div>
    `;
  }

  setupTabs() {
    document.querySelectorAll(".profile-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.activateTab(btn.dataset.tab));
    });
  }

  activateTab(tab) {
    document.querySelectorAll(".profile-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
      b.setAttribute("aria-selected", b.dataset.tab === tab);
    });
    document.querySelectorAll(".profile-tab-panel").forEach((panel) => {
      panel.style.display = panel.id === `tab-${tab}` ? "block" : "none";
    });
  }

  setupEventListeners() {
    document
      .getElementById("profileBtnRefresh")
      ?.addEventListener("click", () => this.fetchProfileData());
    document
      .getElementById("profileBtnEdit")
      ?.addEventListener("click", () =>
        NauraOS.showToast({
          title: "Edit Profil",
          message: "Coming soon",
          type: "info",
        }),
      );
    document
      .getElementById("profileBtnViewPortfolio")
      ?.addEventListener("click", () => (window.location.href = "/portfolio"));
    document
      .getElementById("profileBtnShare")
      ?.addEventListener("click", () => this.shareProfile());
    document
      .getElementById("profileBtnDaily")
      ?.addEventListener("click", () => this.claimDaily());
    document
      .getElementById("profileBtnWork")
      ?.addEventListener("click", () => this.startWork());
    document
      .getElementById("profileBtnInventory")
      ?.addEventListener("click", () => this.activateTab("inventory"));
    document
      .getElementById("profileBtnSkills")
      ?.addEventListener("click", () => this.activateTab("skills"));
    document
      .getElementById("profileBtnClan")
      ?.addEventListener("click", () => this.activateTab("clan"));
    document
      .getElementById("profileBtnSettings")
      ?.addEventListener("click", () => (window.location.href = "/settings"));

    document
      .getElementById("invSearch")
      ?.addEventListener("input", () => this.fetchProfileData());
    document
      .getElementById("invFilter")
      ?.addEventListener("change", () => this.fetchProfileData());
    document
      .getElementById("invSort")
      ?.addEventListener("change", () => this.fetchProfileData());
    document
      .getElementById("achFilter")
      ?.addEventListener("change", () => this.fetchProfileData());
    document
      .getElementById("histFilter")
      ?.addEventListener("change", () => this.fetchProfileData());

    document
      .getElementById("clanBtnCreate")
      ?.addEventListener(
        "click",
        () => (window.location.href = "/clan?create=1"),
      );
    document
      .getElementById("clanBtnBrowse")
      ?.addEventListener("click", () => (window.location.href = "/clan"));
  }

  shareProfile() {
    const url = window.location.href;
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        NauraOS.showToast({
          title: "Tersalin",
          message: "Link profil disalin ke clipboard",
          type: "success",
        });
      })
      .catch(() => {
        NauraOS.showToast({ title: "Info", message: url, type: "info" });
      });
  }

  claimDaily() {
    fetch("/api/profile/daily", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Daily Reward",
            message: `+${data.amount.toLocaleString()} NC`,
            type: "success",
          });
          this.fetchProfileData();
        } else {
          NauraOS.showToast({
            title: "Gagal",
            message: data.error,
            type: "error",
          });
        }
      });
  }

  startWork() {
    fetch("/api/profile/work", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Kerja Selesai",
            message: `+${data.amount.toLocaleString()} NC`,
            type: "success",
          });
          this.fetchProfileData();
        } else {
          NauraOS.showToast({
            title: "Gagal",
            message: data.error,
            type: "error",
          });
        }
      });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.profilePage = new ProfilePage();
});

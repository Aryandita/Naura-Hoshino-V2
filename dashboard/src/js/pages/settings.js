/**
 * Settings Page - Pengaturan Bot
 * Prefix, modul, automod, welcomer, log channel, ekonomi, musik, advanced
 */

class SettingsPage {
  constructor() {
    this.currentGuild = null;
    this.activeTab = "general";
    this.init();
  }

  init() {
    this.loadGuilds();
    this.setupTabs();
    this.setupEventListeners();
  }

  loadGuilds() {
    fetch("/api/settings/guilds")
      .then((r) => r.json())
      .then((data) => {
        const select = document.getElementById("settingsGuildDropdown");
        if (!select) return;
        select.innerHTML =
          '<option value="">Pilih Server</option>' +
          (data.guilds || [])
            .map(
              (g) =>
                `<option value="${g.id}">${this.escapeHtml(g.name)}</option>`,
            )
            .join("");
        if (data.current) {
          select.value = data.current;
          this.currentGuild = data.current;
          this.loadSettings();
        }
      })
      .catch((err) => console.warn("[Settings] Failed to load guilds:", err));
  }

  loadSettings() {
    if (!this.currentGuild) return;
    fetch(`/api/settings/guild/${this.currentGuild}`)
      .then((r) => r.json())
      .then((data) => this.applySettings(data))
      .catch((err) => console.warn("[Settings] Failed to load settings:", err));
  }

  applySettings(data) {
    if (!data) return;

    // General
    document.getElementById("setPrefix").value = data.prefix || "n!";
    document.getElementById("setLang").value = data.language || "id";
    document.getElementById("setTimezone").value =
      data.timezone || "Asia/Jakarta";
    document.getElementById("setCompactMode").checked = !!data.compactMode;
    document.getElementById("setShowBotStats").checked =
      data.showBotStats !== false;
    document.getElementById("setAutoDeleteCmd").checked = !!data.autoDeleteCmd;
    document.getElementById("setDmFallback").checked =
      data.dmFallback !== false;

    // Notifications
    document.getElementById("setNotifDowntime").checked =
      data.notifDowntime !== false;
    document.getElementById("setNotifNewVersion").checked =
      data.notifNewVersion !== false;
    document.getElementById("setNotifEconomyAlert").checked =
      !!data.notifEconomyAlert;
    document.getElementById("setNotifSecurityAlert").checked =
      data.notifSecurityAlert !== false;

    // Economy
    document.getElementById("econDailyMin").value =
      data.economy?.dailyMin || 100;
    document.getElementById("econDailyMax").value =
      data.economy?.dailyMax || 500;
    document.getElementById("econWorkMin").value = data.economy?.workMin || 50;
    document.getElementById("econWorkMax").value = data.economy?.workMax || 300;
    document.getElementById("econWorkCooldown").value =
      data.economy?.workCooldown || 30;
    document.getElementById("econBankInterest").value =
      data.economy?.bankInterest || 0.5;
    document.getElementById("econBankMax").value =
      data.economy?.bankMax || 10000000;
    document.getElementById("econTransferFee").value =
      data.economy?.transferFee || 1;
    document.getElementById("econMinTransfer").value =
      data.economy?.minTransfer || 10;
    document.getElementById("econTaxRate").value = data.economy?.taxRate || 2;

    // Music
    document.getElementById("musicDefaultVolume").value =
      data.music?.defaultVolume || 80;
    document.getElementById("musicDefaultQuality").value =
      data.music?.defaultQuality || "medium";
    document.getElementById("musicNormalize").checked =
      data.music?.normalize !== false;
    document.getElementById("musicAutoplay").checked =
      data.music?.autoplay !== false;
    document.getElementById("musicDJEnabled").checked = !!data.music?.djEnabled;
    document.getElementById("musicDJDefaultMode").value =
      data.music?.djDefaultMode || "smart";
    document.getElementById("musicDJCooldown").value =
      data.music?.djCooldown || 5;
    document.getElementById("musicAllowDJ").checked =
      data.music?.allowDJ !== false;
    document.getElementById("musicDJRoleOnly").checked =
      !!data.music?.djRoleOnly;
    document.getElementById("musicDJRole").value = data.music?.djRole || "";
    document.getElementById("musicMaxQueue").value =
      data.music?.maxQueue || 100;
    document.getElementById("musicMaxSongDuration").value =
      data.music?.maxSongDuration || 60;

    // Load modules
    this.loadModules(data.modules || []);
    // Load automod rules
    this.loadAutomodRules(data.automod?.rules || []);
    // Load log channels
    this.loadLogChannels(data.logChannels || []);
    // Load welcomer
    this.loadWelcomer(data.welcomer || {});
    // Load advanced
    this.loadAdvanced(data.advanced || {});
  }

  loadModules(modules) {
    const container = document.getElementById("modulesList");
    if (!container) return;

    container.innerHTML =
      (modules || [])
        .map(
          (mod) => `
      <div class="card" style="padding:var(--space-3); display:flex; align-items:center; gap:var(--space-3);">
        <div style="width:44px; height:44px; border-radius:var(--radius-lg); background:var(--ui-primary-glow); border:1px solid var(--hairline-brand); display:flex; align-items:center; justify-content:center; color:var(--ui-primary); font-size:1.1rem; flex-shrink:0;">
          <i class="${mod.icon || "fa-solid fa-puzzle-piece"}" aria-hidden="true"></i>
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:var(--ink); font-size:var(--text-sm);">${this.escapeHtml(mod.name)}</div>
          <div style="font-size:var(--text-xs); color:var(--text-muted);">${this.escapeHtml(mod.description)}</div>
        </div>
        <div class="toggle">
          <input type="checkbox" class="toggle-input module-toggle" data-module-id="${mod.id}" ${mod.enabled ? "checked" : ""} ${mod.core ? "disabled" : ""}>
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </div>
        <span class="badge ${mod.core ? "badge-primary" : "badge-neutral"}" style="font-size:var(--text-xs);">${mod.core ? "Inti" : "Opsional"}</span>
      </div>
    `,
        )
        .join("") ||
      '<div style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Tidak ada modul</div>';

    container.querySelectorAll(".module-toggle").forEach((toggle) => {
      toggle.addEventListener("change", (e) => {
        this.toggleModule(toggle.dataset.moduleId, toggle.checked);
      });
    });
  }

  toggleModule(moduleId, enabled) {
    if (!this.currentGuild) return;
    fetch(`/api/settings/guild/${this.currentGuild}/modules/${moduleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) throw new Error(data.error);
        NauraOS.showToast({
          title: "Berhasil",
          message: `Modul ${enabled ? "diaktifkan" : "dinonaktifkan"}`,
          type: "success",
        });
      })
      .catch((err) => {
        NauraOS.showToast({
          title: "Gagal",
          message: err.message,
          type: "error",
        });
        this.loadSettings();
      });
  }

  loadAutomodRules(rules) {
    const container = document.getElementById("automodRules");
    if (!container) return;

    container.innerHTML =
      (rules || [])
        .map(
          (rule) => `
      <div class="card" style="padding:var(--space-3); display:flex; align-items:center; gap:var(--space-3);">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:var(--space-2);">
            <span style="font-weight:600; color:var(--ink); font-size:var(--text-sm);">${this.escapeHtml(rule.name)}</span>
            <span class="badge ${rule.action === "kick" ? "badge-error" : rule.action === "ban" ? "badge-error" : "badge-warning"}" style="font-size:var(--text-xs);">${rule.action}</span>
          </div>
          <div style="font-size:var(--text-xs); color:var(--text-muted);">${this.escapeHtml(rule.description)}</div>
        </div>
        <button type="button" class="btn btn-icon-only btn-ghost btn-sm" data-rule-id="${rule.id}" aria-label="Edit rule"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
        <button type="button" class="btn btn-icon-only btn-ghost btn-sm" data-rule-id="${rule.id}" aria-label="Hapus rule"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
      </div>
    `,
        )
        .join("") ||
      '<div style="text-align:center; padding:var(--space-4); color:var(--text-muted); font-size:var(--text-sm);">Belum ada rule. Klik "Tambah Rule" untuk membuat.</div>';
  }

  loadLogChannels(channels) {
    const container = document.getElementById("logChannelsList");
    if (!container) return;

    const defaultChannels = [
      {
        id: "memberJoin",
        name: "Member Join/Leave",
        desc: "Log kedatangan dan kepergian member",
      },
      {
        id: "messageEdit",
        name: "Message Edit/Delete",
        desc: "Log edit dan hapus pesan",
      },
      {
        id: "modActions",
        name: "Mod Actions",
        desc: "Log kick, ban, warn, timeout",
      },
      { id: "economy", name: "Ekonomi", desc: "Log transaksi ekonomi besar" },
      { id: "security", name: "Security", desc: "Log automod dan alert raid" },
      { id: "music", name: "Music", desc: "Log aktivitas pemutar musik" },
    ];

    container.innerHTML = defaultChannels
      .map((ch) => {
        const selected = channels.find((c) => c.id === ch.id)?.channelId || "";
        return `
        <div class="card" style="padding:var(--space-3); display:flex; align-items:center; gap:var(--space-3);">
          <div style="width:44px; height:44px; border-radius:var(--radius-lg); background:var(--cyan-dim); border:1px solid rgba(34,211,238,0.3); display:flex; align-items:center; justify-content:center; color:var(--accent-cyan); font-size:1.1rem; flex-shrink:0;">
            <i class="fa-solid fa-hashtag" aria-hidden="true"></i>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; color:var(--ink); font-size:var(--text-sm);">${ch.name}</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted);">${ch.desc}</div>
          </div>
          <select class="form-select log-channel-select" data-log-id="${ch.id}" style="min-width:200px;" aria-label="Pilih channel untuk ${ch.name}">
            <option value="">Nonaktif</option>
          </select>
        </div>
      `;
      })
      .join("");

    // Populate channel selects - would normally fetch guild channels
    this.loadGuildChannels();
  }

  loadGuildChannels() {
    if (!this.currentGuild) return;

    fetch(`/api/settings/guild/${this.currentGuild}/channels`)
      .then((r) => r.json())
      .then((data) => {
        document.querySelectorAll(".log-channel-select").forEach((select) => {
          select.innerHTML =
            '<option value="">Nonaktif</option>' +
            (data.channels || [])
              .filter((c) => c.type === "text")
              .map(
                (c) =>
                  `<option value="${c.id}">#${this.escapeHtml(c.name)}</option>`,
              )
              .join("");
        });
      })
      .catch(() => {});
  }

  loadWelcomer(welcomer) {
    document.getElementById("welcomerChannel").value = welcomer.channelId || "";
    document.getElementById("welcomerMessage").value = welcomer.message || "";
    document.getElementById("welcomerRulesChannel").value =
      welcomer.rulesChannelId || "";
    document.getElementById("welcomerAutoRole").value =
      welcomer.autoRoleId || "";
  }

  loadAdvanced(adv) {
    document.getElementById("advLavalinkHost").value =
      adv.lavalink?.host || "localhost";
    document.getElementById("advLavalinkPort").value =
      adv.lavalink?.port || 2333;
    document.getElementById("advLavalinkPassword").value =
      adv.lavalink?.password || "";
    document.getElementById("advPoruNodes").value = adv.poruNodes
      ? JSON.stringify(adv.poruNodes, null, 2)
      : "";
    document.getElementById("advPostgresUrl").value = adv.postgresUrl || "";
    document.getElementById("advMongoUrl").value = adv.mongoUrl || "";
    document.getElementById("advRedisUrl").value = adv.redisUrl || "";
    document.getElementById("advDbSsl").checked = adv.dbSsl !== false;
    document.getElementById("advAiPrimary").value = adv.aiPrimary || "gemini";
    document.getElementById("advAiTimeout").value = adv.aiTimeout || 30;
    document.getElementById("advAiMaxTokens").value = adv.aiMaxTokens || 4096;
    document.getElementById("advAiCircuitBreaker").checked =
      adv.aiCircuitBreaker !== false;
    document.getElementById("advRateLimitGlobal").value =
      adv.rateLimitGlobal || 60;
    document.getElementById("advRateLimitPerUser").value =
      adv.rateLimitPerUser || 20;
    document.getElementById("advAntiRaid").checked = adv.antiRaid !== false;
    document.getElementById("advAntiSpam").checked = adv.antiSpam !== false;
    document.getElementById("advLinkFilter").checked = adv.linkFilter !== false;
  }

  setupTabs() {
    document.querySelectorAll(".settings-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.activeTab = btn.dataset.tab;
        document.querySelectorAll(".settings-tab-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.tab === this.activeTab);
          b.setAttribute("aria-selected", b.dataset.tab === this.activeTab);
        });
        document.querySelectorAll(".settings-tab-panel").forEach((panel) => {
          panel.style.display =
            panel.id === `tab-${this.activeTab}` ? "block" : "none";
        });
      });
    });
  }

  setupEventListeners() {
    const guildSelect = document.getElementById("settingsGuildDropdown");
    guildSelect?.addEventListener("change", (e) => {
      this.currentGuild = e.target.value;
      if (this.currentGuild) this.loadSettings();
    });

    // General settings save
    document
      .getElementById("generalSettingsBtnSave")
      ?.addEventListener("click", () => this.saveGeneral());
    document
      .getElementById("generalSettingsBtnReset")
      ?.addEventListener("click", () => this.loadSettings());

    // Economy settings save
    document
      .getElementById("econSettingsBtnSave")
      ?.addEventListener("click", () => this.saveEconomy());
    document
      .getElementById("econSettingsBtnReset")
      ?.addEventListener("click", () => this.loadSettings());

    // Music settings save
    document
      .getElementById("musicSettingsBtnSave")
      ?.addEventListener("click", () => this.saveMusic());

    // Advanced save
    document
      .getElementById("advBtnSaveAll")
      ?.addEventListener("click", () => this.saveAdvanced());
    document
      .getElementById("advBtnExportConfig")
      ?.addEventListener("click", () => this.exportConfig());
    document
      .getElementById("advBtnImportConfig")
      ?.addEventListener("click", () => this.importConfig());

    // Welcomer
    document
      .getElementById("welcomerBtnSave")
      ?.addEventListener("click", () => this.saveWelcomer());
    document
      .getElementById("welcomerBtnPreview")
      ?.addEventListener("click", () => this.previewWelcomer());
    document
      .getElementById("welcomerBtnTest")
      ?.addEventListener("click", () => this.testWelcomer());
  }

  saveGeneral() {
    if (!this.currentGuild) return;
    const data = {
      prefix: document.getElementById("setPrefix").value,
      language: document.getElementById("setLang").value,
      timezone: document.getElementById("setTimezone").value,
      compactMode: document.getElementById("setCompactMode").checked,
      showBotStats: document.getElementById("setShowBotStats").checked,
      autoDeleteCmd: document.getElementById("setAutoDeleteCmd").checked,
      dmFallback: document.getElementById("setDmFallback").checked,
      notifDowntime: document.getElementById("setNotifDowntime").checked,
      notifNewVersion: document.getElementById("setNotifNewVersion").checked,
      notifEconomyAlert: document.getElementById("setNotifEconomyAlert")
        .checked,
      notifSecurityAlert: document.getElementById("setNotifSecurityAlert")
        .checked,
    };

    this.putSettings(data, "Pengaturan umum disimpan");
  }

  saveEconomy() {
    if (!this.currentGuild) return;
    const data = {
      economy: {
        dailyMin: parseInt(document.getElementById("econDailyMin").value),
        dailyMax: parseInt(document.getElementById("econDailyMax").value),
        workMin: parseInt(document.getElementById("econWorkMin").value),
        workMax: parseInt(document.getElementById("econWorkMax").value),
        workCooldown: parseInt(
          document.getElementById("econWorkCooldown").value,
        ),
        bankInterest: parseFloat(
          document.getElementById("econBankInterest").value,
        ),
        bankMax: parseInt(document.getElementById("econBankMax").value),
        transferFee: parseFloat(
          document.getElementById("econTransferFee").value,
        ),
        minTransfer: parseInt(document.getElementById("econMinTransfer").value),
        taxRate: parseFloat(document.getElementById("econTaxRate").value),
      },
    };

    this.putSettings(data, "Pengaturan ekonomi disimpan");
  }

  saveMusic() {
    if (!this.currentGuild) return;
    const data = {
      music: {
        defaultVolume: parseInt(
          document.getElementById("musicDefaultVolume").value,
        ),
        defaultQuality: document.getElementById("musicDefaultQuality").value,
        normalize: document.getElementById("musicNormalize").checked,
        autoplay: document.getElementById("musicAutoplay").checked,
        crossfadeEnabled: document.getElementById("musicCrossfadeEnabled")
          .checked,
        crossfadeDuration: parseInt(
          document.getElementById("musicCrossfadeDuration").value,
        ),
        djEnabled: document.getElementById("musicDJEnabled").checked,
        djDefaultMode: document.getElementById("musicDJDefaultMode").value,
        djCooldown: parseInt(document.getElementById("musicDJCooldown").value),
        allowDJ: document.getElementById("musicAllowDJ").checked,
        djRoleOnly: document.getElementById("musicDJRoleOnly").checked,
        djRole: document.getElementById("musicDJRole").value,
        maxQueue: parseInt(document.getElementById("musicMaxQueue").value),
        maxSongDuration: parseInt(
          document.getElementById("musicMaxSongDuration").value,
        ),
      },
    };

    this.putSettings(data, "Pengaturan musik disimpan");
  }

  saveAdvanced() {
    if (!this.currentGuild) return;
    let poruNodes = null;
    try {
      const poruVal = document.getElementById("advPoruNodes").value;
      poruNodes = poruVal ? JSON.parse(poruVal) : null;
    } catch (e) {
      NauraOS.showToast({
        title: "Error",
        message: "Format JSON Poru Nodes tidak valid",
        type: "error",
      });
      return;
    }

    const data = {
      advanced: {
        lavalink: {
          host: document.getElementById("advLavalinkHost").value,
          port: parseInt(document.getElementById("advLavalinkPort").value),
          password: document.getElementById("advLavalinkPassword").value,
        },
        poruNodes,
        postgresUrl: document.getElementById("advPostgresUrl").value,
        mongoUrl: document.getElementById("advMongoUrl").value,
        redisUrl: document.getElementById("advRedisUrl").value,
        dbSsl: document.getElementById("advDbSsl").checked,
        aiPrimary: document.getElementById("advAiPrimary").value,
        aiTimeout: parseInt(document.getElementById("advAiTimeout").value),
        aiMaxTokens: parseInt(document.getElementById("advAiMaxTokens").value),
        aiCircuitBreaker: document.getElementById("advAiCircuitBreaker")
          .checked,
        rateLimitGlobal: parseInt(
          document.getElementById("advRateLimitGlobal").value,
        ),
        rateLimitPerUser: parseInt(
          document.getElementById("advRateLimitPerUser").value,
        ),
        antiRaid: document.getElementById("advAntiRaid").checked,
        antiSpam: document.getElementById("advAntiSpam").checked,
        linkFilter: document.getElementById("advLinkFilter").checked,
      },
    };

    this.putSettings(data, "Pengaturan lanjutan disimpan");
  }

  putSettings(data, successMsg) {
    fetch(`/api/settings/guild/${this.currentGuild}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.success) {
          NauraOS.showToast({
            title: "Berhasil",
            message: successMsg,
            type: "success",
          });
          this.loadSettings();
        } else {
          NauraOS.showToast({
            title: "Gagal",
            message: result.error,
            type: "error",
          });
        }
      })
      .catch((err) => {
        NauraOS.showToast({
          title: "Error",
          message: "Gagal menyimpan pengaturan",
          type: "error",
        });
      });
  }

  saveWelcomer() {
    if (!this.currentGuild) return;
    const data = {
      welcomer: {
        channelId: document.getElementById("welcomerChannel").value,
        message: document.getElementById("welcomerMessage").value,
        rulesChannelId: document.getElementById("welcomerRulesChannel").value,
        autoRoleId: document.getElementById("welcomerAutoRole").value,
      },
    };

    this.putSettings(data, "Welcomer disimpan");
  }

  previewWelcomer() {
    NauraOS.showModal({
      title: "Pratinjau Welcomer",
      content: `
        <div style="background:var(--bg-layer); border:1px solid var(--hairline); border-radius:var(--radius-xl); padding:var(--space-5);">
          <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-3);">
            <img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="" style="width:48px; height:48px; border-radius:50%; background:var(--bg-deep);">
            <div>
              <div style="font-weight:600; color:var(--ink);">Naura Hoshino</div>
              <div style="font-size:var(--text-xs); color:var(--text-muted);">Bot</div>
            </div>
          </div>
          <div id="welcomerPreviewText" style="font-size:var(--text-sm); color:var(--text-secondary); white-space:pre-line;">${this.escapeHtml(
            document.getElementById("welcomerMessage").value,
          )
            .replace(/{user}/g, "@User")
            .replace(/{server}/g, "Server Name")
            .replace(/{count}/g, "123")
            .replace(/{rules}/g, "#rules")
            .replace(/{mention}/g, "@User")}</div>
        </div>
      `,
      actions: [{ label: "Tutup", variant: "btn-primary", onClick: () => {} }],
    });
  }

  testWelcomer() {
    if (!this.currentGuild) return;
    fetch(`/api/settings/guild/${this.currentGuild}/welcomer/test`, {
      method: "POST",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Test Berhasil",
            message: "Pesan welcomer test telah dikirim",
            type: "success",
          });
        } else {
          NauraOS.showToast({
            title: "Gagal",
            message: data.error,
            type: "error",
          });
        }
      })
      .catch((err) => {
        NauraOS.showToast({
          title: "Error",
          message: "Gagal test welcomer",
          type: "error",
        });
      });
  }

  exportConfig() {
    fetch(`/api/settings/guild/${this.currentGuild}/export`)
      .then((r) => r.json())
      .then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const link = document.createElement("a");
        link.download = `naura-settings-${this.currentGuild}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
      })
      .catch((err) => {
        NauraOS.showToast({
          title: "Error",
          message: "Gagal ekspor config",
          type: "error",
        });
      });
  }

  importConfig() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          this.putSettings(data, "Config diimpor berhasil");
        } catch (err) {
          NauraOS.showToast({
            title: "Error",
            message: "File JSON tidak valid",
            type: "error",
          });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.settingsPage = new SettingsPage();
});

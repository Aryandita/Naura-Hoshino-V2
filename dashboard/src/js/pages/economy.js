/**
 * Economy Page - Economy Server
 * Saldo NC, Bank Vault, Transaksi, Pasar, Analitik Moneter, Kurs, Pajak
 */

class EconomyPage {
  constructor() {
    this.socket = null;
    this.currentGuild = null;
    this.analyticsChart = null;
    this.init();
  }

  init() {
    this.connectSocket();
    this.initCharts();
    this.loadGuilds();
    this.setupEventListeners();
  }

  connectSocket() {
    this.socket = io("/dashboard", {
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    this.socket.on("connect", () => {
      this.socket.emit("subscribe", { rooms: ["economy"] });
    });

    this.socket.on("economy:balance", (data) => this.updateBalance(data));
    this.socket.on("economy:transactions", (data) =>
      this.updateTransactions(data),
    );
  }

  initCharts() {
    if (typeof Chart === "undefined") return;
    const ctx = document.getElementById("econAnalyticsChart");
    if (ctx) {
      this.analyticsChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
          datasets: [
            {
              label: "In (NC)",
              data: [0, 0, 0, 0, 0, 0, 0],
              borderColor: "#22c55e",
              backgroundColor: "rgba(34,197,94,0.1)",
              fill: true,
              tension: 0.4,
              pointRadius: 0,
            },
            {
              label: "Out (NC)",
              data: [0, 0, 0, 0, 0, 0, 0],
              borderColor: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.1)",
              fill: true,
              tension: 0.4,
              pointRadius: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { color: "rgba(255,255,255,0.05)" },
              ticks: { color: "#94a3b8" },
            },
            y: {
              grid: { color: "rgba(255,255,255,0.05)" },
              ticks: { color: "#94a3b8" },
            },
          },
        },
      });
    }
  }

  loadGuilds() {
    fetch("/api/economy/guilds")
      .then((r) => r.json())
      .then((data) => {
        const select = document.getElementById("economyGuildDropdown");
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
          this.loadBalance();
        }
      })
      .catch((err) => console.warn("[Economy] Failed to load guilds:", err));
  }

  loadBalance() {
    if (!this.currentGuild) return;
    fetch(`/api/economy/user/balance?guildId=${this.currentGuild}`)
      .then((r) => r.json())
      .then((data) => this.updateBalance(data))
      .catch((err) => console.warn("[Economy] Failed to load balance:", err));

    fetch(`/api/economy/user/transactions?guildId=${this.currentGuild}`)
      .then((r) => r.json())
      .then((data) => this.updateTransactions(data.transactions || []))
      .catch((err) =>
        console.warn("[Economy] Failed to load transactions:", err),
      );
  }

  updateBalance(data) {
    document.getElementById("statNC").textContent = (
      data.nc || 0
    ).toLocaleString();
    document.getElementById("statBank").textContent = (
      data.bank || 0
    ).toLocaleString();
    document.getElementById("statTxCount").textContent = (
      data.txCount || 0
    ).toLocaleString();
    document.getElementById("statTxVolume").textContent =
      (data.txVolume || 0).toLocaleString() + " NC";
    document.getElementById("statTaxCollected").textContent = (
      data.taxCollected || 0
    ).toLocaleString();
  }

  updateTransactions(transactions) {
    const tbody = document.getElementById("econTxTable");
    if (!tbody) return;

    if (!transactions.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Tidak ada transaksi</td></tr>';
      return;
    }

    const filter = document.getElementById("econTxFilter")?.value || "all";
    const search =
      document.getElementById("econTxSearch")?.value?.toLowerCase() || "";

    const filtered = transactions.filter((tx) => {
      if (filter !== "all" && tx.type !== filter) return false;
      if (search && !tx.description?.toLowerCase().includes(search))
        return false;
      return true;
    });

    tbody.innerHTML =
      filtered
        .slice(0, 20)
        .map(
          (tx) => `
      <tr style="transition:background var(--duration-fast) var(--ease-out);">
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--text-muted);">${new Date(tx.timestamp).toLocaleString("id-ID")}</td>
        <td><span class="badge badge-${this.getTxBadgeClass(tx.type)}" style="font-size:var(--text-xs);">${tx.type}</span></td>
        <td style="font-size:var(--text-sm); color:var(--text-primary);">${this.escapeHtml(tx.counterparty || "-")}</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:${tx.direction === "in" ? "var(--color-success)" : "var(--color-error)"};">${tx.direction === "in" ? "+" : "-"}${(tx.amount || 0).toLocaleString()} NC</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--text-muted);">${(tx.fee || 0).toLocaleString()} NC</td>
        <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${(tx.balanceAfter || 0).toLocaleString()} NC</td>
        <td><span class="badge badge-success" style="font-size:var(--text-xs);">${tx.status || "completed"}</span></td>
      </tr>
    `,
        )
        .join("") ||
      '<tr><td colspan="7" style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Tidak ada transaksi match</td></tr>';
  }

  getTxBadgeClass(type) {
    const classes = {
      transfer: "primary",
      deposit: "success",
      withdraw: "warning",
      shop: "info",
      daily: "success",
      work: "info",
    };
    return classes[type] || "neutral";
  }

  setupEventListeners() {
    const guildSelect = document.getElementById("economyGuildDropdown");
    guildSelect?.addEventListener("change", (e) => {
      this.currentGuild = e.target.value;
      if (this.currentGuild) this.loadBalance();
    });

    const txFilter = document.getElementById("econTxFilter");
    const txSearch = document.getElementById("econTxSearch");
    txFilter?.addEventListener("change", () => this.loadBalance());
    txSearch?.addEventListener("input", () => this.loadBalance());

    document
      .getElementById("economyBtnRefresh")
      ?.addEventListener("click", () => this.loadBalance());
    document
      .getElementById("econBtnTransfer")
      ?.addEventListener("click", () => this.openTransferModal());
    document
      .getElementById("econBtnDeposit")
      ?.addEventListener("click", () => this.openDepositModal());
    document
      .getElementById("econBtnWithdraw")
      ?.addEventListener("click", () => this.openWithdrawModal());
    document
      .getElementById("econBtnDaily")
      ?.addEventListener("click", () => this.claimDaily());
    document
      .getElementById("econBtnWork")
      ?.addEventListener("click", () => this.startWork());
    document
      .getElementById("econBtnShop")
      ?.addEventListener(
        "click",
        () => (window.location.href = "/marketplace"),
      );
    document
      .getElementById("economyBtnRefresh")
      ?.addEventListener("click", () => this.loadBalance());
    document
      .getElementById("economyBtnDeposit")
      ?.addEventListener("click", () => this.openDepositModal());
    document
      .getElementById("econBtnConvert")
      ?.addEventListener("click", () => this.convertBridge());
  }

  openTransferModal() {
    NauraOS.showModal({
      title: "Transfer NC",
      content: `
        <div style="display:flex; flex-direction:column; gap:var(--space-4);">
          <div class="form-group">
            <label class="form-label">Penerima</label>
            <input type="text" id="modalTransferUser" class="form-input" placeholder="Username atau ID Discord" aria-label="Penerima">
          </div>
          <div class="form-group">
            <label class="form-label">Jumlah (NC)</label>
            <input type="number" id="modalTransferAmount" class="form-input" placeholder="1000" min="10" aria-label="Jumlah">
          </div>
          <div class="form-group">
            <label class="form-label">Catatan</label>
            <textarea id="modalTransferNote" class="form-textarea" rows="3" placeholder="Opsional" aria-label="Catatan"></textarea>
          </div>
        </div>
      `,
      actions: [
        { label: "Batal", variant: "btn-ghost", onClick: () => {} },
        {
          label: "Transfer",
          variant: "btn-primary",
          onClick: () => this.executeTransfer(),
        },
      ],
    });
  }

  executeTransfer() {
    const user = document.getElementById("modalTransferUser")?.value;
    const amount = parseInt(
      document.getElementById("modalTransferAmount")?.value,
    );
    if (!user || !amount || amount < 10) {
      NauraOS.showToast({
        title: "Error",
        message: "Isi penerima dan jumlah yang valid (min 10 NC)",
        type: "error",
      });
      return;
    }

    fetch("/api/economy/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guildId: this.currentGuild,
        to: user,
        amount,
        note: document.getElementById("modalTransferNote")?.value,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Berhasil",
            message: `Transfer ${amount} NC ke ${user}`,
            type: "success",
          });
          this.loadBalance();
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
          message: "Gagal melakukan transfer",
          type: "error",
        });
      });
  }

  openDepositModal() {
    NauraOS.showModal({
      title: "Deposit Bank",
      content: `
        <div style="display:flex; flex-direction:column; gap:var(--space-4);">
          <div class="form-group">
            <label class="form-label">Jumlah (NC)</label>
            <input type="number" id="modalDepositAmount" class="form-input" placeholder="10000" min="100" aria-label="Jumlah deposit">
            <p class="form-hint">Bunga harian 0.5% · Max deposit 10M NC</p>
          </div>
        </div>
      `,
      actions: [
        { label: "Batal", variant: "btn-ghost", onClick: () => {} },
        {
          label: "Deposit",
          variant: "btn-primary",
          onClick: () => this.executeDeposit(),
        },
      ],
    });
  }

  executeDeposit() {
    const amount = parseInt(
      document.getElementById("modalDepositAmount")?.value,
    );
    if (!amount || amount < 100) {
      NauraOS.showToast({
        title: "Error",
        message: "Jumlah minimum 100 NC",
        type: "error",
      });
      return;
    }

    fetch("/api/economy/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: this.currentGuild, amount }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: " deposited",
            message: `${amount.toLocaleString()} NC masuk bank`,
            type: "success",
          });
          this.loadBalance();
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
          message: "Gagal melakukan deposit",
          type: "error",
        });
      });
  }

  openWithdrawModal() {
    NauraOS.showModal({
      title: "Tarik Bank",
      content: `
        <div style="display:flex; flex-direction:column; gap:var(--space-4);">
          <div class="form-group">
            <label class="form-label">Jumlah (NC)</label>
            <input type="number" id="modalWithdrawAmount" class="form-input" placeholder="5000" min="100" aria-label="Jumlah tarik">
          </div>
        </div>
      `,
      actions: [
        { label: "Batal", variant: "btn-ghost", onClick: () => {} },
        {
          label: "Tarik",
          variant: "btn-primary",
          onClick: () => this.executeWithdraw(),
        },
      ],
    });
  }

  executeWithdraw() {
    const amount = parseInt(
      document.getElementById("modalWithdrawAmount")?.value,
    );
    if (!amount || amount < 100) {
      NauraOS.showToast({
        title: "Error",
        message: "Jumlah minimum 100 NC",
        type: "error",
      });
      return;
    }

    fetch("/api/economy/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: this.currentGuild, amount }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Berhasil",
            message: `${amount.toLocaleString()} NC ditarik dari bank`,
            type: "success",
          });
          this.loadBalance();
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
          message: "Gagal melakukan penarikan",
          type: "error",
        });
      });
  }

  claimDaily() {
    fetch("/api/economy/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: this.currentGuild }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Daily Reward",
            message: `+${data.amount.toLocaleString()} NC`,
            type: "success",
          });
          this.loadBalance();
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
          message: "Gagal klaim daily",
          type: "error",
        });
      });
  }

  startWork() {
    fetch("/api/economy/work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: this.currentGuild }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Kerja Selesai",
            message: `+${data.amount.toLocaleString()} NC`,
            type: "success",
          });
          this.loadBalance();
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
          message: "Gagal bekerja",
          type: "error",
        });
      });
  }

  convertBridge() {
    const amount = parseInt(document.getElementById("econBridgeAmount")?.value);
    if (!amount || amount < 1000) {
      NauraOS.showToast({
        title: "Error",
        message: "Minimum 1000 SC untuk konversi",
        type: "error",
      });
      return;
    }

    fetch("/api/economy/bridge/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: this.currentGuild, amountSC: amount }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Konversi Berhasil",
            message: `${amount.toLocaleString()} SC → ${data.amountPD.toLocaleString()} PD`,
            type: "success",
          });
          document.getElementById("econBridgeAmount").value = "";
          document.getElementById("econBridgePreview").textContent = "";
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
          message: "Gagal konversi",
          type: "error",
        });
      });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.economyPage = new EconomyPage();
});

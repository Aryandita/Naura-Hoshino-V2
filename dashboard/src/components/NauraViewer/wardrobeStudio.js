/**
 * wardrobeStudio.js - 3D Wardrobe & Costume Customizer Studio (NAURA OS)
 * Mengelola pemilihan shader dan material kosmetik 3D avatar Naura Hoshino
 * dengan persistensi LocalStorage dan reaktivitas interaktif.
 */

export const WARDROBE_SKINS = Object.freeze([
    {
        id: "cyberpunk",
        name: "Cyberpunk Neon",
        theme: "Tech & Holo",
        icon: "fa-solid fa-microchip",
        color: "#38bdf8",
        glow: "rgba(56, 189, 248, 0.4)",
        desc: "Aksen cyber cyan & magenta rim bernuansa kota masa depan Neo-Tokyo.",
        emissive: 0x38bdf8,
        emissiveIntensity: 0.25,
        metalness: 0.35,
        roughness: 0.38,
    },
    {
        id: "maid",
        name: "Gothic Maid",
        theme: "Monochrome Elegance",
        icon: "fa-solid fa-feather-pointed",
        color: "#9ca3af",
        glow: "rgba(156, 163, 175, 0.4)",
        desc: "Gaun monokromatik gelap dengan jahitan satin perak berwibawa.",
        emissive: 0x1f2937,
        emissiveIntensity: 0.12,
        metalness: 0.1,
        roughness: 0.6,
    },
    {
        id: "casual",
        name: "Pastel Kawaii",
        theme: "Sakura Blossom",
        icon: "fa-solid fa-heart",
        color: "#f472b6",
        glow: "rgba(244, 114, 182, 0.4)",
        desc: "Palet pastel peach & soft sakura pink ceria untuk suasana santai.",
        emissive: 0xf472b6,
        emissiveIntensity: 0.18,
        metalness: 0.12,
        roughness: 0.5,
    },
    {
        id: "adventurer",
        name: "Wilds Explorer",
        theme: "Naura Wilds Nature",
        icon: "fa-solid fa-compass",
        color: "#10b981",
        glow: "rgba(16, 185, 129, 0.4)",
        desc: "Seragam penjelajah rimba dengan aksen lumut emerald dan gesper tembaga.",
        emissive: 0x10b981,
        emissiveIntensity: 0.22,
        metalness: 0.25,
        roughness: 0.45,
    },
]);

const STORAGE_KEY = "naura_wardrobe_skin_v2";

export class WardrobeStudio {
    constructor(viewerInstance) {
        this.viewer = viewerInstance;
        this.currentSkin = this.getSavedSkin();
    }

    /**
     * Mendapatkan skin yang tersimpan di LocalStorage.
     * @returns {string}
     */
    getSavedSkin() {
        try {
            if (typeof localStorage !== "undefined") {
                return localStorage.getItem(STORAGE_KEY) || "cyberpunk";
            }
        } catch (_) {}
        return "cyberpunk";
    }

    /**
     * Menyimpan dan mengaplikasikan skin ke 3D viewer.
     * @param {string} skinId
     */
    equipSkin(skinId) {
        const found = WARDROBE_SKINS.find((s) => s.id === skinId.toLowerCase());
        const targetId = found ? found.id : "cyberpunk";

        this.currentSkin = targetId;

        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(STORAGE_KEY, targetId);
            }
        } catch (_) {}

        if (this.viewer && typeof this.viewer.setSkin === "function") {
            this.viewer.setSkin(targetId);
        }

        // Dispatch CustomEvent agar UI lain dapat tersinkronisasi
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("naura:skin_changed", {
                    detail: { skinId: targetId, config: found },
                }),
            );
        }

        return found;
    }

    /**
     * Render komponen studio kartu wardrobe ke dalam DOM container.
     * @param {HTMLElement} containerEl
     */
    renderTo(containerEl) {
        if (!containerEl) return;

        containerEl.innerHTML = `
      <div class="nv-wardrobe-studio grid grid-cols-2 gap-2.5 p-2">
        ${WARDROBE_SKINS.map((skin) => {
            const isEquipped = skin.id === this.currentSkin;
            return `
            <button class="nv-wardrobe-card p-3 rounded-xl border transition-all text-left relative overflow-hidden group ${
                isEquipped
                    ? "border-pink-500 bg-pink-950/20 shadow-lg shadow-pink-500/10"
                    : "border-white/10 bg-black/40 hover:border-white/30"
            }" data-skin-id="${skin.id}">
              <div class="flex items-center gap-2 mb-1.5">
                <i class="${skin.icon}" style="color: ${skin.color};"></i>
                <span class="text-xs font-semibold text-white tracking-wide">${skin.name}</span>
                ${isEquipped ? `<span class="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-pink-500 text-white font-mono">ACTIVE</span>` : ""}
              </div>
              <p class="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">${skin.desc}</p>
              <div class="absolute bottom-0 left-0 h-0.5 w-full transition-all" style="background-color: ${skin.color}; opacity: ${isEquipped ? "1" : "0.3"};"></div>
            </button>
          `;
        }).join("")}
      </div>
    `;

        containerEl.querySelectorAll(".nv-wardrobe-card").forEach((card) => {
            card.addEventListener("click", () => {
                const skinId = card.dataset.skinId;
                this.equipSkin(skinId);
                this.renderTo(containerEl); // Re-render untuk memperbarui badge active
            });
        });
    }
}

export default WardrobeStudio;

# 🌿 Plugin Survival - Naura Wilds RPG System

> Direktori ini adalah **entry point** untuk seluruh fitur survival RPG "Naura Wilds". Berisi router command utama dan 60+ subcommand yang mencakup ekonomi, combat, crafting, sosial, dan eksplorasi.

## 📋 Entry Points

| File | Deskripsi |
|------|-----------|
| `survival.js` | Router utama `/survival` - mendistribusikan ke subcommand berdasarkan action |
| `rpg.js` | Router alternatif `/rpg` - alias untuk kompatibilitas backward |

### Subcommands (`subcommands/`) - 60+ Commands

#### 💰 Ekonomi & Perdagangan
| File | Deskripsi |
|------|-----------|
| `wallet.js` | Cek saldo SC/PD/VB/BA pemain |
| `bank.js` | Deposit, withdraw, transfer antar pemain |
| `market.js` | Player marketplace (jual/beli item) |
| `auction.js` | Sistem lelang item langka |
| `trade.js` | Direct trade antar pemain dengan escrow |
| `shop.js` | NPC shop & dynamic pricing |

#### ⚔️ Combat & PvE
| File | Deskripsi |
|------|-----------|
| `arena.js` | PvP arena ranked matchmaking |
| `duel.js` | 1v1 duel dengan taruhan |
| `dungeon.js` | Instanced dungeon crawler |
| `customDungeon.js` | User-generated dungeon |
| `raid.js` | Multi-player raid boss |
| `raidplan.js` | Raid planning & scheduling tool |
| `siege.js` | Guild siege warfare |
| `abyss.js` | Endgame abyss challenge |
| `bounty.js` | Bounty hunting system |
| `heist.js` | Stealth-based heist mission |

#### 🏕️ Eksplorasi & Gathering
| File | Deskripsi |
|------|-----------|
| `roam.js` | Open world exploration |
| `travel.js` | Fast travel antar region |
| `expedition.js` | Timed expedition missions |
| `mine.js` | Mining & ore gathering |
| `chop.js` | Woodcutting |
| `fish.js` | Fishing minigame |
| `collect.js` | Resource collection |
| `farm.js` | Farming & agriculture |

#### 🔨 Crafting & Progression
| File | Deskripsi |
|------|-----------|
| `craft.js` | Item crafting system |
| `forge.js` | Equipment forging |
| `enchant.js` | Enchantment system |
| `class.js` | Class selection & specialization |
| `skill.js` | Skill tree & abilities |
| `rebirth.js` | Prestige/rebirth system |
| `study.js` | Knowledge & research |

#### 👥 Sosial & Komunitas
| File | Deskripsi |
|------|-----------|
| `clan.js` | Clan management & wars |
| `federation.js` | Multi-clan federation |
| `family.js` | Family/marriage system |
| `town.js` | Town square & community board |
| `house.js` | Personal housing |
| `pet.js` | Pet companion system |
| `npc.js` | NPC interaction & quests |

#### 📦 Inventory & Items
| File | Deskripsi |
|------|-----------|
| `inventory.js` | Inventory management |
| `inventorySortFilter.js` | Sort & filter helpers |
| `consume.js` | Use consumable items |
| `gallery.js` | Collection/cosmetic gallery |
| `gacha.js` | Gacha/loot box system |

#### 🎯 Quests & Events
| File | Deskripsi |
|------|-----------|
| `quest.js` | Main questline |
| `dailyQuest.js` | Daily rotating quests |
| `story.js` | Narrative story mode |
| `event.js` | Seasonal events |
| `pass.js` | Battle pass system |
| `achievements.js` | Achievement tracker |

#### ℹ️ Informasi & Utility
| File | Deskripsi |
|------|-----------|
| `info.js` | Player stats & profile |
| `start.js` | New player onboarding |
| `guide.js` | In-game tutorial |
| `history.js` | Transaction/activity history |
| `chronicle.js` | Server-wide chronicle log |
| `conquest.js` | Territory conquest map |
| `rest.js` | Rest & recovery mechanic |
| `work.js` | Job/work system |
| `date.js` | In-game calendar |
| `quick.js` | Quick actions shortcut |

## 🏗️ Pola Arsitektur

### 1. Router Pattern
`survival.js` bertindak sebagai dispatcher murni - tidak ada logika bisnis:
```javascript
const action = interaction.options.getSubcommand();
const handler = require(`./subcommands/${action}`);
await handler.execute(interaction, client);
```

### 2. Adapt Survival Interaction
Button/select menu interactions **wajib** dibungkus sebelum diteruskan:
```javascript
const adapted = adaptSurvivalInteraction(interaction, action);
await subcommandHandler.execute(adapted, client);
```

### 3. Atomic Economy Transactions
Semua mutasi saldo melalui `cacheManager` atau `transactionHelper`:
```javascript
// Numerik
await cacheManager.incrementUserSurvival(userId, { sukamajuCoins: amount });

// JSON inventory
await cacheManager.mutateUserProfileJson(userId, 'inventory', (inv) => {
  inv.push(newItem);
  return inv;
});

// Pembayaran berisiko
await executeAtomicPayment({ userId, amount, currency: 'SC', action: 'buy_item' });
```

### 4. Partial Patch Updates
Jangan mutasi seluruh objek UserSurvival - gunakan patch parsial:
```javascript
const patch = { hunger: newHunger, energy: newEnergy };
await cacheManager.updateUserSurvival(userId, patch);
```

### 5. Collector Lifecycle Management
Stop collector lama saat navigasi UI:
```javascript
stopMessageCollector(messageId, 'navigated');
```

## 🔗 Navigasi Terkait

- **Core Survival Logic:** `src/survival/` (currency, durability, town engine)
- **Cache Layer:** `src/managers/cacheManager.js`
- **Transaction Helper:** `src/utils/transactionHelper.js`
- **Survival UI Tokens:** `src/utils/survivalUIHelper.js`
- **Domain Contracts:** `src/domain/contracts/survivalContract.js`
- **Models:** `src/models/UserSurvival.js`, `src/models/ServerTreasury.js`
- **Localization:** `assets/language/id.json` key prefix `survival.*`
- **Rules:** [`RULES.md`](../../RULES.md) Bagian 2 (Survival Economy) & Bagian 5 (Fatal Gotchas #8, #10)

## ⚠️ Peringatan Kritis

1. **Jangan read-modify-write saldo** - selalu gunakan atomic increment/debit
2. **Jangan mutasi seluruh UserSurvival** - gunakan partial patch
3. **Wrap ButtonInteraction** dengan `adaptSurvivalInteraction()` sebelum forward
4. **Jangan hapus pesan kartu utama** saat membalas ephemeral dari tombol
5. **Stop collector dengan `'navigated'`** saat berpindah layar
6. **Hardcode warna dilarang** - gunakan `survivalUIHelper.js` tokens
7. **Maksimal 25 subcommands** per root command (Discord API limit)

---

*Dokumentasi ini ditujukan untuk developer junior. Untuk detail arsitektur lengkap, baca [`AGENTS.md`](../../AGENTS.md) Bagian 7 (Diagram Alur) dan [`PRD.md`](../../PRD.md) untuk spesifikasi produk.*

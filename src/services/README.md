# ⚙️ Services Layer - Engine Komputasi Latar

> Direktori ini berisi **service modules** yang menangani logika bisnis latar belakang, integrasi API pihak ketiga, game engines, dan otomatisasi. Services bersifat stateless atau memiliki state internal terbatas, dan dipanggil oleh managers/plugins.

## 📋 Daftar Services

### 🎵 Audio & Musik
| File | Deskripsi |
|------|-----------|
| `soundboardService.js` | Web soundboard studio - upload, play, manage clips |
| `fishAudioService.js` | Fish Audio TTS API integration (model s1/tts-1) |
| `aiDjTrackService.js` | AI DJ track recommendation & queue management |
| `lyricsService.js` | Song lyrics fetching & display |
| `radioService.js` | Internet radio stream integration |
| `musicAuraService.js` | Music-reactive visual aura effects |
| `voiceCompanionService.js` | Voice channel AI companion interaction |

### 💰 Ekonomi & Game Engines
| File | Deskripsi |
|------|-----------|
| `blackjackEngine.js` | Blackjack card game logic (pure computation) |
| `cardBattleEngine.js` | Card battle system with deck building |
| `tarotEngine.js` | Tarot reading engine with interpretation |
| `predictionEngine.js` | Prediction market & betting engine |
| `stockMarketEngine.js` | Virtual stock market simulation |
| `typeRaceEngine.js` | Typing speed race minigame |
| `territoryWarEngine.js` | Territory control war mechanics |
| `seasonEngine.js` | Seasonal event rotation engine |
| `gemSocketEngine.js` | Gem socketing & enhancement system |
| `economyGuardEngine.js` | Anti-exploit economy protection |
| `bountyVaultEngine.js` | Bounty vault reward calculation |
| `tradeEngine.js` | Player-to-player trade validation |

### 👑 Premium & Entitlement
| File | Deskripsi |
|------|-----------|
| `entitlementService.js` | Discord SKU sync & premium tier management |
| `voteService.js` | Top.gg vote rewards & VIP Starter grants |
| `premiumReminderService.js` | Smart DM reminder before VIP expiry |
| `couponExpiryNotifier.js` | Coupon expiration notification service |
| `referralRewardService.js` | Referral program reward distribution |

### 📡 Integrasi & Webhook
| File | Deskripsi |
|------|-----------|
| `webhookDispatcher.js` | Outbound webhook dispatch utility |
| `farmNotificationWebhook.js` | Farm event webhook notifications |
| `minecraftBridge.js` | Minecraft server bridge integration |
| `webPushService.js` | Web push notification delivery |
| `telemetryMetrics.js` | Telemetry data collection & export |

### 🛠️ Moderasi & Utility
| File | Deskripsi |
|------|-----------|
| `reportService.js` | User report processing & storage |
| `appealService.js` | Moderation appeal handling |
| `incidentService.js` | Incident tracking & resolution |
| `roleSyncService.js` | Cross-server role synchronization |
| `nicknameHistoryService.js` | Nickname change history tracking |
| `reactionRoleService.js` | Reaction role assignment logic |
| `aliasService.js` | Command alias resolution |
| `accessKeyService.js` | API access key generation & validation |
| `sandboxService.js` | Sandboxed code execution environment |

### 🎮 Player Engagement
| File | Deskripsi |
|------|-----------|
| `dailyRewardService.js` | Daily login reward distribution |
| `dailyChallengeService.js` | Daily challenge generation & tracking |
| `leaderboardService.js` | Leaderboard computation & caching |
| `leaderboardRotationService.js` | Leaderboard period rotation |
| `milestoneTrackerService.js` | Player milestone detection & rewards |
| `playerTitleService.js` | Title/unlock management |
| `mailboxService.js` | In-game mailbox delivery system |
| `onboardingWizard.js` | New user onboarding flow |
| `welcomeCardService.js` | Welcome card image generation |
| `astralService.js` | Astral/gacha pull system |
| `arcadeDailyService.js` | Arcade daily rotation manager |

### 🔄 Automation & Scheduling
| File | Deskripsi |
|------|-----------|
| `automationEngine.js` | Generic automation rule engine |
| `eventSchedulerService.js` | Scheduled event management |
| `afkDetectorService.js` | AFK status detection & auto-reply |
| `combatLogService.js` | Combat log recording & retrieval |
| `durabilityWarningService.js` | Item durability low-warning alerts |
| `notificationCenter.js` | Centralized notification dispatch |
| `apiHealthService.js` | API health check monitoring |
| `economyAuditService.js` | Economy transaction audit logging |

### 📝 Registry & Configuration
| File | Deskripsi |
|------|-----------|
| `commandRegistry.js` | Slash command auto-registration & sync |
| `capsuleService.js` | Time capsule creation & retrieval |
| `voiceRewards.js` | Voice activity reward distribution |

## 🏗️ Pola Arsitektur

### 1. Pure Computation Engines
Game engines (`*Engine.js`) adalah **fungsi murni** tanpa side effects:
```javascript
// Input -> Output, tanpa DB call
function calculateBlackjackResult(hand, dealerHand) {
  // pure logic only
  return { winner, payout };
}
```

### 2. Service vs Manager Boundary
- **Services**: Stateless/pure logic, API integration, computation
- **Managers**: Stateful, lifecycle management, caching, DB connections

### 3. Failover & Circuit Breaker
Services yang memanggil API eksternal wajib implement circuit breaker:
```javascript
async function callExternalAPI(endpoint) {
  if (circuitBreaker.isOpen()) throw new Error('Circuit open');
  try {
    const result = await fetch(endpoint);
    circuitBreaker.recordSuccess();
    return result;
  } catch (err) {
    circuitBreaker.recordFailure();
    throw err;
  }
}
```

### 4. Test Co-location
Setiap service memiliki test file berdampingan (`*.test.js`) untuk unit testing.

## 🔗 Navigasi Terkait

- **Managers (Stateful):** [`src/managers/`](../managers/README.md)
- **Survival Core:** `src/survival/`
- **AI Ensemble:** `src/ai/`
- **Domain Contracts:** `src/domain/contracts/`
- **Canvas Workers:** `src/canvas/`
- **Config:** `src/config/env.js`, `src/config/database.js`
- **Rules:** [`RULES.md`](../../RULES.md) Bagian 3.8 (Circuit Breaker) & Bagian 3.11 (Premium Ecosystem)

## ⚠️ Konvensi Penamaan

- `*Service.js` - Integrasi API, notifikasi, utility background
- `*Engine.js` - Pure computation, game logic, deterministic
- `*Notifier.js` - Notification-specific services
- `*.test.js` - Unit tests (co-located)

---

*Dokumentasi ini ditujukan untuk developer junior. Untuk detail pola transaksi atomik, baca [`RULES.md`](../../RULES.md).*

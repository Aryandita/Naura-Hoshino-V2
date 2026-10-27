# 🎵 REFACTORING PLAN: lavalinkClusterManager.js

**File:** `src/managers/lavalinkClusterManager.js`  
**Current Score:** 7/10  
**Target Score:** 9/10  
**Lines:** 986  
**Estimated Effort:** 10-14 hours  
**Priority:** #1 (Highest Impact)

---

## 📋 PROBLEM ANALYSIS

### Critical Issues Identified:

1. **File terlalu besar (986 baris)** dengan banyak tanggung jawab berbeda
2. **Fungsi `migratePlayer` kompleks (112 baris)** - lock management, snapshot, dual-path migration
3. **Fungsi `getPreferredNode` rumit (75 baris)** - multi-tier filtering + scoring algorithm
4. **ANSI escape codes inline** - mengganggu keterbacaan di setiap logger call
5. **Shard health evaluator** - fitur terpisah yang tidak seharusnya ada di audio manager
6. **Magic numbers** - threshold `450`, guild limit `1500` tanpa penjelasan
7. **Method `probeNodeLatencies` dan `detectPacketDropAnomalies`** - hubungan tidak eksplisit

---

## 🎯 REFACTORING STRATEGY: Modular Decomposition

Pecah file menjadi **4 modul terpisah** dengan tanggung jawab jelas:

```
src/managers/
├── lavalinkClusterManager.js      (Core orchestrator - ~300 lines)
├── lavalink/
│   ├── circuitBreaker.js          (Circuit breaker logic - ~150 lines)
│   ├── nodeSelector.js            (Tier selection + Hi-Fi - ~200 lines)
│   ├── playerMigrator.js          (Migration logic - ~180 lines)
│   └── shardHealthEvaluator.js    (Shard health - moved to utils/)
```

---

## 📦 MODULE BREAKDOWN

### Module 1: `circuitBreaker.js` (~150 lines)
**Responsibility:** Circuit breaker state management and node quarantine

**Extracted Methods:**
- `recordNodeError(nodeName, error)` - Record failure and evaluate CB state
- `_evaluateCircuitBreaker(nodeName, cb)` - State transition logic (CLOSED → OPEN → HALF-OPEN)
- `isNodeAvailable(nodeName)` - Check if node is quarantined
- `resetCircuitBreaker(nodeName)` - Manual reset after recovery
- `getCircuitBreakerState(nodeName)` - Get current CB state for monitoring

**Constants:**
```javascript
const CB_CONFIG = {
  ERROR_THRESHOLD: 3,        // Max consecutive errors before opening
  WINDOW_MS: 30000,          // Time window for error counting (30s)
  QUARANTINE_MS: 300000,     // Quarantine duration (5 minutes)
};

const CB_STATE = {
  CLOSED: 'CLOSED',          // Normal operation
  OPEN: 'OPEN',              // Node quarantined
  HALF_OPEN: 'HALF_OPEN',    // Testing if node recovered
};
```

**Benefits:**
- Isolated CB logic mudah di-test
- Reusable untuk service lain (Redis, HTTP clients)
- Clear state machine documentation

---

### Module 2: `nodeSelector.js` (~200 lines)
**Responsibility:** Tiered node selection with capability discovery and Hi-Fi federation

**Extracted Methods:**
- `buildTieredNodeList(configuredPrivateNodes)` - Combine private + public nodes
- `loadPublicFallbackNodes()` - Load from config or hardcoded defaults
- `getPreferredNode(guildId, options)` - Multi-tier selection algorithm
- `discoverNodeCapabilities(node)` - Probe REST /v4/info endpoint
- `registerHiFiNode(nodeName, config)` - Register lossless-capable node
- `selectHiFiNode(guildId)` - Select best Hi-Fi node for guild

**Constants:**
```javascript
const NODE_TIERS = {
  PRIMARY: 1,       // Private main node
  SECONDARY: 2,     // Private backup
  FALLBACK: 3,      // Public pool
};

const LATENCY_THRESHOLDS = {
  EXCELLENT: 100,   // < 100ms
  GOOD: 200,        // < 200ms
  FAIR: 450,        // < 450ms (threshold magic number explained!)
  POOR: Infinity,   // > 450ms
};

const MAX_GUILDS_PER_NODE = 1500;  // Magic number now documented!
```

**Benefits:**
- Selection algorithm terisolasi dan testable
- Hi-Fi logic terpisah dari core cluster
- Capability discovery reusable

---

### Module 3: `playerMigrator.js` (~180 lines)
**Responsibility:** Zero-drop player migration during node failures

**Extracted Methods:**
- `migratePlayer(player, targetNode)` - Main migration orchestrator
- `_capturePlayerSnapshot(player)` - Save queue, position, volume, filters
- `_acquireMigrationLock(guildId)` - Prevent duplicate migrations
- `_releaseMigrationLock(guildId)` - Cleanup after migration
- `_restorePlayerState(player, snapshot)` - Restore from snapshot
- `_executeMoveNode(player, targetNode)` - Try moveNode API first
- `_executeReconnect(player, targetNode)` - Fallback to reconnect if moveNode fails

**Types:**
```javascript
/**
 * @typedef {Object} PlayerSnapshot
 * @property {string} track - Current track identifier
 * @property {number} position - Playback position in ms
 * @property {number} volume - Volume level (0-1000)
 * @property {boolean} paused - Pause state
 * @property {Object} filters - Active audio filters
 * @property {Array} queue - Queued tracks
 */
```

**Benefits:**
- Migration logic complex tapi terisolasi
- Lock mechanism jelas dan documented
- Dual-path strategy (moveNode vs reconnect) explained

---

### Module 4: Core `lavalinkClusterManager.js` (~300 lines)
**Responsibility:** Orchestrate all modules, manage lifecycle, health probes

**Remaining Methods:**
- Constructor - Initialize all sub-modules
- `initialize(client)` - Setup Poru client and event handlers
- `startHealthProbes()` - Schedule periodic latency probes
- `probeNodeLatencies()` - Measure RTT to all nodes
- `detectPacketDropAnomalies()` - Identify problematic nodes
- `shutdown()` - Graceful cleanup

**Integration Pattern:**
```javascript
class LavalinkClusterManager {
  constructor() {
    this.circuitBreaker = new CircuitBreakerManager();
    this.nodeSelector = new NodeSelector();
    this.playerMigrator = new PlayerMigrator(this.circuitBreaker);
    
    // ... other state
  }
  
  getPreferredNode(guildId, options) {
    return this.nodeSelector.getPreferredNode(guildId, options);
  }
  
  recordNodeError(nodeName, error) {
    this.circuitBreaker.recordNodeError(nodeName, error);
  }
  
  async migratePlayer(player, targetNode) {
    return this.playerMigrator.migratePlayer(player, targetNode);
  }
}
```

**Benefits:**
- Clear separation of concerns
- Sub-modules injectable dan testable
- Core orchestrator fokus pada lifecycle

---

### Bonus: Move `shardHealthEvaluator.js` to `src/utils/`
**Reason:** Shard health evaluation bukan tanggung jawab audio cluster

**Extracted Methods:**
- `evaluateShardHealth(shardId, metrics)` - Assess shard performance
- `calculateShardScore(metrics)` - Compute health score
- `getShardStatus(shardId)` - Get human-readable status

**New Location:** `src/utils/shardHealthEvaluator.js`

---

## 🔧 ADDITIONAL IMPROVEMENTS

### 1. Logger Helper Utility
Create `src/utils/loggerBanner.js`:
```javascript
const ANSI = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  MAGENTA_BG: '\x1b[45m',
  WHITE_FG: '\x1b[37m',
};

function logWithBanner(level, banner, message) {
  const prefix = `${ANSI.MAGENTA_BG}${ANSI.WHITE_FG} ${banner} ${ANSI.RESET}`;
  logger[level](`${prefix} ${message}`);
}

// Usage:
logWithBanner('info', '🎵 AUDIO CLUSTER', `Registered ${count} nodes`);
```

**Benefits:**
- No more inline ANSI codes
- Consistent banner formatting
- Easy to change colors globally

### 2. Flowchart Comments
Add ASCII diagrams for complex algorithms:

```javascript
/**
 * Node Selection Algorithm:
 * 
 * ┌─────────────────┐
 * │ Get All Nodes   │
 * └────────┬────────┘
 *          ▼
 * ┌─────────────────┐
 * │ Filter by Tier  │ ← Priority: Tier 1 > 2 > 3
 * └────────┬────────┘
 *          ▼
 * ┌─────────────────┐
 * │ Filter by CB    │ ← Exclude OPEN/HALF_OPEN
 * └────────┬────────┘
 *          ▼
 * ┌─────────────────┐
 * │ Sort by Latency │ ← Lowest RTT first
 * └────────┬────────┘
 *          ▼
 * ┌─────────────────┐
 * │ Check Capacity  │ ← < 1500 guilds
 * └────────┬────────┘
 *          ▼
 * ┌─────────────────┐
 * │ Return Best     │
 * └─────────────────┘
 */
```

### 3. Named Constants for All Magic Numbers
```javascript
const HEALTH_PROBE_INTERVAL_MS = 60000;    // 1 minute
const LATENCY_TIMEOUT_MS = 5000;           // 5 seconds
const MAX_RETRIES = 3;                     // Retry attempts
const PACKET_LOSS_THRESHOLD = 0.05;        // 5% packet loss = anomaly
```

---

## ✅ VALIDATION CHECKLIST

### Per Module:
- [ ] Syntax check passed (`node -c`)
- [ ] JSDoc coverage 100%
- [ ] No magic numbers
- [ ] Max function length ≤ 50 lines
- [ ] Max nesting depth ≤ 2 levels
- [ ] Unit tests created/passed
- [ ] Integration with core verified

### Overall:
- [ ] All existing callers work without changes
- [ ] Backward compatibility maintained
- [ ] Performance not degraded
- [ ] Error handling preserved
- [ ] Logging output unchanged

---

## 📊 EXPECTED OUTCOMES

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Readability Score | 7/10 | 9/10 | +29% |
| Lines per File | 986 | ~300 (core) | -70% cognitive load |
| Max Function Length | 112 lines | ≤50 lines | -55% |
| Test Coverage | Low | High | Modular testing |
| Maintainability | Low | High | Clear boundaries |

---

## ⚠️ RISKS & MITIGATIONS

### Risk 1: Breaking Changes
**Mitigation:** Keep public API surface identical. Internal refactoring only.

### Risk 2: Performance Regression
**Mitigation:** Benchmark before/after. Module calls should add <1ms overhead.

### Risk 3: Incomplete Migration
**Mitigation:** Migrate one module at a time. Test each independently.

### Risk 4: Circular Dependencies
**Mitigation:** Careful dependency graph. Use dependency injection where needed.

---

## 🕒 EXECUTION TIMELINE

### Phase 1: Preparation (1 hour)
- [ ] Create `src/managers/lavalink/` directory
- [ ] Create logger banner utility
- [ ] Document current behavior with tests

### Phase 2: Extract circuitBreaker.js (2-3 hours)
- [ ] Extract CB logic
- [ ] Write unit tests
- [ ] Integrate with core
- [ ] Validate no regressions

### Phase 3: Extract nodeSelector.js (3-4 hours)
- [ ] Extract selection algorithm
- [ ] Extract Hi-Fi logic
- [ ] Add flowchart comments
- [ ] Test tier selection

### Phase 4: Extract playerMigrator.js (3-4 hours)
- [ ] Extract migration logic
- [ ] Implement lock mechanism
- [ ] Test dual-path strategy
- [ ] Verify zero-drop behavior

### Phase 5: Move shardHealthEvaluator.js (1 hour)
- [ ] Extract to utils/
- [ ] Update imports
- [ ] Verify functionality

### Phase 6: Refactor Core (2-3 hours)
- [ ] Simplify constructor
- [ ] Wire up sub-modules
- [ ] Add integration tests
- [ ] Final validation

### Phase 7: Documentation (1 hour)
- [ ] Create folder README
- [ ] Update AGENTS.md references
- [ ] Document breaking changes (if any)

**Total Estimated Time:** 13-17 hours

---

## 📝 NOTES

- This is the most complex refactoring in the project
- Take breaks between phases to avoid fatigue
- Test thoroughly after each phase
- Document decisions and trade-offs
- Consider pair programming/review for critical sections

---

**Last Updated:** 2026-10-25  
**Status:** Planning Complete - Ready for Execution  
**Next Step:** Begin Phase 1 (Preparation)

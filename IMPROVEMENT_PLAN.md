# 🎯 EXECUTABLE IMPROVEMENT PLAN
## Naura Hoshino V2 - Action Items & Tasks

**Created:** 2026-10-25  
**Owner:** Development Team  
**Status:** Active  

---

## 📋 TASK BREAKDOWN (Priority Order)

### 🔴 CRITICAL (Do Today)

#### Task 1: Organize Uncommitted Changes
**Estimated Time:** 2-3 hours  
**Impact:** High  
**Files Affected:** 345 files

**Steps:**
```bash
# 1. Check current status
git status --short > uncommitted_files.txt

# 2. Group by feature area
# Create separate commits for:
# - Dashboard animations (9 files)
# - E2E tests (4 files)
# - Survival engines (15 files)
# - Visual novel system (8 files)
# - Documentation (7 files)
# - Localization (2 files)
# - Config/utils (20+ files)

# 3. Commit each group with proper message format
git add <files>
git commit -m "<emoji> <type>: <description>"
```

**Acceptance Criteria:**
- [ ] All 345 files committed or intentionally ignored
- [ ] Each commit follows 3-tier message format
- [ ] No unrelated files in same commit
- [ ] QA gate still passes after all commits

---

#### Task 2: Add Unit Tests for New Commands
**Estimated Time:** 2 hours  
**Impact:** High  
**Files to Create:** 3 test files

**Test File Template:**
```javascript
// plugin/survival/subcommands/chronicle.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

test("chronicle command - generates narration", async () => {
  // Test implementation
});

test("chronicle command - handles invalid event type", async () => {
  // Test error handling
});

test("chronicle command - supports all narrative styles", async () => {
  // Test all 5 styles
});
```

**Acceptance Criteria:**
- [ ] chronicle.test.js created with 5+ tests
- [ ] raidplan.test.js created with 5+ tests
- [ ] analyze.test.js created with 5+ tests
- [ ] All tests pass (`npm test`)
- [ ] Coverage > 80% for command logic

---

### 🟡 HIGH PRIORITY (This Week)

#### Task 3: Database Performance Optimization
**Estimated Time:** 3-4 hours  
**Impact:** Critical  
**Location:** Database indexes, cacheManager.js

**Action Items:**
1. **Create index optimization script**
```javascript
// scripts/optimize-db-indexes.js
const queries = [
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_userid ON "UserProfiles" ("userId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_userid ON "UserSurvivals" ("userId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guildsettings_guildid ON "GuildSettings" ("guildId")',
];

async function optimizeIndexes() {
  const { sequelize } = require("../src/managers/dbManager");
  
  for (const query of queries) {
    try {
      await sequelize.query(query);
      console.log(`✅ Created index: ${query.substring(0, 50)}...`);
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
    }
  }
}

optimizeIndexes();
```

2. **Profile slow queries**
```bash
# Enable query logging temporarily
NODE_ENV=development node index.js

# Monitor logs for SLOW QUERY warnings
grep "SLOW QUERY" logs/naura.log | sort | uniq -c | sort -rn
```

3. **Tune connection pool**
```javascript
// src/config/database.js
const poolConfig = {
  max: 20,        // Increase from default 5
  min: 5,         // Keep warm connections
  idle: 30000,    // 30s idle timeout
  acquire: 60000, // 60s acquire timeout
};
```

**Acceptance Criteria:**
- [ ] Index optimization script created
- [ ] Query time reduced to < 200ms (p95)
- [ ] No more SLOW QUERY warnings in logs
- [ ] Connection pool tuned for production load

---

#### Task 4: Expand E2E Test Coverage
**Estimated Time:** 4-5 hours  
**Impact:** High  
**Location:** dashboard/tests/e2e/

**Test Suites to Add:**
```javascript
// dashboard/tests/e2e/soundboard.spec.js
test.describe("Soundboard Studio", () => {
  test("should play preset sound", async ({ page }) => {
    // Implementation
  });
  
  test("should upload custom sound", async ({ page }) => {
    // Implementation
  });
  
  test("should respect cooldown", async ({ page }) => {
    // Implementation
  });
});

// dashboard/tests/e2e/automod.spec.js
test.describe("Automod Studio", () => {
  test("should configure anti-spam settings", async ({ page }) => {
    // Implementation
  });
  
  test("should add bad words filter", async ({ page }) => {
    // Implementation
  });
});

// dashboard/tests/e2e/economy.spec.js
test.describe("Economy Analyzer", () => {
  test("should display currency health", async ({ page }) => {
    // Implementation
  });
  
  test("should show balancing recommendations", async ({ page }) => {
    // Implementation
  });
});
```

**Acceptance Criteria:**
- [ ] soundboard.spec.js created (5+ tests)
- [ ] automod.spec.js created (5+ tests)
- [ ] economy.spec.js created (5+ tests)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Test coverage report generated

---

#### Task 5: AI Model Health Monitoring
**Estimated Time:** 3-4 hours  
**Impact:** Medium  
**Location:** src/ai/, dashboard/routes/api/

**Implementation Plan:**
1. **Create model status endpoint**
```javascript
// dashboard/routes/api/ai-models.js
router.get("/api/ai/models/status", async (req, res) => {
  const models = {
    gemini: { status: "unknown", latency: null, lastCheck: null },
    groq: { status: "unknown", latency: null, lastCheck: null },
    ollama: { status: "unknown", latency: null, lastCheck: null },
  };
  
  // Ping each provider
  for (const [provider, config] of Object.entries(models)) {
    const start = Date.now();
    try {
      await pingProvider(provider);
      config.status = "healthy";
      config.latency = Date.now() - start;
    } catch (error) {
      config.status = "unhealthy";
      config.error = error.message;
    }
    config.lastCheck = new Date().toISOString();
  }
  
  res.json(models);
});
```

2. **Add automatic failover trigger**
```javascript
// src/ai/aiEnsembleRouter.js
const MODEL_HEALTH_THRESHOLD = 2000; // 2 seconds
const CONSECUTIVE_FAILURES_THRESHOLD = 5;

let failureCounters = { gemini: 0, groq: 0 };

async function selectOptimalModel(taskType) {
  // Check recent performance
  if (failureCounters.gemini >= CONSECUTIVE_FAILURES_THRESHOLD) {
    logger.warn("[AiRouter] Gemini degraded, switching to Groq");
    return "groq";
  }
  
  // Normal selection logic
  return getDefaultModel(taskType);
}
```

**Acceptance Criteria:**
- [ ] /api/ai/models/status endpoint working
- [ ] Automatic failover triggers on degradation
- [ ] Dashboard shows model health indicators
- [ ] Alerts sent when all providers unhealthy

---

### 🟢 MEDIUM PRIORITY (Next Week)

#### Task 6: Documentation Updates
**Estimated Time:** 2-3 hours  
**Impact:** Medium  
**Files to Update:** README.md, AGENTS.md, TODO.md, CHANGELOG.md

**Updates Needed:**
1. **README.md** - Add new commands section
2. **AGENTS.md** - Update plugin structure diagram
3. **TODO.md** - Mark completed items
4. **CHANGELOG.md** - Create and populate

**Acceptance Criteria:**
- [ ] All docs updated
- [ ] No broken links
- [ ] Version numbers consistent
- [ ] Examples tested and working

---

#### Task 7: Pending Plugin Evaluation
**Estimated Time:** 2 hours  
**Impact:** Low  
**Location:** pending_plugin/

**Evaluation Matrix:**
| Plugin | Complexity | Value | API Cost | Priority |
|--------|-----------|-------|----------|----------|
| ai_crafting_advisor | Low | High | Low | 1 |
| ai_moderator | Medium | High | Medium | 2 |
| ai_translator | Medium | Medium | Medium | 3 |
| ai_music_generator | High | Medium | High | 4 |
| ai_merchant_trader | Medium | Medium | Medium | 5 |

**Action:**
- Review top 3 candidates
- Estimate implementation effort
- Get stakeholder approval
- Schedule for next sprint

**Acceptance Criteria:**
- [ ] Evaluation matrix completed
- [ ] Top 3 candidates identified
- [ ] Implementation plan drafted
- [ ] Stakeholder sign-off obtained

---

## 📊 PROGRESS TRACKING

### Daily Standup Checklist
- [ ] Check git status (target: 0 uncommitted critical files)
- [ ] Review QA gate results (target: 8/8 PASS)
- [ ] Monitor slow query logs (target: 0 warnings)
- [ ] Update task progress below

### Weekly Metrics
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Uncommitted Files | 0 | 345 | 🔴 |
| Test Coverage | 85% | ~75% | 🟡 |
| Query Time (p95) | <200ms | 1640ms | 🔴 |
| QA Gate Time | <300s | 342s | 🟡 |
| E2E Test Count | 20+ | 4 | 🔴 |

---

## 🚦 CURRENT STATUS

**Last Updated:** 2026-10-25 13:55 UTC  
**Overall Health:** 🟡 NEEDS ATTENTION  

**Blockers:**
- None currently

**Risks:**
- Large number of uncommitted changes (data loss risk)
- Database performance degradation in production
- Low E2E test coverage

**Next Actions:**
1. Start Task 1 (Commit Organization) - TODAY
2. Begin Task 2 (Unit Tests) - TODAY
3. Schedule Task 3 (DB Optimization) - TOMORROW

---

## 📝 NOTES & DECISIONS

### Decision Log
| Date | Decision | Rationale | Owner |
|------|----------|-----------|-------|
| 2026-10-25 | Prioritize commit organization | Prevent work loss | Team |
| 2026-10-25 | Focus on DB performance | User experience impact | DevOps |
| 2026-10-25 | Expand E2E tests | Regression prevention | QA |

### Technical Debt Tracker
- [ ] Remove deprecated model files (low priority)
- [ ] Refactor survival engine duplication (medium priority)
- [ ] Consolidate utility functions (low priority)

---

**Document Maintainer:** Development Team  
**Review Frequency:** Daily standup, Weekly planning  
**Next Full Review:** 2026-11-01  

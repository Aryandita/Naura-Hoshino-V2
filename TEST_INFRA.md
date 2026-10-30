# 🧪 TEST INFRASTRUCTURE SPECIFICATION: NAURA HOSHINO V2 (v2.4.0)

> **Document Version:** 2.4.0 | **Date:** 2026-10-30  
> **Target Deliverable:** Naura Hoshino V2 Full System Audit (Milestones M1–M4)  
> **Architecture:** Opaque-Box E2E Dual-Track Verification Engine  
> **Runtime:** Node.js >= 24 | **Framework:** `node:test` + `node:assert/strict`  
> **Test Suite:** `tests/e2e/project_audit.test.js`

---

## 1. Executive Summary & Design Philosophy

The Naura Hoshino V2 verification test infrastructure provides an independent, opaque-box, deterministic end-to-end verification suite covering the core deliverables of the v2.4.0 ecosystem overhaul:
1. **Polyglot Database & Environment Sync (M1)**: Supabase connection pooler validation, `.env` contract enforcement, 1-to-1 synchronized `.env.example`, and zero credential leaks.
2. **SSOT Version Governance (M2)**: Centralized `2.4.0` version in `package.json` enforced across lockfiles, dashboard templates, Android wrappers, documentation, scripts, and runtime tokens.
3. **Slash Commands Architecture & Prefix Routing (M3)**: Discord API quota management keeping slash commands strictly below the ceiling (98 CHAT_INPUT / 105 total), promotion of `/downloader` and `/calculator`, consolidation of redundant command trees, and multi-option prefix `n!` execution support.
4. **Booting Engine & QA Gate Certification (M4)**: Clean startup without environment warnings, zero ESLint warnings across the codebase, 0 architectural drift, and 100% green certification across all automated testing stages.

In accordance with the project's Dual-Track architecture, the test suite operates independently from the application code under test:
- **Zero Mocking of Core Governance Contracts**: Evaluates real environment configurations, parses real package manifests, checks live exports, and executes real math/command routing pipelines.
- **Fail-Fast Defect Isolation**: Provides detailed diagnostic output with precise error contexts, expected vs. actual values, and pinpointed failure locations.
- **Strict Compliance Verification**: Asserts zero regressions against the standards documented in `AGENTS.md`, `RULES.md`, `PRD.md`, and `PROJECT.md`.

---

## 2. Directory Layout & Write Ownership

```text
d:\Naura Hoshino V2\
├── tests/
│   └── e2e/
│       └── project_audit.test.js       # Comprehensive Opaque-Box E2E Verification Suite (Tiers 1–4)
├── scripts/
│   ├── qa-gate.js                      # Master QA Gate runner orchestrating all 9 quality checks
│   ├── check-version-parity.js         # Automated 22-target SSOT version parity validator
│   ├── check-em-dash.js                # Zero em-dash (\u2014) compliance scanner
│   ├── validate-locales.js             # Strict i18n locale dictionary parity validator
│   ├── check-requires.js               # Static require graph & method resolution checker (4656+ calls)
│   ├── check-inline-scripts.js         # Dashboard HTML inline script syntax validator (38 scripts)
│   ├── check-secrets.js                # Live credential & private token leak scanner
│   └── verify-drift.js                 # Architectural convention & phantom code scanner
├── TEST_INFRA.md                       # This infrastructure specification
└── TEST_READY.md                       # Project test readiness publication
```

---

## 3. Four-Tier Testing Methodology

The E2E verification suite is structured into 4 progressive tiers in `tests/e2e/project_audit.test.js`:

### Tier 1: Feature Coverage (Core Functional Contracts)
Exhaustively tests the mandatory deliverables across the 4 major architectural areas:

#### 1. Environment & Secrets
- **TC-T1.ENV.1**: Asserts `src/config/env.js` declares all mandatory keys (`TOKEN`, `CLIENT_ID`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_PROJECT_ID`) in `REQUIRED_KEYS`.
- **TC-T1.ENV.2**: Asserts `env.validateEnv({ fatal: false })` returns `true` with zero missing keys in the active environment.
- **TC-T1.ENV.3**: Asserts `.env.example` defines Supabase transaction pooler port `6543`, `pooler.supabase.com`, and `DB_SSL`.
- **TC-T1.ENV.4**: Asserts `env.getLavalinkNumberedNodes` parses numbered Lavalink cluster environment variables (`LAVALINK_NODE_1_*`, etc.).
- **TC-T1.ENV.5**: Asserts `cleanEnv` handles quotes, spaces, and Pterodactyl-style placeholders.

#### 2. SSOT Version Governance
- **TC-T1.VER.1**: Asserts `package.json` specifies version `2.4.0` as the canonical Single Source of Truth.
- **TC-T1.VER.2**: Asserts `src/config/version.js` dynamically exports `BOT_VERSION` and `ENGINE_VERSION` matching `package.json`.
- **TC-T1.VER.3**: Asserts `getFormattedFooter` generates official footers containing `v2.4.0` across all official module categories (`core`, `music`, `economy`, `survival`, `moderation`).
- **TC-T1.VER.4**: Asserts the version string strictly adheres to the semver schema `X.Y.Z` where `X = 2`.
- **TC-T1.VER.5**: Asserts version consistency across tracked repository targets (README, PRD, DESIGN, RULES, AGENTS).

#### 3. Slash Command Quotas & Deployment Payload
- **TC-T1.CMD.1**: Asserts `SLASH_DEPLOY_EXCLUDE` maps excluded commands to valid hub or subcommand routing targets.
- **TC-T1.CMD.2**: Asserts `/downloader` and `/calculator` are promoted to top-level slash commands and not in `SLASH_DEPLOY_EXCLUDE`.
- **TC-T1.CMD.3**: Asserts redundant top-level commands (`/user`, `/worldclock`, `/minigame`) are consolidated into subcommand targets.
- **TC-T1.CMD.4**: Asserts the deployed slash command payload adheres to Discord's CHAT_INPUT ceiling (`<= 100`, currently 98).
- **TC-T1.CMD.5**: Asserts the total deployed payload (slash commands + context menus) adheres to Discord's bulk overwrite limit (`<= 130`, currently 105).

#### 4. Prefix Routing & `n!` Mock Interaction
- **TC-T1.PFX.1**: Asserts `plugin/utility/downloader.js` exports `executePrefix` with `dl` and `download` aliases.
- **TC-T1.PFX.2**: Asserts `plugin/utility/calculator.js` exports `executePrefix` with `calc` alias.
- **TC-T1.PFX.3**: Asserts calculator evaluates arithmetic expressions accurately via prefix message execution.
- **TC-T1.PFX.4**: Asserts calculator safely rejects malicious or code injection payloads (`process.exit`, `eval`, `require`).
- **TC-T1.PFX.5**: Asserts mock interaction contract satisfies Discord `ChatInputCommandInteraction` requirements.

---

### Tier 2: Boundary & Corner Cases

- **TC-T2.1 (Environment Boundaries)**: Verifies `cleanEnv` handles boundary cases: whitespace, quotes, empty strings, null, and non-string inputs.
- **TC-T2.2 (Validation Isolation)**: Verifies `validateEnv` accurately flags missing keys when mandatory configuration is cleared in simulation.
- **TC-T2.3 (Discord API Constraints)**: Asserts every command in `plugin/` complies with Discord naming and option limits (name `<= 32` characters, description `<= 100` characters, options `<= 25`).
- **TC-T2.4 (Math Evaluation Boundaries)**: Verifies math evaluation safely handles division by zero, float arithmetic, and deeply nested parentheses.
- **TC-T2.5 (URL Parsing Boundaries)**: Verifies downloader URL parsing strips Discord angle brackets (`<URL>`), trims whitespace, and rejects non-HTTP URLs.
- **TC-T2.6 (Mock Option Getters)**: Verifies mock interaction getters (`getString`, `getInteger`, `getBoolean`) properly handle edge types and case-insensitive boolean tokens.

---

### Tier 3: Cross-Feature Combinations

- **TC-T3.1 (Deployment Sync Contract)**: Asserts `plugin/owner/deploy.js` respects `SLASH_DEPLOY_EXCLUDE` and includes context menus to prevent `BASE_TYPE_MAX_LENGTH` errors.
- **TC-T3.2 (Downloader Prefix Quality)**: Verifies prefix downloader correctly extracts explicit quality parameters vs. default automatic resolution.
- **TC-T3.3 (UI Version Propagation)**: Verifies `NauraContainerBuilder` propagates dynamic `v2.4.0` footers into Components V2 containers.
- **TC-T3.4 (Apps Anywhere Integration)**: Asserts personal utility commands configure `integration_types` and `contexts` for Discord user-installable apps.
- **TC-T3.5 (Alias Collision Protection)**: Asserts custom user alias registration prevents alias collisions from shadowing canonical command names.

---

### Tier 4: Real-World Workloads & QA Gate Certification

- **TC-T4.1 (Static Require Graph)**: Asserts all core modules, managers, services, and plugins resolve cleanly without missing dependencies.
- **TC-T4.2 (Zero Em-Dash Policy)**: Asserts zero forbidden em-dash (`\u2014`) characters exist in key documentation, source files, and JSON dictionaries.
- **TC-T4.3 (Locale Parity)**: Asserts 100% parity between Indonesian (`id.json`) and English (`en.json`) translation dictionaries.
- **TC-T4.4 (Zero Secret Leaks)**: Asserts zero active bot tokens, database passwords, or private API keys exist in tracked files.
- **TC-T4.5 (Master QA Gate Definition)**: Asserts `scripts/qa-gate.js` exists and defines the comprehensive 9-stage quality certification pipeline.

---

## 4. Test Execution & Verification

### Running the E2E Verification Suite
```powershell
node --test tests/e2e/project_audit.test.js
```

### Running the Master QA Gate Pipeline
```powershell
node scripts/qa-gate.js
# or
npm run qa
```

### Running Unit Test Suites
```powershell
npm test
```

### Quality Assurance Gate Checklist
| Stage | Description | Tool / Script | Status |
|:-----:|:------------|:--------------|:------:|
| 1/9 | ESLint Code Standards | `eslint .` | PASS (0 errors, 0 warnings) |
| 2/9 | Zero Em-Dash Enforcement | `node scripts/check-em-dash.js` | PASS (0 violations) |
| 3/9 | i18n Locales Parity | `node scripts/validate-locales.js --strict` | PASS (508 keys synced) |
| 4/9 | SSOT Version Parity | `node scripts/check-version-parity.js` | PASS (22/22 targets) |
| 5/9 | Static Require Graph | `node scripts/check-requires.js` | PASS (4656+ calls verified) |
| 6/9 | Dashboard Inline Scripts | `node scripts/check-inline-scripts.js` | PASS (38 scripts valid) |
| 7/9 | Secret Leak Scanner | `node scripts/check-secrets.js` | PASS (0 leaks) |
| 8/9 | Architectural Drift Check | `node scripts/verify-drift.js` | PASS (0 drift) |
| 9/9 | Automated Unit Tests | `node --test` | PASS (782/782 tests pass) |

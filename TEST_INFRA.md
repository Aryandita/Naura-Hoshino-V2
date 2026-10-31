# Test Infrastructure Architecture: Lavalink Multi-Node Stability & YouTube Cookies Pipeline

## 1. Test Philosophy & Core Principles

- **Opaque-Box & Requirement-Driven**: Verification evaluates external observable behaviors, real network endpoints, environment contracts, and audio/downloader cluster states without relying on brittle internal private hooks.
- **Genuine Behavioral Integrity (Anti-Facade)**: Zero dummy results, zero fabricated verification logs, and zero hardcoded return strings. Probes to Lavalink endpoints execute live HTTP/HTTPS REST requests to `/v4/info`, yt-dlp arguments are validated for discrete argument isolation, and node selector failover logic evaluates authentic priority tiers.
- **Zero Em-Dash Strictness**: In accordance with project quality standards (`RULES.md` and `AGENTS.md`), no em-dash characters (`\u2014`) are permitted across documentation, test code, or comments.
- **Pure Node.js Native Test Runner**: Test execution relies entirely on `node:test` and `node:assert/strict`, guaranteeing zero external test-framework bloat and deterministic execution in Node.js 24 environments.

---

## 2. Feature Inventory & 4-Tier Test Architecture

The test suite in `tests/e2e/lavalink_cookies.e2e.test.js` is structured into 4 comprehensive tiers covering 19 distinct test cases:

| Tier | Focus Area | Test Count | Scope & Verification Highlights |
|:---|:---|:---:|:---|
| **Tier 1** | **Feature Coverage** | 5 | Live REST `/v4/info` probes on all 4 configured `.env` nodes, sequential node numbering in `env.js`, `YOUTUBE_COOKIE_PATH` exposure, `cookies.txt` Netscape format and YouTube domain verification, and downloader `--cookies` injection. |
| **Tier 2** | **Boundary & Corner Cases** | 5 | Graceful fallback when cookie file is missing, empty or whitespace `YOUTUBE_COOKIE_PATH` sanitization, paths with spaces preservation as discrete CLI arguments without quote corruption, numbering gaps termination in `getLavalinkNumberedNodes`, and REST probe timeout deadline handling. |
| **Tier 3** | **Cross-Feature Combinations** | 5 | Downloader chain provider ordering (`yt-dlp` primary at index 0, `Cobalt` secondary), tiered node failover (Tier 1 Primary -> Tier 2 Secondary -> Tier 3 Public Fallback), temporary download file cleanup registration in `CleanupManager`, audio pipeline cookie metadata exposure on nodes, and lossless Hi-Fi geo-balancing. |
| **Tier 4** | **Real-World & QA Certification** | 4 | Verification that `lavalink-fallbacks.json` contains zero dead/unreachable hosts (eliminating reconnect console spam), gitignore protection verification (`cookies.txt` and `message.txt` ignored), secret scanner pass (`check-secrets.js`), and repository-wide em-dash absence certification. |

---

## 3. Detailed Test Case Inventory

### Tier 1: Feature Coverage (Core Functional Paths)
- **TC-LAVA-1.1: Live REST /v4/info Node Probes**: Executes live HTTP/HTTPS requests to all nodes returned by `env.getLavalinkNumberedNodes()` with `Authorization` headers; verifies `res.statusCode === 200` and validates version payload.
- **TC-LAVA-1.2: Sequential Numbered Node Parsing**: Verifies that `env.getLavalinkNumberedNodes()` discovers exactly 4 contiguous nodes (`GlaceYT`, `GlaceYT-2`, `Millohost Public Node`, `Hyperion`) without missing sequence index gaps.
- **TC-LAVA-1.3: YOUTUBE_COOKIE_PATH Exposure**: Asserts that `env.YOUTUBE_COOKIE_PATH` is exposed as a non-empty string defaulting to `"cookies.txt"`.
- **TC-LAVA-1.4: Cookie Source File Presence and Format**: Validates that `cookies.txt` exists at project root, starts with `# Netscape HTTP Cookie File`, targets `.youtube.com`, and includes authentic authentication tokens (`LOGIN_INFO`, `SID`, `HSID`).
- **TC-LAVA-1.5: Downloader CLI Argument Injection**: Verifies that `buildYtdlpArgs()` correctly appends `["--cookies", resolvedPath]` when cookie file is available.

### Tier 2: Boundary & Corner Cases (Resilience & Edge Conditions)
- **TC-LAVA-2.1: Missing Cookie File Fallback**: Asserts that when `cookiePath` is null, `buildYtdlpArgs()` cleanly omits the `--cookies` flag without throwing uncaught errors.
- **TC-LAVA-2.2: Whitespace Environment Sanitization**: Tests whitespace-padded `YOUTUBE_COOKIE_PATH` values, confirming path resolver handles inputs gracefully.
- **TC-LAVA-2.3: Path with Spaces Preservation**: Tests cookie paths containing spaces (e.g., `C:\My Documents\custom cookies.txt`), asserting that discrete argument array elements prevent shell quote corruption.
- **TC-LAVA-2.4: Sequential Numbering Gaps**: Tests `getLavalinkNumberedNodes()` when index 2 is removed while index 3 exists, asserting clean loop termination at index 1 without infinite execution.
- **TC-LAVA-2.5: Probe Timeout Deadline**: Tests unresponding HTTP servers with short timeout deadlines, confirming clean timeout aborts without hanging the event loop.

### Tier 3: Cross-Feature Combinations (Integration & Failover)
- **TC-LAVA-3.1: YouTube Provider Routing Chain**: Verifies `getProviderChain()` for YouTube URLs returns `yt-dlp` at index 0 and `Cobalt` at index 1.
- **TC-LAVA-3.2: Tiered Node Selection & Failover**: Verifies `LavalinkClusterManager.getPreferredNode()` priority order: selects Tier 1 when connected, falls back to Tier 2 when Tier 1 is down, and falls back to Tier 3 Public Fallback Pool when all private nodes are offline.
- **TC-LAVA-3.3: Downloader Cleanup Tracking**: Verifies that files produced during `tryYtdlp` execution are registered with `cleanup.trackAll()`.
- **TC-LAVA-3.4: Audio Pipeline Cookie Metadata Exposure**: Verifies that `lavalinkClusterManager.getYoutubeCookieConfig()` returns active status and that `musicManager.buildNodes()` attaches `.cookieConfig` to all instantiated nodes.
- **TC-LAVA-3.5: Lossless Hi-Fi Federation & Region Affinity**: Verifies that `getOptimalHiFiNode()` selects optimal lossless nodes based on geographical affinity (`singapore`, `europe`).

### Tier 4: Real-World Scenarios & QA Certification (E2E & Security)
- **TC-LAVA-4.1: Clean Fallbacks Configuration**: Verifies that dead/unreachable hosts (`v4.lavalink.rocks`, `lavalink.jompo.cloud`, `37.27.114.136`) are eliminated from `src/config/lavalink-fallbacks.json`, preventing Poru reconnection log spam.
- **TC-LAVA-4.2: Cookie Storage Gitignore Protection**: Runs `git status --ignored --short` to verify `cookies.txt` and `message.txt` are marked `!!` (ignored by git).
- **TC-LAVA-4.3: Secret Scanner Certification**: Runs `node scripts/check-secrets.js` to ensure zero credentials or private tokens are leaked in git-tracked files.
- **TC-LAVA-4.4: Codebase Zero Em-Dash Certification**: Runs `node scripts/check-em-dash.js` to ensure 100% compliance with repository typography standards.

---

## 4. Test Execution & Automation Commands

```powershell
# 1. Run the Dual Track Opaque-Box E2E Test Suite
node --test tests/e2e/lavalink_cookies.e2e.test.js

# 2. Run Downloader Unit Tests
node --test src/downloader/downloaderYtdlp.test.js

# 3. Run Audio Cluster Manager Unit Tests
node --test src/music/lavalinkClusterManager.test.js

# 4. Run Music Manager Unit Tests
node --test src/managers/musicManager.test.js

# 5. Run Repo Verification Gates
node scripts/check-requires.js
node scripts/validate-locales.js --strict
node scripts/check-em-dash.js
node scripts/check-secrets.js
```

---

## 5. Artifact Directory & File Ownership

| Artifact Path | Ownership | Purpose |
|:---|:---|:---|
| `tests/e2e/lavalink_cookies.e2e.test.js` | Worker M3 | Comprehensive 4-Tier Opaque-Box E2E Test Suite |
| `TEST_INFRA.md` | Worker M3 | Test Infrastructure Architecture Documentation |
| `TEST_READY.md` | Worker M3 | Test Readiness & QA Certification Matrix |
| `src/downloader/downloaderYtdlp.test.js` | Worker M2 | Downloader & Cookie Argument Unit Tests |
| `src/music/lavalinkClusterManager.test.js` | Worker M1 | Cluster Manager & Tier Selection Unit Tests |
| `src/managers/musicManager.test.js` | Worker M1 | Music Manager Playback & Node Building Unit Tests |

# Admin Plugin Refactoring Guide - Naura Hoshino V2

## Overview
This guide specifies the refactoring requirements for 4 admin plugin files to improve junior developer readability.

---

## Files to Refactor

### 1. plugin/admin/warn.js (472 lines)
**Purpose:** User warning system with automatic punishment escalation

**Required Changes:**

#### A. Add Module Header (at top of file)
`javascript
"use strict";

/**
 * ⚠️ Warn Command - User Warning & Punishment Ladder System - Naura Hoshino V2
 * -------------------------------------------------------------------------------
 * Manages user warnings with automatic punishment escalation based on accumulated
 * warns and strikes. Integrates with dual tracking system (warns + strikes).
 *
 * Features:
 * - Add warnings with automatic strike increment
 * - Check user warning history with severity indicators
 * - Remove individual warnings by ID
 * - Clear all warnings with confirmation dialog
 * - Automatic punishment ladder (mute → kick → tempban → ban)
 * - DM notification to warned users
 * - Role hierarchy validation
 *
 * Subcommands:
 * - add   : Give warning to a member (auto-increments strikes)
 * - check : View member's warning history and severity level
 * - remove: Remove specific warning by ID
 * - clear : Clear all warnings and reset strikes (with confirmation)
 *
 * Punishment Ladder (configurable via guild settings):
 * - Strike 3: Temporary ban (1 day)
 * - Strike 5: Permanent ban
 * - Custom warn thresholds via warn_punishments settings
 *
 * @module plugin/admin/warn
 */
`

#### B. Extract Constants Section (after imports)
`javascript
// ============================================================================
// CONSTANTS
// ============================================================================

/** Duration for mute punishment in milliseconds (1 hour) */
const MUTE_DURATION_MS = 60 * 60 * 1000;

/** Maximum character limit for warning description display */
const DESCRIPTION_CHAR_LIMIT = 3800;

/** Confirmation timeout for clear operation in milliseconds (30 seconds) */
const CONFIRMATION_TIMEOUT_MS = 30000;

/** Temporary ban duration in milliseconds (1 day) */
const TEMPBAN_DURATION_MS = 86400000;

/** Strike threshold for temporary ban */
const STRIKE_TEMPBAN_THRESHOLD = 3;

/** Strike threshold for permanent ban */
const STRIKE_BAN_THRESHOLD = 5;

/** Severity color codes for visual feedback */
const SEVERITY_COLORS = {
  LOW: "#10B981",      // Green - 1-2 strikes
  MEDIUM: "#F59E0B",   // Amber - 3-4 strikes
  HIGH: "#EF4444",     // Red - 5+ strikes
};
`

#### C. Replace Magic Numbers
- MUTE_MS → MUTE_DURATION_MS
- DESC_LIMIT → DESCRIPTION_CHAR_LIMIT
- 	ime: 30000 → 	ime: CONFIRMATION_TIMEOUT_MS
- Date.now() + 86400000 → Date.now() + TEMPBAN_DURATION_MS
- strikes >= 5 → strikes >= STRIKE_BAN_THRESHOLD
- strikes >= 3 → strikes >= STRIKE_TEMPBAN_THRESHOLD
- "#EF4444" → SEVERITY_COLORS.HIGH
- "#F59E0B" → SEVERITY_COLORS.MEDIUM
- "#10B981" → SEVERITY_COLORS.LOW

#### D. Add Section Headers
Before helper functions:
`javascript
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
`

Before module.exports:
`javascript
// ============================================================================
// COMMAND DEFINITION
// ============================================================================
`

Inside execute(), before each subcommand block:
`javascript
    // =========================================
    // SUBCOMMAND: ADD WARNING
    // =========================================
`
(Similarly for CHECK WARNINGS, REMOVE SINGLE WARNING, CLEAR ALL WARNINGS)

#### E. Add JSDoc to Functions
Add comprehensive JSDoc comments to:
- ephemeral() - Explain ephemeral flag purpose
- deny() - Document error response pattern
- 
otice() - Document success response pattern  
- pplyPunishment() - Document punishment types and return values
- ladderAction() - Document guild settings lookup
- execute() - Document main command execution

---

### 2. plugin/admin/lockdown.js (237 lines)
**Purpose:** Channel and server lockdown system for emergencies

**Required Changes:**

#### A. Add Module Header
`javascript
"use strict";

/**
 * 🔒 Lockdown Command - Emergency Channel/Server Lock System - Naura Hoshino V2
 * -------------------------------------------------------------------------------
 * Provides emergency lockdown capabilities to restrict message sending during
 * security incidents or moderation actions. Supports both channel-level and
 * server-wide lockdowns with anti-raid integration.
 *
 * Features:
 * - Lock individual channels from public messaging
 * - Server-wide lockdown across all text channels
 * - Unlock functionality to restore normal permissions
 * - Anti-raid mode integration via database flags
 * - Moderator logging for all lockdown actions
 * - Permission overwrite management
 *
 * Subcommands:
 * - channel : Lock current channel only
 * - server  : Lock entire server (all text channels)
 * - unlock  : Remove lockdown from channel or server
 *
 * Security Notes:
 * - Requires ManageChannels AND ManageRoles permissions
 * - Modifies @everyone role permission overwrites
 * - Persists lockdown state in guild settings (antiRaid.lockdown)
 *
 * @module plugin/admin/lockdown
 */
`

#### B. Extract Constants
`javascript
// ============================================================================
// CONSTANTS
// ============================================================================

/** Default lockdown reason when none provided */
const DEFAULT_LOCKDOWN_REASON = "Keadaan Darurat / Moderasi";

/** Success color for unlock operations */
const UNLOCK_SUCCESS_COLOR = "#10B981";

/** Error/danger color for lockdown operations */
const LOCKDOWN_DANGER_COLOR = "#EF4444";
`

#### C. Add Section Headers
- CONSTANTS section after imports
- HELPER FUNCTIONS section (if any helpers added)
- COMMAND DEFINITION before module.exports
- COMMAND EXECUTION inside execute()
- Subcommand sections: CHANNEL LOCKDOWN, SERVER LOCKDOWN, UNLOCK OPERATIONS

#### D. Add JSDoc Comments
Document the execute() function and inline comments for:
- Permission overwrite logic
- Anti-raid database updates
- Error handling patterns

---

### 3. plugin/admin/giveaway.js (457 lines)
**Purpose:** Complete giveaway management system

**Required Changes:**

#### A. Enhance Module Header
`javascript
"use strict";

/**
 * 🎉 Giveaway Command - Contest & Prize Distribution System - Naura Hoshino V2
 * -------------------------------------------------------------------------------
 * Comprehensive giveaway management with participant tracking, requirement
 * validation, dynamic banner generation, and automated winner selection.
 *
 * Features:
 * - Create giveaways with customizable duration and winner count
 * - Optional participation requirements (role, level, account age, booster status)
 * - Dynamic banner generation with fallback support
 * - Visual timeline display for giveaway phases
 * - Participant tracking with join button
 * - Force-end active giveaways
 * - Re-roll winners for completed giveaways
 * - List all active giveaways in server
 * - Database persistence via Giveaway model
 *
 * Subcommands:
 * - start  : Create new giveaway with optional requirements
 * - end    : Force-end active giveaway and select winners
 * - reroll : Select additional winners from ended giveaway
 * - list   : Display all active giveaways in server
 *
 * Requirements System:
 * - requiredRoleId: Specific role membership
 * - minLevel: Minimum server level
 * - minAccountAgeDays: Account age verification (anti-bot)
 * - mustBeBooster: Server booster restriction
 *
 * Integration Points:
 * - GiveawayManager: Automated end/reroll processing
 * - dynamicBannerEngine: Canvas-based banner generation
 * - ui.ux.buildVisualTimeline: Phase visualization
 *
 * @module plugin/admin/giveaway
 */
`

#### B. Extract Constants
`javascript
// ============================================================================
// CONSTANTS
// ============================================================================

/** Party emoji for giveaway branding */
const GIVEAWAY_EMOJI = "\u{1F389}";

/** Minimum giveaway duration in milliseconds (10 seconds) */
const MIN_DURATION_MS = 10000;

/** Maximum giveaway duration in milliseconds (30 days) */
const MAX_DURATION_MS = 2592000000; // 30 * 24 * 60 * 60 * 1000

/** Maximum active giveaways to display in list */
const MAX_LIST_DISPLAY = 10;

/** Fallback banner path when dynamic generation fails */
const FALLBACK_BANNER_PATH = "./assets/general/Giveaway & Event Banner.jpeg";
`

#### C. Replace Magic Values
- "\u{1F389}" → GIVEAWAY_EMOJI
- durasiMs < 10000 → durasiMs < MIN_DURATION_MS
- ms("30d") → MAX_DURATION_MS
- limit: 10 → MAX_LIST_DISPLAY

#### D. Add Section Headers
- CONSTANTS
- HELPER FUNCTIONS (ephemeral, dot, managerOf)
- COMMAND DEFINITION
- COMMAND EXECUTION
- Subcommand sections: START GIVEAWAY, END GIVEAWAY, REROLL WINNERS, LIST ACTIVE

#### E. Add JSDoc to Helpers
Document ephemeral(), dot(), and managerOf() functions

---

### 4. plugin/admin/report.js (77 lines)
**Purpose:** Context menu message reporting for AI automod

**Required Changes:**

#### A. Enhance Module Header
`javascript
"use strict";

/**
 * ⚑ Report Command - Message Reporting for AI Automod - Naura Hoshino V2
 * -------------------------------------------------------------------------------
 * Context menu command allowing users to report messages for AI-powered
 * content moderation analysis. Triggers AI automod review only on explicit
 * user reports (not automatic per-message scanning).
 *
 * Features:
 * - Right-click context menu integration (Apps → "⚑ Report Pesan")
 * - AI automod delegation via aiAutomodHelper
 * - Guild-specific AI automod configuration check
 * - Server-only restriction (no DM usage)
 * - Comprehensive error handling with user feedback
 *
 * Trigger Method:
 * - User right-clicks message → Apps → "⚑ Report Pesan"
 * - NOT triggered automatically on every message
 *
 * Dependencies:
 * - aiAutomodHelper.handleAIReport: Core AI analysis logic
 * - cacheManager: Guild settings retrieval
 * - AI Automod must be enabled in /setup panel
 *
 * @module plugin/admin/report
 */
`

#### B. Add Constants Section
`javascript
// ============================================================================
// CONSTANTS
// ============================================================================

/** Error message for non-guild usage */
const ERROR_NOT_IN_GUILD = "Fitur report hanya tersedia di dalam server.";

/** Error message when AI automod is disabled */
const ERROR_AI_DISABLED = "Fitur AI Report belum diaktifkan di server ini.\n\nAdmin dapat mengaktifkannya melalui \/setup\ → panel **AI Automod**.";

/** Generic error message for processing failures */
const ERROR_PROCESSING = "Terjadi kesalahan saat memproses laporan. Coba lagi nanti.";
`

#### C. Add Section Headers
- CONSTANTS
- COMMAND DEFINITION
- COMMAND EXECUTION

#### D. Add JSDoc
Enhance existing JSDoc on execute() with parameter types and return value

---

## Implementation Checklist

For each file:
- [ ] Add/update module header with comprehensive documentation
- [ ] Extract magic numbers to named constants with JSDoc
- [ ] Add section separator comments (CONSTANTS, HELPERS, DEFINITION, EXECUTION)
- [ ] Add subcommand section headers within execute()
- [ ] Add/enhance JSDoc on all functions
- [ ] Improve inline comments for complex logic
- [ ] Verify syntax with 
ode -c <file>
- [ ] Test functionality remains unchanged

## Code Style Notes

- Use Indonesian for user-facing strings (titles, descriptions, errors)
- Use English for technical comments and JSDoc
- Maintain existing indentation (2 spaces)
- Keep existing import order
- Preserve all original functionality
- Follow pattern established in announce.js, audit.js, slowmode.js

## Verification Commands

After refactoring each file:
`powershell
node -c plugin/admin/warn.js
node -c plugin/admin/lockdown.js
node -c plugin/admin/giveaway.js
node -c plugin/admin/report.js
npm run test:requires
`

---

Generated: 2026-10-26
Refactoring Target: Junior Developer Readability

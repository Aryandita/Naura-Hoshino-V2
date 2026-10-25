"use strict";

const { logger } = require("../managers/logger");
const redisManager = require("../managers/redisManager");

const REMINDER_BEFORE_MS = 3600000;

const DEFAULT_EVENTS = [
  { id: "daily_reset", name: "Daily Quest Reset", cronExpression: "0 0 * * *", recurring: true, reminderBefore: REMINDER_BEFORE_MS },
  { id: "weekly_boss", name: "World Boss Spawn", cronExpression: "0 20 * * 6", recurring: true, reminderBefore: REMINDER_BEFORE_MS },
  { id: "monthly_festival", name: "Festival Bulanan", cronExpression: "0 12 1 * *", recurring: true, reminderBefore: REMINDER_BEFORE_MS * 24 },
];

class EventSchedulerService {
  constructor() {
    this.scheduledEvents = new Map();
    this.timers = new Map();
  }

  /**
   * Inisialisasi scheduler dengan event default atau custom
   * @param {Array} customEvents
   */
  initialize(customEvents = []) {
    const events = [...DEFAULT_EVENTS, ...customEvents];

    for (const event of events) {
      this.scheduledEvents.set(event.id, {
        ...event,
        nextOccurrence: this._calculateNextOccurrence(event.cronExpression),
      });
    }

    logger.info(`[EventScheduler] Initialized with ${events.length} events`);
  }

  /**
   * Mendapatkan daftar event mendatang
   * @param {number} limit
   * @returns {Array}
   */
  getUpcomingEvents(limit = 10) {
    const now = Date.now();
    const events = [];

    for (const [id, event] of this.scheduledEvents) {
      const timeUntil = event.nextOccurrence - now;
      events.push({
        id,
        name: event.name,
        nextOccurrence: event.nextOccurrence,
        timeUntilMs: timeUntil,
        timeUntilFormatted: this._formatDuration(timeUntil),
        reminderAt: event.nextOccurrence - (event.reminderBefore || REMINDER_BEFORE_MS),
        recurring: event.recurring,
      });
    }

    events.sort((a, b) => a.nextOccurrence - b.nextOccurrence);
    return events.slice(0, limit);
  }

  /**
   * Memeriksa event yang perlu diingatkan saat ini
   * @returns {Array} Event yang butuh reminder
   */
  checkReminders() {
    const now = Date.now();
    const dueReminders = [];

    for (const [id, event] of this.scheduledEvents) {
      const reminderTime = event.nextOccurrence - (event.reminderBefore || REMINDER_BEFORE_MS);
      if (now >= reminderTime && now < event.nextOccurrence) {
        const reminderKey = `event_reminder_sent:${id}:${Math.floor(event.nextOccurrence / 86400000)}`;
        dueReminders.push({ ...event, reminderKey });
      }
    }

    return dueReminders;
  }

  /**
   * Menandai reminder sudah dikirim
   * @param {string} reminderKey
   */
  async markReminderSent(reminderKey) {
    try {
      await redisManager.set(reminderKey, "1", "EX", 86400);
    } catch (error) {
      logger.error(`[EventScheduler] Error marking reminder sent:`, error);
    }
  }

  /**
   * Advance event ke occurrence berikutnya setelah event berlalu
   * @param {string} eventId
   */
  advanceEvent(eventId) {
    const event = this.scheduledEvents.get(eventId);
    if (!event) return;

    if (event.recurring) {
      event.nextOccurrence = this._calculateNextOccurrence(event.cronExpression);
      logger.info(`[EventScheduler] Advanced ${eventId} to ${new Date(event.nextOccurrence).toISOString()}`);
    } else {
      this.scheduledEvents.delete(eventId);
      logger.info(`[EventScheduler] Removed non-recurring event ${eventId}`);
    }
  }

  /**
   * Tambah event custom
   * @param {object} eventDef
   */
  addEvent(eventDef) {
    this.scheduledEvents.set(eventDef.id, {
      ...eventDef,
      nextOccurrence: this._calculateNextOccurrence(eventDef.cronExpression),
    });
    logger.info(`[EventScheduler] Added event: ${eventDef.id}`);
  }

  removeEvent(eventId) {
    this.scheduledEvents.delete(eventId);
    logger.info(`[EventScheduler] Removed event: ${eventId}`);
  }

  _calculateNextOccurrence(cronExpression) {
    const parts = cronExpression.split(" ");
    if (parts.length !== 5) return Date.now() + 86400000;

    const now = new Date();
    const [minute, hour, dayOfMonth, month] = parts;

    const next = new Date(now);
    next.setSeconds(0, 0);

    if (minute !== "*") next.setMinutes(parseInt(minute, 10));
    else next.setMinutes(0);

    if (hour !== "*") next.setHours(parseInt(hour, 10));
    else next.setHours(0);

    if (dayOfMonth !== "*") next.setDate(parseInt(dayOfMonth, 10));
    if (month !== "*") next.setMonth(parseInt(month, 10) - 1);

    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }

    return next.getTime();
  }

  _formatDuration(ms) {
    if (ms <= 0) return "Now";
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}

module.exports = { EventSchedulerService, DEFAULT_EVENTS, REMINDER_BEFORE_MS };

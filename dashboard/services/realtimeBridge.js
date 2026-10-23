"use strict";

const eventBus = require("../../src/core/eventBus");

const ROOM_PREFIXES = {
  guild: "guild:",
  user: "user:",
  economy: "economy:",
  survival: "survival:",
  music: "music:",
  global: "global",
};

class RealtimeBridge {
  constructor(io) {
    this.io = io;
    this.presenceMap = new Map();
    this._setupEventBusListeners();
    this._setupSocketHandlers();
  }

  _setupEventBusListeners() {
    const broadcastEvents = [
      "economy:transaction",
      "economy:transfer",
      "survival:worldboss:spawn",
      "survival:worldboss:defeated",
      "survival:territory:claimed",
      "music:track:start",
      "music:track:end",
      "system:announcement",
      "cache:invalidated",
    ];

    for (const eventName of broadcastEvents) {
      eventBus.on(eventName, (data) => {
        this._handleEventBusEvent(eventName, data);
      });
    }
  }

  _handleEventBusEvent(eventName, data) {
    const room = this._resolveRoom(eventName, data);
    if (room) {
      this.io.to(room).emit(eventName, {
        ...data,
        timestamp: Date.now(),
      });
    } else {
      this.io.emit(eventName, {
        ...data,
        timestamp: Date.now(),
      });
    }
  }

  _resolveRoom(eventName, data) {
    if (eventName.startsWith("economy:")) {
      return data.userId ? `${ROOM_PREFIXES.user}${data.userId}` : ROOM_PREFIXES.economy;
    }
    if (eventName.startsWith("survival:")) {
      if (data.guildId) return `${ROOM_PREFIXES.guild}${data.guildId}`;
      return ROOM_PREFIXES.survival;
    }
    if (eventName.startsWith("music:")) {
      return data.guildId ? `${ROOM_PREFIXES.guild}${data.guildId}` : null;
    }
    return null;
  }

  _setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      const userId = socket.handshake.auth?.userId;
      const guildIds = socket.handshake.auth?.guildIds || [];

      if (userId) {
        socket.join(`${ROOM_PREFIXES.user}${userId}`);
        this._updatePresence(userId, socket.id, true);
      }

      for (const guildId of guildIds) {
        socket.join(`${ROOM_PREFIXES.guild}${guildId}`);
      }

      socket.join(ROOM_PREFIXES.global);

      socket.on("subscribe", (rooms) => {
        const allowedRooms = Array.isArray(rooms) ? rooms.filter((r) => this._canSubscribe(socket, r)) : [];
        for (const room of allowedRooms) {
          socket.join(room);
        }
        socket.emit("subscribed", { rooms: allowedRooms });
      });

      socket.on("unsubscribe", (rooms) => {
        const roomList = Array.isArray(rooms) ? rooms : [rooms];
        for (const room of roomList) {
          socket.leave(room);
        }
        socket.emit("unsubscribed", { rooms: roomList });
      });

      socket.on("presence:update", (status) => {
        if (userId) {
          this._updatePresence(userId, socket.id, true, status);
        }
      });

      socket.on("disconnect", () => {
        if (userId) {
          this._updatePresence(userId, socket.id, false);
        }
      });
    });
  }

  _canSubscribe(socket, room) {
    if (room === ROOM_PREFIXES.global) return true;
    if (room.startsWith(ROOM_PREFIXES.economy)) return true;
    if (room.startsWith(ROOM_PREFIXES.survival)) return true;

    const userId = socket.handshake.auth?.userId;
    if (room.startsWith(ROOM_PREFIXES.user)) {
      return room === `${ROOM_PREFIXES.user}${userId}`;
    }

    const guildIds = socket.handshake.auth?.guildIds || [];
    if (room.startsWith(ROOM_PREFIXES.guild)) {
      const guildId = room.replace(ROOM_PREFIXES.guild, "");
      return guildIds.includes(guildId);
    }

    return false;
  }

  _updatePresence(userId, socketId, online, status = "online") {
    if (online) {
      this.presenceMap.set(userId, {
        socketId,
        status,
        lastSeen: Date.now(),
      });
      this.io.to(`${ROOM_PREFIXES.user}${userId}`).emit("presence:self", {
        status,
        lastSeen: Date.now(),
      });
    } else {
      this.presenceMap.delete(userId);
    }
  }

  getPresence(userId) {
    return this.presenceMap.get(userId) || null;
  }

  getOnlineUsers() {
    return Array.from(this.presenceMap.keys());
  }

  emitToUser(userId, event, data) {
    this.io.to(`${ROOM_PREFIXES.user}${userId}`).emit(event, data);
  }

  emitToGuild(guildId, event, data) {
    this.io.to(`${ROOM_PREFIXES.guild}${guildId}`).emit(event, data);
  }

  broadcastGlobal(event, data) {
    this.io.emit(event, data);
  }

  invalidateCache(key, reason) {
    this.io.emit("cache:invalidated", { key, reason, timestamp: Date.now() });
  }
}

module.exports = RealtimeBridge;

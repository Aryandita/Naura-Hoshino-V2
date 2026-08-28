"use strict";

/**
 * @namespace: plugin/utility/notification.js
 * @description: Alias / delegator ke notifications.js (Single Source of Truth)
 */

const notificationsCommand = require("./notifications");

module.exports = {
  data: notificationsCommand.data,
  execute: notificationsCommand.execute,
};

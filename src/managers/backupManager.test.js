"use strict";

const test = require("node:test");
const assert = require("node:assert");
const backupManager = require("./backupManager");
const { sequelize } = require("./dbManager");

test("BackupManager runBackup executes cleanly with mocked query", async () => {
  const origQuery = sequelize.query;
  const origDialect = sequelize.getDialect;

  try {
    sequelize.getDialect = () => "postgres";
    sequelize.query = async (sql) => {
      if (sql.includes("information_schema.tables")) {
        return [{ table_name: "test_table" }];
      }
      return [{ id: 1, name: "item1" }];
    };

    const result = await backupManager.runBackup();
    assert.strictEqual(typeof result, "object");
    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.files));
  } finally {
    sequelize.query = origQuery;
    sequelize.getDialect = origDialect;
  }
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ServiceContainer } = require("./container");

test("ServiceContainer - Registrasi Value Statis", () => {
  const container = new ServiceContainer();
  const mockConfig = { appName: "Naura Hoshino V2", port: 3000 };

  container.value("config", mockConfig);

  assert.equal(container.has("config"), true);
  assert.equal(container.resolve("config"), mockConfig);
});

test("ServiceContainer - Registrasi Singleton Factory", () => {
  const container = new ServiceContainer();
  let factoryExecutions = 0;

  container.singleton("database", () => {
    factoryExecutions++;
    return { connectionId: Math.random() };
  });

  assert.equal(container.has("database"), true);

  const instance1 = container.resolve("database");
  const instance2 = container.resolve("database");

  assert.equal(factoryExecutions, 1, "Factory singleton hanya boleh dieksekusi satu kali.");
  assert.equal(instance1, instance2, "Instance kedua harus merujuk pada objek singleton yang sama.");
});

test("ServiceContainer - Registrasi Transient Factory", () => {
  const container = new ServiceContainer();
  let callCount = 0;

  container.transient("logger", () => {
    callCount++;
    return { id: callCount };
  });

  const logger1 = container.resolve("logger");
  const logger2 = container.resolve("logger");

  assert.notEqual(logger1, logger2, "Transient harus menghasilkan instance baru tiap kali di-resolve.");
  assert.equal(logger1.id, 1);
  assert.equal(logger2.id, 2);
});

test("ServiceContainer - Deteksi Circular Dependency", () => {
  const container = new ServiceContainer();

  container.singleton("serviceA", (c) => {
    return { b: c.resolve("serviceB") };
  });

  container.singleton("serviceB", (c) => {
    return { a: c.resolve("serviceA") };
  });

  assert.throws(
    () => {
      container.resolve("serviceA");
    },
    /Circular dependency terdeteksi/,
    "Harus melempar error saat terdeteksi siklus A -> B -> A",
  );
});

test("ServiceContainer - Error Layanan Belum Terdaftar", () => {
  const container = new ServiceContainer();

  assert.equal(container.has("nonExistentService"), false);
  assert.throws(
    () => {
      container.resolve("nonExistentService");
    },
    /belum terdaftar di container/,
  );
});

test("ServiceContainer - Lifecycle Hooks (init & dispose)", async () => {
  const container = new ServiceContainer();
  let isInitialized = false;
  let isDisposed = false;

  const sampleService = {
    init: async () => {
      isInitialized = true;
    },
    dispose: async () => {
      isDisposed = true;
    },
  };

  container.value("sample", sampleService);

  await container.init();
  assert.equal(isInitialized, true, "init hook harus terpanggil");

  await container.dispose();
  assert.equal(isDisposed, true, "dispose hook harus terpanggil");
});

test("ServiceContainer - Pembersihan State (clear)", () => {
  const container = new ServiceContainer();
  container.value("foo", "bar");

  assert.equal(container.has("foo"), true);
  container.clear();
  assert.equal(container.has("foo"), false);
});

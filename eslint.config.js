// Flat config ESLint untuk Naura Hoshino V.2 (CommonJS / Node)
// Jalankan: npm run lint  |  Perbaiki otomatis: npm run lint:fix

// Kolom JSON. Tidak punya padanan `kolom = kolom + delta`, jadi satu-satunya cara
// aman adalah mengunci barisnya lewat mutate*Json().
const JSON_COLUMNS = [
  "inventory",
  "rpg_state",
  "shop_purchases",
  "cooldowns",
  "economy_investments",
  "economy_deposit",
  "afk_mentions",
  "music_playlist",
];

// Kolom yang sifatnya akumulatif. Menulis nilai absolut hasil pembacaan membuat
// dua perubahan yang tiba berdekatan saling menimpa.
const COUNTER_COLUMNS = [
  "economy_wallet",
  "economy_bank",
  "starFragments",
  "coupons",
  "leveling_xp",
  "survival_xp",
  "music_tracksListened",
];

const asPattern = (names) => `/^(${names.join("|")})$/`;

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "assets/**",
      "package-lock.json",
      "dashboard/public/**",
      "dashboard/views/**",
      // Hasil build Vite dan vendor pihak ketiga tidak perlu dilint
      "dashboard-v2/dist/**",
      "dashboard-v2/public/vendor/**",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "writable",
        exports: "writable",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        queueMicrotask: "readonly",
        structuredClone: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        AbortController: "readonly",
       AbortSignal: "readonly",
      },
    },
    rules: {
      // Fokus awal: tangkap bug nyata, bukan gaya penulisan.
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-unreachable": "error",
      eqeqeq: ["warn", "smart"],
      "no-var": "warn",
      "prefer-const": "warn",

      // Semua entri di bawah bersetelan 'warn', bukan 'error', dengan alasan
      // yang sama: pemanggil lama di modul non-survival belum selesai
      // diaudit, dan lint yang merah total justru berhenti dibaca orang.
      // Naikkan ke 'error' setelah auditnya tuntas.
      "no-restricted-syntax": [
        "warn",

        // `ephemeral: true` sudah usang di discord.js v14.
        // Aturan ini menahan pemakaian baru (issue #10).
        {
          selector: 'Property[key.name="ephemeral"][value.value=true]',
          message:
            "Gunakan `flags: MessageFlags.Ephemeral`, bukan `ephemeral: true` (issue #10).",
        },
        {
          selector: 'Property[key.value="ephemeral"][value.value=true]',
          message:
            "Gunakan `flags: MessageFlags.Ephemeral`, bukan `ephemeral: true` (issue #10).",
        },

        // Kolom JSON yang ditulis sebagai nilai absolut. Inilah pola yang
        // membuat barang hilang ketika dua hadiah tiba bersamaan: keduanya
        // menulis array versi lama plus satu barang.
        {
          selector: `CallExpression[callee.property.name=/^updateUser(Profile|Survival)$/] ObjectExpression > Property[key.name=${asPattern(JSON_COLUMNS)}]`,
          message:
            "Kolom JSON wajib diubah lewat cacheManager.mutate*Json() atau helper atomik seperti addItemsAtomic(), bukan update*() dengan nilai absolut (issue #17).",
        },

        // Kolom akumulatif yang ditulis sebagai nilai absolut.
        {
          selector: `CallExpression[callee.property.name=/^updateUser(Profile|Survival)$/] ObjectExpression > Property[key.name=${asPattern(COUNTER_COLUMNS)}]`,
          message:
            "Kolom akumulatif wajib memakai increment*() untuk penambahan atau debit*() untuk pengurangan, bukan update*() dengan nilai absolut (issue #17).",
        },

        // Model.update() langsung melewati seluruh lapisan cache, sehingga
        // cache user:profile dan user:survival menyimpan nilai basi sampai
        // TTL-nya habis.
        {
          selector:
            'CallExpression[callee.object.name=/^User(Profile|Survival)$/][callee.property.name="update"]',
          message:
            "Jangan memanggil UserProfile.update() atau UserSurvival.update() langsung. Lewatkan lewat cacheManager supaya cache-nya ikut dibereskan.",
        },

        // save() tanpa daftar fields menulis SELURUH baris dari nilai yang ada
        // di memori. Bila charge() atau reward() baru saja memajukan kolom
        // atomik, nilai lama ikut tertulis dan flush lima detik kemudian
        // menerapkan penambahannya lagi. Inilah bug kupon terhitung dua kali.
        {
          selector:
            'CallExpression[arguments.length=0][callee.property.name="save"][callee.object.name=/^(survival|profile|userSurvival|userProfile|row)$/]',
          message:
            "Sebutkan kolomnya secara eksplisit: save({ fields: [...] }). save() telanjang menulis seluruh baris dan bisa menggandakan saldo yang baru dimajukan charge() atau reward().",
        },

        // Menulis saldo sebagai nilai absolut. Dipertahankan hanya untuk
        // pemanggil lama yang belum diaudit.
        {
          selector: 'CallExpression[callee.property.name="setBalance"]',
          message:
            "currency.setBalance() sudah usang. Pakai charge() untuk memotong, reward() untuk menambah, atau cacheManager.increment*() bila butuh delta langsung.",
        },

        // Larangan memanggil @napi-rs/canvas langsung di luar canvasRuntime.js
        {
          selector:
            'CallExpression[callee.name="require"][arguments.0.value="@napi-rs/canvas"]',
          message:
            "Dilarang me-require '@napi-rs/canvas' langsung. Gunakan 'src/canvas/canvasRuntime.js' sebagai satu-satunya gateway.",
        },
      ],
    },
  },

  {
    // cacheManager dan canvasRuntime memiliki hak khusus mengakses modul inti/native
    files: [
      "src/canvas/canvasRuntime.js",
      "src/managers/cacheManager.js",
      "src/managers/dbMigrator.js",
      "src/managers/dbSeeder.js",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // Frontend dashboard-v2 adalah ESM (`type: module`) yang berjalan di
    // browser dan dibundel Vite. Parse sebagai module, matikan no-undef
    // karena globals browser/window tidak relevan bagi kode hasil bundel.
    files: ["dashboard-v2/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
    },
    rules: {
      "no-undef": "off",
    },
  },
  {
    // Berkas router interaksi harus tetap tipis. Ini yang menjaga
    // interactionCreate.js tidak kembali menjadi 43 KB seperti dulu.
    files: ["src/events/interactionCreate.js", "src/interactions/**/*.js"],
    rules: {
      "max-lines": [
        "warn",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
    },
  },
];

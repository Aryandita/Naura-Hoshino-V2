// Flat config ESLint untuk Naura Hoshino V.2 (CommonJS / Node)
// Jalankan: npm run lint  |  Perbaiki otomatis: npm run lint:fix

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'assets/**',
            'package-lock.json',
            'src/dashboard/public/**',
            'src/dashboard/views/**'
        ]
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'writable',
                exports: 'writable',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                queueMicrotask: 'readonly',
                structuredClone: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                AbortController: 'readonly'
            }
        },
        rules: {
            // Fokus awal: tangkap bug nyata, bukan gaya penulisan.
            'no-undef': 'error',
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-unreachable': 'error',
            eqeqeq: ['warn', 'smart'],
            'no-var': 'warn',
            'prefer-const': 'warn',

            // `ephemeral: true` sudah usang di discord.js v14 dan hanya bertahan di
            // repo ini karena penambal prototype di src/utils/ephemeralPatch.js.
            // Aturan ini menahan pemakaian baru supaya penambal itu bisa dihapus
            // (issue #10), bukan tumbuh terus.
            //
            // Setelan 'warn' dulu, bukan 'error', karena pemanggil lama belum
            // selesai dimigrasikan dan lint yang merah total malah diabaikan orang.
            'no-restricted-syntax': [
                'warn',
                {
                    selector: 'Property[key.name="ephemeral"][value.value=true]',
                    message: 'Gunakan `flags: MessageFlags.Ephemeral`, bukan `ephemeral: true` (issue #10).'
                },
                {
                    selector: 'Property[key.value="ephemeral"][value.value=true]',
                    message: 'Gunakan `flags: MessageFlags.Ephemeral`, bukan `ephemeral: true` (issue #10).'
                }
            ]
        }
    },
    {
        // Penambal itu sendiri memang harus menyebut properti usangnya.
        files: ['src/utils/ephemeralPatch.js'],
        rules: {
            'no-restricted-syntax': 'off'
        }
    },
    {
        // Berkas router interaksi harus tetap tipis. Ini yang menjaga
        // interactionCreate.js tidak kembali menjadi 43 KB seperti dulu.
        files: ['src/events/interactionCreate.js', 'src/interactions/**/*.js'],
        rules: {
            'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }]
        }
    }
];

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
            'prefer-const': 'warn'
        }
    }
];

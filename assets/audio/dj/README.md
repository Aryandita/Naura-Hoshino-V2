# DJ Voice Lines, Pre-generated Audio Assets

Voice packs generated with the repository's Fish Audio integration. They are a safe fallback for AI DJ playback when runtime synthesis is unavailable.

The normal path still synthesizes the complete intro at runtime. That is intentional: track title, artist, requester name, selected language, and custom persona must remain accurate. Static files never contain a fake title or a placeholder user name.

## Folder Structure

```
assets/audio/dj/
├── id/              # Indonesian voice packs
│   ├── lofi_default_v1.mp3
│   ├── lofi_tsundere_v1.mp3
│   └── ...
├── en/              # English voice packs
│   └── ...
├── premium/         # User-specific cache, ignored by Git
├── intro/           # Track-specific runtime cache, ignored by Git
├── manifest.json    # Generated registry with hashes and source text
└── README.md
```

## File Naming Convention

`{genre}_{persona}_v{variant}.mp3`

- **genre**: `lofi`, `anime`, `rock`, `edm`, `kpop`, `acoustic`, `gaming`, `stream`, `pop_default`
- **persona**: `default`, `tsundere`, `kuudere`, `gamer`, `butler`
- **variant**: `1` or `2`
- **Total**: 9 genres x 5 built-in personas x 2 variants x 2 languages = 180 files

Custom personas outside the built-in five are not faked into a static asset. They use runtime Fish Audio synthesis so the requested style is preserved.

## How to Regenerate

### Prerequisites

- `FISH_AUDIO_API_KEY` configured in `.env`
- Node.js >= 24

### Commands

```bash
# Preview what will be generated (no API calls)
node scripts/generate-dj-audio.js --dry-run

# Generate all languages
node scripts/generate-dj-audio.js

# Generate only Indonesian
node scripts/generate-dj-audio.js --lang id

# Generate only English
node scripts/generate-dj-audio.js --lang en
```

The script includes a 2s delay between API calls to respect the Fish Audio rate limit. One language produces 90 files and may take several minutes, depending on API latency.

## How the Bot Uses These Files

1. `aiDjManager.js` classifies the current track's genre via `genreClassifier.js`.
2. Runtime Fish Audio synthesis runs first, so the intro can include the actual title, artist, requester, language, and persona.
3. If runtime synthesis fails, `aiDjTrackService.js` selects `assets/audio/dj/{lang}/{genre}_{persona}_v{variant}.mp3`.
4. If a persona-specific file is unavailable, the resolver falls back to the genre-only naming convention for backward compatibility.
5. The `manifest.json` file tracks every generated file, source text, size, and SHA-256 hash.

## Manifest Format

```json
{
  "generatedAt": "2026-10-28T11:00:00.000Z",
  "files": [
    {
      "lang": "id",
      "genre": "LOFI",
      "persona": "default",
      "variant": 1,
      "filename": "lofi_default_v1.mp3",
      "path": "assets/audio/dj/id/lofi_v1.mp3",
      "sizeBytes": 45678
    }
  ]
}
```

## Notes

- Do not commit `.env` or API keys to version control
- Re-run generation after updating templates in this script or in `aiDjManager.js`
- The `premium/` folder is reserved for future VIP-tier exclusive voice lines

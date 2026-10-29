# DJ Voice Lines - Pre-generated Audio Assets

Pre-generated Fish Audio TTS voice lines for Naura's AI DJ companion feature. These files provide instant DJ intro audio without real-time API calls during playback.

## Folder Structure

```
assets/audio/dj/
├── id/              # Indonesian voice lines
│   ├── lofi_v1.mp3
│   ├── lofi_v2.mp3
│   ├── anime_v1.mp3
│   └── ...
├── en/              # English voice lines
│   ├── lofi_v1.mp3
│   └── ...
├── premium/         # Reserved for VIP-exclusive voice lines
├── manifest.json    # Generated file registry with metadata
└── README.md        # This file
```

## File Naming Convention

`{genre}_v{variant}.mp3`

- **genre**: `lofi`, `anime`, `rock`, `edm`, `kpop`, `acoustic`, `gaming`, `stream`, `pop_default`
- **variant**: `1` or `2` (two template variants per genre for variety)
- **Total**: 9 genres x 2 variants x 2 languages = 36 files

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

The script includes a 1.2s delay between API calls to respect Fish Audio rate limits. Expect ~45 seconds for a full generation run of one language (18 files).

## How the Bot Uses These Files

1. `aiDjManager.js` classifies the current track's genre via `genreClassifier.js`
2. If a pre-generated file exists at `assets/audio/dj/{lang}/{genre}_v{random}.mp3`, it is streamed directly via Lavalink/Poru
3. If no pre-generated file exists, the bot falls back to real-time Fish Audio TTS synthesis
4. The `manifest.json` file tracks which files are available and their metadata

## Manifest Format

```json
{
  "generatedAt": "2026-10-28T11:00:00.000Z",
  "files": [
    {
      "lang": "id",
      "genre": "lofi",
      "variant": 1,
      "filename": "lofi_v1.mp3",
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

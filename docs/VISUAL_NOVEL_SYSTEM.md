# 📖 Naura Wilds Visual Novel System - Panduan Lengkap

## Overview

Sistem Visual Novel (VN) untuk Naura Wilds Survival RPG yang mengubah pengalaman grinding menjadi cerita interaktif yang mendalam. Sistem ini mengintegrasikan:

- **Story Engine** - Progres cerita bercabang dengan choices
- **Visual Novel Renderer** - Render scene dengan Discord Components V2 + Canvas
- **NPC Schedule System** - NPC berpindah lokasi & berubah penampilan berdasarkan waktu
- **Backstory Unlock System** - Lore NPC terbuka seiring kenaikan relationship
- **Dynamic Portrait System** - Tampilan NPC berbeda setiap konteks

---

## 🎯 Tujuan Desain

1. **Meningkatkan Retensi** - User kembali untuk melanjutkan cerita
2. **Emotional Engagement** - User merasa terhubung dengan NPC
3. **Meaningful Progression** - Relationship level membuka konten baru
4. **Replayability** - Multiple paths dan endings
5. **Immersion** - Dialog kontekstual, jadwal realistis, visual dinamis

---

## 🏗️ Arsitektur Sistem

### 1. Story Engine (`src/survival/engines/storyEngine.js`)

Mengelola progres cerita user:

```javascript
{
  currentChapter: "prologue",
  currentScene: "start", 
  completedScenes: ["scene_001", "scene_002"],
  unlockedBackstories: ["ningsih_level_1", "tari_level_2"],
  choices: {
    "chapter1_choice1": "option_a",
    "chapter2_choice2": "option_b"
  },
  flags: {
    "helped_ningsih_farm": true,
    "saved_tari_from_storm": false
  }
}
```

**Fitur:**
- Track chapter & scene progress
- Record user choices untuk branching
- Set/get story flags untuk conditional content
- Unlock backstory tracking

### 2. Visual Novel Renderer (`src/survival/engines/visualNovelRenderer.js`)

Render VN scenes menggunakan Discord Components V2:

```javascript
const scene = {
  characterId: "ningsih",
  characterEmotion: "happy",
  backgroundId: "farm_morning",
  speakerName: "Ningsih",
  dialogText: "Selamat pagi! Bunga-bunga hari ini mekar indah sekali~",
  choices: [
    { label: "Memuji bunganya", value: "compliment" },
    { label: "Bertanya cara merawat", value: "ask_care" },
    { label: "Diam saja", value: "silent" }
  ]
};
```

**Asset Structure:**
```
assets/survival/vn/
├── characters/
│   ├── ningsih/
│   │   ├── neutral.png
│   │   ├── happy.png
│   │   ├── sad.png
│   │   └── working.png
│   └── tari/
│       ├── neutral.png
│       ├── fishing.png
│       └── swimming.png
└── backgrounds/
    ├── farm_morning.png
    ├── town_square_evening.png
    └── clinic_interior.png
```

### 3. NPC Schedule Engine (`src/survival/engines/npcScheduleEngine.js`)

NPC memiliki jadwal harian realistis:

```javascript
ningsih: {
  timeSlots: [
    { startHour: 5, endHour: 8, location: "farm", activity: "menyiram tanaman", portraitVariant: "working" },
    { startHour: 8, endHour: 12, location: "market", activity: "menjual hasil panen", portraitVariant: "casual" },
    { startHour: 12, endHour: 14, location: "cafe", activity: "makan siang", portraitVariant: "relaxed" },
    // ... more slots
  ]
}
```

**Fitur:**
- NPC berpindah lokasi berdasarkan jam in-game
- Portrait variant berubah sesuai aktivitas
- Contextual dialog berdasarkan apa yang sedang dilakukan NPC
- Availability check (tidak bisa ganggu NPC yang sedang tidur)

### 4. Backstory Engine (`src/survival/engines/npcBackstoryEngine.js`)

Lore NPC terbuka di relationship level tertentu:

```javascript
ningsih: {
  levels: [
    {
      level: 1,
      title: "Gadis Desa yang Penyayang",
      content: "Ningsih tumbuh di keluarga petani sederhana...",
      unlockCondition: "Reach Friendship Level 1"
    },
    {
      level: 2,
      title: "Mimpi di Balik Kesederhanaan",
      content: "Di balik senyum polosnya, Ningsih menyimpan mimpi besar...",
      unlockCondition: "Reach Friendship Level 2"
    },
    // ... more levels
  ]
}
```

**Unlock Flow:**
1. User naikkan relationship level dengan NPC
2. System auto-check backstory unlock
3. Notifikasi muncul saat backstory baru terbuka
4. User baca via `/story backstory <npc>`

---

## 🎮 Command Usage

### `/story start`
Mulai atau lanjutkan story mode. Menampilkan hub menu dengan:
- Current chapter & scene
- Progress stats
- Quick access ke scene berikutnya

### `/story backstory <npc>`
Baca backstory NPC yang sudah terbuka. List semua available backstories dengan status unlock.

### `/story schedule [npc]`
- Tanpa parameter: Lihat semua NPC yang available saat ini
- Dengan parameter: Lihat jadwal lengkap NPC tertentu

### `/story progress`
Detail progres story mode:
- Chapter & scene saat ini
- Jumlah scenes selesai
- Backstories terbuka
- Story flags aktif

---

## 📝 Writing Guidelines untuk VN Content

### Dialog Style
- **Natural & Conversational** - Hindari bahasa kaku/formal
- **Personality-Driven** - Setiap NPC punya voice unik
- **Context-Aware** - Dialog berubah berdasarkan waktu, lokasi, relationship
- **No Em-Dash** - Gunakan "-" bukan "-" (sesuai RULES.md)

### Character Voice Examples

**Ningsih (Polos, Pemalu):**
```
"Oh... halo. Maaf, aku lagi fokus menyiram bunga. 
Kamu... mau lihat kebun baruku? Aku tanam lavender kemarin."
```

**Tari (Tomboy, Energik):**
```
"Oi! Pas banget kamu datang! Gelombang hari ini gila banget!
Ayo melaut bareng, aku jamin nggak bakal nyesel!"
```

**Bidan Sari (Keibuan, Lembut):**
```
"Selamat pagi, sayang. Kamu kelihatan lelah sekali.
Sudah makan belum? Sini, Ibu buatkan teh hangat dulu."
```

### Branching Choices Design

**Meaningful Impact:**
- Choices mempengaruhi relationship points
- Beberapa choices unlock exclusive scenes
- Long-term consequences di chapter berikutnya

**Example:**
```javascript
choices: [
  { 
    label: "Bantu Ningsih menyiram", 
    value: "help_water",
    effects: { affection: +5, flag: "helped_ningsih_farm" }
  },
  { 
    label: "Puji bunganya saja", 
    value: "compliment",
    effects: { affection: +2 }
  },
  { 
    label: "Langsung pergi", 
    value: "leave",
    effects: { affection: -1 }
  }
]
```

---

## 🎨 Art Asset Requirements

### Character Portraits
- **Format:** PNG/WebP dengan transparent background
- **Resolution:** Minimal 512x512px (recommended 1024x1024)
- **Emotions per NPC:** neutral, happy, sad, angry, surprised, working, casual, evening, home, sleep
- **Style:** Consistent anime/VN aesthetic

### Backgrounds
- **Format:** PNG/JPEG
- **Resolution:** 1920x1080 (16:9 aspect ratio)
- **Variants:** morning, afternoon, evening, night (untuk lokasi utama)
- **Locations:** farm, market, cafe, clinic, school, smithy, town_square, beach, dock, library, park, tavern, home_interior

### UI Elements
- Name box overlay
- Choice button styling
- Transition effects (optional)

---

## 🔧 Integration Points

### 1. NPC Interaction (`plugin/survival/subcommands/npc.js`)
- Check NPC availability via schedule engine
- Use contextual dialog dari schedule
- Trigger backstory unlock on relationship increase

### 2. Town System (`plugin/survival/subcommands/town.js`)
- Show only available NPCs based on current hour
- Display NPC current activity & appearance

### 3. Gallery (`plugin/survival/subcommands/gallery.js`)
- Add "Backstory Collection" tab
- Show unlocked vs locked backstories

### 4. Dashboard Activity Page
- Integrate VN reader interface
- Show story progress widget
- NPC schedule viewer

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [x] Story Engine core
- [x] VN Renderer basic
- [x] NPC Schedule Engine
- [x] Backstory Engine
- [x] `/story` command structure

### Phase 2: Content Creation (Week 3-6)
- [ ] Write prologue & chapter 1 scripts
- [ ] Create NPC portrait assets (emotions)
- [ ] Create background assets (key locations)
- [ ] Implement choice branching logic
- [ ] Add backstory content for main romance NPCs

### Phase 3: Polish & Integration (Week 7-8)
- [ ] Integrate with existing NPC interaction system
- [ ] Add notification system untuk backstory unlock
- [ ] Dashboard integration
- [ ] Testing & balancing
- [ ] Localization (ID/EN)

### Phase 4: Expansion (Ongoing)
- [ ] Additional chapters & side stories
- [ ] More NPC backstories
- [ ] Achievement system tied to story progress
- [ ] Seasonal events dengan limited-time story content

---

## 📊 Success Metrics

- **Retention Rate:** % user yang kembali untuk continue story
- **Backstory Unlock Rate:** Rata-rata backstories dibuka per user
- **Choice Diversity:** Distribusi choices (hindari dominant strategy)
- **Completion Rate:** % user yang finish chapter
- **Engagement Time:** Average session duration di story mode

---

## 💡 Future Enhancements

1. **Voice Acting** - AI-generated voice lines untuk key scenes
2. **Animated Sprites** - Live2D-style character animations
3. **Music Integration** - BGM yang berubah sesuai mood scene
4. **Achievement System** - Badges untuk story milestones
5. **Community Stories** - User-generated VN content (modding support)
6. **Cross-Platform Sync** - Continue story di dashboard/web

---

## 📚 References

- AGENTS.md Section 7.1 (Diagram Alur Eksekusi)
- RULES.md Section 1.12 (Lokalisasi & Standardisasi Gaya Teks)
- DESIGN.md (Bahasa Desain & UI Tokens)
- Existing NPC System: `src/survival/data/npcs.js`
- Existing Relationship System: `src/survival/helpers/npcHelpers.js`

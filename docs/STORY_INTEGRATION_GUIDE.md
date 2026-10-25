# 📖 Story System Integration Guide

## Overview

Story system sekarang terintegrasi langsung ke dalam survival commands, bukan sebagai command terpisah. VN scenes dan story events muncul secara natural saat user berinteraksi dengan sistem survival.

---

## 🔗 Integration Points

### 1. NPC Interaction (`/survival npc`)

**File:** `plugin/survival/subcommands/npc.js`

**Integrations:**
- **First Encounter VN Scene** - Saat user memilih NPC untuk pertama kali, jika ada first encounter scene, akan ditampilkan sebagai VN scene
- **Dynamic Portrait** - Portrait NPC berubah berdasarkan schedule (working, casual, evening, dll)
- **Contextual Dialog** - Dialog NPC menyesuaikan dengan aktivitasnya saat ini
- **Activity Display** - Menampilkan apa yang sedang dilakukan NPC dan dimana lokasinya
- **Backstory Unlock Notification** - Notifikasi saat backstory baru terbuka setelah relationship level naik

**Flow:**
```
User pilih NPC dari dropdown
  ↓
Check first encounter scene → Jika ada, render VN scene
  ↓
Get NPC state dari schedule engine (location, activity, portrait variant)
  ↓
Get contextual dialog berdasarkan aktivitas
  ↓
Display NPC card dengan enhanced info
  ↓
Saat user greet/gift → Check backstory unlock
  ↓
Jika backstory unlocked → Tampilkan notifikasi
```

### 2. Travel System (`/survival travel`)

**File:** `plugin/survival/subcommands/travel.js`

**Integrations:**
- **Location Story Events** - Event khusus yang triggered di lokasi tertentu pada waktu tertentu
- **First Visit Trigger** - Cerita/exploration note saat mengunjungi lokasi baru pertama kali
- **Time-based Events** - Event yang hanya muncul di jam in-game tertentu

**Example Triggers:**
```javascript
// Town square night event
if (location === "town_square" && hour >= 20 && hour < 23) {
  // Trigger special night scene
}

// First visit to new location
if (!flags[`visited_${location}`]) {
  // Show exploration note
}
```

### 3. NPC Actions (`src/survival/helpers/npcActions.js`)

**Integrations:**
- **Greet Action** - Check backstory unlock setelah relationship level naik
- **Gift Action** - Bisa ditambahkan trigger untuk special gift story scenes
- **Marry Action** - Marriage proposal VN scene

**Backstory Unlock Flow:**
```
User greet NPC
  ↓
Affection naik, check relationship level change
  ↓
Jika level naik → checkBackstoryUnlock()
  ↓
Jika backstory tersedia → Tampilkan notifikasi dengan command hint
```

---

## 🎮 User Experience Flow

### Contoh 1: First Meet Ningsih

1. User ketik `/survival npc`
2. Pilih "Ningsih" dari dropdown
3. **VN Scene muncul:**
   ```
   [Background: Farm Morning]
   [Character: Ningsih - Surprised]
   
   Ningsih: "Oh! Maaf, aku tidak melihatmu datang. 
   Kamu... pendatang baru ya?
   
   Aku Ningsih. Selamat datang di kebun kami!"
   
   [Choice Buttons]
   • "Senang berkenalan denganmu, Ningsih."
   • "Kebunmu indah sekali!"
   ```
4. User pilih response
5. Story flag tercatat, lanjut ke NPC interaction normal

### Contoh 2: Relationship Level Up

1. User greet Ningsih berulang kali hingga affection 30+
2. Relationship level naik dari 0 ke 1
3. **Notifikasi muncul:**
   ```
   💬 Ngobrol Santai
   
   Kamu mengobrol santai dengan Ningsih. Suasananya hangat sekali~
   > Afeksi +2
   
   📖 Backstory Terbuka!
   Hubunganmu dengan Ningsih meningkat! Kamu sekarang bisa 
   membaca cerita latar belakangnya dengan `/story backstory ningsih`.
   ```

### Contoh 3: Location Event

1. User travel ke town_square pada jam 21:00
2. **Story event triggered:**
   ```
   📍 Kamu sudah sampai di Alun-Alun Kota!
   
   ... (travel info) ...
   
   📖 Narrator
   Alun-alun kota terasa berbeda di malam hari. Lentera-lentera 
   temaram menciptakan suasana magis...
   
   Kamu mendengar alunan musik sayup-sayup dari panggung kecil 
   di sudut alun-alun.
   ```

### Contoh 4: Dynamic NPC Display

1. User buka `/survival npc` pada jam 08:00
2. Pilih Ningsih
3. **NPC Card menampilkan:**
   ```
   Ningsih (Ahli Botani & Petani)
   *Polos, pekerja keras, sangat menyukai tanaman*
   
   📍 Sedang menjual hasil panen di market
   👔 Memakai celemek berkebun
   
   Status: Teman
   Affection: 25/100
   ████████░░ 25%
   
   💬 Ningsih: "Pagi! Mau beli sayur segar? 
   Baru dipanen tadi subuh loh!"
   ```

---

## 📊 Story Progress Tracking

Semua story progress tersimpan di `UserSurvival.storyProgress`:

```javascript
{
  currentChapter: "prologue",
  currentScene: "start",
  completedScenes: ["scene_001", "scene_002"],
  unlockedBackstories: ["ningsih_level_1", "tari_level_2"],
  choices: {
    "chapter1_choice1": "option_a"
  },
  flags: {
    "first_meet_ningsih": true,
    "helped_ningsih_farm": true,
    "visited_town_square": true,
    "town_square_night_event": true
  }
}
```

---

## 🔧 Developer Guide

### Menambah First Encounter Scene

Edit `src/survival/helpers/storyIntegration.js`:

```javascript
getFirstEncounterScene(npcId) {
  const scenes = {
    your_npc_id: {
      characterId: "your_npc_id",
      characterEmotion: "happy",
      backgroundId: "location_time",
      speakerName: "NPC Name",
      dialogText: "Dialog text here...",
      choices: [
        { label: "Choice 1", value: "value1" },
        { label: "Choice 2", value: "value2" },
      ],
    },
  };
  return scenes[npcId] || null;
}
```

### Menambah Location Event

Edit `src/survival/helpers/storyIntegration.js`:

```javascript
async checkLocationStoryEvent(userId, location, hour) {
  const progress = await storyEngine.getUserStoryProgress(userId);

  if (location === "your_location" && hour >= X && hour < Y) {
    const eventKey = "your_location_event";
    if (!progress.flags[eventKey]) {
      await storyEngine.setStoryFlag(userId, eventKey, true);
      return {
        type: "location_event",
        scene: {
          backgroundId: "your_background",
          speakerName: "Narrator",
          dialogText: "Your story text...",
        },
      };
    }
  }
  return null;
}
```

### Menambah Activity Trigger

Edit `src/survival/helpers/storyIntegration.js`:

```javascript
async checkActivityStoryTrigger(userId, activityType, context = {}) {
  const progress = await storyEngine.getUserStoryProgress(userId);

  if (activityType === "your_activity") {
    const triggerKey = "your_trigger_flag";
    if (!progress.flags[triggerKey]) {
      await storyEngine.setStoryFlag(userId, triggerKey, true);
      return {
        type: "story_notification",
        message: "Your notification message...",
      };
    }
  }
  return null;
}
```

---

## 🎨 Asset Requirements

Untuk integrasi penuh, siapkan asset berikut:

### Character Portraits (dengan emotions & variants)
```
assets/survival/vn/characters/
├── ningsih/
│   ├── neutral.png, happy.png, sad.png, surprised.png
│   ├── working.png, casual.png, relaxed.png, evening.png
│   └── home.png, sleep.png
└── ... (untuk setiap NPC)
```

### Backgrounds (dengan time variants)
```
assets/survival/vn/backgrounds/
├── farm_morning.png, farm_afternoon.png, farm_evening.png
├── market_morning.png, market_afternoon.png
├── town_square_morning.png, town_square_evening.png, town_square_night.png
└── ... (untuk setiap lokasi)
```

---

## ✅ Testing Checklist

- [ ] First encounter VN scene muncul saat pilih NPC baru
- [ ] Dynamic portrait berubah sesuai jam in-game
- [ ] Contextual dialog menampilkan aktivitas NPC
- [ ] Backstory unlock notification muncul saat level up
- [ ] Location event triggered di waktu/tempat yang tepat
- [ ] First visit note muncul saat explore lokasi baru
- [ ] Story flags tersimpan dengan benar
- [ ] Tidak ada error saat asset belum tersedia (graceful fallback)

---

## 🚀 Future Enhancements

1. **Choice Consequences** - Choices mempengaruhi story branches
2. **Multi-scene Stories** - Chapter-length VN sequences
3. **Animated Transitions** - Fade effects antara scenes
4. **BGM Integration** - Music yang berubah sesuai mood
5. **Achievement System** - Badges untuk story milestones
6. **Dashboard Integration** - VN reader di web dashboard

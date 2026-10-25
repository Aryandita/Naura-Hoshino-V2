# 🎨 Asset Generation Prompts - Roam & Date System

## NPC Portraits (Transparent Background)

### Style Guidelines
- **Format:** PNG dengan transparent background
- **Resolution:** 1024x1024px (square, character-focused)
- **Style:** Anime/VN aesthetic, consistent dengan existing Naura Wilds art
- **Emotions per NPC:** neutral, happy, sad, shy, excited, surprised, working, casual, evening

### Character-Specific Prompts

#### Ningsih (Gadis Desa Petani)
```
Base appearance: Young Indonesian village girl, long dark hair in loose braid, 
simple floral dress or kebaya, gentle smile, soft brown eyes.

Emotions:
- neutral: Calm expression, slight smile, holding small flower
- happy: Bright smile, eyes sparkling, hands clasped together
- shy: Blushing cheeks, looking down slightly, fidgeting fingers
- working: Wearing straw hat and apron, holding watering can, focused expression
- casual: Relaxed pose, sitting on grass, peaceful expression
- evening: Wearing simple dress, holding lantern, warm smile
```

#### Tari (Anak Nelayan Tomboy)
```
Base appearance: Athletic Indonesian girl, short messy black hair, 
tanned skin, confident grin, wearing practical fishing outfit.

Emotions:
- neutral: Confident stance, arms crossed, slight smirk
- happy: Big laugh, one hand raised, energetic pose
- excited: Jumping slightly, fists pumped, wide grin
- working: Wearing fisherman hat, holding fishing rod, determined look
- casual: Sitting casually, leaning back, relaxed smile
- swimming: In swimwear, wet hair, playful expression
```

#### Bidan Sari (Perawat Keibuan)
```
Base appearance: Mature Indonesian woman, neat bun hairstyle, 
nurse uniform or modest dress, warm motherly smile, glasses.

Emotions:
- neutral: Gentle smile, hands folded, professional stance
- happy: Warm laugh, eyes crinkling, nurturing expression
- concerned: Slight frown, tilted head, caring eyes
- working: In nurse uniform, holding medical bag, professional smile
- casual: In comfortable clothes, reading book, relaxed
- evening: In elegant dress, holding tea cup, serene smile
```

#### Bu Ratna (Guru Cerdas)
```
Base appearance: Elegant Indonesian woman, shoulder-length hair, 
glasses, modest blouse and skirt, intelligent gaze.

Emotions:
- neutral: Thoughtful expression, holding book, slight smile
- happy: Proud smile, adjusting glasses, warm eyes
- teaching: Pointing at invisible board, engaged expression
- reading: Focused on book, finger on page, concentrated
- casual: Relaxed pose, cup of tea, content smile
- formal: In blazer, professional stance, confident
```

---

## Location Backgrounds (With NPCs)

### Format
- **Resolution:** 1920x1080px (16:9 landscape)
- **Include:** 1-2 NPCs dalam scene sesuai konteks
- **Time variants:** morning, afternoon, evening, night

### Location Prompts

#### Warung Bu Yati (Desa Sukamaju)
```
Morning: Traditional Indonesian warung with wooden tables, steam rising from 
kitchen, warm sunlight through windows. Bu Yati (middle-aged woman in apron) 
serving food. Mang Ujang sitting at table eating. Cozy village atmosphere.

Evening: Same warung but with warm lamp lighting, fewer customers, 
more intimate atmosphere. Outside view shows sunset.
```

#### Sekolah SD (Desa Sukamaju)
```
Morning: Simple village school building with open windows, children's drawings 
on walls. Bu Ratna at blackboard teaching. Budi and Siti sitting at desks. 
Bright morning light, cheerful colors.

Afternoon: Same classroom but emptier, some children playing outside. 
Bu Ratna grading papers at desk. Warm afternoon sun.
```

#### Kebun Warga (Desa Sukamaju)
```
Morning: Lush vegetable garden with neat rows, morning dew on leaves. 
Ningsih watering plants with watering can. Ki Prawiro inspecting herbs nearby. 
Misty morning atmosphere, golden hour lighting.

Afternoon: Same garden under bright sun, Ningsih harvesting vegetables, 
wiping sweat from forehead. Vibrant green colors.
```

#### Sungai Jernih (Desa Sukamaju)
```
Morning: Clear river with smooth rocks, tall trees on banks, mist over water. 
Tari standing on rock casting fishing line. Mang Ujang sitting on bank with 
bamboo rod. Peaceful nature sounds implied.

Evening: Same river at golden hour, orange sky reflection on water. 
Tari and player character sitting on bank watching sunset. Romantic atmosphere.
```

#### Cafe Naura (Kota Pratama)
```
Afternoon: Modern cozy cafe interior, wooden furniture, hanging plants, 
large windows. Bidan Sari sipping latte at corner table. Luna Gacha browsing 
menu at counter. Soft jazz atmosphere implied.

Night: Same cafe with warm ambient lighting, candles on tables, more intimate. 
Bidan Sari and player character having dinner date. Romantic mood.
```

#### Perpustakaan Kota (Kota Pratama)
```
Afternoon: Tall bookshelves, reading lamps, quiet study area. 
Bu Ratna browsing books in philosophy section. Sunlight through high windows. 
Scholarly atmosphere.

Evening: Same library with softer lighting, fewer people. 
Bu Ratna and player character reading together at same table. 
Intimate intellectual atmosphere.
```

---

## Event Scene Compositions

### First Meet Event Template
```
Composition: Character portrait (right side, 60% frame), 
background location (full frame behind), dialog box overlay (bottom).

Example - First Meet Ningsih at Kebun:
- Background: Kebun pagi hari dengan kabut tipis
- Character: Ningsih (surprised emotion) memegang keranjang sayur
- Foreground: Player POV melihat dari jalan setapak
- Lighting: Soft morning light dari kiri atas
- Mood: Innocent surprise, welcoming
```

### Relationship Event Template
```
Composition: Two characters in scene (NPC + silhouette/backsight of player), 
intimate framing, emotional lighting.

Example - Level 2 Ningsih at Kebun Sore:
- Background: Kebun saat sunset, golden hour
- Characters: Ningsih (shy emotion) berdiri dekat bunga, 
  player silhouette di sampingnya
- Lighting: Warm orange glow dari matahari terbenam
- Mood: Tender moment, growing closeness
- Details: Bunga-bunga di foreground, butterflies optional
```

### Date Scene Template
```
Composition: Romantic framing, both characters visible, 
special lighting effects, detailed background.

Example - Date with Ningsih at Kebun:
- Background: Kebun dengan picnic blanket, basket makanan, 
  fairy lights di pohon (malam hari)
- Characters: Ningsih (happy/blushing) duduk di blanket, 
  player character beside her
- Lighting: Moonlight + warm fairy lights
- Mood: Intimate, romantic, special occasion
- Details: Flowers around blanket, stars visible in sky
```

---

## Shop Item Icons (Optional)

Jika ingin menambahkan icon untuk shop items:

```
nasi_goreng: Plate of fried rice with egg and vegetables, top-down view
teh_manis: Glass of sweet tea with ice cubes, condensation on glass
kopi_desa: Traditional coffee cup with steam rising
latte: Modern latte art in ceramic cup
croissant: Golden butter croissant on plate
ramuan_stamina: Glowing green potion in glass bottle
```

---

## Technical Notes

1. **File Naming Convention:**
   - NPC portraits: `{npc_id}_{emotion}.png` (e.g., `ningsih_shy.png`)
   - Backgrounds: `{location_id}_{time}.png` (e.g., `kebun_morning.png`)
   - Items: `{item_id}.png` (e.g., `nasi_goreng.png`)

2. **Color Palette Consistency:**
   - Desa Sukamaju: Earth tones, greens, warm browns
   - Kota Pratama: Modern blues, grays, accent pinks
   - Desa Khul'Khas: Dark greens, purples, mysterious tones
   - Istana Draken: Gold, deep reds, blacks

3. **Export Settings:**
   - PNG-24 for transparency
   - sRGB color space
   - No compression artifacts

4. **Asset Placement:**
   ```
   assets/survival/
   ├── roam/
   │   ├── npcs/
   │   │   ├── ningsih/
   │   │   ├── tari/
   │   │   └── ...
   │   ├── backgrounds/
   │   │   ├── desa_sukamaju/
   │   │   ├── kota_pratama/
   │   │   └── ...
   │   └── items/
   └── vn/ (existing VN assets)
   ```

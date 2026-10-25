# 🎨 Technical Specification: 3D Model Naura Hoshino dengan Full Animation

**Versi Dokumen:** 1.0.0  
**Tanggal:** 2026-10-25  
**Target:** 3D Artist / Animator  
**Engine Target:** Three.js r160+ / @pixiv/three-vrm v1.x  
**Format Export:** GLB (GLTF 2.0 Binary) & VRM 0.x/1.x  

---

## 📋 Daftar Isi

1. [Overview Proyek](#1-overview-proyek)
2. [Spesifikasi Model Base](#2-spesifikasi-model-base)
3. [Rigging Standards](#3-rigging-standards)
4. [Daftar Animasi yang Dibutuhkan](#4-daftar-animasi-yang-dibutuhkan)
5. [Timing & Keyframe Guidelines](#5-timing--keyframe-guidelines)
6. [Morph Targets / Blend Shapes](#6-morph-targets--blend-shapes)
7. [Export Settings](#7-export-settings)
8. [Quality Assurance Checklist](#8-quality-assurance-checklist)
9. [Referensi Implementasi Existing](#9-referensi-implementasi-existing)

---

## 1. Overview Proyek

### 1.1 Konteks Penggunaan

Model 3D Naura Hoshino akan digunakan di 2 environment:

**A. Web Dashboard (Primary)**
- Renderer: Three.js WebGL
- FPS Target: 60 FPS desktop, 30 FPS mobile
- Max draw calls: < 50
- Texture budget: ≤ 2048x2048 per texture
- Vertex count ideal: < 100k vertices

**B. Discord Bot Canvas (Secondary)**
- Renderer: Node.js Canvas (static/snapshot) atau headless WebGL
- Usage: Profile card generation, welcome images, achievement badges
- Format output: PNG/JPEG static image
- Tidak perlu animasi real-time, hanya pose keyframes

### 1.2 Style Guide

**Art Style:** Anime Cyberpunk-Nature Hybrid
- Proporsi tubuh: 6-7 head heights (anime style)
- Wajah: Large expressive eyes, small nose/mouth
- Rambut: Ponytail dengan physics bones (spring bones)
- Kostum: Tech-wear dengan elemen neon cyan/pink
- Warna dominan: White, Cyan (#38bdf8), Pink (#ffb3cb), Dark accents

**Referensi Visual:**
- Lihat folder: `assets/3D Model Naura/previews/`
- Preview animasi: `preview_anim_*.png`
- Base model: `naura NEW.glb` dan `naura NEW.vrm`

---

## 2. Spesifikasi Model Base

### 2.1 Geometry Requirements

| Aspek | Requirement | Notes |
|-------|-------------|-------|
| **Total Vertices** | 80,000 - 100,000 | Current model: 87,307 vertices |
| **Total Faces** | 150,000 - 200,000 | Triangles only (no quads/n-gons) |
| **UV Islands** | Clean, non-overlapping | Padding ≥ 4px antara islands |
| **Texture Resolution** | 2048x2048 max | Power of 2 (POT) required |
| **Material Count** | ≤ 8 materials | Group by texture set |
| **Skinned Meshes** | 1 mesh ideal | Max 4 meshes jika diperlukan |

### 2.2 Topology Guidelines

✅ **DO:**
- Edge flow mengikuti muscle deformation zones
- Support loops di area sendi (shoulder, elbow, knee, hip)
- Consistent quad-based topology untuk wajah
- Extra geometry di area yang butuh detail tinggi (mata, mulut)

❌ **DON'T:**
- N-gons (faces dengan > 4 vertices)
- Pole vertices (vertex dengan > 5 edges) di area deformasi
- Overlapping UVs
- Internal geometry yang tidak terlihat (buang semua)

### 2.3 Scale & Units

```
Scale Reference:
- Total height: 1.65 meters (dalam scene units)
- Head height: ~0.23m
- Shoulder width: ~0.38m
- Hip width: ~0.32m

Root position: Y = 0 (feet on ground plane)
Forward axis: +Z (model menghadap +Z)
Up axis: +Y
```

---

## 3. Rigging Standards

### 3.1 Humanoid Bone Mapping (VRM Compatible)

Model **WAJIB** menggunakan bone naming convention VRM/Humanoid:

```javascript
// Required bones (exact names):
Hips
Spine
Chest
UpperChest        // Optional tapi recommended
Neck
Head
LeftShoulder
LeftArm
LeftForeArm
LeftHand
RightShoulder
RightArm
RightForeArm
RightHand
LeftUpLeg
LeftLeg
LeftFoot
RightUpLeg
RightLeg
RightFoot

// Finger bones (optional tapi bagus untuk hand gestures):
LeftThumbProximal, LeftThumbIntermediate, LeftThumbDistal
LeftIndexProximal, LeftIndexIntermediate, LeftIndexDistal
LeftMiddleProximal, LeftMiddleIntermediate, LeftMiddleDistal
LeftRingProximal, LeftRingIntermediate, LeftRingDistal
LeftLittleProximal, LeftLittleIntermediate, LeftLittleDistal
(Sama untuk Right*)

// Face bones (untuk advanced expressions):
LeftEye, RightEye
Jaw
```

### 3.2 Bone Orientation

```
Rest Pose: T-Pose atau A-Pose (arms down 45°)
- Arms: Straight out to sides (T-pose) ATAU angled down 45° (A-pose)
- Legs: Straight down, feet forward
- Spine: Natural S-curve slight
- Hands: Palms facing down/back

Bone Axis:
- X: Right/Left
- Y: Up/Down  
- Z: Forward/Backward
```

### 3.3 Spring Bones (Physics)

Untuk secondary animation (rambut, baju, accessories):

```javascript
// Recommended spring bone chains:
Ponytail (3-5 bones)
  └─ Ponytail_01 → Ponytail_02 → Ponytail_03 → Ponytail_end

Hair strands (2-3 chains per side)
  └─ Hair_L_01 → Hair_L_02 → Hair_L_end
  └─ Hair_R_01 → Hair_R_02 → Hair_R_end

Skirt/Clothing (optional)
  └─ Skirt_F_01 → Skirt_F_02
  └─ Skirt_B_01 → Skirt_B_02
  └─ Skirt_L_01 → Skirt_L_02
  └─ Skirt_R_01 → Skirt_R_02
```

**Spring Bone Parameters:**
- Stiffness: 0.3 - 0.7 (rambut lebih stiff dari baju)
- Drag: 0.1 - 0.3
- Gravity: (0, -0.5, 0) untuk natural hang

### 3.4 Inverse Bind Matrix (IBM)

⚠️ **CRITICAL:** Setelah rigging selesai, **WAJIB** export IBM yang benar!

Current issue di model existing: IBM tidak sinkron setelah joint repositioning, menyebabkan skinning artifacts saat animasi.

**Checklist IBM:**
- ✅ Semua joints sudah di-position dengan benar
- ✅ Skin weights sudah di-assign dan normalized (total weight per vertex = 1.0)
- ✅ Test deformasi di semua extreme poses sebelum export
- ✅ Export dengan "Include Inverse Bind Matrices" enabled

---

## 4. Daftar Animasi yang Dibutuhkan

### 4.1 Priority HIGH (Core Interactions)

| ID | Nama Animasi | Duration | Loop | Deskripsi | Use Case |
|----|--------------|----------|------|-----------|----------|
| A01 | Idle | 3-4s | ✅ | Diam dengan napas halus & micro sway | Default state |
| A02 | Wave | 2-2.5s | ❌ | Lambaian tangan friendly | Greeting, welcome |
| A03 | Thinking | 3-4s | ✅ | Kepala miring, tangan di dagu | Processing, loading |
| A04 | NodYes | 1-1.5s | ❌ | Kepala mengangguk 2-3x | Konfirmasi, agree |
| A05 | ShakeNo | 1.2-1.8s | ❌ | Kepala geleng 3-4x | Deny, reject, cancel |
| A06 | WalkForward | 1-1.2s | ✅ | Berjalan maju natural | Navigasi dashboard |
| A07 | WalkBackward | 1.2-1.5s | ✅ | Berjalan mundur hati-hati | Retreat, back nav |
| A08 | Sit | 4-5s | ✅ | Duduk santai dengan idle motion | AFK, lounge, rest |

### 4.2 Priority MEDIUM (Enhanced UX)

| ID | Nama Animasi | Duration | Loop | Deskripsi | Use Case |
|----|--------------|----------|------|-----------|----------|
| A09 | Type | 2.5-3s | ✅ | Mengetik di keyboard virtual | Bot typing response |
| A10 | DanceLoop1 | 2-2.5s | ✅ | Upbeat energetic dance | Music player (fast) |
| A11 | DanceLoop2 | 3-3.5s | ✅ | Smooth groovy dance | Music player (slow) |
| A12 | Cheers | 2-3s | ❌ | Bersorak dengan tangan naik | Achievement, level up |
| A13 | Shy | 3-4s | ✅ | Malu-malu, tangan menutup wajah | Embarrassed, cute reaction |
| A14 | Sleepy | 4-5s | ✅ | Mengantuk, kepala turun perlahan | AFK lama, late night |
| A15 | BlowKiss | 2-2.5s | ❌ | Tiup ciuman dengan tangan | Love, thank you |

### 4.3 Priority LOW (Nice to Have)

| ID | Nama Animasi | Duration | Loop | Deskripsi | Use Case |
|----|--------------|----------|------|-----------|----------|
| A16 | AstralCast | 2.5-3s | ❌ | Sihir magic dengan partikel | Special ability, hoshino mode |
| A17 | StarPose | 2-3s | ❌ | Pose idol bintang | Photo mode, showcase |
| A18 | Dizzy | 3-4s | ✅ | Pusing berputar | Error, confused, overload |
| A19 | Read | 4-5s | ✅ | Membaca buku/tablet | Reading mode, study |
| A20 | HoldItem | 3-4s | ✅ | Memegang item di tangan kanan | Inventory, gift |
| A21 | Salute | 2-2.5s | ❌ | Hormat militer formal | VIP greeting, respect |
| A22 | Bow | 2-3s | ❌ | Membungkuk sopan | Thank you, apology |
| A23 | Yawn | 2.5-3s | ❌ | Menguap lelah | Transition to Sleepy |
| A24 | Stretch | 3-3.5s | ❌ | Meregangkan badan | Wake up, break |
| A25 | CombatStance | 3-4s | ✅ | Siap bertarung | Naura Wilds battle |
| A26 | Craft | 3-4s | ✅ | Crafting/gathering motion | Survival RPG |
| A27 | Drink | 2.5-3s | ❌ | Minum dari gelas/cafe | Cafe system |
| A28 | Eat | 2.5-3s | ❌ | Makan snack | Cafe system |
| A29 | Point | 1.5-2s | ❌ | Menunjuk ke depan/samping | Tutorial, guide |
| A30 | TurnLeft | 1-1.2s | ❌ | Berputar 90° kiri | Navigation |
| A31 | TurnRight | 1-1.2s | ❌ | Berputar 90° kanan | Navigation |

---

## 5. Timing & Keyframe Guidelines

### 5.1 General Principles

**Ease In/Out:**
- Semua animasi WAJIB menggunakan easing (tidak linear)
- Recommended: Cubic Bezier atau Quadratic
- Avoid sudden stops/starts kecuali untuk comedic effect

**Weight & Momentum:**
- Karakter anime tetap punya weight (tidak floaty)
- Anticipation sebelum aksi besar (wind-up)
- Follow-through setelah aksi (recovery)

**Personality:**
- Naura = Energetic, cheerful, slightly clumsy but cute
- Gerakan harus expressif dan readable
- Exaggerate poses untuk clarity (anime principle)

### 5.2 Specific Timing Examples

**Walk Cycle (A06):**
```
Frame 0:   Contact (kaki kiri depan, tumit touch ground)
Frame 15:  Down (lowest point, knees bent)
Frame 30:  Passing (kaki kanan pass kaki kiri)
Frame 45:  Up (highest point, push off)
Frame 60:  Contact (kaki kanan depan)
... repeat mirror untuk cycle lengkap

FPS: 30
Total frames: 60 (2 seconds untuk full cycle kiri-kanan-kiri)
Hip bounce: ±2cm vertical
Hip sway: ±3cm horizontal
Shoulder counter-rotation: ±5°
Arm swing: ±30° dari rest position
```

**Wave (A02):**
```
Frame 0:   Rest pose
Frame 8:   Anticipation (badan sedikit turun, tangan prepare)
Frame 15:  Hand up ke samping kepala
Frame 20-35: Wave oscillation (3 cycles, ±20° wrist rotation)
Frame 45:  Hand return ke rest
Frame 50:  Settle back ke idle

FPS: 30
Total: 50-60 frames
Easing: Ease-out saat hand up, ease-in saat return
```

**Nod Yes (A04):**
```
Frame 0:   Head neutral
Frame 8:   Head down 25° (cepat)
Frame 12:  Head up 5° (bounce up sedikit)
Frame 18:  Head down 20° (kedua kali, lebih kecil)
Frame 22:  Head up neutral
Frame 30:  Settle

FPS: 30
Total: 30-40 frames
Note: Motion blur friendly, snappy tapi smooth
```

### 5.3 Loop vs One-Shot

**Looping Animations:**
- Harus seamless transition (frame terakhir ≈ frame pertama)
- Test dengan play berulang tanpa visible pop/hitch
- Untuk walk/run: pastikan footstep timing konsisten

**One-Shot Animations:**
- Start dan end di neutral/idle pose
- Include 3-5 frame hold di akhir untuk settle
- Provide "return to idle" transition jika needed

---

## 6. Morph Targets / Blend Shapes

### 6.1 Required Facial Expressions

| Name | Category | Description | Priority |
|------|----------|-------------|----------|
| Happy | Emotion | Smile lebar, mata squint sedikit | HIGH |
| Sad | Emotion | Mulut turun, eyebrows naik tengah | HIGH |
| Angry | Emotion | Eyebrows turun & mendekat, mulut tegang | HIGH |
| Thinking | Emotion | Mata lihat atas/samping, mulut slight purse | HIGH |
| Surprised | Emotion | Mata lebar, mulut open 'O' | MEDIUM |
| Blink | Eye | Kelopak mata tertutup penuh | HIGH |
| Wink | Eye | Satu mata tertutup (kanan) | LOW |
| Talk_A | Viseme | Mulut buka 'A' (seperti "father") | HIGH |
| Talk_I | Viseme | Mulut smile narrow 'I' (seperti "see") | HIGH |
| Talk_U | Viseme | Mulut rounded 'U' (seperti "food") | HIGH |
| Talk_E | Viseme | Mulut wide 'E' (seperti "bed") | HIGH |
| Talk_O | Viseme | Mulut open round 'O' (seperti "go") | HIGH |

### 6.2 Morph Target Naming Convention

Gunakan exact names ini untuk compatibility dengan code existing:

```javascript
// Emotions (capitalize first letter):
Happy, Sad, Angry, Thinking, Surprised

// Eyes:
Blink, Wink

// Visemes (untuk lip-sync):
Talk_A, Talk_I, Talk_U, Talk_E, Talk_O
// ATAU alternatif lowercase:
aa, ih, ou, ee, oh
```

### 6.3 Creating Quality Morph Targets

✅ **Best Practices:**
- Sculpt di base mesh terlebih dahulu, lalu create morph
- Maintain vertex count (tidak add/remove vertices)
- Test interpolation 0% → 100% harus smooth
- Combine multiple morphs harus work bersama (no conflicts)

❌ **Common Pitfalls:**
- Morph yang mengubah topology
- Extreme deformations yang bikin clipping
- Asymmetric morphs yang seharusnya symmetric
- Missing corrective shapes untuk joint bends

---

## 7. Export Settings

### 7.1 GLB Export (Recommended untuk Web)

**Blender Export Settings:**
```
Format: glTF Binary (.glb)

✓ Meshes
  ✓ Apply Modifiers: YES
  ✓ UVs: YES
  ✓ Normals: YES
  ✓ Tangents: YES (jika ada normal map)
  ✓ Vertex Colors: NO (kecuali dipakai)
  ✓ Materials: YES
  ✓ Compression: Draco (level 6-8)

✓ Animation
  ✓ Animation: YES
  ✓ Shape Keys: YES (morph targets)
  ✓ Skinning: YES
  ✓ Limit to: Selected Objects (jika scene complex)

✓ Extras
  ✓ Cameras: NO
  ✓ Lights: NO
  ✓ Embed Textures: YES (single file)
```

**File Size Targets:**
- Model only (no anim): < 5 MB
- Model + 10 animations: < 15 MB
- Model + 30 animations: < 25 MB
- Texture total: < 20 MB

### 7.2 VRM Export (Untuk Advanced Features)

**Required Tools:**
- Blender + VRM Addon (latest version)
- Atau Unity + UniVRM

**VRM-Specific Settings:**
```
✓ Humanoid Mapping: Auto-detect atau manual assign
✓ Spring Bones: Configure di panel VRM
✓ Morph Targets: Map ke VRM expression presets
✓ LookAt: Configure eye tracking bones
✓ First Person: Setup offset untuk VR view (optional)

Metadata:
- Title: "Naura Hoshino V2"
- Author: "[Your Name]"
- Version: "2.4.0"
- License: "Proprietary"
```

### 7.3 Texture Optimization

**Before Export:**
```powershell
# Compress textures sebelum embed:
# Diffuse/Albedo: JPEG quality 85-90%
# Normal/Roughness/Metalness: PNG lossless
# Resolution: Max 2048x2048, downscale jika perlu

# Tools recommended:
- TinyPNG / ImageOptim (lossless compression)
- Substance Painter (export with optimal settings)
- Blender Image Editor (save as optimized)
```

**Texture Naming Convention:**
```
Naura_Diffuse.png      (atau _BaseColor)
Naura_Normal.png
Naura_Roughness.png
Naura_Metalness.png
Naura_Emissive.png     (untuk neon parts)
Naura_AO.png           (ambient occlusion, optional)
```

---

## 8. Quality Assurance Checklist

Sebelum deliver model, **WAJIB** test semua items ini:

### 8.1 Static Model Check

- [ ] Model load tanpa error di Three.js GLTFLoader
- [ ] Semua textures appear correctly (no missing/pink)
- [ ] Scale correct (height ≈ 1.65m in scene units)
- [ ] Facing correct direction (+Z forward)
- [ ] No hidden/internal geometry
- [ ] Vertex count < 100k
- [ ] Material count ≤ 8
- [ ] UVs clean & non-overlapping

### 8.2 Rigging Check

- [ ] All humanoid bones present & named correctly
- [ ] Skin weights normalized (sum = 1.0 per vertex)
- [ ] No joint popping di extreme poses
- [ ] Inverse Bind Matrices correct
- [ ] Test pose: T-pose, A-pose, squat, arms up, twist spine
- [ ] Finger bones bend naturally (jika ada)
- [ ] Spring bones configured (ponytail, hair)

### 8.3 Animation Check

Untuk SETIAP animasi yang di-deliver:

- [ ] Play tanpa errors/warnings di console
- [ ] Smooth playback (no stutter/frame drops)
- [ ] Correct duration (sesuai spec)
- [ ] Loop seamless (untuk looping anims)
- [ ] Return to neutral (untuk one-shot anims)
- [ ] No mesh clipping selama motion
- [ ] Feet stay on ground (untuk walk/stand)
- [ ] Root motion correct (jika pakai root transform)
- [ ] Morph targets trigger correctly (jika ada)
- [ ] Test di 30 FPS dan 60 FPS

### 8.4 Performance Check

- [ ] Load time < 3 detik di 4G connection
- [ ] Render < 8ms per frame (desktop)
- [ ] Render < 16ms per frame (mobile mid-range)
- [ ] Memory usage < 200MB GPU VRAM
- [ ] No texture bleeding/mip-map issues
- [ ] Draco compression works correctly

### 8.5 Integration Test

Test di actual Naura Hoshino V2 dashboard:

```javascript
// 1. Copy file ke: dashboard/public/models/naura_v2.glb
// 2. Update viewer3d.js line 24:
//    modelPath: options.modelPath || "/models/naura_v2.glb"
// 3. Run dashboard dev server:
//    cd dashboard && npm run dev
// 4. Open browser, check Console untuk errors
// 5. Test semua animations via UI controls
// 6. Verify cursor tracking works
// 7. Test di mobile device / responsive mode
```

---

## 9. Referensi Implementasi Existing

### 9.1 Code References

**Animation System:**
- Controller: `dashboard/src/components/NauraViewer/animations/core/controller.js`
- Sequences: `dashboard/src/components/NauraViewer/animations/sequences/*.js`
- Runtime Fix: `dashboard/src/components/NauraViewer/animations/core/nauraRuntimeFix.js`

**Viewer Implementation:**
- Main Viewer: `dashboard/src/components/NauraViewer/viewer3d.js`
- Loader: `dashboard/src/components/NauraViewer/loader.js`
- Particles: `dashboard/src/components/NauraViewer/particles.js`

**Existing Models:**
- GLB: `assets/3D Model Naura/naura NEW.glb`
- VRM: `assets/3D Model Naura/naura NEW.vrm`
- Previews: `assets/3D Model Naura/previews/`

### 9.2 Documentation References

- **DESIGN.md**: Visual style guide & color tokens
- **PRD.md**: Product requirements & user personas
- **RULES.md**: Technical constraints & coding standards
- **AGENTS.md**: AI agent navigation & SOP

### 9.3 Contact & Support

Untuk pertanyaan teknis atau clarifications:
- Technical Lead: [Contact via Discord/GitHub]
- Repository: https://github.com/[org]/naura-hoshino-v2
- Issues: Create GitHub issue dengan tag `3d-model` atau `animation`

---

## 📝 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-10-25 | AI Assistant | Initial specification document |

---

## ⚖️ License & Usage Rights

Model dan animations yang dibuat berdasarkan spec ini adalah proprietary asset milik Naura Hoshino V2 project. Dilarang distribute, sell, atau use di project lain tanpa explicit written permission.

---

**END OF DOCUMENT**

*Last updated: 2026-10-25*

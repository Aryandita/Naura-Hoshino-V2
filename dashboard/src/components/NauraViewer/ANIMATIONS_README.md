# 🎭 Animasi Prosedural Naura Hoshino V2

**Versi:** 2.4.0  
**Last Updated:** 2026-10-25  
**Total Animasi:** 18 (10 existing + 8 new)  

---

## 📊 Daftar Animasi Available

### ✅ Existing Animations (10)

| Name | Duration | Loop | Trigger Command | Deskripsi |
|------|----------|------|-----------------|-----------|
| **Idle** | 3.0s | ✅ | `setMood('idle')` | Diam dengan napas & sway halus |
| **Wave** | 2.4s | ❌ | `setMood('wave')` | Lambaian tangan menyapa |
| **Thinking** | 3.5s | ✅ | `setMood('thinking')` | Berpikir dengan head tilt |
| **Dizzy** | 3.0s | ✅ | `setMood('dizzy')` | Pusing berputar |
| **Cheers** | 2.8s | ❌ | `setMood('cheers')` | Bersorak gembira |
| **Shy** | 3.2s | ✅ | `setMood('shy')` | Malu-malu |
| **Sleepy** | 4.0s | ✅ | `setMood('sleepy')` | Mengantuk |
| **BlowKiss** | 2.5s | ❌ | `setMood('blowkiss')` | Tiup ciuman |
| **AstralCast** | 2.8s | ❌ | `setMood('astral')` | Sihir magic ✨ |
| **StarPose** | 2.5s | ❌ | `setMood('starpose')` | Pose idol bintang ⭐ |

### 🆕 New Animations (8) - Added 2026-10-25

| Name | Duration | Loop | Trigger Command | Use Case |
|------|----------|------|-----------------|----------|
| **WalkForward** | 1.2s | ✅ | `setMood('walk')` | Navigasi dashboard |
| **WalkBackward** | 1.4s | ✅ | `setMood('back')` | Retreat/back nav |
| **Sit** | 4.0s | ✅ | `setMood('sit')` | AFK, lounge, rest |
| **DanceLoop1** | 2.0s | ✅ | `setMood('dance')` | Music (upbeat) 🎵 |
| **DanceLoop2** | 3.0s | ✅ | `setMood('groove')` | Music (smooth) 🎶 |
| **Type** | 2.5s | ✅ | `setMood('type')` | Bot typing response ⌨️ |
| **NodYes** | 1.2s | ❌ | `setMood('yes')` | Konfirmasi, agree ✓ |
| **ShakeNo** | 1.4s | ❌ | `setMood('no')` | Deny, reject ✗ |

---

## 🚀 Cara Menggunakan

### Di Dashboard (JavaScript)

```javascript
// Get viewer instance
const viewer = window.nauraViewer; // atau reference Anda

// Play animation by name
viewer.playAnimation('WalkForward');
viewer.playAnimation('DanceLoop1', { loop: true });
viewer.playAnimation('NodYes', { 
    loop: false,
    onFinish: () => console.log('Nod selesai!')
});

// Atau via mood system (auto-mapping)
viewer.setMood('walk');      // → WalkForward
viewer.setMood('dance');     // → DanceLoop1
viewer.setMood('type');      // → Type
viewer.setMood('yes');       // → NodYes
viewer.setMood('no');        // → ShakeNo
viewer.setMood('sit');       // → Sit
viewer.setMood('groove');    // → DanceLoop2
```

### Mood Mapping Lengkap

Lihat di: `animations/core/controller.js` line ~430

```javascript
const animMap = {
    // Walk
    walk: "WalkForward",
    walkforward: "WalkForward",
    move: "WalkForward",
    navigate: "WalkForward",
    
    // Back
    walkbackward: "WalkBackward",
    back: "WalkBackward",
    retreat: "WalkBackward",
    
    // Sit
    sit: "Sit",
    relax: "Sit",
    lounge: "Sit",
    rest: "Sit",
    
    // Dance
    dance: "DanceLoop1",
    dance1: "DanceLoop1",
    upbeat: "DanceLoop1",
    energetic: "DanceLoop1",
    dance2: "DanceLoop2",
    groove: "DanceLoop2",
    smooth: "DanceLoop2",
    
    // Type
    type: "Type",
    typing: "Type",
    keyboard: "Type",
    writing: "Type",
    
    // Confirm/Deny
    nod: "NodYes",
    yes: "NodYes",
    confirm: "NodYes",
    agree: "NodYes",
    shake: "ShakeNo",
    no: "ShakeNo",
    deny: "ShakeNo",
    reject: "ShakeNo",
};
```

---

## 🎨 Technical Details

### Animation System Architecture

```
viewer3d.js (Naura3DViewer)
  └─ animController (AnimationController)
       ├─ mixer (THREE.AnimationMixer) - untuk baked clips
       ├─ parts (Granular Controllers)
       │   ├─ hips, spine, chest, upperChest
       │   ├─ leftArm, rightArm, leftHand, rightHand
       │   ├─ leftLeg, rightLeg
       │   ├─ neck, head
       │   ├─ eyes, blink, face
       │   └─ hair (spring physics)
       └─ activeAnim (current sequence name)
```

### Keyframe Format

Setiap animasi sequence menggunakan format:

```javascript
{
    name: "AnimationName",
    duration: 2.0,        // seconds
    isLoop: true/false,
    
    root: {               // Root transform (model group)
        posY: [{ t: 0.0, v: 0.0 }, ...],
        rotY: [{ t: 0.0, v: 0.0 }, ...],
    },
    
    bones: {              // Per-bone rotation (Euler XYZ)
        Hips: [{ t: 0.0, x: 0, y: 0, z: 0 }, ...],
        LeftArm: [...],
        RightArm: [...],
        // ... other bones
    },
    
    morphs: {             // Morph target weights (0-1)
        Happy: [{ t: 0.0, v: 0.8 }, ...],
        Blink: [...],
    },
    
    harmonics: {          // Procedural oscillations
        bounce: { freq: 2.0, amp: 0.01 },
        sway: { freq: 1.0, amp: 0.015 }
    }
}
```

### Interpolation

Semua keyframe di-interpolate menggunakan **cubic spline** untuk smooth motion:
- Position: Linear interpolation
- Rotation: Spherical interpolation (quaternion slerp)
- Morphs: Smooth step / ease-in-out

---

## 🔧 Customization

### Adjust Speed

```javascript
// Change playback speed
viewer.animController.mixer.timeScale = 1.5; // 1.5x faster
viewer.animController.mixer.timeScale = 0.8; // Slower
```

### Add New Animation

1. Buat file baru di `animations/sequences/myAnimation.js`
2. Export sequence object (format lihat di atas)
3. Import di `animations/sequences/index.js`
4. Add ke `ANIMATION_DEFINITIONS` object
5. (Optional) Add mood mapping di `controller.js` setMood()

### Modify Existing Animation

Edit langsung di file sequence terkait. Hot reload supported di dev mode.

---

## 🐛 Known Issues & Limitations

### Current Limitations

1. **Procedural vs Baked**: Semua animasi saat ini prosedural (code-driven), bukan baked animation dari model 3D. Ini berarti:
   - ✅ Pros: Ringan, flexible, real-time adjustable
   - ❌ Cons: Limited complexity, tidak ada secondary motion otomatis

2. **Foot IK**: Belum ada inverse kinematics untuk kaki. Walk cycle mungkin terlihat sliding di beberapa surface.

3. **Finger Animation**: Finger bones belum di-animate (static pose). Perlu manual keyframe jika mau detail hand gestures.

4. **Spring Bones**: Ponytail physics sudah ada tapi clothing/skirt physics belum implemented.

### Performance Notes

- All animations run at 60 FPS on modern desktop
- Mobile performance: 30-45 FPS depending on device
- Memory footprint: ~50-80MB GPU VRAM with all animations loaded

---

## 📝 Changelog

### v2.4.0 (2026-10-25)

**Added:**
- ✅ WalkForward & WalkBackward sequences
- ✅ Sit/Relax animation
- ✅ DanceLoop1 (upbeat) & DanceLoop2 (smooth)
- ✅ Type/Keyboard animation
- ✅ NodYes & ShakeNo confirmation animations
- ✅ Extended mood mapping untuk semua animasi baru
- ✅ Technical spec document untuk 3D artist (`docs/3D_MODEL_SPECIFICATION.md`)

**Fixed:**
- ✅ Improved animation transition smoothing
- ✅ Better looping behavior untuk continuous animations

**Documentation:**
- ✅ Created ANIMATIONS_README.md (this file)
- ✅ Added inline JSDoc comments di semua sequence files

---

## 🎯 Roadmap (Future Plans)

### Priority HIGH
- [ ] Implement foot IK untuk walk cycle lebih natural
- [ ] Add finger animation untuk sign language / detailed gestures
- [ ] Clothing spring bones (skirt, blazer, accessories)

### Priority MEDIUM  
- [ ] Transition blending antar animasi (smooth crossfade)
- [ ] Emotion system yang combine multiple morphs dynamically
- [ ] Audio-reactive animations (sync dengan music/voice)

### Priority LOW
- [ ] Motion capture integration untuk realistic movement
- [ ] AI-driven procedural animation (learning dari user interaction)
- [ ] Multi-character synchronization (untuk future features)

---

## 📚 References

- **Three.js Animation System**: https://threejs.org/docs/#manual/en/introduction/Animation-system
- **VRM Specification**: https://vrm.dev/en/univrm/
- **GLTF Format**: https://www.khronos.org/gltf/
- **Naura Hoshino DESIGN.md**: `/DESIGN.md`
- **3D Model Spec**: `/docs/3D_MODEL_SPECIFICATION.md`

---

## 💡 Tips for Animator

Jika Anda 3D artist yang ingin contribute baked animations:

1. Baca `docs/3D_MODEL_SPECIFICATION.md` terlebih dahulu
2. Gunakan bone naming convention yang sama (VRM/Humanoid)
3. Test di actual dashboard sebelum submit
4. Keep file size reasonable (< 5MB per animation clip)
5. Provide both GLB dan VRM format jika memungkinkan

---

**Questions or Issues?**  
Create GitHub issue dengan tag `animation` atau contact technical lead.

**License:** Proprietary - Naura Hoshino V2 Project

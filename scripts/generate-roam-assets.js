"use strict";

/**
 * Roam & Date System Asset Manifest & Generator Configuration
 * Contains complete specifications, prompts, aspect ratios, and target file paths.
 */

const ROAM_ASSET_MANIFEST = {
  npcs: {
    ningsih: {
      id: "ningsih",
      name: "Ningsih",
      role: "Gadis Desa Petani",
      targetDir: "assets/survival/roam/npcs/ningsih",
      referenceImage: "assets/survival/characters/ningsih.jpeg",
      aspectRatio: "1:1",
      emotions: {
        neutral: {
          file: "ningsih_neutral.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Ningsih. Young Indonesian village girl, long dark hair in a loose side braid, simple floral kebaya dress, gentle smile, soft brown eyes. Emotion: neutral - calm expression, slight gentle smile, holding a small delicate wild flower in hands. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        happy: {
          file: "ningsih_happy.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Ningsih. Young Indonesian village girl, long dark hair in a loose braid, simple floral kebaya dress, soft brown eyes. Emotion: happy - bright smile, eyes sparkling with joy, cheerful posture. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        shy: {
          file: "ningsih_shy.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Ningsih. Young Indonesian village girl, long dark hair in a loose braid, simple floral kebaya dress, soft brown eyes. Emotion: shy - cute blushing cheeks, looking down slightly with bashful soft gaze, fidgeting shyly with fingers. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        working: {
          file: "ningsih_working.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Ningsih. Young Indonesian village girl, long dark hair in a loose braid. Emotion: working - wearing a rural straw hat and cute gardening apron over her floral dress, holding a small watering can, focused gentle and diligent expression. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        casual: {
          file: "ningsih_casual.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Ningsih. Young Indonesian village girl, long dark hair in a loose braid, wearing casual comfortable dress or kebaya. Emotion: casual - relaxed pose, resting peacefully, serene calm pleasant smile, tranquil posture. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        evening: {
          file: "ningsih_evening.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Ningsih. Young Indonesian village girl, long dark hair in a loose braid. Emotion: evening - wearing a modest traditional dress, holding a warm glowing vintage oil lantern in hands, gentle warm comforting smile, dusk evening ambient lighting on character. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        }
      }
    },
    tari: {
      id: "tari",
      name: "Tari",
      role: "Anak Nelayan Tomboy",
      targetDir: "assets/survival/roam/npcs/tari",
      referenceImage: "assets/survival/characters/tari.jpeg",
      aspectRatio: "1:1",
      emotions: {
        neutral: {
          file: "tari_neutral.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Tari. Athletic Indonesian girl, short messy black hair, sun-kissed tanned skin, wearing practical fisherman outfit with rolled-up sleeves. Emotion: neutral - confident stance, arms crossed over chest, slight cool smirk, tomboyish charm. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        happy: {
          file: "tari_happy.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Tari. Athletic Indonesian girl, short messy black hair, tanned skin, wearing fisherman outfit. Emotion: happy - cheerful big open-mouthed laugh, one hand raised in a friendly wave/gesture, radiant energetic and lively pose. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        excited: {
          file: "tari_excited.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Tari. Athletic Indonesian girl, short messy black hair, tanned skin, wearing fisherman outfit. Emotion: excited - fists pumped up in triumphant celebration, wide enthusiastic grin, energetic spark in eyes, dynamic hyped-up pose. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        working: {
          file: "tari_working.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Tari. Athletic Indonesian girl, short messy black hair, tanned skin. Emotion: working - wearing a bucket fisherman hat, holding a fishing rod over her shoulder, determined focused confident smirk, ready to fish. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        casual: {
          file: "tari_casual.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Tari. Athletic Indonesian girl, short messy black hair, tanned skin, casual t-shirt and shorts/pants. Emotion: casual - relaxed chilled pose, arms resting casually behind head or leaning back, easygoing relaxed warm smile, laid-back vibe. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        swimming: {
          file: "tari_swimming.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Tari. Athletic Indonesian girl, short messy wet black hair with water droplets, tanned skin, wearing athletic sporty one-piece rashguard swimwear. Emotion: swimming - playful teasing wink, charming energetic smile, refreshing aquatic vibe. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        }
      }
    },
    bidan_sari: {
      id: "bidan_sari",
      name: "Bidan Sari",
      role: "Perawat Keibuan",
      targetDir: "assets/survival/roam/npcs/bidan_sari",
      referenceImage: "assets/survival/characters/bidan_sari.jpeg",
      aspectRatio: "1:1",
      emotions: {
        neutral: {
          file: "bidan_sari_neutral.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bidan Sari. Mature graceful Indonesian woman, neat bun hairstyle, wearing glasses, modest clean nurse / clinic uniform. Emotion: neutral - gentle warm reassuring smile, hands folded politely in front, professional yet motherly nurturing stance. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        happy: {
          file: "bidan_sari_happy.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bidan Sari. Mature graceful Indonesian woman, neat bun hairstyle, wearing glasses, nurse uniform. Emotion: happy - warm gentle laugh, eyes crinkling with kindness and warmth, deeply nurturing, affectionate and comforting expression. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        concerned: {
          file: "bidan_sari_concerned.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bidan Sari. Mature Indonesian woman, neat bun hairstyle, glasses, nurse uniform. Emotion: concerned - slight frown, tilted head, deeply caring and empathetic eyes, protective nurturing posture. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        working: {
          file: "bidan_sari_working.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bidan Sari. Mature Indonesian woman, neat bun, glasses, nurse uniform, holding a professional medical bag and clipboard, dedicated professional smile. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        casual: {
          file: "bidan_sari_casual.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bidan Sari. Mature Indonesian woman, comfortable modest casual clothing, reading an interesting book, relaxed serene expression. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        evening: {
          file: "bidan_sari_evening.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bidan Sari. Mature Indonesian woman, elegant modest batik/evening dress, holding a warm porcelain tea cup, gentle serene smile. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        }
      }
    },
    bu_ratna: {
      id: "bu_ratna",
      name: "Bu Ratna",
      role: "Guru Cerdas",
      targetDir: "assets/survival/roam/npcs/bu_ratna",
      referenceImage: "assets/survival/characters/bu_ratna.jpeg",
      aspectRatio: "1:1",
      emotions: {
        neutral: {
          file: "bu_ratna_neutral.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bu Ratna. Elegant Indonesian woman, stylish shoulder-length black hair, glasses, modest blouse and skirt, intelligent gaze. Emotion: neutral - thoughtful expression, holding a hardcover book, slight polite smile. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        happy: {
          file: "bu_ratna_happy.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bu Ratna. Elegant Indonesian woman, shoulder-length hair, glasses. Emotion: happy - proud warm smile, gently adjusting glasses frame with index finger, sparkling intelligent eyes. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        teaching: {
          file: "bu_ratna_teaching.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bu Ratna. Teacher outfit, glasses, pointing gesture as if explaining a lesson on blackboard, enthusiastic, engaged pedagogical expression. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        reading: {
          file: "bu_ratna_reading.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bu Ratna. Focused on reading open book, finger gently tracing page, engrossed concentrated studious expression, soft lighting. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        casual: {
          file: "bu_ratna_casual.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bu Ratna. Relaxed pose, comfortable casual knit sweater, holding cup of hot coffee/tea, content satisfied gentle smile. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        },
        formal: {
          file: "bu_ratna_formal.png",
          status: "COMPLETED",
          prompt: "Anime visual novel character portrait of Bu Ratna. Sharp formal teacher blazer, professional confident stance, commanding yet benevolent presence. Waist-up character sprite, isolated on pure clean white background, anime VN art style."
        }
      }
    }
  },
  backgrounds: {
    desa_sukamaju: {
      warung: {
        morning: {
          file: "warung_morning.png",
          targetDir: "assets/survival/roam/backgrounds/desa_sukamaju",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Traditional Indonesian village warung interior with wooden tables and benches, steam rising from kitchen pots, warm morning sunlight streaming through open wooden windows. Cozy rural Indonesian village atmosphere, detailed makoto shinkai aesthetic."
        },
        evening: {
          file: "warung_evening.png",
          targetDir: "assets/survival/roam/backgrounds/desa_sukamaju",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Traditional Indonesian village warung at dusk, warm hanging incandescent lamp lighting, peaceful intimate atmosphere, view through window shows vibrant orange sunset over rice paddies."
        }
      },
      sekolah: {
        morning: {
          file: "sekolah_morning.png",
          targetDir: "assets/survival/roam/backgrounds/desa_sukamaju",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Simple cheerful Indonesian village elementary school classroom (SD), open wooden windows showing lush greenery outside, colorful children drawings on walls, blackboard, bright morning sunlight."
        },
        afternoon: {
          file: "sekolah_afternoon.png",
          targetDir: "assets/survival/roam/backgrounds/desa_sukamaju",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Quiet village school classroom during late afternoon, golden amber sunlight casting long shadows across empty wooden desks, serene nostalgic atmosphere."
        }
      },
      kebun: {
        morning: {
          file: "kebun_morning.png",
          targetDir: "assets/survival/roam/backgrounds/desa_sukamaju",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Lush Indonesian village vegetable garden with neat farming beds, morning dew on green leaves, gentle morning mist in background, golden sunrise light filtering through foliage."
        },
        afternoon: {
          file: "kebun_afternoon.png",
          targetDir: "assets/survival/roam/backgrounds/desa_sukamaju",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Sunlit rural vegetable farm under bright clear blue sky, vibrant emerald greens, blooming crop flowers, wooden fence and distant village hills."
        }
      },
      sungai: {
        morning: {
          file: "sungai_morning.png",
          targetDir: "assets/survival/roam/backgrounds/desa_sukamaju",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Crystal clear sparkling village river flowing past smooth river stones and lush mossy banks, tall bamboo trees, gentle morning mist over sparkling water."
        },
        evening: {
          file: "sungai_evening.png",
          targetDir: "assets/survival/roam/backgrounds/desa_sukamaju",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Riverbank at golden hour sunset, dramatic orange, purple and magenta sky reflection on calm rippling river water, peaceful romantic scenic nature."
        }
      }
    },
    kota_pratama: {
      cafe: {
        afternoon: {
          file: "cafe_afternoon.png",
          targetDir: "assets/survival/roam/backgrounds/kota_pratama",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Modern cozy aesthetic cafe interior, warm timber wood furniture, hanging potted plants, large glass windows with sunlight pouring in, espresso machine and pastry display."
        },
        night: {
          file: "cafe_night.png",
          targetDir: "assets/survival/roam/backgrounds/kota_pratama",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Cozy urban cafe at night, warm dimmed ambient lighting, candles on small wooden tables, city streetlights bokeh visible through windows, romantic mood."
        }
      },
      perpustakaan: {
        afternoon: {
          file: "perpustakaan_afternoon.png",
          targetDir: "assets/survival/roam/backgrounds/kota_pratama",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Grand city library interior, tall mahogany bookshelves reaching high ceiling, classic reading lamps on long study tables, quiet scholarly sunlight through tall arched windows."
        },
        evening: {
          file: "perpustakaan_evening.png",
          targetDir: "assets/survival/roam/backgrounds/kota_pratama",
          aspectRatio: "16:9",
          status: "COMPLETED",
          prompt: "Anime visual novel background 16:9 landscape. Quiet city library at night, soft warm desk lamp illumination on open books, cozy quiet intellectual atmosphere, dark blue twilight outside windows."
        }
      }
    }
  },
  events: {
    first_meet_ningsih: {
      file: "event_first_meet_ningsih.png",
      targetDir: "assets/survival/roam/events",
      aspectRatio: "16:9",
      status: "COMPLETED",
      prompt: "Anime visual novel CG scene 16:9. First meeting encounter with Ningsih in misty morning vegetable garden. Ningsih holding vegetable basket with cute surprised expression, soft morning light, anime cinematic composition."
    },
    relationship_ningsih_sunset: {
      file: "event_rel_ningsih_sunset.png",
      targetDir: "assets/survival/roam/events",
      aspectRatio: "16:9",
      status: "COMPLETED",
      prompt: "Anime visual novel CG scene 16:9. Romantic sunset at rural flower garden, Ningsih blushing shyly looking towards viewer, warm golden hour orange glow, glowing dust motes and gentle breeze."
    },
    date_ningsih_night: {
      file: "event_date_ningsih_night.png",
      targetDir: "assets/survival/roam/events",
      aspectRatio: "16:9",
      status: "COMPLETED",
      prompt: "Anime visual novel CG scene 16:9. Night picnic date in garden under starry night sky, cozy picnic blanket with lantern and delicious food, fairy lights on trees, Ningsih smiling happily, romantic intimate atmosphere."
    }
  },
  items: {
    nasi_goreng: {
      file: "nasi_goreng.png",
      targetDir: "assets/survival/roam/items",
      aspectRatio: "1:1",
      status: "COMPLETED",
      prompt: "Game icon 1:1, plate of steaming Indonesian nasi goreng fried rice with sunny side up fried egg, sliced cucumber, tomato and cracker garnish, top-down isometric view, clean isolated white background, vibrant anime food art."
    },
    teh_manis: {
      file: "teh_manis.png",
      targetDir: "assets/survival/roam/items",
      aspectRatio: "1:1",
      status: "COMPLETED",
      prompt: "Game icon 1:1, glass of Indonesian iced sweet jasmine tea (es teh manis) with ice cubes and condensation drops, fresh mint garnish, clean isolated white background, vibrant anime food art."
    },
    kopi_desa: {
      file: "kopi_desa.png",
      targetDir: "assets/survival/roam/items",
      aspectRatio: "1:1",
      status: "COMPLETED",
      prompt: "Game icon 1:1, traditional Indonesian village black coffee (kopi tubruk) in classic enamel cup with rising steam, clean isolated white background, vibrant game icon art."
    },
    latte: {
      file: "latte.png",
      targetDir: "assets/survival/roam/items",
      aspectRatio: "1:1",
      status: "COMPLETED",
      prompt: "Game icon 1:1, ceramic cafe coffee cup with beautiful heart latte art foam, clean isolated white background, vibrant game icon art."
    },
    croissant: {
      file: "croissant.png",
      targetDir: "assets/survival/roam/items",
      aspectRatio: "1:1",
      status: "COMPLETED",
      prompt: "Game icon 1:1, golden flaky butter croissant pastry on a small porcelain plate, delicious glossy crust, clean isolated white background, vibrant game icon art."
    },
    ramuan_stamina: {
      file: "ramuan_stamina.png",
      targetDir: "assets/survival/roam/items",
      aspectRatio: "1:1",
      status: "COMPLETED",
      prompt: "Game icon 1:1, glowing emerald green stamina potion liquid in an ornate fantasy glass vial bottle with cork stopper, magical sparkles, clean isolated white background, vibrant RPG icon art."
    }
  }
};

module.exports = { ROAM_ASSET_MANIFEST };

if (require.main === module) {
  let completed = 0;
  let total = 0;

  for (const char of Object.values(ROAM_ASSET_MANIFEST.npcs)) {
    for (const emo of Object.values(char.emotions)) {
      total++;
      if (emo.status === "COMPLETED") completed++;
    }
  }

  for (const region of Object.values(ROAM_ASSET_MANIFEST.backgrounds)) {
    for (const loc of Object.values(region)) {
      for (const timeData of Object.values(loc)) {
        total++;
        if (timeData.status === "COMPLETED") completed++;
      }
    }
  }

  for (const event of Object.values(ROAM_ASSET_MANIFEST.events)) {
    total++;
    if (event.status === "COMPLETED") completed++;
  }

  for (const item of Object.values(ROAM_ASSET_MANIFEST.items)) {
    total++;
    if (item.status === "COMPLETED") completed++;
  }

  console.log(`[Roam Asset Manifest] Total: ${total} assets | Completed: ${completed} (${Math.round((completed/total)*100)}%)`);
}

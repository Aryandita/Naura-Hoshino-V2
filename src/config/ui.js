const { ActivityType } = require('discord.js');
const path = require('path');
const { logger } = require('../../src/managers/logger');

module.exports = {
    // ==========================================
    // 🎨 COLOR PALETTE SYSTEM
    // ==========================================
    colors: {
        // --- Core Colors ---
        primary: '#FFC0CB',
        accent: '#00FFFF',

        // --- Custom Systems ---
        economy: '#FFD700',
        fishing: '#1E90FF',
        mining: '#8B4513',
        crafting: '#228B22',
        battle: '#DC143C',
        rank: '#9400D3',
        music: '#8A2BE2',
        welcome: '#00FFFF',
        leave: '#FF69B4',
        boost: '#FFD700',
        announcement: '#001aff',
        announce_update: '#00FFFF',
        announce_mt: '#8B4513',
        announce_event: '#FFD700',
        announce_warn: '#DC143C',

        // --- Status Colors ---
        success: '#00FF00',
        error: '#FF0000',
        dark: '#2b2d31',
        light: '#f0f0f0',

        // --- Premium Tier Colors ---
        premium_supporter: '#C0C0C0',       // Perak — Tier Supporter
        premium_friends: '#A855F7',         // Ungu Lilac — Tier Friends
        premium_vip: '#FFD700',             // Emas — Tier V.I.P
        premium_accent: '#FDE68A',          // Emas muda — highlight teks VIP
        premium_glow: 'rgba(255,215,0,0.3)' // Aura glow untuk efek premium
    },

    // ==========================================
    // 🖼️ BANNER CONFIGURATION
    // ==========================================
    banners: {
        // --- Leveling ---
        levelUp: './assets/core/levelbg.png',

        // --- General ---
        naura: './assets/core/avatar.png',
        qris: './assets/general/qris.jpg',
        ticket: './assets/general/banner_ticket.png',
        about: './assets/core/banner_about.png',
        ping: './assets/core/banner_ping.png',
        help: './assets/core/banner_help.png',
        stats: './assets/core/banner_stats.png',
        music: './assets/music/banner_music.png',
        survival: './assets/survival/banner_survival.png',
        shop: './assets/economy/shop_banner.png',
        dungeon: './assets/survival/banner_dungeon.png',
        economy: './assets/economy/banner_economy.png',
        wedding: './assets/survival/banner_wedding.png'
    },

    // ==========================================
    // 🖼️ CANVAS BACKGROUNDS
    // ==========================================
    backgrounds: {
        welcome: './assets/core/welcome_bg.png',
        leave: './assets/core/leave_bg.png',
        boost: './assets/core/boost_bg.png'
    },

    // ==========================================
    // 🏕️ SURVIVAL BACKGROUNDS
    // ==========================================
    survivalBackgrounds: {
        desa_pagi: './assets/survival/background/desa_pagi.jpeg',
        desa_siang: './assets/survival/background/desa_siang.jpeg',
        desa_sore: './assets/survival/background/desa_sore.jpeg',
        desa_malam: './assets/survival/background/desa_malam.jpeg',

        hutan_pagi: './assets/survival/background/hutan_pagi.jpeg',
        hutan_siang: './assets/survival/background/hutan_siang.jpeg',
        hutan_sore: './assets/survival/background/hutan_sore.jpeg',
        hutan_malam: './assets/survival/background/hutan_malam.jpeg',

        tambang_pagi: './assets/survival/background/tambang_pagi.jpeg',
        tambang_siang: './assets/survival/background/tambang_siang.jpeg',
        tambang_sore: './assets/survival/background/tambang_sore.jpeg',
        tambang_malam: './assets/survival/background/tambang_malam.jpeg',

        laut_pagi: './assets/survival/background/laut_pagi.jpeg',
        laut_siang: './assets/survival/background/laut_siang.jpeg',
        laut_sore: './assets/survival/background/laut_sore.jpeg',
        laut_malam: './assets/survival/background/laut_malam.jpeg',

        kota_pagi: './assets/survival/background/kota_pagi.jpeg',
        kota_siang: './assets/survival/background/kota_siang.jpeg',
        kota_sore: './assets/survival/background/kota_sore.jpeg',
        kota_malam: './assets/survival/background/kota_malam.jpeg',

        academy_pagi: './assets/survival/background/academy_pagi.jpeg',
        academy_siang: './assets/survival/background/academy_siang.jpeg',
        academy_sore: './assets/survival/background/academy_sore.jpeg',
        academy_malam: './assets/survival/background/academy_malam.jpeg',

        park_pagi: './assets/survival/background/park_pagi.jpeg',
        park_siang: './assets/survival/background/park_siang.jpeg',
        park_sore: './assets/survival/background/park_sore.jpeg',
        park_malam: './assets/survival/background/park_malam.jpeg',

        frostsnow_pagi: './assets/survival/background/frostsnow.png',
        frostsnow_siang: './assets/survival/background/frostsnow.png',
        frostsnow_sore: './assets/survival/background/frostsnow.png',
        frostsnow_malam: './assets/survival/background/frostsnow.png',

        twilight_pagi: './assets/survival/background/twilight.png',
        twilight_siang: './assets/survival/background/twilight.png',
        twilight_sore: './assets/survival/background/twilight.png',
        twilight_malam: './assets/survival/background/twilight.png'
    },

    // ==========================================
    // 👹 MONSTER SPRITES
    // ==========================================
    monsters: {
        slime: './assets/survival/monsters/slime.png',
        goblin: './assets/survival/monsters/goblin.png'
    },

    // ==========================================
    // ➖ TEXT DIVIDERS
    // ==========================================
    dividers: {
        musicDividers: '⊱ ────── {.⋅ ♫ ⋅.} ───── ⊰',
        generalDividers: ''
    },

    // ==========================================
    // 🔗 LINK
    // ==========================================
    dashboards: 'hyperion.kythia.xyz:3070',
    support_server: 'https://dsc.gg/naura-hoshino',
    invite: 'https://discord.com/oauth2/authorize?client_id=1483665745727721543&permissions=8&scope=bot%20applications.commands',
    vote: '',
    saweria: '',


    // ==========================================
    // 🎯 CUSTOM EMOJIS SYSTEM
    // ==========================================
    emojis: {
        // --- Status & System ---
        power: '<:Restart:1484706091941232815>',
        stats: '<:stats:1492712312975392859>',
        info: '<a:information:1499384250221199360>',
        lokasi: '<:location:1499383522769768448>',
        desc: '<a:SpinningBook:1492696903069208627>',
        success: '<a:done:1492712310173732954>',
        error: '<a:error2:1492712275771920536>',
        loading: '<a:Loading1:1492696844646613042>',
        admin: '<a:Crown2:1492696869053141143>',
        dot: '<a:Arrow:1492696901051744298>',
        booster: '<a:Booster:1492696882454200350>',
        latency: '<a:Latency:1492696871586631872>',
        online: '<a:Online:1492696928092291123>',
        offline: '<a:Offline:1492696923436617748>',
        redping: '<:redping:1492712290703638578>',
        greenping: '<:greenping:1492712286681305129>',
        yellowping: '<:yellowping:1492712288631656519>',
        clock: '<a:clock:1492712296697298954>',
        warning: '<a:Warn:1492696836694347816>',

        // --- Core Command Emojis (Customizable) ---
        core: '<a:download:1525035127611064431>',
        ping: '<a:Latency:1492696871586631872>',
        about: '<:Naura:1488427505466474597>',
        help: '<a:SpinningBook:1492696903069208627>',
        language: '<a:information:1499384250221199360>',
        sparkles: '<a:Sparkle:1492696861440610324>',
        eventloop: '<a:Flash:1492696906764390460>',
        saweria: '<a:MoneyBag:1492696891169702000>',
        trakteer: '<a:MoneyBag:1492696891169702000>',
        topgg: '<a:Gift:1492696855778295859>',
        minecraft: '<:minecraftlogo1022:1525386839710761080>',
        cpu: '<a:download:1525035127611064431>',
        ram: '<a:Flash:1492696906764390460>',
        os: '<a:download:1525035127611064431>',
        uptime: '<a:clock:1492712296697298954>',
        software: '<:ai:1492712303911633009>',
        reach: '<a:gold:1492731787137519666>',
        guilds: '<:Limit:1493981697749024870>',
        users: '<:Naura:1488427505466474597>',
        bot_uptime: '<a:clock:1492712296697298954>',
        shard: '<:database:1492712292524232824>',
        memory: '<:database:1492712292524232824>',
        developer: '<a:Crown2:1492696869053141143>',

        // --- Naura Face Recognition ---
        sad: '',
        happy: '',
        sleepy: '',
        shy: '',
        angry: '',
        love: '',
        kiss: '',
        wink: '',
        smile: '',
        crying: '',
        confused: '',
        surprised: '',

        // --- Announcements ---
        announce_update: '<a:Announcement1:1492696885817770164>',
        announce_mt: '<:Database:1484706081988018279>',
        announce_event: '<a:Gift:1492696855778295859>',
        announce_warn: '<a:Warn:1492696836694347816>',
        announce_info: '<:Naura:1488427505466474597>',

        // --- Economy ---
        vip: '<a:Diamond:1492696863525179483>',

        // --- Premium Tier Badges ---
        premium_supporter: '🌟',
        premium_friends: '💫',
        premium_vip: '👑',
        premium_badge: '<a:Diamond:1492696863525179483>',
        premium_crown: '<a:Crown2:1492696869053141143>',

        coin: '<:NauraCoins:1484705998349402173>',
        nsf: '<:76792starcoin:1523226268257091755>',
        star_fragment: '<:76792starcoin:1523226268257091755>',
        support: '<:Naura:1488427505466474597>',
        dashboard: '<:stats:1492712312975392859>',
        invite: '<a:Arrow:1492696901051744298>',
        wallet: '<:Wallet:1489894081436975184>',
        bank: '<:NauraBank:1484706000488497273>',
        lootbox: '<a:Gift:1492696855778295859>',
        trophy: '<a:Trophy:1492696877454331914>',
        race: '🏎️',
        work: '💼',
        fishing: '<:fishingrod:1500712645882282167>',
        mining: '⛏️',
        crafting: '🔨',
        battle: '<:Strenght:1499621329366810716>',
        rank: '👑',
        beg: '<:NauraBeg:1484706002669404160>',
        steal: '<:Steal:1484706094759677962>',
        hack: '<:Hack:1484706096462430308>',
        crime: '🦹',
        slots: '<:Slots:1484706033841737868>',
        effect: '<a:Flash:1492696906764390460>',
        id: '<a:SpinningBook:1492696903069208627>',

        // --- Class & RPG ---
        class_warrior: '<:shield:1523223839280988231>',
        class_mage: '<a:Wand:1523223835678347264>',
        class_assassin: '<:Sword:1523223837477441586>',
        hunger: '<:hunger:1499612622927167520>',
        thirst: '<:thirst:1499612607458312212>',
        strength: '<:Strenght:1499621329366810716>',
        agility: '<a:Flash:1492696906764390460>',
        intelligence: '<a:inteligent:1499612616358887574>',
        luck: '<a:luck:1499612612080570488>',
        health: '<:health:1499612610012643459>',
        stamina: '<a:Flash:1492696906764390460>',
        quest: '<a:SpinningBook:1492696903069208627>',
        vehicle: '<a:vehicle:1530482724085956608>',
        experience: '<a:xp:1523217869079576627>',
        pet: '<a:pet:1499612620859117719>',
        npc: '<:Limit:1493981697749024870>',
        npc_shino_hoshino: '<:Naura:1488427505466474597>',
        npc_mayor_lucy: '<a:Crown2:1492696869053141143>',
        npc_ki_ageng_joyo: '<a:pet:1499612620859117719>',
        npc_gaston: '<:backpack:1499612625107943525>',
        npc_mbak_siti: '<a:luck:1499612612080570488>',
        backpack: '<:backpack:1499612625107943525>',
        tools: '<:Tools:1499621327743615006>',
        clear_sky: '<a:sunmove:1500705371134889995>',
        rain: '<a:255591blueumbrella:1523226263844556882>',
        badai: '<a:thunder:1525032363225125046>',
        sick: '<a:sick:1530482726090571846>',
        soup: '<a:soup:1530482720403226654>',
        bar_filled: '<:AfterDot:1488166236004159509>',
        bar_empty: '<:BeforeDot:1488166108081950882>',

        // --- Time & Seasons ---
        morning: '<a:morning:1500705373093498920>',
        day: '<a:afternoon:1500705365053018113>',
        afternoon: '<a:morning:1500705373093498920>',
        night: '<a:moon:1500705359222931597>',
        summer: '<a:summer:1500721239054876802>',
        spring: '<a:spring:1500715167594582037>',
        winter: '<a:winter:1500717689457344603>',
        autumn: '<:autumn:1500715165425995817>',

        // --- RPG Items & Materials ---
        property: '<:property:1500705357130104842>',
        bed: '<:bed:1500705354613264494>',
        apple: '<:apple:1500705352335757362>',
        mineral_water: '<:waterbottle:1500712659769622560>',
        wood: '<:log:1500712657307832371>',
        stone: '<:stone:1500712655067938826>',
        iron_ore: '<:iron:1500712652962529401>',
        diamond: '<:diamond:1500712650936549427>',
        trash: '<:trash:1500712648545931294>',
        small_fish: '🐟',
        salmon: '🍣',
        mystic_herb: '<a:flower:1500712641293975663>',
        fishing_rod: '<:fishingrod:1500712645882282167>',
        riffle: '<:riffle:1500712643781070959>',
        pickaxe: '⛏️',
        axe: '🪓',
        sword: '⚔️',
        shield: '🛡️',
        potion: '🧪',
        bandage: '🩹',

        // --- RPG Survival Mechanics ---
        diff_easy: '<:6887gdeasy:1523227250831392838>',
        diff_normal: '<:5963gdhard:1523227512644046928>',
        diff_hard: '<:1617gdinsane:1523227248868462632>',
        diff_extreme: '<:1515gddemonextreme:1523227247186542702>',
        diff_star: '<:76792starcoin:1523226268257091755>',
        farm_seed: '<a:luck:1499612612080570488>',
        farm_harvest: '<a:108748plant:1499612618397323335>',
        farm_soil: '🟫',
        farm_house: '<:property:1500705357130104842>',
        dungeon_fight: '<:Strenght:1499621329366810716>',
        dungeon_boss: '<:50524champions:1523226265983778816>',
        dungeon_monster: '<:50524champions:1523226265983778816>',
        dungeon_attack: '<:riffle:1500712643781070959>',
        dungeon_flee: '🏃',
        dungeon_dodge: '💨',
        dungeon_win: '🎉',
        dungeon_money: '💰',
        dungeon_xp: '<a:xp:1523217869079576627>',
        dungeon_loot: '<a:Gift:1492696855778295859>',
        dungeon_skull: '💀',
        craft_table: '<:Tools:1499621327743615006>',
        craft_potion: '🧪',
        craft_meal: '<:hunger:1499612622927167520>',
        npc_group: '👥',
        npc_talk: '💬',
        npc_greet: '🗣️',
        npc_repair: '<:Tools:1499621327743615006>',
        npc_tax: '<a:340830cashfly:1523226270517956749>',
        npc_briefcase: '💼',
        npc_broken_heart: '💔',
        study_school: '🏫',
        study_book: '📖',
        study_grad: '🎓',
        shop_cart: '🛒',
        shop_box: '📦',
        vehicle: '🚗',
        fuel: '⛽',
        wedding_ring: '💍',
        dungeon_pass: '🎟️',
        house: '<:property:1500705357130104842>',
        quest: '📜',
        bare_hands: '🖐️',
        rain: '<a:255591blueumbrella:1523226263844556882>',
        snow: '<a:6960snowfall:1523226262183612436>',
        clear_sky: '<a:afternoon:1500705365053018113>',
        sick: '🤒',
        medicine: '💊',
        raincoat: '🧥',
        jacket: '🧥',
        recipe: '📃',
        certificate: '🎓',
        thief: '🥷',
        mask: '🎭',
        bomb: '💣',
        prison: '⛓️',

        // Downloader
        youtube: '<a:Youtube:1500310258709434448>',
        tiktok: '<:tiktok:1547565608970203176>',
        instagram: '<:Instagram:1532358955165024256>',
        twitter: '<:X_:1532358957048401950>',
        facebook: '<:Facebook:1532358953344700437>',
        threads: '<:Threads:1532358951528562860>',

        // --- Rarity & Giveaways ---
        common: '<:Common:1488899502378193026>',
        uncommon: '🟢',
        rare: '<:Rare:1488899517477556324>',
        epic: '🟣',
        legendary: '<:Legendary:1488899547261304972>',
        mythic: '<:Mythical:1488899534653362257>',
        reward: '<a:Gift:1492696855778295859>',
        vanity: '<a:Party:1492696820227510385>',

        // --- Help & Navigation ---
        help_core: '<:stats:1492712312975392859>',
        help_eco: '<:NauraCoins:1484705998349402173>',
        help_music: '<:Lyrics:1484705972919337070>',
        help_game: '<:activity:1492712284550729879>',
        help_admin: '<:Privacy:1484706044943929354>',
        help_survival: '<:property:1500705357130104842>',
        naura: '<:Naura:1488427505466474597>',
        support: '<a:information:1499384250221199360>',
        dashboard: '<:web:1492712301986447511>',
        invite: '<:Naura:1488427505466474597>',
        server_info: '<:database:1492712292524232824>',
        ram_info: '<:dev:1492712298647916644>',
        software_info: '<:Technology:1484706005185986650>',
        system_reach: '<:stats:1492712312975392859>',
        about_title: '<:Naura:1488427505466474597>',
        network_ping: '<:web:1492712301986447511>',
        database_ping: '<:Database:1484706081988018279>',
        pong: '<a:Latency:1492696871586631872>',

        // --- Tempvoice Panel ---
        lock: '<a:Lock:1493979607337275532>',
        unlock: '<a:Unlock:1493981701502799893>',
        rename: '<a:Rename1:1493979591319097455>',
        limit: '<:Limit:1493981697749024870>',
        hide: '<a:Hide:1493979601528033443>',
        unhide: '<a:Unhide:1493979596301926420>',
        stage: '<a:Stage:1493982052675092692>',
        waiting: '<a:Stage:1493982052675092692>',
        move: '<:798008booster:1493982970443468870>',
        ticket: '<:431007ticketicon:1523227930682064908>',

        // --- Minigames ---
        counting: '🔢',
        tod_truth: '📝',
        tod_dare: '😈',
        tod_spin: '🔄',

        // --- Utility Commands (Anime, Movie, Weather) ---
        anime_search: '<:search:1525032346406096946>',
        anime_rating: '<a:rate:1525032352793890896>',
        anime_type: '<a:SpinningBook:1492696903069208627>',
        anime_episodes: '<a:clock:1492712296697298954>',
        anime_status: '<a:information:1499384250221199360>',
        anime_genres: '<a:movie:1525032349434249307>',
        anime_age_rating: '<:web:1492712301986447511>',
        movie_search: '<:search:1525032346406096946>',
        movie_director: '<a:movie:1525032349434249307>',
        movie_actors: '<a:movie:1525032349434249307>',
        movie_rating: '<a:rate:1525032352793890896>',
        movie_runtime: '<a:clock:1492712296697298954>',
        movie_awards: '<a:gold:1492731787137519666>',
        weather_temp: '<:temp:1525032365229998080>',
        weather_humidity: '<a:humidity:1525033136323301376>',
        weather_wind: '<a:wind:1525032360322535484>',
        weather_temp_max: '<:temp:1525032365229998080>',
        weather_temp_min: '<:temp:1525032365229998080>',
        weather_sunny: '<a:sunmove:1500705371134889995>',
        weather_mainly_clear: '<a:sunmove:1500705371134889995>',
        weather_cloudy: '<a:summer:1500721239054876802>',
        weather_overcast: '<a:summer:1500721239054876802>',
        weather_fog: '<a:wind:1525032360322535484>',
        weather_rain: '<a:255591blueumbrella:1523226263844556882>',
        weather_snow: '<a:6960snowfall:1523226262183612436>',
        weather_thunder: '<a:thunder:1525032363225125046>',

        // --- Music Controls & Info ---
        nowplaying: '<a:DiscSpinner1:1492696912145678488>',
        progressDot: '<:DotMusic:1488166056768835596>',
        progressLineBefore: '<:AfterDot:1488166236004159509>',
        progressLineAfter: '<:BeforeDot:1488166108081950882>',
        favorite: '<a:SpinHeart:1492696848643915796>',
        filter: '<:Filter:1484705994020753529>',
        musicListener: '<a:Listener:1492696916050444449>',
        musicArtist: '<:Artis:1484706029244518561>',
        musicPlayPause: '<:PlayPause:1484705975998091375>',
        musicSkip: '<:Skip:1484705981152755712>',
        musicStop: '<:Stop:1484705983778525315>',
        musicLoop: '<:Loop:1484705967991034010>',
        musicVolDown: '<:VolumeDown:1484874588524646621>',
        musicVolUp: '<:VolumeUp:1484874537110864034>',
        musicAutoplay: '<:AutoPlay:1484705985980268744>',
        musicLyrics: '<:Lyrics:1484705972919337070>',
        musicShuffle: '<:Shuffle:1484705970469867641>',
        music247: '<a:Moon:1492696850602524682>',

        // --- Music Filters (DSP) ---
        normal: '<:MusicDisc:1484706066662031483>',
        bassboost: '<:BassBoost:1493476326634684517>',
        nightcore: '<:NightCore:1493476329658515497>',
        vaporwave: '<:vaporwave:1493478233448910878>',

        // --- Music Sources ---
        spotify: '<:Spotify:1500311186736939008>',
        youtube: '<a:Youtube:1500310258709434448>',
        soundcloud: '<:SoundCloud:1500310263247671347>',
        apple: '<:apple:1500705352335757362>',

        // --- Miscellaneous Utilities ---
        download: '<a:download:1525035127611064431>',
        quest_star: '<a:gold:1492731787137519666>',
        quest_clock: '<a:clock:1492712296697298954>',

        // --- Achievements & Titles ---
        achievement_badge: '🏅',
        achievement_locked: '🔒',
        achievement_unlocked: '🔓',

        // --- Location Minigames ---
        fishing_net: '🎣',
        fish_rare: '🐡',
        fish_legendary: '🦈',
        wood_oak: '🪵',
        wood_mahogany: '🌳',
        ore_gold: '🟡',
        ore_ruby: '🔴',

        // --- Guild & Co-op ---
        guild_banner: '🎌',
        guild_shield: '🛡️',

        // --- Gacha ---
        gacha_pull: '🎰',
        gacha_legendary: '✨',

        // --- Story Quest ---
        story_scroll: '📜',
        story_book: '📖',

    },

    // ==========================================
    // 📜 CENTRALIZED FOOTER CONFIGURATION
    // ==========================================
    footers: {
        core: 'Naura Hoshino Core v1.2.0 • Created by Aryandita ✨',
        utility: 'Naura Utility Feature • Created by Aryandita ✨',
        survival: 'Naura RPG Survival Edition • Created by Aryandita ✨',
        music: 'Naura High-Fidelity Audio System • Created by Aryandita ✨',

        // --- Premium Tier Footers ---
        premium: 'Naura V.I.P Project • Terima kasih telah mendukung Naura! 💎',
        premium_supporter: 'Naura Supporter Tier • Bersama kita tumbuh ✨',
        premium_friends: 'Naura Friends Tier • Terima kasih sahabat setia 💫',
        premium_vip: 'Naura V.I.P Tier • Kamu adalah yang terpilih 👑'
    },

    // ==========================================
    // 🛡️ SMART SYSTEM GETTERS (ANTI-CRASH)
    // ==========================================

    // Get standardized categorized footer text
    getFooter(category = 'core') {
        return this.footers[category] || this.footers.core;
    },

    // Dapatkan warna aksen premium berdasarkan nama tier atau angka
    getPremiumColor(tier) {
        const map = {
            supporter: this.colors.premium_supporter,
            friends: this.colors.premium_friends,
            vip: this.colors.premium_vip,
            1: this.colors.premium_supporter,
            2: this.colors.premium_friends,
            3: this.colors.premium_vip,
        };
        return map[tier] || this.colors.premium_vip;
    },

    // Dapatkan emoji badge premium berdasarkan nama tier
    getPremiumEmoji(tier) {
        const map = {
            supporter: this.emojis.premium_supporter,
            friends: this.emojis.premium_friends,
            vip: this.emojis.premium_vip,
            none: this.emojis.vip,
        };
        return map[tier] || this.emojis.premium_badge;
    },

    // Deteksi nama tier user berdasarkan sisa hari premium
    // Supporter: <= 30 hari, Friends: 31-90 hari, VIP: > 90 hari
    getPremiumTier(daysLeft, isPremium) {
        if (!isPremium || daysLeft <= 0) return 'none';
        if (daysLeft > 90) return 'vip';
        if (daysLeft > 30) return 'friends';
        return 'supporter';
    },

    // Clean custom Discord emojis (<a:name:id> or <:name:id>) for headers and footers
    stripCustomEmojis(text) {
        if (!text) return '';
        return text.replace(/<a?:\w+:\d+>/g, '').trim();
    },

    // Safely parse emoji for Discord buttons or select menu options
    parseEmoji(emojiStr) {
        if (!emojiStr) return null;
        const customMatch = emojiStr.match(/<(a)?:(\w+):(\d+)>/);
        if (customMatch) {
            return {
                animated: Boolean(customMatch[1]),
                name: customMatch[2],
                id: customMatch[3]
            };
        }
        return { name: emojiStr };
    },

    // Check emoji. Returns null if not exists so fallback works.
    getEmoji(name) {
        return this.emojis[name] || null;
    },

    // Check color. Returns primary color if not exists.
    getColor(name) {
        return this.colors[name] || this.colors.primary;
    },

    // Check banner. Returns path if exists, otherwise null.
    getBanner(name) {
        const fs = require('fs');
        const bannerPath = this.banners[name];
        if (!bannerPath) return null;
        return fs.existsSync(bannerPath) ? bannerPath : null;
    },

    // Check background. Returns path if exists, otherwise null.
    getBackground(name) {
        const fs = require('fs');
        const bgPath = this.backgrounds[name];
        if (!bgPath) return null;
        return fs.existsSync(bgPath) ? bgPath : null;
    },

    // In-game dynamic location background loader
    getSurvivalBackground(lokasi, hour) {
        let bgBase = 'desa';
        const loc = (lokasi || 'village').toLowerCase();
        if (loc === 'hutan') bgBase = 'hutan';
        else if (loc === 'tambang') bgBase = 'tambang';
        else if (loc === 'laut') bgBase = 'laut';
        else if (loc === 'kota') bgBase = 'kota';
        else if (loc === 'academy') bgBase = 'academy';
        else if (loc === 'park') bgBase = 'park';
        else if (loc === 'village' || loc === 'desa') bgBase = 'desa';

        let stateName = 'siang';
        if (hour !== undefined) {
            if (hour >= 18 || hour < 5) stateName = 'malam';
            else if (hour >= 5 && hour < 11) stateName = 'pagi';
            else if (hour >= 11 && hour < 15) stateName = 'siang';
            else stateName = 'sore';
        }

        const fs = require('fs');
        const key = `${bgBase}_${stateName}`;
        const fallbackKey = `${bgBase}_siang`;

        const bgPath = this.survivalBackgrounds[key] || this.survivalBackgrounds[fallbackKey] || this.survivalBackgrounds.desa_siang;
        return fs.existsSync(bgPath) ? bgPath : './assets/survival/background/desa_siang.jpeg';
    },

    // Monster Sprite path loader
    getMonsterSprite(monsterName) {
        const fs = require('fs');
        const spritePath = this.monsters[monsterName] || this.monsters.slime;
        return fs.existsSync(spritePath) ? spritePath : './assets/survival/monsters/slime.png';
    },

    // Default Dungeon Background path
    getDungeonBackground() {
        const fs = require('fs');
        const bgPath = this.survivalBackgrounds.tambang_malam;
        return fs.existsSync(bgPath) ? bgPath : './assets/survival/background/tambang_malam.jpeg';
    },

    // Progress Bar Creator
    createProgressBar(current, max, length = 10) {
        const percent = Math.min(Math.max(current / max, 0), 1);
        const filledLength = Math.round(length * percent);
        const emptyLength = length - filledLength;

        const filledBar = this.emojis.bar_filled.repeat(filledLength);
        const emptyBar = this.emojis.bar_empty.repeat(emptyLength);

        return `${filledBar}${emptyBar}`;
    },

    // Standardized Error Message Sender (Components V2)
    async sendError(interaction, errorMessage, ephemeral = false) {
        const { buildErrorContainerV2 } = require('../utils/NauraContainerBuilder');
        const containerPayload = buildErrorContainerV2({ errorMessage });

        try {
            let msg;
            if (interaction.deferred || interaction.replied) {
                msg = await interaction.editReply({ ...containerPayload, files: [] });
            } else {
                msg = await interaction.reply({ ...containerPayload, ephemeral: ephemeral, fetchReply: !ephemeral });
            }

            if (!ephemeral) {
                setTimeout(() => {
                    if (interaction.deleteReply) {
                        interaction.deleteReply().catch(() => { });
                    } else if (msg && msg.delete) {
                        msg.delete().catch(() => { });
                    }
                }, 15000);
            }

            return msg;
        } catch (e) {
            logger.error('[UI SendError]', e);
        }
    },

    // Bilingual / Hybrid text generator
    hybrid(idText, enText) {
        if (!idText) return enText || '';
        if (!enText) return idText || '';
        return `${idText} / ${enText}`;
    },

    // Smart language resolver based on interaction locale
    getLangText(interaction, idText, enText) {
        if (!interaction) return this.hybrid(idText, enText);

        let preferredLang = 'id';
        const locale = interaction.locale || interaction.guildLocale || '';
        if (locale.startsWith('en')) {
            preferredLang = 'en';
        }

        return preferredLang === 'en' ? (enText || idText) : (idText || enText);
    },

    // Helper untuk mengambil path gambar avatar karakter dari assets
    getCharacterImagePath(imageFileName) {
        if (!imageFileName) return null;
        const charPath = path.join(__dirname, '../../assets/survival/characters', imageFileName);
        const fs = require('fs');
        if (fs.existsSync(charPath)) return charPath;
        return null;
    }
}
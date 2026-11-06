# Naura Hoshino V2 - Minecraft Server In-Game Link Integration

Folder ini memuat berkas Skript resmi untuk mengintegrasikan server Minecraft dengan bot Discord Naura Hoshino V2.

## Berkas yang Tersedia
* `naura_link.sk`: Berkas skrip utama untuk plugin Skript Minecraft.
* Panduan lengkap instalasi dan konfigurasi dapat dibaca di: [`docs/MINECRAFT_SETUP.md`](../../docs/MINECRAFT_SETUP.md).

## Cara Cepat Pasang
1. Salin `naura_link.sk` ke folder `plugins/Skript/scripts/` di server Minecraft Anda.
2. Edit opsi `api_url` di baris ke-8 dengan alamat endpoint API bot Anda:
   ```yaml
   api_url: "http://ip-bot-anda:3000/api/minecraft/verify"
   ```
3. Berikan permission kepada pemain di server:
   ```bash
   lp group default permission set naura.use true
   ```
4. Muat ulang skrip di konsol server:
   ```bash
   sk reload naura_link.sk
   ```


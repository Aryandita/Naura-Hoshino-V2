FROM ghcr.io/lavalink-devs/lavalink:4

# LAPIS 3 YouTube anti-bot bypass: yt-dlp + provider plugin PO token.
# - yt-dlp                     : dipanggil source ytdlp LavaSrc (prefix ytsearch:).
# - bgutil-ytdlp-pot-provider  : plugin yt-dlp yang mengambil PO token dari
#                                server bgutil (service pot-server:4416).
# Image dasar menjalankan proses sebagai UID 322; install dilakukan sebagai
# root lalu kembali ke user 322 (pola standar image non-root).
# Versi plugin WAJIB sama dengan versi image pot-server di docker-compose.yml
# (naikkan keduanya bersamaan saat update).
ARG BGUTIL_PLUGIN_VERSION=2.0.2
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3-pip ca-certificates && \
    pip3 install --break-system-packages --no-cache-dir \
        yt-dlp bgutil-ytdlp-pot-provider==${BGUTIL_PLUGIN_VERSION} && \
    rm -rf /var/lib/apt/lists/*
USER 322

# Lokasi binary yt-dlp untuk konfigurasi plugins.lavasrc.ytdlp.path.
# pip dengan --break-system-packages menaruhnya di /usr/local/bin.
ENV YT_DLP_PATH=/usr/local/bin/yt-dlp
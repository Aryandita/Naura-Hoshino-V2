"use strict";

// ==========================================
// PROVIDER BERBASIS SCRAPE HALAMAN
// ==========================================
// Pinterest, Reddit, Threads, dan LinkedIn. Semuanya mengandalkan metadata
// halaman, jadi hasilnya selalu disaring lewat keepRealMedia().

const axios = require("axios");
const { logger } = require("../managers/logger");
const { UA, httpsAgent, resolveShortUrl } = require("./downloaderCore");
const { keepRealMedia } = require("./downloaderProvidersTikTok");

const unescapeUrl = (raw = "") =>
  String(raw)
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");

const fetchHtml = async (url, extraHeaders = {}) => {
  const response = await axios.get(url, {
    timeout: 10000,
    httpsAgent,
    headers: { "User-Agent": UA, ...extraHeaders },
  });
  return typeof response.data === "string" ? response.data : "";
};

// ==========================================
// PROVIDER: Pinterest
// ==========================================

const tryPinterestScrape = async (url) => {
  if (!url.includes("pinterest.com") && !url.includes("pin.it")) return null;
  try {
    logger.info("[Downloader] Mencoba Pinterest scrape...");
    const targetUrl = url.includes("pin.it") ? await resolveShortUrl(url) : url;
    const html = await fetchHtml(targetUrl);
    if (!html) return null;

    const videoMatch =
      html.match(/<meta property="og:video:secure_url" content="([^"]+)"/) ||
      html.match(/"contentUrl":"([^"]+\.mp4[^"]*)"/);
    if (videoMatch) {
      const link = unescapeUrl(videoMatch[1]);
      if (keepRealMedia([link], url).length > 0)
        return { status: "stream", url: link };
    }

    const imageMatch = html.match(
      /<meta property="og:image" content="([^"]+)"/,
    );
    if (imageMatch) {
      const link = unescapeUrl(imageMatch[1]);
      if (keepRealMedia([link], url).length > 0)
        return { status: "stream", url: link };
    }
  } catch (e) {
    logger.error(`[Downloader] Pinterest scrape gagal: ${e.message}`);
  }
  return null;
};

// ==========================================
// PROVIDER: Reddit JSON
// ==========================================

const tryRedditJSON = async (url) => {
  if (!url.includes("reddit.com") && !url.includes("redd.it")) return null;
  try {
    logger.info("[Downloader] Mencoba Reddit JSON API...");
    let targetUrl = url;
    if (url.includes("redd.it") && !url.includes("reddit.com")) {
      targetUrl = await resolveShortUrl(url);
    }

    const cleanUrl = targetUrl.split("?")[0].replace(/\/$/, "");
    const response = await axios.get(cleanUrl + ".json", {
      timeout: 10000,
      httpsAgent,
      headers: { "User-Agent": "NauraBot/2.0 (media downloader)" },
    });

    const postData = response.data?.[0]?.data?.children?.[0]?.data;
    if (!postData) return null;

    // Video reddit memakai DASH terpisah; biar yt-dlp yang menggabungkannya.
    if (postData.is_video) return null;

    if (postData.is_gallery && postData.media_metadata) {
      const images = Object.values(postData.media_metadata)
        .filter((m) => m && m.s && (m.s.u || m.s.gif))
        .map((m) => unescapeUrl(m.s.u || m.s.gif))
        .map((link) => ({ url: link, type: "photo" }));

      if (images.length > 0) {
        return images.length === 1
          ? { status: "stream", url: images[0].url }
          : { status: "picker", picker: images };
      }
    }

    if (
      postData.post_hint === "image" ||
      /\.(jpg|jpeg|png|gif)$/i.test(postData.url || "")
    ) {
      return { status: "stream", url: postData.url };
    }
  } catch (e) {
    logger.error(`[Downloader] Reddit JSON API gagal: ${e.message}`);
  }
  return null;
};

// ==========================================
// PROVIDER: Threads
// ==========================================

const tryThreadsEmbed = async (url) => {
  if (!url.includes("threads.net") && !url.includes("threads.com")) return null;
  try {
    logger.info("[Downloader] Mencoba Threads embed scrape...");
    const pathname = new URL(url).pathname.replace(/\/$/, "");
    const html = await fetchHtml(
      "https://www.threads.net" + pathname + "/embed",
    );
    if (!html) return null;

    const videos = [...html.matchAll(/<video[^>]*src="([^"]+)"/g)].map((m) =>
      unescapeUrl(m[1]),
    );
    const images = [
      ...html.matchAll(
        /<img[^>]*class="[^"]*BarcelonaImage[^"]*"[^>]*src="([^"]+)"/g,
      ),
    ].map((m) => unescapeUrl(m[1]));

    const items = [
      ...keepRealMedia(videos, url).map((link) => ({
        url: link,
        type: "video",
      })),
      ...keepRealMedia(images, url).map((link) => ({
        url: link,
        type: "photo",
      })),
    ];

    if (items.length === 0) return null;
    return items.length === 1
      ? { status: "stream", url: items[0].url }
      : { status: "picker", picker: items };
  } catch (e) {
    logger.error(`[Downloader] Threads embed scrape gagal: ${e.message}`);
  }
  return null;
};

// ==========================================
// PROVIDER: LinkedIn
// ==========================================

const tryLinkedInEmbed = async (url) => {
  if (!url.includes("linkedin.com")) return null;
  try {
    logger.info("[Downloader] Mencoba LinkedIn embed scrape...");

    let embedUrl = url;
    const activityMatch = url.match(/activity[:-](\d+)/i);

    if (activityMatch) {
      embedUrl =
        "https://www.linkedin.com/embed/feed/update/urn:li:activity:" +
        activityMatch[1];
    } else if (url.includes("/posts/") || url.includes("/feed/")) {
      const oembedUrl =
        "https://www.linkedin.com/oembed?url=" +
        encodeURIComponent(url) +
        "&format=json";
      const oembedRes = await axios.get(oembedUrl, {
        timeout: 8000,
        headers: { "User-Agent": UA },
      });
      const thumb = oembedRes.data && oembedRes.data.thumbnail_url;
      if (thumb && keepRealMedia([thumb], url).length > 0) {
        return { status: "stream", url: thumb };
      }
    }

    const html = await fetchHtml(embedUrl, {
      Referer: "https://www.linkedin.com/",
    });
    if (!html) return null;

    const videoMeta = html.match(
      /<meta property="og:video(?::secure_url|:url)?" content="([^"]+)"/,
    );
    if (videoMeta && keepRealMedia([videoMeta[1]], url).length > 0) {
      return { status: "stream", url: unescapeUrl(videoMeta[1]) };
    }

    const imageMeta = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (imageMeta && keepRealMedia([imageMeta[1]], url).length > 0) {
      return { status: "stream", url: unescapeUrl(imageMeta[1]) };
    }
  } catch (e) {
    logger.error(`[Downloader] LinkedIn embed scrape gagal: ${e.message}`);
  }
  return null;
};

module.exports = {
  unescapeUrl,
  tryPinterestScrape,
  tryRedditJSON,
  tryThreadsEmbed,
  tryLinkedInEmbed,
};

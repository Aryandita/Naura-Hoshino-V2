/**
 * status.context.js - Reaktivitas NauraViewer untuk halaman Status/Telemetry.
 *
 * Naura akan bereaksi terhadap data metrik live:
 * - Kaget ('surprised') bila ping/latensi tiba-tiba melonjak
 * - Senang ('happy') saat shard reconnect
 */

export default function (viewer) {
  let socketListener = null;
  let lastPing = 0;

  return {
    init() {
      viewer.setMood("thinking");
      setTimeout(() => viewer.setMood("idle"), 3000);

      if (window.socket) {
        socketListener = (data) => {
          // Cek jika ping melonjak drastis (lebih dari +150ms dari sebelumnya)
          if (data && data.metrics && data.metrics.ping) {
            const currentPing = data.metrics.ping;
            if (lastPing > 0 && currentPing > lastPing + 150) {
              viewer.setMood("surprised");
              setTimeout(() => viewer.setMood("idle"), 4000);
            } else if (currentPing < 50 && lastPing >= 50) {
              // Ping jadi sangat bagus
              viewer.setMood("happy");
              setTimeout(() => viewer.setMood("idle"), 3000);
            }
            lastPing = currentPing;
          }
        };
        window.socket.on("sys-metrics", socketListener);
      }
    },
    cleanup() {
      if (window.socket && socketListener) {
        window.socket.off("sys-metrics", socketListener);
      }
    },
  };
}

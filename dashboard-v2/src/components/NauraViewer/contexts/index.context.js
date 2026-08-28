/**
 * index.context.js - Reaktivitas NauraViewer untuk halaman Home.
 *
 * Naura akan menyambut pengguna ("happy") saat pertama kali dibuka,
 * lalu bereaksi terhadap event 'sys-status' dari Socket.IO.
 */

export default function (viewer) {
  let socketListener = null;

  return {
    init() {
      // Sambut pengguna saat masuk beranda
      viewer.setMood("happy");

      setTimeout(() => {
        viewer.setMood("idle");
      }, 5000);

      // Jika ada Socket.IO terhubung di halaman, dengarkan status bot
      if (window.socket) {
        socketListener = (data) => {
          if (data && data.status) {
            if (data.status === "online") {
              viewer.setMood("happy");
            } else if (data.status === "dnd" || data.status === "idle") {
              viewer.setMood("thinking");
            } else {
              viewer.setMood("sad");
            }

            // Kembali ke idle setelah 10 detik
            setTimeout(() => viewer.setMood("idle"), 10000);
          }
        };
        window.socket.on("sys-status", socketListener);
      }
    },
    cleanup() {
      if (window.socket && socketListener) {
        window.socket.off("sys-status", socketListener);
      }
    },
  };
}

/**
 * reveal.js - Modul animasi scroll reveal untuk mobile dashboard Naura OS.
 * Menggunakan IntersectionObserver untuk performa tinggi tanpa scroll event listener.
 */
export function initReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

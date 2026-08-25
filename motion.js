// ---------- Reveal on scroll ----------
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
);

function initReveal(root = document) {
  const els = root.querySelectorAll(".reveal:not(.reveal-bound)");
  els.forEach((el, i) => {
    el.classList.add("reveal-bound");
    if (!el.style.transitionDelay) {
      el.style.transitionDelay = Math.min(i, 8) * 70 + "ms";
    }
    revealObserver.observe(el);
  });
}

// ---------- Nav con fondo/blur al scrollear ----------
function setupNavScroll() {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  const onScroll = () => {
    nav.classList.toggle("nav-scrolled", window.scrollY > 12);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// ---------- Parallax suave para elementos [data-parallax] ----------
function setupParallax() {
  const els = document.querySelectorAll("[data-parallax]");
  if (!els.length) return;
  const onScroll = () => {
    els.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.15;
      el.style.transform = `translateY(${window.scrollY * speed}px)`;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("loaded");
  initReveal();
  setupNavScroll();
  setupParallax();
});
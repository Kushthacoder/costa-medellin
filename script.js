// All lookups below are guarded with null-checks since this script runs on
// both the homepage (which has the hero/form/counters) and the individual
// room pages (which don't) — a missing element should never break the rest.

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(link =>
    link.addEventListener('click', () => navLinks.classList.remove('open'))
  );
}

const form = document.getElementById('inquiryForm');
const note = document.getElementById('formNote');
if (form && note) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    note.textContent = "Thanks! This is a demo form — connect it to Formspree, Netlify Forms, or your email backend to receive real inquiries.";
    form.reset();
  });
}

// Nav background on scroll
const navbar = document.querySelector('.navbar');
if (navbar) {
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Hero parallax
const heroBg = document.getElementById('heroBg');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (heroBg && !reduceMotion) {
  window.addEventListener('scroll', () => {
    const offset = window.scrollY;
    if (offset < window.innerHeight) {
      heroBg.style.transform = `translateY(${offset * 0.35}px)`;
    }
  }, { passive: true });
}

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
if (reduceMotion) {
  revealEls.forEach(el => el.classList.add('in-view'));
} else {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => revealObserver.observe(el));
}

// Animated counters
const counters = document.querySelectorAll('.count');
const animateCount = (el) => {
  const target = parseInt(el.dataset.target, 10);
  const duration = 900;
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(progress * target);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
if (counters.length) {
  if (reduceMotion) {
    counters.forEach(el => el.textContent = el.dataset.target);
  } else {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          countObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(el => countObserver.observe(el));
  }
}

// Photo rotator — crossfades between the <img> children of any .photo-rotator,
// one at a time, on a timer. Works with any number of images (2+). Skips the
// auto-rotation for reduced-motion users; they just see the first photo.
const rotators = document.querySelectorAll('.photo-rotator');
if (rotators.length && !reduceMotion) {
  rotators.forEach(rotator => {
    const imgs = Array.from(rotator.querySelectorAll('img'));
    if (imgs.length < 2) return;
    let current = imgs.findIndex(img => img.classList.contains('active'));
    if (current === -1) {
      current = 0;
      imgs[0].classList.add('active');
    }
    setInterval(() => {
      const next = (current + 1) % imgs.length;
      imgs[current].classList.remove('active');
      imgs[next].classList.add('active');
      current = next;
    }, 5000);
  });
}

// Gallery lightbox — click any photo in a .gallery-grid to view it full-size,
// with prev/next arrows scoped to whichever gallery it belongs to. Built
// once here so it works on the homepage and every room page without any
// extra markup in the HTML.
const galleryGrids = document.querySelectorAll('.gallery-grid');
if (galleryGrids.length) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Close">&times;</button>
    <button type="button" class="lightbox-prev" aria-label="Previous photo">&#10094;</button>
    <img class="lightbox-img" src="" alt="">
    <button type="button" class="lightbox-next" aria-label="Next photo">&#10095;</button>
  `;
  document.body.appendChild(overlay);

  const lightboxImg = overlay.querySelector('.lightbox-img');
  const btnClose = overlay.querySelector('.lightbox-close');
  const btnPrev = overlay.querySelector('.lightbox-prev');
  const btnNext = overlay.querySelector('.lightbox-next');

  let activeGroup = [];
  let activeIndex = 0;

  const showCurrent = () => {
    const img = activeGroup[activeIndex];
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || '';
    const multi = activeGroup.length > 1;
    btnPrev.style.display = multi ? '' : 'none';
    btnNext.style.display = multi ? '' : 'none';
  };

  const openLightbox = (group, index) => {
    activeGroup = group;
    activeIndex = index;
    showCurrent();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-lock');
  };

  const closeLightbox = () => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-lock');
    lightboxImg.src = '';
  };

  const showNext = () => {
    activeIndex = (activeIndex + 1) % activeGroup.length;
    showCurrent();
  };
  const showPrev = () => {
    activeIndex = (activeIndex - 1 + activeGroup.length) % activeGroup.length;
    showCurrent();
  };

  galleryGrids.forEach(grid => {
    const imgsInGrid = Array.from(grid.querySelectorAll('img'));
    imgsInGrid.forEach((img, i) => {
      img.addEventListener('click', () => openLightbox(imgsInGrid, i));
    });
  });

  btnClose.addEventListener('click', closeLightbox);
  btnPrev.addEventListener('click', showPrev);
  btnNext.addEventListener('click', showNext);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
  });
}

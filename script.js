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
    // Optional caption (e.g. "Bunk Room") labeling which photo is currently
    // showing — only present when the markup includes a .rotator-label
    // element and data-label attributes on the images.
    const label = rotator.querySelector('.rotator-label');
    let current = imgs.findIndex(img => img.classList.contains('active'));
    if (current === -1) {
      current = 0;
      imgs[0].classList.add('active');
    }
    if (label && imgs[current].dataset.label) label.textContent = imgs[current].dataset.label;
    setInterval(() => {
      const next = (current + 1) % imgs.length;
      imgs[current].classList.remove('active');
      imgs[next].classList.add('active');
      current = next;
      if (label && imgs[current].dataset.label) label.textContent = imgs[current].dataset.label;
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

// Lofi background music — a small floating widget that lets visitors
// optionally play a lofi mix (via YouTube's official embed, so no audio
// files are hosted here) behind the site. Off by default: browsers block
// autoplay-with-sound, so nothing plays until a visitor clicks. The player
// itself is created as soon as the page loads (paused) rather than on
// click — some browsers (notably Safari) only allow starting audio when
// play() is called synchronously inside the click handler, and creating
// the whole YouTube embed on-demand after a click introduces a delay that
// gets the click treated as "not a real user gesture" anymore.
(function () {
  const YT_VIDEO_ID = 'QwYKO-SCRaI'; // Japanese Beach — Summer Lofi / Ocean lofi hip hop mix

  const widget = document.createElement('div');
  widget.className = 'lofi-player';
  widget.innerHTML = `
    <div id="lofiPlayerHost" class="lofi-player-host" aria-hidden="true"></div>
    <button type="button" class="lofi-toggle" aria-pressed="false" aria-label="Play background lofi music">
      <svg class="lofi-icon-play" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
      <svg class="lofi-icon-pause" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z"></path></svg>
    </button>
    <div class="lofi-info">
      <span class="lofi-label">Lofi Radio</span>
      <span class="lofi-sub">ocean lofi mix</span>
    </div>
    <input type="range" class="lofi-volume" min="0" max="100" value="40" aria-label="Music volume">
  `;
  document.body.appendChild(widget);

  const toggleBtn = widget.querySelector('.lofi-toggle');
  const playIcon = widget.querySelector('.lofi-icon-play');
  const pauseIcon = widget.querySelector('.lofi-icon-pause');
  const subLabel = widget.querySelector('.lofi-sub');
  const defaultSubText = subLabel.textContent;
  const volumeSlider = widget.querySelector('.lofi-volume');

  const savedVolume = parseInt(localStorage.getItem('lofiVolume'), 10);
  if (!isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 100) {
    volumeSlider.value = savedVolume;
  }

  let player = null;
  let playerReady = false;
  let playing = false;
  let pendingPlay = false;

  function setPlayingUI(isPlaying) {
    playing = isPlaying;
    playIcon.hidden = isPlaying;
    pauseIcon.hidden = !isPlaying;
    toggleBtn.setAttribute('aria-pressed', String(isPlaying));
    toggleBtn.setAttribute('aria-label', isPlaying ? 'Pause background lofi music' : 'Play background lofi music');
  }

  function showError(message) {
    subLabel.textContent = message;
    toggleBtn.disabled = true;
  }

  function createPlayer() {
    player = new YT.Player('lofiPlayerHost', {
      height: '1',
      width: '1',
      videoId: YT_VIDEO_ID,
      playerVars: { autoplay: 0, controls: 0, loop: 1, playlist: YT_VIDEO_ID },
      events: {
        onReady: () => {
          playerReady = true;
          player.setVolume(parseInt(volumeSlider.value, 10));
          if (pendingPlay) {
            pendingPlay = false;
            player.playVideo();
            setPlayingUI(true);
          }
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) setPlayingUI(true);
          if (e.data === YT.PlayerState.PAUSED) setPlayingUI(false);
        },
        onError: () => {
          showError('unavailable right now');
        }
      }
    });
  }

  // Load the YouTube iframe API and build the (paused) player immediately,
  // so the very first click can call playVideo() synchronously.
  const previousCallback = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (typeof previousCallback === 'function') previousCallback();
    createPlayer();
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onerror = () => showError('blocked by browser/extension');
  document.head.appendChild(tag);

  // If the API never calls back (ad blocker, offline, etc.), fail visibly
  // instead of leaving the button silently doing nothing forever.
  setTimeout(() => {
    if (!playerReady) showError('blocked by browser/extension');
  }, 8000);

  toggleBtn.addEventListener('click', () => {
    if (!playerReady) {
      // Player still loading — remember the intent and play as soon as
      // onReady fires.
      pendingPlay = !pendingPlay;
      subLabel.textContent = pendingPlay ? 'loading…' : defaultSubText;
      return;
    }
    if (playing) {
      player.pauseVideo();
      setPlayingUI(false);
    } else {
      player.playVideo();
      setPlayingUI(true);
    }
  });

  volumeSlider.addEventListener('input', () => {
    const vol = parseInt(volumeSlider.value, 10);
    localStorage.setItem('lofiVolume', String(vol));
    if (player && player.setVolume) player.setVolume(vol);
  });
})();

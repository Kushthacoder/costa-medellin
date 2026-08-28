// initPage() sets up everything that's specific to whatever page content is
// currently in the DOM (nav toggle, form, scroll effects, reveal animations,
// counters, photo rotators). It runs once on the initial page load, and then
// runs again every time the pjax-style router at the bottom of this file
// swaps in a new page's <header>/<main> — which is how the lofi music player
// and gallery lightbox (both set up separately, once, below) survive
// visitors clicking between pages instead of getting torn down on every
// navigation. Because it can run more than once, anything it attaches to
// something that ISN'T replaced on a swap (window, document) cleans up its
// own previous instance first so repeated navigation doesn't stack up
// duplicate listeners/timers.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let navbarScrollHandler = null;
let heroParallaxHandler = null;
let revealObserver = null;
let countObserver = null;
let rotatorIntervals = [];

function initPage() {
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
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.dataset.sending === '1') return;
      form.dataset.sending = '1';
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      note.textContent = '';

      const payload = {
        name: form.elements.name.value,
        email: form.elements.email.value,
        checkin: form.elements.checkin.value,
        checkout: form.elements.checkout.value,
        guests: form.elements.guests.value,
        message: form.elements.message.value,
        _honey: form.elements._honey ? form.elements._honey.value : '',
      };

      const failText = 'Sorry, we could not send your inquiry. Please email costamedellin.ph@gmail.com or try again.';

      try {
        const res = await fetch('/api/inquire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        if (!res.ok || !data.ok) {
          note.textContent = data.error || failText;
          return;
        }

        // Honeypot: gate acknowledges without returning a mail URL.
        if (!data.submitUrl) {
          note.textContent = 'Thanks! Your inquiry has been sent. We will get back to you soon.';
          form.reset();
          return;
        }

        const mailRes = await fetch(data.submitUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name: payload.name,
            email: payload.email,
            checkin: payload.checkin,
            checkout: payload.checkout,
            guests: payload.guests,
            message: payload.message,
            _subject: 'Costa Medellin inquiry',
            _replyto: payload.email,
            _captcha: 'false',
          }),
        });
        let mailData = {};
        try {
          mailData = await mailRes.json();
        } catch {
          mailData = {};
        }
        const mailText = String(mailData.message || '').toLowerCase();
        const needsActivation = mailText.includes('activat') || mailText.includes('confirm your email');
        const mailFailed =
          !needsActivation &&
          (!mailRes.ok || mailData.success === false || mailData.success === 'false');
        if (mailFailed) {
          note.textContent = failText;
          return;
        }
        note.textContent = needsActivation
          ? 'Thanks! Costa Medellin needs to confirm a one-time email before inquiries arrive. You can also write us at costamedellin.ph@gmail.com.'
          : 'Thanks! Your inquiry has been sent. We will get back to you soon.';
        form.reset();
      } catch {
        note.textContent = failText;
      } finally {
        form.dataset.sending = '0';
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Nav background on scroll
  if (navbarScrollHandler) window.removeEventListener('scroll', navbarScrollHandler);
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    navbarScrollHandler = () => navbar.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', navbarScrollHandler, { passive: true });
    navbarScrollHandler();
  } else {
    navbarScrollHandler = null;
  }

  // Hero parallax (homepage only)
  if (heroParallaxHandler) window.removeEventListener('scroll', heroParallaxHandler);
  const heroBg = document.getElementById('heroBg');
  if (heroBg && !reduceMotion) {
    heroParallaxHandler = () => {
      const offset = window.scrollY;
      if (offset < window.innerHeight) {
        heroBg.style.transform = `translateY(${offset * 0.35}px)`;
      }
    };
    window.addEventListener('scroll', heroParallaxHandler, { passive: true });
  } else {
    heroParallaxHandler = null;
  }

  // Scroll reveal
  if (revealObserver) revealObserver.disconnect();
  const revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion) {
    revealEls.forEach(el => el.classList.add('in-view'));
  } else {
    revealObserver = new IntersectionObserver((entries) => {
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
  if (countObserver) countObserver.disconnect();
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
      countObserver = new IntersectionObserver((entries) => {
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

  // Photo rotator — crossfades between the <img> children of any
  // .photo-rotator, one at a time, on a timer. Previous rotators' intervals
  // are cleared first so navigating away doesn't leave zombie timers
  // running against detached images forever.
  rotatorIntervals.forEach(clearInterval);
  rotatorIntervals = [];
  const rotators = document.querySelectorAll('.photo-rotator');
  if (rotators.length && !reduceMotion) {
    rotators.forEach(rotator => {
      const imgs = Array.from(rotator.querySelectorAll('img'));
      if (imgs.length < 2) return;
      // Optional caption (e.g. "Bunk Room") labeling which photo is
      // currently showing — only present when the markup includes a
      // .rotator-label element and data-label attributes on the images.
      const label = rotator.querySelector('.rotator-label');
      let current = imgs.findIndex(img => img.classList.contains('active'));
      if (current === -1) {
        current = 0;
        imgs[0].classList.add('active');
      }
      if (label && imgs[current].dataset.label) label.textContent = imgs[current].dataset.label;
      const intervalId = setInterval(() => {
        const next = (current + 1) % imgs.length;
        imgs[current].classList.remove('active');
        imgs[next].classList.add('active');
        current = next;
        if (label && imgs[current].dataset.label) label.textContent = imgs[current].dataset.label;
      }, 5000);
      rotatorIntervals.push(intervalId);
    });
  }
}

// Gallery lightbox — click any photo in a .gallery-grid to view it
// full-size, with prev/next arrows scoped to whichever gallery it belongs
// to. The overlay is built once and lives outside <main>, so it survives
// page swaps below; clicks are handled via delegation on document rather
// than bound per-image, so it automatically covers whatever gallery images
// are on the page at any given time — including ones swapped in later —
// with nothing to rebind.
(function () {
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

  document.addEventListener('click', (e) => {
    const img = e.target.closest('.gallery-grid img');
    if (!img) return;
    const grid = img.closest('.gallery-grid');
    const imgsInGrid = Array.from(grid.querySelectorAll('img'));
    openLightbox(imgsInGrid, imgsInGrid.indexOf(img));
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
})();

// Lofi background music — a small floating widget that lets visitors
// optionally play a lofi mix (via YouTube's official embed, so no audio
// files are hosted here) behind the site. Off by default: browsers block
// autoplay-with-sound, so nothing plays until a visitor clicks. The player
// itself is created as soon as the page loads (paused) rather than on
// click — some browsers (notably Safari) only allow starting audio when
// play() is called synchronously inside the click handler, and creating
// the whole YouTube embed on-demand after a click introduces a delay that
// gets the click treated as "not a real user gesture" anymore.
//
// This whole widget is built once, here, and lives directly on <body> —
// outside the <header>/<main> that the router below swaps on navigation —
// so once a visitor hits play, the music keeps playing no matter what page
// they click into next.
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

// Pjax-style navigation — intercepts clicks on internal .html links (nav
// links, room cards, "Explore Room", "Send an Inquiry", etc.) and swaps just
// the <header> and <main> content via fetch instead of doing a full browser
// navigation. Everything outside those two elements — the lofi player and
// the gallery lightbox set up above — is never touched, so the music
// doesn't cut out when a visitor clicks from the homepage into a room page
// and back. Falls back to a normal navigation for external links, non-HTML
// links, or if the fetch fails for any reason, so the site still works
// exactly as a plain multi-page site if JS fails to load.
(function () {
  const parser = new DOMParser();

  function isInternalPageLink(link) {
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return false;
    if (link.origin !== window.location.origin) return false;
    return /\.html$/i.test(link.pathname);
  }

  async function swapPage(url, addHistory) {
    let html;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('bad response: ' + res.status);
      html = await res.text();
    } catch (err) {
      window.location.href = url;
      return;
    }

    const doc = parser.parseFromString(html, 'text/html');
    const newHeader = doc.querySelector('header.site-header');
    const newMain = doc.querySelector('main');
    const curHeader = document.querySelector('header.site-header');
    const curMain = document.querySelector('main');
    if (!newHeader || !newMain || !curHeader || !curMain) {
      window.location.href = url;
      return;
    }

    curHeader.replaceWith(newHeader);
    curMain.replaceWith(newMain);
    document.title = doc.title;
    if (addHistory) history.pushState({ pjax: true }, '', url);

    const hash = new URL(url, window.location.href).hash;
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) {
      target.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }

    initPage();
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href]');
    if (!link || !isInternalPageLink(link)) return;

    // A hash link pointing at the page we're already on (e.g. clicking
    // "About" while already on the homepage) is just an in-page scroll —
    // let the browser handle that natively, nothing to swap.
    if (link.pathname === window.location.pathname && link.hash) return;

    e.preventDefault();
    swapPage(link.href, true);
  });

  window.addEventListener('popstate', () => {
    swapPage(window.location.href, false);
  });

  // Initial run, for the page as it was actually loaded.
  initPage();
})();

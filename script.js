/* ============================================================
   Dmitry Kovalev — portfolio interactions
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- loader: a bar across the top, then the site opens ---------- */
  const loader = document.getElementById('loader');
  const loaderFill = document.getElementById('loaderFill');
  const site = document.getElementById('site');

  if (loader) {
    // the flag itself is set by the inline script in <head>, before first paint
    const seen = document.documentElement.dataset.seen === '1';

    let pageLoaded = false;
    window.addEventListener('load', () => { pageLoaded = true; });

    /* a square grows out of the centre of the screen, uncovering the page.
       Insets are in pixels: the .site box is the whole document, so the
       bottom/right edges have to be measured against its real height. */
    const openSquare = () => {
      const DUR = seen ? 700 : 1400;
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      const maxR = Math.max(window.innerWidth, window.innerHeight) / 2 * 1.02;
      const boxW = site.offsetWidth;
      const boxH = site.offsetHeight;

      const draw = r => {
        const top = Math.max(halfH - r, 0);
        const left = Math.max(halfW - r, 0);
        const bottom = Math.max(boxH - (halfH + r), 0);
        const right = Math.max(boxW - (halfW + r), 0);
        site.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
      };

      draw(0);
      site.classList.remove('is-hidden');
      site.classList.add('is-revealing');
      loader.classList.add('is-opening');   // drop the bar before the square gets there

      const t0 = performance.now();
      const step = now => {
        const t = Math.min((now - t0) / DUR, 1);
        draw(t * t * (3 - 2 * t) * maxR);             // gentle at both ends
        if (t < 1) { requestAnimationFrame(step); return; }

        // clip-path would make .site the containing block for the fixed top bar
        site.style.clipPath = '';
        site.classList.remove('is-revealing');
        document.body.classList.remove('is-loading');
        loader.remove();
        // the scrollbar comes back now, so the giant name has to be re-fitted
        window.dispatchEvent(new Event('resize'));
      };
      requestAnimationFrame(step);
    };

    const finish = () => {
      if (reduceMotion) {
        site.classList.remove('is-hidden');
        document.body.classList.remove('is-loading');
        loader.remove();
        window.dispatchEvent(new Event('resize'));
        return;
      }
      openSquare();
    };

    /* Phase one — 0 → 94 — is the CSS animation above; it is already running by
       the time this file executes. All that is left here is the last stretch to
       100 once the browser reports the page in, and the hand-off to the reveal. */

    const HOLD = 0.94;
    const SETTLE = 560;
    const EASE_OUT = t => t * t * (3 - 2 * t);          // smoothstep

    // the last 6% — transform only again, so it stays on the compositor
    const runSettle = () => {
      const stops = Array.from({ length: 21 }, (_, i) => {
        const t = i / 20;
        return { offset: t, transform: `scaleX(${(HOLD + (1 - HOLD) * EASE_OUT(t)).toFixed(5)})` };
      });

      const bar = loaderFill.animate(stops, { duration: SETTLE, easing: 'linear', fill: 'forwards' });
      bar.finished.then(() => setTimeout(finish, 200)).catch(() => {});   // let it sit full
    };

    if (reduceMotion) {
      setTimeout(finish, 200);                    // no animationend will ever fire
    } else {
      // the CSS phase ends on the bar; whichever happens last wins
      const barAnim = loaderFill.getAnimations()[0];
      const phaseOne = barAnim ? barAnim.finished : Promise.resolve();

      // Waiting on window.load alone means parking on 94 for as long as the
      // slowest image takes. Cap it: everything above the fold is in by then,
      // and the rest of the pictures are lazy anyway.
      const loaded = pageLoaded
        ? Promise.resolve()
        : Promise.race([
            new Promise(done => window.addEventListener('load', done, { once: true })),
            new Promise(done => setTimeout(done, 1800))
          ]);

      Promise.all([phaseOne, loaded]).then(runSettle).catch(() => {});
    }
  }

  /* ---------- current year ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- top bar background on scroll ---------- */
  const bar = document.getElementById('topbar');
  const onScroll = () => bar.classList.toggle('is-stuck', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- mobile menu ---------- */
  const burger = document.getElementById('burger');
  const topbarNav = document.getElementById('topbarNav');

  if (burger && topbarNav) {
    const setMenu = open => {
      topbarNav.classList.toggle('is-open', open);
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('is-menu', open);
    };

    burger.addEventListener('click', () => setMenu(!topbarNav.classList.contains('is-open')));
    topbarNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
    // a resize past the breakpoint would otherwise leave the body locked
    window.addEventListener('resize', () => {
      if (window.innerWidth > 760) setMenu(false);
    });
  }

  /* ---------- fit the giant name to the viewport width ---------- */
  const bigname = document.querySelector('.bigname');

  const nameText = bigname.querySelector('span');

  const fitName = () => {
    bigname.style.fontSize = '';                              // back to the CSS clamp value
    nameText.style.transform = 'none';                        // measure it unscaled
    const cs = getComputedStyle(bigname);
    const avail = bigname.clientWidth                         // clientWidth still counts padding
                - parseFloat(cs.paddingLeft)
                - parseFloat(cs.paddingRight);
    const natural = nameText.getBoundingClientRect().width;   // the text itself, at clamp size
    const current = parseFloat(cs.fontSize);
    if (avail > 0 && natural > 0) {
      let size = current * avail / natural;
      bigname.style.fontSize = size + 'px';

      // variable-font width axis makes the first guess a few px optimistic,
      // so correct against the real rendered width
      const drawn = nameText.getBoundingClientRect().width;
      if (drawn > 0) bigname.style.fontSize = (size * avail / drawn * 0.997) + 'px';
    }
    scaleName();                                              // re-apply the scroll scale
  };

  /* ---------- the name shrinks as you scroll towards the next section ----------
     Scaled with a transform rather than font-size: changing the type size would
     change the heading's height mid-scroll and shove the whole page around. */
  const NAME_MIN = 0.42;
  let nameTicking = false;

  const scaleName = () => {
    nameTicking = false;
    if (reduceMotion) return;

    const travel = window.innerHeight * 0.7;                  // fully shrunk by then
    const progress = Math.min(Math.max(window.scrollY / travel, 0), 1);
    const eased = progress * progress * (3 - 2 * progress);   // smoothstep
    nameText.style.transform = `scale(${1 - (1 - NAME_MIN) * eased})`;
  };

  window.addEventListener('scroll', () => {
    if (nameTicking) return;
    nameTicking = true;
    requestAnimationFrame(scaleName);
  }, { passive: true });

  fitName();
  window.addEventListener('resize', fitName);
  if (document.fonts) document.fonts.ready.then(fitName);

  /* ---------- scroll reveal ---------- */
  const targets = document.querySelectorAll(
    '.bigname, .hero__disciplines li, .hero__photo, .hero__frame, .project__head, .credits, ' +
    '.project__left, .ph, .scribble, .floater, .says p, .tl, ' +
    '.contact__eyebrow, .contact__title, .form, ' +
    '.foot__label, .foot__mail, .foot__socials'
  );
  targets.forEach(el => el.classList.add('reveal'));

  // anything holding a picture wipes open instead of fading in
  document.querySelectorAll('.ph, .floater, .tl, .hero__frame')
    .forEach(el => el.classList.add('wipe'));

  const revealer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const group = [...entry.target.parentElement.children].filter(c => c.classList.contains('reveal'));
      // a short cascade reads as intentional; a long one reads as slow loading
      entry.target.style.transitionDelay = Math.min(group.indexOf(entry.target), 5) * 40 + 'ms';
      entry.target.classList.add('is-in');
      obs.unobserve(entry.target);
    });
  }, {
    threshold: 0,
    // Start a third of a screen early. The old value was negative, which meant
    // an element had to be 40px INSIDE the viewport before it began appearing —
    // so you always caught it as an empty white box first.
    rootMargin: '0px 0px 33% 0px'
  });

  targets.forEach(el => revealer.observe(el));

  /* ---------- timeline: the wheel scrolls the rail sideways ---------- */
  const rail = document.getElementById('timelineScroll');

  if (rail && !reduceMotion) {
    let target = rail.scrollLeft, gliding = 0;

    const glide = () => {
      const diff = target - rail.scrollLeft;
      if (Math.abs(diff) < 0.4) { rail.scrollLeft = target; gliding = 0; return; }
      rail.scrollLeft += diff * 0.14;              // eased catch-up, never a hard jump
      gliding = requestAnimationFrame(glide);
    };

    rail.addEventListener('wheel', e => {
      const max = rail.scrollWidth - rail.clientWidth;
      if (max <= 0) return;

      // biggest axis wins, and line-mode wheels report ~1 per notch
      let delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (e.deltaMode === 1) delta *= 16;

      // at either end hand the gesture back to the page instead of trapping it
      if ((delta < 0 && target <= 0) || (delta > 0 && target >= max)) return;

      e.preventDefault();
      target = Math.min(Math.max(target + delta, 0), max);
      if (!gliding) gliding = requestAnimationFrame(glide);
    }, { passive: false });

    // keep the target honest if the rail moves any other way (touch, resize)
    rail.addEventListener('scroll', () => {
      if (!gliding) target = rail.scrollLeft;
    }, { passive: true });
  }

  /* ---------- timeline: progress bar and card counter ---------- */
  const tlProgress = document.getElementById('tlProgress');
  const tlIndex = document.getElementById('tlIndex');
  const tlTotal = document.getElementById('tlTotal');

  if (rail && tlProgress) {
    const cards = [...rail.querySelectorAll('.tl')];
    const pad = n => String(n).padStart(2, '0');
    tlTotal.textContent = pad(cards.length);

    const readRail = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      const ratio = max > 0 ? rail.scrollLeft / max : 0;
      tlProgress.style.width = (ratio * 100).toFixed(2) + '%';

      // spread the travel across the cards, so the far end really reads 07 / 07
      // (picking the left-most visible card would stop at 04 with four on screen)
      tlIndex.textContent = pad(1 + Math.round(ratio * (cards.length - 1)));
    };

    rail.addEventListener('scroll', readRail, { passive: true });
    window.addEventListener('resize', readRail);
    readRail();
  }

  /* ---------- cursor bubble over the collages ---------- */
  const cursor = document.getElementById('cursor');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (cursor && finePointer && !reduceMotion) {
    const zones = document.querySelectorAll('[data-cursor]');
    let cx = 0, cy = 0, drawn = false;

    const paint = () => {
      drawn = false;
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    };

    window.addEventListener('pointermove', e => {
      cx = e.clientX; cy = e.clientY;
      if (!drawn) { drawn = true; requestAnimationFrame(paint); }
    }, { passive: true });

    zones.forEach(zone => {
      zone.addEventListener('pointerenter', () => {
        cursor.querySelector('span').textContent = zone.dataset.cursor;
        cursor.classList.add('is-on');
      });
      zone.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
    });
  }

  /* ---------- hero portrait leans towards the pointer ---------- */
  const heroPhoto = document.getElementById('heroPhoto');

  if (heroPhoto && finePointer && !reduceMotion) {
    const img = heroPhoto.querySelector('img');
    let raf = 0, tx = 0, ty = 0;

    const apply = () => { raf = 0; img.style.transform = `translate(${tx}px, ${ty}px) scale(1.05)`; };

    heroPhoto.addEventListener('pointermove', e => {
      const box = heroPhoto.getBoundingClientRect();
      tx = ((e.clientX - box.left) / box.width - 0.5) * -16;   // max 8px either way
      ty = ((e.clientY - box.top) / box.height - 0.5) * -16;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });

    heroPhoto.addEventListener('pointerleave', () => {
      tx = ty = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    });
  }

  /* ---------- contact form (front end only — opens the mail client) ---------- */
  const form = document.getElementById('contactForm');
  const note = document.getElementById('formNote');

  if (form) {
    const rules = {
      name: v => v.trim().length >= 2 || 'Please tell me your name.',
      email: v => /^\S+@\S+\.\S{2,}$/.test(v.trim()) || 'That email address looks incomplete.',
      message: v => v.trim().length >= 12 || 'A sentence or two about the process, please.'
    };

    const mark = (field, message) => {
      const wrap = field.closest('.field');
      wrap.classList.toggle('is-bad', Boolean(message));
      wrap.querySelector('.field__err').textContent = message || '';
    };

    // clear the complaint as soon as they start fixing it
    form.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('input', () => {
        if (el.closest('.field').classList.contains('is-bad')) mark(el, '');
      });
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      note.textContent = '';
      note.classList.remove('is-bad');

      let firstBad = null;
      Object.entries(rules).forEach(([key, check]) => {
        const field = form.elements[key];
        const result = check(field.value);
        const message = result === true ? '' : result;
        mark(field, message);
        if (message && !firstBad) firstBad = field;
      });

      if (firstBad) {
        firstBad.focus();
        note.textContent = 'Please fix the highlighted fields.';
        note.classList.add('is-bad');
        return;
      }

      const data = Object.fromEntries(new FormData(form));
      const subject = encodeURIComponent(`Automation enquiry — ${data.name}`);
      const body = encodeURIComponent(`${data.message}\n\n— ${data.name} (${data.email})`);
      window.location.href = `mailto:kovalev4041@gmail.com?subject=${subject}&body=${body}`;

      note.textContent = 'Opening your email app… if nothing happens, write to kovalev4041@gmail.com.';
      form.reset();
    });
  }

  /* ---------- gentle parallax drift on collage photos ---------- */
  const photos = [...document.querySelectorAll('.collage .ph')];
  const wide = () => window.matchMedia('(min-width: 641px)').matches;

  if (!reduceMotion && photos.length) {
    photos.forEach((el, i) => { el.dataset.depth = (i % 3 + 1) * 6; });

    let ticking = false;
    const drift = () => {
      photos.forEach(el => {
        const rect = el.getBoundingClientRect();
        const progress = (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight;
        el.style.setProperty('--drift', (-progress * el.dataset.depth).toFixed(1) + 'px');
      });
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (ticking || !wide()) return;
      ticking = true;
      requestAnimationFrame(drift);
    }, { passive: true });

    drift();
  }

  /* ---------- reel video modal ---------- */
  const reelModal = document.getElementById('reelModal');
  const reelVideo = document.getElementById('reelVideo');
  const reelTriggers = document.querySelectorAll('[data-reel]');

  if (reelModal && reelVideo && reelTriggers.length) {
    let lastFocus = null;

    const openReel = () => {
      lastFocus = document.activeElement;
      reelModal.classList.add('is-open');
      reelModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-modal');
      // the click that opened the modal is the user gesture, so sound is allowed;
      // preload="none" means the file only starts downloading now, on play
      reelVideo.currentTime = 0;
      const played = reelVideo.play();
      if (played) played.catch(() => {});      // blocked? the controls are right there
      reelModal.querySelector('.vmodal__close').focus();
    };

    const closeReel = () => {
      reelVideo.pause();
      reelModal.classList.remove('is-open');
      reelModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-modal');
      if (lastFocus) lastFocus.focus();
    };

    reelTriggers.forEach(t => t.addEventListener('click', openReel));
    reelModal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeReel));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && reelModal.classList.contains('is-open')) closeReel();
    });
  }

});

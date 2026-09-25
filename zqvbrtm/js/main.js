/** Router and app bootstrap. Hash-based so deep links survive GitHub Pages. */

import * as store from './store.js';
import { el, clear } from './dom.js';
import { APP_TITLE, APP_SUBTITLE, NAV_TITLE } from './config.js';
import { icon } from './icons.js';
import { themeReveal, animateScreen, pop } from './motion.js';
import * as sound from './sound.js';
import { renderHome } from './views/home.js';
import { renderQuiz } from './views/quiz.js';
import { renderResults } from './views/results.js';
import { renderBuildQuiz } from './views/buildQuiz.js';
import { renderStats } from './views/stats.js';
import { renderReview } from './views/review.js';
import { renderSaved } from './views/saved.js';
import { renderSearch } from './views/search.js';

const ROUTES = {
  '/home': renderHome,
  '/build': renderBuildQuiz,
  '/quiz': renderQuiz,
  '/results': renderResults,
  '/stats': renderStats,
  '/review': renderReview,
  '/saved': renderSaved,
  '/search': renderSearch,
};

const NAV = [
  { href: '#/home', ic: 'study', label: 'Study', match: ['/home', '/build', '/quiz', '/results', '/search'] },
  { href: '#/stats', ic: 'stats', label: 'Stats', match: ['/stats'] },
  { href: '#/review', ic: 'review', label: 'Review', match: ['/review'] },
  { href: '#/saved', ic: 'saved', label: 'Saved', match: ['/saved'] },
];

export function parseHash() {
  const raw = (window.location.hash || '#/home').slice(1);
  const [path, query] = raw.split('?');
  return {
    path: path || '/home',
    params: new URLSearchParams(query || ''),
  };
}

export function navigate(path) {
  window.location.hash = path;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const dark = theme === 'dark';
    btn.replaceChildren(icon(dark ? 'sun' : 'moon'));
    btn.firstChild.classList.add('theme-ic');
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.setAttribute('title', btn.getAttribute('aria-label'));
  }
}

function paintSound() {
  const btn = document.getElementById('sound-toggle');
  if (!btn) return;
  const on = sound.enabled();
  btn.replaceChildren(icon(on ? 'volume' : 'mute'));
  btn.setAttribute('aria-label', on ? 'Sound effects on. Turn them off' : 'Sound effects off. Turn them on');
  btn.setAttribute('title', on ? 'Sound effects: on' : 'Sound effects: off');
}

function buildShell() {
  const root = document.getElementById('app');
  clear(root);

  const nav = el('nav', { class: 'nav', 'aria-label': 'Sections' }, [
    el('span', { class: 'nav-pill', 'aria-hidden': 'true' }),
    el('span', { class: 'navtitle' }, [el('span', { class: 'brandmark' }, [icon('shield', { size: 22 })]), NAV_TITLE]),
    ...NAV.map((n) => el('a', { href: n.href, 'data-nav': n.match.join(' ') }, [
      el('span', { class: 'ic' }, [icon(n.ic, { size: 22 })]),
      el('span', { text: n.label }),
    ])),
  ]);

  const themeBtn = el('button', {
    class: 'iconbtn', id: 'theme-toggle', type: 'button',
    onclick: () => {
      const next = store.getSettings().theme === 'dark' ? 'light' : 'dark';
      store.setSettings({ theme: next });
      themeReveal(themeBtn, () => applyTheme(next));
    },
  });

  const soundBtn = el('button', {
    class: 'iconbtn', id: 'sound-toggle', type: 'button',
    onclick: () => {
      const next = !sound.enabled();
      store.setSettings({ sound: next });
      paintSound();
      pop(soundBtn.firstChild, { scale: 1.25 });
      if (next) { sound.unlock(); sound.play('on'); }
    },
  });

  const topbar = el('header', { class: 'topbar' }, [
    el('span', { class: 'brand' }, [
      el('span', { class: 'brandmark' }, [icon('shield', { size: 20 })]),
      el('span', { class: 'brandtext' }, [APP_TITLE, el('small', { text: APP_SUBTITLE })]),
    ]),
    soundBtn,
    themeBtn,
  ]);

  const main = el('main', { id: 'view', tabindex: '-1' });
  const col = el('div', { class: 'shell-col' }, [topbar, main]);

  root.append(el('div', { class: 'app' }, [nav, col]));
  return main;
}

// The highlight behind the current section glides from tab to tab.
function placeNavPill({ instant = false } = {}) {
  const pill = document.querySelector('.nav-pill');
  const cur = document.querySelector('.nav a[aria-current="page"]');
  if (!pill) return;
  if (!cur) { pill.style.opacity = '0'; return; }
  if (instant) pill.classList.add('no-anim');
  pill.style.width = `${cur.offsetWidth}px`;
  pill.style.height = `${cur.offsetHeight}px`;
  pill.style.transform = `translate(${cur.offsetLeft}px, ${cur.offsetTop}px)`;
  pill.style.opacity = '1';
  if (instant) { void pill.offsetWidth; pill.classList.remove('no-anim'); }
}

let navPlaced = false;

function markActiveNav(path) {
  let changed = null;
  for (const a of document.querySelectorAll('.nav a')) {
    const matches = (a.dataset.nav || '').split(' ');
    const on = matches.includes(path);
    if (on && a.getAttribute('aria-current') !== 'page') changed = a;
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  placeNavPill({ instant: !navPlaced });
  navPlaced = true;
  if (changed) pop(changed.querySelector('.ic'), { scale: 1.18 });
}

function storageBanner() {
  if (!store.storageFailed()) return null;
  return el('div', { class: 'banner', role: 'status' }, [
    el('strong', { text: '⚠ Progress will not be saved. ' }),
    'This browser is blocking local storage (private browsing, or site data is '
    + 'turned off). The app works, but your history disappears when you close the tab.',
  ]);
}

let bannerShown = false;

async function render() {
  const { path, params } = parseHash();
  const view = document.getElementById('view') || buildShell();
  markActiveNav(path);
  clear(view);
  // Restart the entrance animation for the new screen.
  view.classList.remove('enter');
  void view.offsetWidth;
  view.classList.add('enter');

  if (!bannerShown) {
    const b = storageBanner();
    if (b) { view.append(b); bannerShown = true; }
  }

  const fn = ROUTES[path];
  if (!fn) {
    view.append(el('div', { class: 'empty' }, [
      el('span', { class: 'ic' }, [icon('empty', { size: 34 })]),
      el('h1', { text: 'Page not found' }),
      el('p', { class: 'muted', text: `Nothing is routed at ${path}.` }),
      el('a', { class: 'btn', href: '#/home', text: 'Back to Study' }),
    ]));
    return;
  }

  await fn(view, { params, navigate });
  animateScreen(view);
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

export function start() {
  document.title = APP_TITLE;
  store.init();
  buildShell();
  applyTheme(store.getSettings().theme);
  paintSound();
  // Browsers start audio only from a user gesture; wake it on the first one.
  for (const type of ['pointerdown', 'keydown', 'touchend']) {
    window.addEventListener(type, () => sound.unlock(), { passive: true, capture: true });
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('resize', () => placeNavPill({ instant: true }));
  // The font can change link sizes after first paint.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeNavPill({ instant: true }));
  // Views ask for a fresh render after changing stored data (import, reset,
  // discard). Reloading the page does not work inside every embedded viewer.
  window.addEventListener('app:refresh', () => {
    applyTheme(store.getSettings().theme);
    paintSound();
    render();
  });
  render();
}

if (typeof window !== 'undefined' && !window.__SECPLUS_TEST__) start();

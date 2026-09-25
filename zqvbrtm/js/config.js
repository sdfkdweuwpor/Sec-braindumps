/**
 * What makes this copy of the app a separate app. Change these three things
 * (plus tools/objectives.py for the exam's domains) and nothing else.
 */

// Every app built from this template needs its own storage namespace.
// localStorage is shared by everything on one origin -- every GitHub Pages
// site under one account is a single origin, and so is a local server -- so
// two apps using the same namespace silently overwrite each other's progress.
// Question ids restart at q0001 in every bank, which would make the mix-up
// invisible: a question would show someone else's history.
export const STORAGE_NAMESPACE = 'zqvbrtm.';

export const APP_TITLE = 'Security+ SY0-701';     // header, browser tab
export const APP_SUBTITLE = 'practice question bank';
export const NAV_TITLE = 'Security+ 701';         // desktop sidebar

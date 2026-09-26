/*
 * Runs before anything paints (a plain script, not a module, so it does not
 * wait for the 2 MB question bank): apply the saved theme, so someone who
 * chose dark never sees the loading screen flash light first. The key is
 * STORAGE_NAMESPACE (js/config.js) + 'settings'.
 */
(function () {
  try {
    var saved = JSON.parse(window.localStorage.getItem('zqvbrtm.settings') || '{}');
    if (saved && saved.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) { /* storage blocked: the default theme it is */ }
}());

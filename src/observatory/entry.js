// Keep existing shared replay/example URLs usable without changing ordinary
// observatory entry. Fragments remain local and are never sent to inference.
const url = new URL(location.href);
const replay = new URLSearchParams(url.hash.slice(1)).has('replay') || url.searchParams.has('replay');
const nav = performance.getEntriesByType('navigation')[0];
const appDelivered = !!nav && 'serverTiming' in nav && nav.serverTiming.some((item) => item.name === 'lifepot-app');
if (appDelivered && (replay || url.hash === '#example')) {
  location.replace('/experiment' + url.search + url.hash);
} else {
  const web = appDelivered;
  document.getElementById('advanced-tools').hidden = !web;
  document.getElementById('offline-tools').hidden = web;
  void import('./client.js');
}

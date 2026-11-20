// Keep existing shared replay/example URLs usable without changing ordinary
// observatory entry. Fragments remain local and are never sent to inference.
const url = new URL(location.href);
const replay = new URLSearchParams(url.hash.slice(1)).has('replay') || url.searchParams.has('replay');
if ((url.protocol === 'http:' || url.protocol === 'https:') && (replay || url.hash === '#example')) {
  location.replace('/experiment' + url.search + url.hash);
} else {
  void import('./client.js');
}

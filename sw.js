// Gym: caché para abrir la app sin conexión. Red primero (versión nueva) y, si falla o tarda, lo guardado.
const CACHE = "gym-offline-32", FONTS = "gym-fonts-1", IMGS = "pelis-img-1";
const PAGES = ["","index.html","icon.svg","CrisTinita/","CrisTinita/index.html","CrisTinita/manifest.json","app.html","gym.html","entreno.html","calendario.html","volumen.html","progreso.html","graficas.html","calorias.html","x.html","importar.html","sincronizar.html","icono-gym.png","icono-entreno.png","icono-vista.png","manifest.json","peliculas.html","tv.html","pelis.html","icono-peliculas.png","series.html","icono-series-4.png","dario.html","salud.html","sobremi.html","registros.html","icono-dario.png","util.html","ocio.html","futbol.html","vida.html"];
const base = new URL("./", self.location).pathname;
const key = p => new Request(new URL(p, self.location.origin).href);
const isPage = u => u.origin === self.location.origin && u.pathname.startsWith(base) && PAGES.includes(u.pathname.slice(base.length));

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(PAGES.map(async p => { const r = await fetch(base + p, { cache: "reload" }); if (r.ok) await c.put(key(base + p), r) }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== FONTS && k !== IMGS) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function redPrimero(req, u) {
  const c = await caches.open(CACHE), k = key(u.pathname);
  const red = fetch(req).then(r => { if (r.ok) c.put(k, r.clone()); return r });
  try {
    return await Promise.race([red, new Promise((_, no) => setTimeout(no, 3500))]);
  } catch (_) {
    return (await c.match(k)) || red;   // sin guardado: espera a la red
  }
}
async function fuente(req) {
  const c = await caches.open(FONTS), g = await c.match(req);
  const red = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r }).catch(() => g);
  return g || red;
}
// Películas: carátulas de TMDB guardadas para verlas sin conexión
async function caratula(req) {
  const c = await caches.open(IMGS), g = await c.match(req);
  if (g) return g;
  const r = await fetch(req);
  if (r.ok || r.type === "opaque") c.put(req, r.clone());
  return r;
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (isPage(u)) e.respondWith(redPrimero(req, u));
  else if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") e.respondWith(fuente(req));
  else if (u.hostname === "image.tmdb.org") e.respondWith(caratula(req));
});

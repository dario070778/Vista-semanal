// futbol-sync: partidos (ESPN) + canales de TV (futbolenlatv.es) -> fila "futbol" de vista_semanal
const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const TOKEN = "fs_7Qm2xK9vLp4Rt8Wz";

const LIGAS: [string, string, boolean][] = [
  ["liga", "esp.1", false],
  ["ucl", "uefa.champions", false],
  ["uel", "uefa.europa", false],
  ["uecl", "uefa.europa.conf", false],
  ["copa", "esp.copa_del_rey", true],
  ["super", "esp.super_cup", true],
];
const TV_PAGES = ["competicion/la-liga", "competicion/liga-campeones", "competicion/europa-league",
  "competicion/uefa-europa-conference-league", "equipo/sevilla-fc"];
const WIN_BACK = 3, WIN_FWD = 21, KEEP_DAYS = 120;

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const isSev = (n: string) => /sevilla/i.test(n) && !/atl[eé]tico/i.test(n);

type Team = { n: string; l?: string };
type M = { id: string; c: string; t: number; h: Team; a: Team; hs?: number; as?: number; st: string; cl?: string; x?: string; tv?: string[]; src?: string };

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Accept-Language": "es-ES,es;q=0.9" };
let ERR: string[] = [];
async function getJson(u: string) {
  try { const r = await fetch(u, { headers: { ...UA, "Accept": "application/json" } }); if (!r.ok) { ERR.push(r.status + " " + u.split("soccer/")[1]); return null; } return await r.json(); } catch (e) { ERR.push("x " + String(e).slice(0, 60)); return null; }
}
const logo = (u?: string) => u ? u.replace("https://a.espncdn.com/i/teamlogos/", "https://a.espncdn.com/combiner/i?img=/i/teamlogos/") + (u.includes("espncdn") ? "&w=64&h=64" : "") : undefined;

async function espnDay(day: string, out: Record<string, M>) {
  await Promise.all(LIGAS.map(async ([c, slug, onlySev]) => {
    const j = await getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${day}`);
    for (const e of (j?.events ?? [])) {
      const comp = e.competitions?.[0]; if (!comp) continue;
      const cs = comp.competitors ?? [];
      const ho = cs.find((x: any) => x.homeAway === "home") ?? cs[0], aw = cs.find((x: any) => x.homeAway === "away") ?? cs[1];
      if (!ho || !aw) continue;
      const hn = ho.team?.shortDisplayName || ho.team?.displayName || "?", an = aw.team?.shortDisplayName || aw.team?.displayName || "?";
      if (onlySev && !isSev(hn) && !isSev(an)) continue;
      const tp = e.status?.type ?? {};
      const m: M = { id: "e" + e.id, c, t: Date.parse(e.date), h: { n: hn, l: logo(ho.team?.logo) }, a: { n: an, l: logo(aw.team?.logo) },
        st: tp.state === "in" ? "in" : tp.state === "post" ? "post" : "pre", src: "espn" };
      if (tp.name === "STATUS_POSTPONED") m.x = "Aplazado";
      else if (tp.name === "STATUS_CANCELED") m.x = "Suspendido";
      else if (tp.name === "STATUS_HALFTIME") m.cl = "Descanso";
      else if (m.st === "in") m.cl = e.status?.displayClock || "";
      if (m.st !== "pre") { m.hs = +ho.score || 0; m.as = +aw.score || 0; }
      if (tp.name === "STATUS_FINAL_PEN" || tp.name === "STATUS_FINAL_AET") m.cl = tp.name.endsWith("PEN") ? "Penaltis" : "Prórroga";
      out[m.id] = m;
    }
  }));
}

// ---- TV (futbolenlatv.es) ----
type TV = { t: number; h: string; a: string; c: string; ch: string[]; hl?: string; al?: string };
const dec = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
function madridToUtc(d: string, hm: string) { // d=dd/mm/yyyy, hm=HH:MM (hora de Madrid)
  const [dd, mm, yy] = d.split("/").map(Number), [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(yy, mm - 1, dd, h, mi);
  const off = (ts: number) => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ts));
    const g = (k: string) => +(p.find(x => x.type === k)?.value ?? 0); return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute")) - ts; };
  return guess - off(guess);
}
function parseTV(html: string): TV[] {
  const out: TV[] = [];
  for (const tb of html.split('<table class="tablaPrincipal').slice(1)) {
    const fecha = tb.match(/cabeceraTabla[^>]*>\s*<td[^>]*>[^,<]*,\s*(\d{2}\/\d{2}\/\d{4})/)?.[1];
    for (const row of tb.split("<tr").slice(1)) {
      if (!row.includes('class="local')) continue;
      const hora = row.match(/class="hora[^"]*"[^>]*>\s*(\d{1,2}:\d{2})/)?.[1];
      const comp = dec(row.match(/contenedorImgCompeticion[\s\S]*?alt="([^"]+)"/)?.[1] ?? "");
      const loc = row.match(/class="local"[\s\S]*?<span title="([^"]+)"/)?.[1];
      const vis = row.match(/class="visitante"[\s\S]*?<span title="([^"]+)"/)?.[1];
      const hl = row.match(/class="local"[\s\S]*?alt-img="([^"]+)"/)?.[1], al = row.match(/class="visitante"[\s\S]*?alt-img="([^"]+)"/)?.[1];
      if (!loc || !vis || !fecha || !hora) continue;
      const lc = row.split('class="listaCanales"')[1] ?? "";
      const ch = [...lc.matchAll(/<li[^>]*title="([^"]+)"/g)].map(x => dec(x[1]))
        .filter(x => !/ver en directo|tv bar/i.test(x)).map(x => x.replace(/:\s*ver partido.*$/i, "").replace(/\s*\(ver gratis\)/i, "").trim());
      out.push({ t: madridToUtc(fecha, hora), h: dec(loc), a: dec(vis), c: comp, ch: [...new Set(ch)], hl, al });
    }
  }
  return out;
}
const STOP = new Set(["fc", "cf", "cd", "rc", "ud", "sd", "sad", "club", "de", "del", "la", "el", "ac", "as", "sc", "ss", "afc", "fk", "sk", "bk", "if", "rcd", "real", "deportivo", "sporting", "athletic", "at", "atletico", "united", "city"]);
const toks = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
const same = (a: string, b: string) => { const A = toks(a), B = toks(b); if (!A.length || !B.length) return a.toLowerCase() === b.toLowerCase(); return A.some(x => B.some(y => x === y || (x.length > 4 && y.length > 4 && (x.startsWith(y) || y.startsWith(x))))); };
function attachTV(ms: Record<string, M>, tv: TV[]) {
  const used = new Set<number>();
  for (const m of Object.values(ms)) {
    if (m.src !== "espn") continue;
    let best = -1, sc = 0;
    tv.forEach((x, i) => { if (Math.abs(x.t - m.t) > 75 * 60e3) return; const s = (same(x.h, m.h.n) ? 1 : 0) + (same(x.a, m.a.n) ? 1 : 0) + (same(x.h, m.a.n) || same(x.a, m.h.n) ? 0.5 : 0); if (s > sc) { sc = s; best = i; } });
    if (best >= 0 && sc >= 1) { m.tv = tv[best].ch; tv.forEach((x, i) => { if (Math.abs(x.t - m.t) <= 75 * 60e3 && same(x.h, m.h.n) && same(x.a, m.a.n)) used.add(i); }); }
    // Mismo partido con la hora aún sin confirmar (otro horario el mismo día)
    tv.forEach((x, i) => { if (Math.abs(x.t - m.t) < 18 * 3600e3 && same(x.h, m.h.n) && same(x.a, m.a.n)) used.add(i); });
  }
  // Partidos del Sevilla que ESPN aún no tiene (más allá de la ventana o Copa sin fecha en ESPN)
  for (const id of Object.keys(ms)) if (ms[id].src === "tv") delete ms[id];
  tv.forEach((x, i) => {
    if (used.has(i) || !(isSev(x.h) || isSev(x.a)) || x.t < Date.now() - 3 * 3600e3) return;
    const c = /liga ea|la liga/i.test(x.c) ? "liga" : /campeones|champions/i.test(x.c) ? "ucl" : /conference/i.test(x.c) ? "uecl" : /europa/i.test(x.c) ? "uel" : /copa del rey/i.test(x.c) ? "copa" : /supercopa/i.test(x.c) ? "super" : "otra";
    const id = "t" + x.t + toks(x.h).join("").slice(0, 8);
    if (ms[id]) return;
    ms[id] = { id, c, x: c === "otra" ? x.c : undefined, t: x.t, h: { n: x.h, l: x.hl }, a: { n: x.a, l: x.al }, st: "pre", tv: x.ch, src: "tv" } as M;
  });
}

Deno.serve(async (req) => {
  const u = new URL(req.url); ERR = [];
  if (u.searchParams.get("t") !== TOKEN) return new Response("no", { status: 401 });
  const r = await fetch(`${URL_}/rest/v1/vista_semanal?id=eq.futbol&select=datos`, { headers: H });
  const rows = await r.json();
  const datos = rows?.[0]?.datos ?? { v: {}, updatedAt: 0 };
  const V = datos.v ?? (datos.v = {});
  V.m = V.m ?? {}; V.tv = V.tv ?? []; V.rot = V.rot ?? 0;

  const now = new Date(), days: string[] = [];
  for (let i = -WIN_BACK; i <= WIN_FWD; i++) days.push(ymd(new Date(now.getTime() + i * 864e5)));
  const mode = u.searchParams.get("mode") ?? "tick";
  let toFetch: string[];
  if (mode === "live") {
    // Solo si hay algún partido en juego (o a punto de empezar): refresca hoy y nada más
    const act = Object.values(V.m as Record<string, M>).some(m => m.src === "espn" && m.st !== "post" && !m.x && m.t < Date.now() + 5 * 60e3 && m.t > Date.now() - 4 * 3600e3);
    if (!act) return new Response("idle");
    toFetch = [ymd(now), ...(now.getUTCHours() < 4 ? [ymd(new Date(now.getTime() - 864e5))] : [])];
  } else if (mode === "range") { const f = +(u.searchParams.get("from") ?? 0), n = +(u.searchParams.get("n") ?? 6); toFetch = days.slice(f, f + n); }
  else {
    const today = ymd(now), yest = ymd(new Date(now.getTime() - 864e5));
    const rot: string[] = []; for (let k = 0; k < 3; k++) rot.push(days[(V.rot + k) % days.length]);
    V.rot = (V.rot + 3) % days.length;
    toFetch = [...new Set([today, ...(now.getUTCHours() < 4 ? [yest] : []), ...rot])];
  }
  // Borra los partidos ESPN de los días que se van a refrescar (por si cambian de fecha)
  const fresh: Record<string, M> = {};
  for (const d of toFetch) await espnDay(d, fresh);
  const dayOf = (t: number) => ymd(new Date(t));
  const fetchedDays = new Set(toFetch);
  if (ERR.length === 0) for (const [id, m] of Object.entries(V.m as Record<string, M>)) if (m.src === "espn" && fetchedDays.has(dayOf(m.t)) && !fresh[id]) delete V.m[id];
  Object.assign(V.m, fresh);

  let tvMsg = "";
  if (mode !== "live" && (mode === "tv" || !V.tvAt || Date.now() - V.tvAt > 6 * 3600e3)) {
    const all: TV[] = [];
    for (const p of TV_PAGES) { try { const h = await (await fetch("https://www.futbolenlatv.es/" + p, { headers: UA })).text(); all.push(...parseTV(h)); } catch { /* sigue */ } }
    // Quita duplicados (el mismo partido sale en la página de la competición y en la del Sevilla)
    const seen = new Map<string, TV>();
    for (const x of all) { const k = x.t + "|" + toks(x.h).join("") + "|" + toks(x.a).join(""); const o = seen.get(k); if (o) o.ch = [...new Set([...o.ch, ...x.ch])]; else seen.set(k, x); }
    all.length = 0; all.push(...seen.values());
    for (const x of all) if (x.ch.length > 1) x.ch = x.ch.filter(c => !/por confirmar/i.test(c));
    if (all.length) { V.tv = all.filter(x => x.t > Date.now() - 2 * 864e5); V.tvAt = Date.now(); tvMsg = ` tv=${V.tv.length}`; }
  }
  attachTV(V.m, V.tv);
  const lim = Date.now() - KEEP_DAYS * 864e5;
  for (const [id, m] of Object.entries(V.m as Record<string, M>)) if (m.t < lim) delete V.m[id];
  V.upd = Date.now(); datos.updatedAt = Date.now();
  const w = await fetch(`${URL_}/rest/v1/vista_semanal`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: "futbol", datos, actualizado_en: new Date().toISOString() }) });
  return new Response(`${w.ok ? "ok" : "error"} ${mode} dias=${toFetch.join(",")} partidos=${Object.keys(V.m).length} nuevos=${Object.keys(fresh).length}${tvMsg}${ERR.length ? " err=" + ERR.slice(0, 3).join("|") : ""}`);
});

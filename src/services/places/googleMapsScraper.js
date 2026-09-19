import { COUNTRY_NAMES, buildTextQuery, normalizePlaceLead, validateFilters } from "./googlePlaces.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:8080";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "LeadFlow/1.0 (+https://github.com/MxSGameJPS/leadflow)";
const geocodeCache = new Map();

function baseUrl() {
  return String(process.env.GOOGLE_MAPS_SCRAPER_URL || process.env.SCRAPER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function scraperHeaders() {
  const headers = { "Content-Type": "application/json", "User-Agent": USER_AGENT };
  const apiKey = process.env.GOOGLE_MAPS_SCRAPER_API_KEY || process.env.SCRAPER_API_KEY;
  if (apiKey) headers["X-API-Key"] = apiKey;
  return headers;
}

function positiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function depthForCount(count) {
  const configured = Number.parseInt(String(process.env.GOOGLE_MAPS_SCRAPER_DEPTH || ""), 10);
  if (Number.isFinite(configured) && configured > 0) return Math.min(20, configured);
  if (count <= 20) return 5;
  if (count <= 40) return 6;
  return 7;
}

function firstEmail(value) {
  const match = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || null;
}

function stableExternalId(row) {
  return row.place_id || row.data_id || row.cid || row.link || [row.title, row.address].filter(Boolean).join("|") || null;
}

export function parseScraperCsv(input = "") {
  const text = String(input || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      field = "";
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some(cell => cell !== "")) rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows.shift().map(header => header.trim());
  return rows.map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

export function normalizeScraperPlace(row, filters) {
  return normalizePlaceLead({
    externalId: stableExternalId(row),
    name: row.title,
    segment: row.category || filters.category,
    city: filters.city,
    location: filters.state,
    address: row.address,
    phone: row.phone,
    email: firstEmail(row.emails),
    site: row.website,
    rating: row.review_rating,
    reviews: row.review_count,
    mapsLink: row.link,
  }, filters, { source: "Google Maps", reasonPrefix: "Encontrado automaticamente no Google Maps via scraper local" });
}

async function geocode(filters, fetchImpl) {
  const cacheKey = (filters.city + "|" + filters.state + "|" + filters.country).toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  const params = new URLSearchParams({
    format: "json",
    limit: "1",
    q: filters.city + ", " + filters.state + ", " + COUNTRY_NAMES[filters.country],
  });
  const response = await fetchImpl(NOMINATIM_ENDPOINT + "?" + params, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível localizar a cidade para a busca (HTTP " + response.status + ").");
  const results = await response.json();
  const first = results?.[0];
  if (!first?.lat || !first?.lon) throw new Error("Não foi possível localizar a cidade informada. Revise cidade e estado/região.");

  const coords = { lat: String(first.lat), lon: String(first.lon) };
  geocodeCache.set(cacheKey, coords);
  return coords;
}

async function scraperFetch(path, options, fetchImpl) {
  try {
    return await fetchImpl(baseUrl() + path, { ...options, headers: { ...scraperHeaders(), ...(options?.headers || {}) }, cache: "no-store" });
  } catch (error) {
    throw new Error("Google Maps Scraper não está acessível em " + baseUrl() + ". Execute npm run scraper:up e tente novamente. Detalhe: " + (error?.message || error));
  }
}

async function responseError(response, label) {
  const body = await response.text().catch(() => "");
  const detail = body.trim().slice(0, 300);
  return label + " respondeu com HTTP " + response.status + (detail ? ": " + detail : ".");
}

async function healthCheck(fetchImpl) {
  const response = await scraperFetch("/api/v1/jobs", { method: "GET" }, fetchImpl);
  if (!response.ok) throw new Error(await responseError(response, "Google Maps Scraper"));
}

async function createJob(filters, coords, fetchImpl) {
  const maxTime = positiveInt(process.env.GOOGLE_MAPS_SCRAPER_MAX_TIME, 600, 60, 1800);
  const radius = positiveInt(process.env.GOOGLE_MAPS_SCRAPER_RADIUS, 10000, 1000, 50000);
  const proxies = String(process.env.GOOGLE_MAPS_SCRAPER_PROXIES || "")
    .split(/[\n,]+/)
    .map(value => value.trim())
    .filter(Boolean);

  const body = {
    name: "leadflow-" + Date.now(),
    keywords: [buildTextQuery(filters)],
    lang: "pt",
    zoom: 15,
    lat: coords.lat,
    lon: coords.lon,
    fast_mode: false,
    radius,
    depth: depthForCount(filters.count),
    email: true,
    max_time: maxTime,
    ...(proxies.length ? { proxies } : {}),
  };

  const response = await scraperFetch("/api/v1/jobs", { method: "POST", body: JSON.stringify(body) }, fetchImpl);
  if (!response.ok) throw new Error(await responseError(response, "Não foi possível criar a busca no Google Maps Scraper"));
  const payload = await response.json();
  if (!payload?.id) throw new Error("O Google Maps Scraper não retornou o ID da busca.");
  return { id: payload.id, maxTime };
}

async function waitForJob(job, fetchImpl, sleepImpl) {
  const pollMs = positiveInt(process.env.GOOGLE_MAPS_SCRAPER_POLL_MS, 2500, 1000, 15000);
  const deadline = Date.now() + (job.maxTime + 30) * 1000;

  while (Date.now() < deadline) {
    const response = await scraperFetch("/api/v1/jobs/" + job.id, { method: "GET" }, fetchImpl);
    if (!response.ok) throw new Error(await responseError(response, "Não foi possível consultar o status da busca"));
    const payload = await response.json();
    const status = String(payload?.Status || payload?.status || "").toLowerCase();
    if (status === "ok") return;
    if (status === "failed") throw new Error("A busca no Google Maps falhou. Reduza a quantidade ou configure proxies se isso estiver acontecendo repetidamente.");
    await sleepImpl(pollMs);
  }

  throw new Error("A busca no Google Maps excedeu o tempo máximo configurado.");
}

async function downloadJob(jobId, fetchImpl) {
  const response = await scraperFetch("/api/v1/jobs/" + jobId + "/download", { method: "GET" }, fetchImpl);
  if (!response.ok) throw new Error(await responseError(response, "Não foi possível baixar os resultados da busca"));
  return response.text();
}

export async function searchGoogleMapsScraper(input, { fetchImpl = fetch, sleepImpl = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const filters = validateFilters(input);
  const query = buildTextQuery(filters);
  await healthCheck(fetchImpl);
  const coords = await geocode(filters, fetchImpl);
  const job = await createJob(filters, coords, fetchImpl);
  await waitForJob(job, fetchImpl, sleepImpl);
  const csv = await downloadJob(job.id, fetchImpl);
  const rows = parseScraperCsv(csv);
  const results = [];
  const seen = new Set();

  for (const row of rows) {
    if (/closed permanently|fechado permanentemente/i.test(String(row.status || ""))) continue;
    const item = normalizeScraperPlace(row, filters);
    const key = item.placeId || (item.name + "|" + (item.address || "")).toLowerCase();
    if (!item.name || seen.has(key)) continue;
    seen.add(key);
    results.push(item);
    if (results.length >= filters.count) break;
  }

  return { results, count: results.length, query, filters, provider: "google_maps_scraper", jobId: job.id };
}

import { createHash } from "node:crypto";

function clean(value, max = 8000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function safeUrl(value) {
  const raw = clean(value, 1600);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sourceFromUrl(source, url) {
  if (source !== "freelance" || !url) return source;
  const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } })();
  if (host.includes("99freelas")) return "99freelas";
  if (host.includes("workana")) return "workana";
  if (host.includes("freelancer")) return "freelancer";
  return source;
}

function fingerprintFor({ source, sourceUrl, author, content, title }) {
  const basis = sourceUrl
    ? `${source}|${sourceUrl}`
    : `${source}|${author}|${title}|${content}`.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").slice(0, 4000);
  return createHash("sha256").update(basis).digest("hex");
}

function rawString(value) {
  try { return JSON.stringify(value).slice(0, 16000); }
  catch { return ""; }
}

export function normalizeRawSignal(raw = {}, context = {}) {
  if (typeof raw === "string") raw = { content: raw };
  const sourceUrl = safeUrl(raw.sourceUrl || raw.url || raw.link || raw.href || raw.permalink);
  const source = sourceFromUrl(context.source || raw.source || "web", sourceUrl);
  const title = clean(raw.title || raw.name || raw.heading || raw.subject, 500);
  const content = clean(
    raw.content || raw.text || raw.description || raw.snippet || raw.body || raw.summary || title,
    12000,
  );
  const authorValue = raw.author?.name || raw.author?.username || raw.author || raw.username || raw.user?.name || raw.user || "";
  const author = clean(authorValue, 300);
  if (!content && !title) return null;

  const signal = {
    source,
    sourceUrl: sourceUrl || null,
    author: author || null,
    title: title || null,
    content: content || title,
    query: clean(context.query || raw.query, 300),
    publishedAt: safeDate(raw.publishedAt || raw.published_at || raw.createdAt || raw.created_at || raw.date || raw.timestamp),
    rawPayload: rawString(raw),
  };
  signal.fingerprint = fingerprintFor(signal);
  return signal;
}

function collectObjects(value, output, depth = 0) {
  if (depth > 7 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, output, depth + 1);
    return;
  }
  if (typeof value !== "object") return;

  const keys = Object.keys(value);
  if (keys.some(key => ["url", "link", "href", "text", "content", "description", "snippet", "title"].includes(key))) {
    output.push(value);
  }
  for (const child of Object.values(value)) collectObjects(child, output, depth + 1);
}

function parseJsonLoose(text) {
  const trimmed = clean(text, 2_000_000);
  if (!trimmed) return null;
  const attempts = [trimmed];
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (fenced !== trimmed) attempts.push(fenced);
  const firstObject = trimmed.indexOf("{");
  const lastObject = trimmed.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) attempts.push(trimmed.slice(firstObject, lastObject + 1));
  const firstArray = trimmed.indexOf("[");
  const lastArray = trimmed.lastIndexOf("]");
  if (firstArray >= 0 && lastArray > firstArray) attempts.push(trimmed.slice(firstArray, lastArray + 1));

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed?.content === "string") {
        const nested = parseJsonLoose(parsed.content);
        if (nested) return nested;
      }
      return parsed;
    } catch {}
  }
  return null;
}

function yamlishBlocks(text) {
  const blocks = String(text || "").split(/\n(?=-\s|\d+[.)]\s)/).map(item => item.trim()).filter(Boolean);
  return blocks.map(block => {
    const pick = key => {
      const match = block.match(new RegExp(`(?:^|\\n)\\s*-?\\s*${key}\\s*:\\s*(.+)`, "i"));
      return match?.[1]?.trim()?.replace(/^['"]|['"]$/g, "") || "";
    };
    return {
      url: pick("url|link|href"),
      title: pick("title|name"),
      author: pick("author,username|user"),
      text: pick("text|content|description|snippet") || block,
      date: pick("date|created_at|published_at|timestamp"),
    };
  });
}

function urlContextBlocks(text) {
  const lines = String(text || "").split(/\r?\n/);
  const results = [];
  const seen = new Set();
  for (let index = 0; index < lines.length; index++) {
    const urls = lines[index].match(/https?:\/\/[^\s<>'"\])}]+/g) || [];
    for (const url of urls) {
      const normalized = url.replace(/[.,;:]+$/, "");
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      const start = Math.max(0, index - 3);
      const end = Math.min(lines.length, index + 5);
      results.push({ url: normalized, content: lines.slice(start, end).join("\n") });
    }
  }
  return results;
}

export function extractSignalsFromCommandOutput(output, context = {}) {
  const rawItems = [];
  const parsed = parseJsonLoose(output);
  if (parsed) collectObjects(parsed, rawItems);
  if (!rawItems.length) rawItems.push(...yamlishBlocks(output));
  if (!rawItems.some(item => item.url || item.link || item.href)) rawItems.push(...urlContextBlocks(output));

  const normalized = rawItems
    .map(item => normalizeRawSignal(item, context))
    .filter(Boolean);
  return dedupeSignals(normalized);
}

export function dedupeSignals(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item?.fingerprint || seen.has(item.fingerprint)) continue;
    seen.add(item.fingerprint);
    result.push(item);
  }
  return result;
}

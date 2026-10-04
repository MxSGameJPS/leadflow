import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";

let initialized = false;

export async function ensureIntentStorage() {
  if (initialized) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS IntentSignal (
      id TEXT NOT NULL PRIMARY KEY,
      fingerprint TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      sourceUrl TEXT,
      author TEXT,
      title TEXT,
      content TEXT NOT NULL,
      query TEXT,
      publishedAt TEXT,
      matchedService TEXT NOT NULL DEFAULT 'unknown',
      intentType TEXT NOT NULL DEFAULT 'other',
      buyerStage TEXT NOT NULL DEFAULT 'unknown',
      intentLevel TEXT NOT NULL DEFAULT 'unknown',
      urgencyScore INTEGER NOT NULL DEFAULT 0,
      fitScore INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 0,
      explicitIntent INTEGER NOT NULL DEFAULT 0,
      intentScore INTEGER NOT NULL DEFAULT 0,
      band TEXT NOT NULL DEFAULT 'low',
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      leadId TEXT,
      rawPayload TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe("CREATE UNIQUE INDEX IF NOT EXISTS IntentSignal_fingerprint_key ON IntentSignal(fingerprint)");
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS IntentSignal_score_idx ON IntentSignal(intentScore DESC)");
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS IntentSignal_status_idx ON IntentSignal(status)");
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS IntentSignal_source_idx ON IntentSignal(source)");
  initialized = true;
}

function mapRow(row) {
  if (!row) return null;
  return {
    ...row,
    urgencyScore: Number(row.urgencyScore || 0),
    fitScore: Number(row.fitScore || 0),
    confidence: Number(row.confidence || 0),
    explicitIntent: Boolean(row.explicitIntent),
    intentScore: Number(row.intentScore || 0),
  };
}

export async function listIntentSignals({ limit = 200, status = "", source = "", service = "", minScore = 0 } = {}) {
  await ensureIntentStorage();
  const clauses = [];
  const params = [];
  if (status) { clauses.push("status = ?"); params.push(String(status)); }
  if (source) { clauses.push("source = ?"); params.push(String(source)); }
  if (service) { clauses.push("matchedService = ?"); params.push(String(service)); }
  if (Number(minScore) > 0) { clauses.push("intentScore >= ?"); params.push(Number(minScore)); }
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM IntentSignal${where} ORDER BY intentScore DESC, COALESCE(publishedAt, createdAt) DESC LIMIT ?`, ...params, safeLimit);
  return rows.map(mapRow);
}

export async function getIntentSignal(id) {
  await ensureIntentStorage();
  const rows = await prisma.$queryRawUnsafe("SELECT * FROM IntentSignal WHERE id = ? LIMIT 1", String(id));
  return mapRow(rows[0]);
}

export async function upsertIntentSignals(items = []) {
  await ensureIntentStorage();
  let added = 0;
  let updated = 0;
  for (const item of items) {
    if (!item?.fingerprint || !item?.content || !item?.source) continue;
    const existing = await prisma.$queryRawUnsafe("SELECT id FROM IntentSignal WHERE fingerprint = ? LIMIT 1", item.fingerprint);
    const id = existing[0]?.id || randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO IntentSignal (
        id,fingerprint,source,sourceUrl,author,title,content,query,publishedAt,matchedService,intentType,buyerStage,intentLevel,
        urgencyScore,fitScore,confidence,explicitIntent,intentScore,band,reason,status,leadId,rawPayload,createdAt,updatedAt
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(fingerprint) DO UPDATE SET
        source=excluded.source,
        sourceUrl=COALESCE(excluded.sourceUrl,IntentSignal.sourceUrl),
        author=COALESCE(excluded.author,IntentSignal.author),
        title=COALESCE(excluded.title,IntentSignal.title),
        content=CASE WHEN length(excluded.content) > length(IntentSignal.content) THEN excluded.content ELSE IntentSignal.content END,
        query=excluded.query,
        publishedAt=COALESCE(excluded.publishedAt,IntentSignal.publishedAt),
        matchedService=excluded.matchedService,
        intentType=excluded.intentType,
        buyerStage=excluded.buyerStage,
        intentLevel=excluded.intentLevel,
        urgencyScore=excluded.urgencyScore,
        fitScore=excluded.fitScore,
        confidence=excluded.confidence,
        explicitIntent=excluded.explicitIntent,
        intentScore=excluded.intentScore,
        band=excluded.band,
        reason=excluded.reason,
        rawPayload=excluded.rawPayload,
        updatedAt=CURRENT_TIMESTAMP
    `,
      id, item.fingerprint, item.source, item.sourceUrl || null, item.author || null, item.title || null, item.content,
      item.query || null, item.publishedAt || null, item.matchedService || "unknown", item.intentType || "other",
      item.buyerStage || "unknown", item.intentLevel || "unknown", Number(item.urgencyScore || 0), Number(item.fitScore || 0),
      Number(item.confidence || 0), item.explicitIntent ? 1 : 0, Number(item.intentScore || 0), item.band || "low",
      item.reason || null, item.status || "new", item.leadId || null, item.rawPayload || null,
      item.createdAt || new Date().toISOString(),
    );
    if (existing.length) updated++; else added++;
  }
  return { added, updated, total: added + updated };
}

export async function setIntentSignalStatus(id, status, leadId = null) {
  await ensureIntentStorage();
  const allowed = new Set(["new", "saved", "dismissed"]);
  const value = allowed.has(status) ? status : "new";
  await prisma.$executeRawUnsafe("UPDATE IntentSignal SET status = ?, leadId = COALESCE(?, leadId), updatedAt = CURRENT_TIMESTAMP WHERE id = ?", value, leadId, String(id));
  return getIntentSignal(id);
}

export async function clearIntentSignals({ dismissedOnly = false } = {}) {
  await ensureIntentStorage();
  const countRows = await prisma.$queryRawUnsafe(dismissedOnly ? "SELECT COUNT(*) AS count FROM IntentSignal WHERE status = 'dismissed'" : "SELECT COUNT(*) AS count FROM IntentSignal");
  if (dismissedOnly) await prisma.$executeRawUnsafe("DELETE FROM IntentSignal WHERE status = 'dismissed'");
  else await prisma.$executeRawUnsafe("DELETE FROM IntentSignal");
  return { count: Number(countRows[0]?.count || 0) };
}

export async function intentStats() {
  await ensureIntentStorage();
  const [totalRows, newRows, hotRows, savedRows] = await Promise.all([
    prisma.$queryRawUnsafe("SELECT COUNT(*) AS count FROM IntentSignal"),
    prisma.$queryRawUnsafe("SELECT COUNT(*) AS count FROM IntentSignal WHERE status = 'new'"),
    prisma.$queryRawUnsafe("SELECT COUNT(*) AS count FROM IntentSignal WHERE status = 'new' AND intentScore >= 85"),
    prisma.$queryRawUnsafe("SELECT COUNT(*) AS count FROM IntentSignal WHERE status = 'saved'"),
  ]);
  return {
    total: Number(totalRows[0]?.count || 0),
    new: Number(newRows[0]?.count || 0),
    hot: Number(hotRows[0]?.count || 0),
    saved: Number(savedRows[0]?.count || 0),
  };
}

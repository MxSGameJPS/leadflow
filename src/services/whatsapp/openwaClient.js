/**
 * OpenWA transport adapter. No WhatsApp sends are performed by this module.
 * Configuration is server-only; never expose API key to client bundles.
 */
function config() {
  const baseUrl = process.env.OPENWA_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.OPENWA_API_KEY?.trim();
  const sessionId = process.env.OPENWA_SESSION_ID?.trim();
  if (!baseUrl || !apiKey || !sessionId) {
    return { configured: false, baseUrl: null, sessionId: null };
  }
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("OPENWA_URL deve utilizar HTTP(S).");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("OPENWA_URL precisa de HTTPS em produção.");
  }
  return { configured: true, baseUrl, apiKey, sessionId };
}
export function isOpenWAConfigured() {
  try { return config().configured; } catch { return false; }
}
export async function getOpenWAStatus() {
  const settings = config();
  if (!settings.configured) return { configured: false, connected: false, message: "Configure OPENWA_URL, OPENWA_API_KEY e OPENWA_SESSION_ID." };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${settings.baseUrl}/api/sessions/${encodeURIComponent(settings.sessionId)}`, {
      headers: { "X-API-Key": settings.apiKey, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { configured: true, connected: false, message: `OpenWA retornou HTTP ${response.status}.` };
    const session = await response.json();
    const state = String(session.status ?? session.data?.status ?? "unknown").toLowerCase();
    return { configured: true, connected: ["connected", "ready", "authenticated"].includes(state), status: state, sessionId: settings.sessionId };
  } catch {
    return { configured: true, connected: false, message: "Não foi possível consultar a sessão OpenWA." };
  } finally { clearTimeout(timeout); }
}

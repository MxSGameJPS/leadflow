import { normalizeChatList, matchChatToLead } from "./chatMatching.js";

const TARGET_LABEL = "Prospecção de Clientes";
function endpoint() {
  const base = process.env.OPENWA_URL?.trim().replace(/\/+$/, "");
  const key = process.env.OPENWA_API_KEY?.trim();
  const session = process.env.OPENWA_SESSION_ID?.trim();
  if (!base || !key || !session) return null;
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol) || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("OpenWA URL inválida.");
  return { base, key, session: encodeURIComponent(session) };
}
async function requestJson(settings, path, signal) {
  const response = await fetch(`${settings.base}/api/sessions/${settings.session}/${path}`, {
    headers: { "X-API-Key": settings.key, Accept: "application/json" }, cache: "no-store", signal,
  });
  if (!response.ok) {
    let reason = "";
    try { const data = await response.json(); reason = String(data.message || data.error || "").slice(0, 160); } catch {}
    throw new Error(`HTTP ${response.status}${reason ? ": " + reason : ""}`);
  }
  return response.json();
}
/**
 * Read-only, strictly label-scoped inbox. Never fall back to all chats:
 * personal chats must not be exposed to the prospecting interface.
 */
export async function loadWhatsAppInbox(leads) {
  let settings;
  try { settings = endpoint(); } catch { return { ready: false, chats: [], message: "Configuração OpenWA inválida." }; }
  if (!settings) return { ready: false, chats: [], message: "Configure o OpenWA para visualizar os leads da etiqueta." };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const payload = await requestJson(settings, "labels", controller.signal);
    const labels = Array.isArray(payload) ? payload : payload?.data ?? [];
    if (!Array.isArray(labels)) return { ready: false, chats: [], message: "Formato de etiquetas inesperado na API OpenWA." };
    const target = labels.find(label => String(label.name || "").trim().toLocaleLowerCase("pt-BR") === TARGET_LABEL.toLocaleLowerCase("pt-BR"));
    if (!target) return { ready: false, chats: [], message: `Etiqueta "${TARGET_LABEL}" não encontrada no OpenWA. Confira o nome no WhatsApp Business.` };
    const raw = await requestJson(settings, `labels/${encodeURIComponent(String(target.id))}/chats`, controller.signal);
    const chats = normalizeChatList(raw).map(chat => {
      const lead = matchChatToLead(chat, leads);
      return { ...chat, leadId: lead?.id ?? null, leadName: lead?.name ?? null, leadStage: lead?.stage ?? null };
    });
    return { ready: true, chats, label: TARGET_LABEL, message: null };
  } catch (error) {
    return { ready: false, chats: [], message: `Não foi possível carregar a etiqueta "${TARGET_LABEL}": ${error.message}. A consulta por etiqueta exige whatsapp-web.js; Baileys pode retornar HTTP 501.` };
  } finally { clearTimeout(timeout); }
}

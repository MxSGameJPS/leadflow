import { normalizeChatList, matchChatToLead } from "./chatMatching.js";

const TARGET_LABEL = process.env.OPENWA_PROSPECTING_LABEL?.trim() || "Prospecção de Cliente";
const ALIASES = ["Prospecção de Cliente", "Prospecção de Clientes"];
function labelKey(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}
export function selectProspectingLabels(labels, wanted = TARGET_LABEL) {
  const exact = labels.filter(label => label.id != null && labelKey(label.name) === labelKey(wanted));
  if (exact.length) return [...new Map(exact.map(label => [String(label.id), label])).values()];
  if (process.env.OPENWA_PROSPECTING_LABEL) return [];
  const aliases = labels.filter(label => label.id != null && ALIASES.some(alias => labelKey(alias) === labelKey(label.name)));
  return [...new Map(aliases.map(label => [String(label.id), label])).values()];
}
// Kept for compatibility with existing consumers.
export function selectProspectingLabel(labels, wanted = TARGET_LABEL) {
  return selectProspectingLabels(labels, wanted)[0] ?? null;
}
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
    const labels = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.labels) ? payload.data.labels : Array.isArray(payload?.labels) ? payload.labels : [];
    if (!Array.isArray(labels)) return { ready: false, chats: [], message: "Formato de etiquetas inesperado na API OpenWA." };
    const targets = selectProspectingLabels(labels);
    if (!targets.length) {
      const available = labels.map(label => String(label.name || "").trim()).filter(Boolean).slice(0, 20);
      return {
        ready: false,
        chats: [],
        message: available.length
          ? `Etiqueta "${TARGET_LABEL}" não encontrada. O OpenWA retornou estas etiquetas: ${available.join(", ")}. Configure OPENWA_PROSPECTING_LABEL conforme o nome listado.`
          : "O OpenWA respondeu à consulta, mas retornou zero etiquetas. Confira se a sessão usa whatsapp-web.js, se o WhatsApp Business sincronizou as etiquetas e se elas aparecem no próprio OpenWA. Não carregaremos conversas pessoais como alternativa.",
      };
    }
    // Query every distinct matching label; never fall back to all chats.
    // Fail closed on any label error to avoid presenting a misleading partial set.
    const results = await Promise.all(targets.map(target =>
      requestJson(settings, `labels/${encodeURIComponent(String(target.id))}/chats`, controller.signal)
    ));
    const uniqueChats = new Map();
    for (const result of results) {
      for (const chat of normalizeChatList(result)) {
        if (!uniqueChats.has(chat.id)) uniqueChats.set(chat.id, chat);
      }
    }
    const chats = [...uniqueChats.values()].map(chat => {
      const lead = matchChatToLead(chat, leads);
      return { ...chat, leadId: lead?.id ?? null, leadName: lead?.name ?? null, leadStage: lead?.stage ?? null };
    });
    return { ready: true, chats, label: TARGET_LABEL, labelCount: targets.length, message: null };
  } catch (error) {
    return { ready: false, chats: [], message: `Não foi possível carregar a etiqueta "${TARGET_LABEL}": ${error.message}. A consulta por etiqueta exige whatsapp-web.js; Baileys pode retornar HTTP 501.` };
  } finally { clearTimeout(timeout); }
}

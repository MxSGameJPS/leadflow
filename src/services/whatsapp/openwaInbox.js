import { normalizeChatList, matchChatToLead } from "./chatMatching.js";

/** Read-only OpenWA inbox discovery, never sends messages. */
export async function loadWhatsAppInbox(leads) {
  const baseUrl = process.env.OPENWA_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.OPENWA_API_KEY?.trim();
  const sessionId = process.env.OPENWA_SESSION_ID?.trim();
  if (!baseUrl || !apiKey || !sessionId) return { ready: false, chats: [], message: "Configure o OpenWA para visualizar as conversas." };
  try {
    const url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("URL inválida");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/chats`, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" }, cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) {
        let detail = "";
        try {
          const errorBody = await response.json();
          const raw = errorBody?.message ?? errorBody?.error ?? "";
          detail = Array.isArray(raw) ? raw.join("; ") : String(raw || "");
        } catch { /* Some gateways return an empty/non-JSON error body. */ }
        const hint = response.status === 400
          ? "Confirme se a sessão está READY no painel OpenWA e se OPENWA_SESSION_ID é o UUID da sessão."
          : response.status === 401 || response.status === 403
            ? "Verifique a chave de API e suas permissões sobre esta sessão."
            : response.status === 404 ? "Verifique se o identificador da sessão existe." : "Verifique a conexão e os logs do OpenWA.";
        const sanitized = detail.replace(/[\r\n]+/g, " ").slice(0, 250);
        return { ready: false, chats: [], message: `OpenWA HTTP ${response.status}. ${sanitized ? sanitized + " — " : ""}${hint}` };
      }
      const payload = await response.json();
      const chats = normalizeChatList(payload).map(chat => {
        const lead = matchChatToLead(chat, leads);
        return { ...chat, leadId: lead?.id ?? null, leadName: lead?.name ?? null, leadStage: lead?.stage ?? null };
      });
      return { ready: true, chats, message: chats.length ? null : "Nenhuma conversa foi retornada na consulta atual." };
    } finally { clearTimeout(timeout); }
  } catch {
    return { ready: false, chats: [], message: "Não foi possível consultar as conversas. Verifique a conexão com OpenWA." };
  }
}

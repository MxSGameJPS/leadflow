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
      if (!response.ok) return { ready: false, chats: [], message: `A leitura das conversas retornou HTTP ${response.status}. Verifique permissões e sessão.` };
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

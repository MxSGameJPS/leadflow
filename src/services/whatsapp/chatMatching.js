/**
 * Normalize Brazilian telephone identifiers for conservative LeadFlow matching.
 * WhatsApp @lid IDs are not telephone numbers and must not be guessed.
 */
export function normalizePhone(value) {
  const raw = String(value ?? "").trim();
  if (!raw || /@lid$/i.test(raw) || /@g.us$/i.test(raw)) return "";
  const digits = raw.replace(/@c\.us$|@s\.whatsapp\.net$/i, "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  return "";
}
export function matchChatToLead(chat, leads) {
  const id = chat.id?._serialized ?? chat.id ?? chat.chatId ?? chat.jid ?? "";
  const number = normalizePhone(id);
  if (!number) return null;
  const matching = leads.filter(lead => [lead.whatsapp, lead.phone].some(phone => normalizePhone(phone) === number));
  // Ambiguous matches are never silently assigned to a lead.
  return matching.length === 1 ? matching[0] : null;
}
export function normalizeChatList(payload) {
  const data = payload?.data ?? payload;
  const array = Array.isArray(data) ? data : data?.chats ?? data?.items ?? data?.results ?? [];
  if (!Array.isArray(array)) return [];
  return array.map(chat => ({
    id: String(chat.id?._serialized ?? chat.id ?? chat.chatId ?? chat.jid ?? ""),
    name: String(chat.name ?? chat.pushname ?? chat.contactName ?? "Conversa sem nome"),
    unreadCount: Number(chat.unreadCount ?? chat.unread_count ?? 0),
    lastMessageAt: chat.timestamp ?? chat.lastMessage?.timestamp ?? null,
    isGroup: Boolean(chat.isGroup || String(chat.id?._serialized ?? chat.id ?? "").endsWith("@g.us")),
  })).filter(chat => chat.id && !chat.isGroup);
}

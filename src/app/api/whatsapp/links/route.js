import { NextResponse } from "next/server";
import { saveManualLink, removeManualLink } from "../../../../services/whatsapp/manualLinks.js";
export const runtime = "nodejs";
function localOnly() { return process.env.NODE_ENV !== "production"; }
export async function POST(request) {
  if (!localOnly()) return NextResponse.json({ error: "Vinculação disponível apenas em ambiente de desenvolvimento local." }, { status: 403 });
  try {
    const { chatId, leadId } = await request.json();
    const sessionId = process.env.OPENWA_SESSION_ID;
    if (!sessionId || typeof chatId !== "string" || chatId.length > 128 || typeof leadId !== "string") return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    if (!/@(lid|c\.us|s\.whatsapp\.net)$/.test(chatId)) return NextResponse.json({ error: "Identificador de conversa inválido." }, { status: 400 });
    const link = await saveManualLink({ sessionId, chatId, leadId });
    return NextResponse.json({ link });
  } catch (error) { return NextResponse.json({ error: error.message || "Falha ao vincular." }, { status: 400 }); }
}
export async function DELETE(request) {
  if (!localOnly()) return NextResponse.json({ error: "Vinculação disponível apenas em ambiente de desenvolvimento local." }, { status: 403 });
  try {
    const { chatId } = await request.json();
    const sessionId = process.env.OPENWA_SESSION_ID;
    if (!sessionId || typeof chatId !== "string" || chatId.length > 128) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    await removeManualLink(sessionId, chatId);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Falha ao desfazer o vínculo." }, { status: 400 }); }
}

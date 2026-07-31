import fs from "node:fs/promises";
import path from "node:path";
import { CONSULTING_STAGE_IDS } from "../consulting/stages.js";

const WORKSPACE_DIR = path.join(process.cwd(), "data", "lead-workspaces");

const DEFAULT_WORKSPACE = Object.freeze({
  callScript: "",
  whatsappMessage: "",
  previewUrl: "",
  appointment: {
    type: "Reunião",
    time: "09:00",
    notes: "",
    status: "pending",
  },
  sale: {
    paymentTerms: "",
    meetingNotes: "",
    outcome: "open",
    projectValue: 0,
    paymentMethod: "Pix",
    installments: 1,
    paidInstallments: 0,
    amountPaid: 0,
    firstDueDate: "",
    paymentStatus: "pending",
  },
  consulting: {
    stage: "novo",
    status: "pending",
    websiteUrl: "",
    instagramUrl: "",
    instagramNotes: "",
    auditSnapshot: "",
    overallScore: 0,
    executiveSummary: "",
    report: "",
    whatsappMessage: "",
    priceCents: 5000,
    paymentStatus: "pending",
    soldAt: "",
    deliveredAt: "",
    lastAnalyzedAt: "",
    providerId: "",
    providerName: "",
    model: "",
    warning: "",
  },
});

function safeLeadId(value) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{4,160}$/.test(id)) throw new Error("Identificador do lead inválido.");
  return id;
}

function cleanText(value, max = 6000) {
  return String(value ?? "").replace(/\u0000/g, "").slice(0, max);
}

function cleanUrl(value) {
  const raw = cleanText(value, 1000).trim();
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function cleanInteger(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number.parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanDate(value) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function cleanTimestamp(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizeWorkspace(input = {}) {
  const appointment = input.appointment && typeof input.appointment === "object" ? input.appointment : {};
  const sale = input.sale && typeof input.sale === "object" ? input.sale : {};
  const consulting = input.consulting && typeof input.consulting === "object" ? input.consulting : {};
  const installments = cleanInteger(sale.installments, DEFAULT_WORKSPACE.sale.installments, 1, 120);
  const paidInstallments = cleanInteger(sale.paidInstallments, DEFAULT_WORKSPACE.sale.paidInstallments, 0, installments);
  const projectValue = cleanInteger(sale.projectValue, DEFAULT_WORKSPACE.sale.projectValue, 0);
  const amountPaid = cleanInteger(sale.amountPaid, DEFAULT_WORKSPACE.sale.amountPaid, 0, projectValue || Number.MAX_SAFE_INTEGER);

  return {
    callScript: cleanText(input.callScript),
    whatsappMessage: cleanText(input.whatsappMessage),
    previewUrl: cleanUrl(input.previewUrl),
    appointment: {
      type: cleanText(appointment.type || DEFAULT_WORKSPACE.appointment.type, 80),
      time: /^\d{2}:\d{2}$/.test(String(appointment.time || "")) ? String(appointment.time) : DEFAULT_WORKSPACE.appointment.time,
      notes: cleanText(appointment.notes, 2000),
      status: ["pending", "completed", "cancelled"].includes(appointment.status) ? appointment.status : DEFAULT_WORKSPACE.appointment.status,
    },
    sale: {
      paymentTerms: cleanText(sale.paymentTerms, 1000),
      meetingNotes: cleanText(sale.meetingNotes, 5000),
      outcome: ["open", "won", "lost"].includes(sale.outcome) ? sale.outcome : "open",
      projectValue,
      paymentMethod: cleanText(sale.paymentMethod || DEFAULT_WORKSPACE.sale.paymentMethod, 80),
      installments,
      paidInstallments,
      amountPaid,
      firstDueDate: cleanDate(sale.firstDueDate),
      paymentStatus: ["pending", "partial", "paid", "overdue"].includes(sale.paymentStatus) ? sale.paymentStatus : DEFAULT_WORKSPACE.sale.paymentStatus,
    },
    consulting: {
      stage: CONSULTING_STAGE_IDS.includes(consulting.stage) ? consulting.stage : DEFAULT_WORKSPACE.consulting.stage,
      status: ["pending", "ready", "reviewed", "sent", "sold", "delivered"].includes(consulting.status) ? consulting.status : DEFAULT_WORKSPACE.consulting.status,
      websiteUrl: cleanUrl(consulting.websiteUrl),
      instagramUrl: cleanUrl(consulting.instagramUrl),
      instagramNotes: cleanText(consulting.instagramNotes, 6000),
      auditSnapshot: cleanText(consulting.auditSnapshot, 40_000),
      overallScore: cleanInteger(consulting.overallScore, DEFAULT_WORKSPACE.consulting.overallScore, 0, 100),
      executiveSummary: cleanText(consulting.executiveSummary, 5000),
      report: cleanText(consulting.report, 35_000),
      whatsappMessage: cleanText(consulting.whatsappMessage, 5000),
      priceCents: cleanInteger(consulting.priceCents, DEFAULT_WORKSPACE.consulting.priceCents, 0, 10_000_000),
      paymentStatus: ["pending", "paid", "refunded"].includes(consulting.paymentStatus) ? consulting.paymentStatus : DEFAULT_WORKSPACE.consulting.paymentStatus,
      soldAt: cleanTimestamp(consulting.soldAt),
      deliveredAt: cleanTimestamp(consulting.deliveredAt),
      lastAnalyzedAt: cleanTimestamp(consulting.lastAnalyzedAt),
      providerId: cleanText(consulting.providerId, 180),
      providerName: cleanText(consulting.providerName, 180),
      model: cleanText(consulting.model, 180),
      warning: cleanText(consulting.warning, 1200),
    },
    updatedAt: input.updatedAt || null,
  };
}

function fileForLead(leadId) {
  return path.join(WORKSPACE_DIR, `${safeLeadId(leadId)}.json`);
}

export async function getLeadWorkspace(leadId) {
  try {
    const raw = await fs.readFile(fileForLead(leadId), "utf8");
    return normalizeWorkspace(JSON.parse(raw));
  } catch (error) {
    if (error?.code === "ENOENT") return normalizeWorkspace(DEFAULT_WORKSPACE);
    if (error instanceof SyntaxError) return normalizeWorkspace(DEFAULT_WORKSPACE);
    throw error;
  }
}

export async function saveLeadWorkspace(leadId, patch = {}) {
  const id = safeLeadId(leadId);
  const current = await getLeadWorkspace(id);
  const merged = normalizeWorkspace({
    ...current,
    ...patch,
    appointment: { ...current.appointment, ...(patch.appointment || {}) },
    sale: { ...current.sale, ...(patch.sale || {}) },
    consulting: { ...current.consulting, ...(patch.consulting || {}) },
    updatedAt: new Date().toISOString(),
  });

  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  const target = fileForLead(id);
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(merged, null, 2), "utf8");
  await fs.rename(temporary, target);
  return merged;
}

export async function listLeadWorkspaces() {
  try {
    const names = await fs.readdir(WORKSPACE_DIR);
    const items = await Promise.all(names.filter(name => name.endsWith(".json")).map(async name => {
      const leadId = name.slice(0, -5);
      return { leadId, workspace: await getLeadWorkspace(leadId) };
    }));
    return items;
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

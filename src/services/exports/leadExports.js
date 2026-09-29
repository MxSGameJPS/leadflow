function clean(value, max = 5000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function safeDate(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const valid = Number.isNaN(value.getTime()) ? new Date() : value;
  return valid.toISOString().slice(0, 10);
}

function slug(value) {
  return clean(value, 120)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "leads";
}

function exportedLead(lead = {}) {
  return {
    id: clean(lead.id || lead.externalId, 180),
    name: clean(lead.name, 240),
    segment: clean(lead.segment, 180),
    city: clean(lead.city, 180),
    location: clean(lead.location, 180),
    address: clean(lead.address, 700),
    phone: clean(lead.phone, 100),
    whatsapp: clean(lead.whatsapp, 100),
    email: clean(lead.email, 320),
    instagram: clean(lead.instagram, 800),
    site: clean(lead.site, 800),
    googleRating: clean(lead.googleRating, 40),
    googleReviews: clean(lead.googleReviews, 40),
    score: Number(lead.score || 0),
    grade: clean(lead.grade, 8),
    stage: clean(lead.stage, 80),
    problem: clean(lead.problem, 1200),
    offer: clean(lead.offer, 1200),
    mapsLink: clean(lead.mapsLink, 1000),
    notes: clean(lead.notes, 3000),
  };
}

export function buildLeadsJson(leads = []) {
  const list = Array.isArray(leads) ? leads : [];
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: list.length,
    leads: list.map(exportedLead),
  }, null, 2);
}

function vcardEscape(value) {
  return clean(value, 2000)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function normalizedPhone(value) {
  const raw = clean(value, 100);
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  else if ((digits.length !== 12 && digits.length !== 13) || !digits.startsWith("55")) return "";
  return digits ? "+" + digits : "";
}

export function buildLeadsVCard(leads = []) {
  const list = Array.isArray(leads) ? leads : [];
  return list.filter(lead => clean(lead?.name)).map(lead => {
    const phone = normalizedPhone(lead.whatsapp || lead.phone);
    const website = clean(lead.site || lead.instagram, 800);
    const note = [
      lead.segment ? "Segmento: " + clean(lead.segment, 180) : "",
      lead.grade ? "Qualificação: " + clean(lead.grade, 20) + " · score " + Number(lead.score || 0) : "",
      lead.googleRating ? "Google: " + clean(lead.googleRating, 20) + "★" + (lead.googleReviews ? " · " + clean(lead.googleReviews, 40) + " avaliações" : "") : "",
      lead.problem ? clean(lead.problem, 700) : "",
    ].filter(Boolean).join(" | ");
    const rows = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:" + vcardEscape(lead.name),
      lead.segment ? "ORG:" + vcardEscape(lead.name) : "",
      phone ? "TEL;TYPE=CELL:" + phone : "",
      lead.email ? "EMAIL;TYPE=INTERNET:" + vcardEscape(lead.email) : "",
      website ? "URL:" + vcardEscape(website) : "",
      lead.address ? "ADR;TYPE=WORK:;;" + vcardEscape(lead.address) + ";" + vcardEscape(lead.city || "") + ";" + vcardEscape(lead.location || "") + ";;;": "",
      note ? "NOTE:" + vcardEscape(note) : "",
      "END:VCARD",
    ].filter(Boolean);
    return rows.join("\r\n");
  }).join("\r\n");
}

export function leadExportFilename(format = "json", scope = "base", date = new Date()) {
  const ext = format === "vcf" ? "vcf" : "json";
  return "leadflow_" + slug(scope) + "_" + safeDate(date) + "." + ext;
}

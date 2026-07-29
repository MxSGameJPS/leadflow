import * as repo from "../src/repositories/leadRepository.js";
import { prisma } from "../src/lib/prisma.js";

let pass = 0, fail = 0;
const t = (n, c) => { if (c) pass++; else { fail++; console.error("FAIL:", n); } };

await repo.clearAll();
t("clear -> 0", (await repo.stats()).total === 0);

const a = await repo.createLead({ id: "test_a", name: "Alpha Pizzaria", source: "Google Maps", grade: "A", score: 80, whatsapp: "5547999990001", weakSite: true, city: "Dois Irmãos" });
t("create id", !!a.id);
t("create stage novo (default)", a.stage === "novo");

t("moveStage contatado", (await repo.moveStage(a.id, "contatado")).stage === "contatado");
t("setFollowUp", (await repo.setFollowUp(a.id, "2026-01-01")).followUpAt === "2026-01-01");
t("setProposalValue", (await repo.setProposalValue(a.id, 2500)).proposalValue === 2500);
t("setLanding done", (await repo.setLanding(a.id, "done")).landingStatus === "done");

const inc = [
  { id: "test_b", name: "Beta Bar", source: "Google Maps", grade: "B", score: 60, whatsapp: "5547999990002", weakSite: true },
  { id: "test_a2", name: "Alpha Pizzaria", whatsapp: "5547999990001", source: "Google Maps", grade: "A", score: 85, weakSite: true, city: "Dois Irmãos" },
];
const r1 = await repo.importLeads(inc);
t("import added 1 (Beta)", r1.added === 1);
t("import updated 1 (Alpha dedupe)", r1.updated === 1);
t("total 2", (await repo.stats()).total === 2);

const r2 = await repo.importLeads(inc);
t("reimport added 0", r2.added === 0);
t("reimport updated 2", r2.updated === 2);

const alpha = (await repo.listLeads()).find(l => l.name === "Alpha Pizzaria");
t("preserva stage apos import", alpha.stage === "contatado");
t("preserva valor apos import", alpha.proposalValue === 2500);

const st = await repo.stats();
t("stats withWhatsapp 2", st.withWhatsapp === 2);
t("stats total 2", st.total === 2);

await repo.deleteLead(alpha.id);
t("delete -> 1", (await repo.stats()).total === 1);

await repo.clearAll();
t("cleanup -> 0", (await repo.stats()).total === 0);

console.log("\n" + pass + " passaram, " + fail + " falharam");
await prisma.$disconnect();
process.exit(fail ? 1 : 0);

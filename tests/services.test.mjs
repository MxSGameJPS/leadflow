import { gradeFromScore, autoScore, waNorm } from "../src/services/leads/scoring.js";
import { recommend, defaultLanding } from "../src/services/leads/recommend.js";
import { buildMessages, waFor, msgKindForStage } from "../src/services/leads/messages.js";
import { regionFromPhone, cityFromText } from "../src/services/leads/location.js";
import { STAGES, NEXT } from "../src/services/leads/stages.js";
import { parseLeads } from "../src/services/imports/parseLeads.js";

let pass = 0, fail = 0;
function t(name, cond) { if (cond) pass++; else { fail++; console.error("FAIL:", name); } }

t("gradeFromScore 75=A", gradeFromScore(75) === "A");
t("gradeFromScore 55=B", gradeFromScore(55) === "B");
t("gradeFromScore 40=C", gradeFromScore(40) === "C");
t("gradeFromScore 10=D", gradeFromScore(10) === "D");
t("waNorm 47 -> 13 digitos", waNorm("(47) 99885-5512") === "5547998855512");
t("waNorm curto -> null", waNorm("123") === null);
t("regionFromPhone 47 -> Joinville", /Joinville/.test(regionFromPhone("+5547999065600")));
t("cityFromText joinville", cityFromText("loja em Joinville SC") === "Joinville/SC");
t("STAGES tem 9 colunas", STAGES.length === 9);
t("NEXT com_resposta -> proposta", NEXT.com_resposta === "proposta");
t("msgKind rejeitada = recovery", msgKindForStage("proposta_rejeitada") === "recovery");
t("msgKind sem_resposta = followup", msgKindForStage("sem_resposta") === "followup");

const lg = { source: "Google Maps", name: "San Giovanni", grade: "A", segment: "Pizzaria", weakSite: true, googleRating: "4.7", googleReviews: "141", city: "Dois Irmãos", whatsapp: "5551999999999", offer: "Site institucional + cardápio digital" };
t("recommend A maps = landing", recommend(lg).type === "landing");
t("defaultLanding = todo", defaultLanding(lg) === "todo");
const m = buildMessages(lg);
t("msg initial cita nome", m.initial.includes("San Giovanni"));
t("msg initial tem 4.7 estrela", m.initial.includes("4.7★"));
t("waFor codifica wa.me", waFor(lg, "initial").startsWith("https://wa.me/5551999999999?text="));

const csv = "Nome da empresa,Segmento,Telefone,Nota no Google\nBar do Ze,Bar,(47) 99999-9999,4.5\n";
const parsed = parseLeads(csv, "x.csv");
t("parseLeads 1 lead", parsed.length === 1);
t("parsed nome", parsed[0].name === "Bar do Ze");
t("parsed whatsapp", parsed[0].whatsapp === "5547999999999");
t("parsed location por DDD", /DDD 47|Joinville/.test(parsed[0].location));
t("parsed grade calculado", ["A", "B", "C", "D"].includes(parsed[0].grade));

console.log("\n" + pass + " passaram, " + fail + " falharam");
process.exit(fail ? 1 : 0);

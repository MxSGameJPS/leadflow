import { inspectWebsiteHtml } from "../src/services/consulting/siteAuditService.js";
import {
  buildConsultingAuditPrompt,
  parseConsultingAuditResponse,
} from "../src/services/ai/consultingAuditService.js";

let pass = 0;
let fail = 0;

function test(name, condition) {
  if (condition) pass++;
  else {
    fail++;
    console.error("FAIL:", name);
  }
}

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <title>Restaurante Exemplo em Dois Irmãos</title>
  <meta name="description" content="Conheça nosso restaurante, cardápio e opções de reservas em Dois Irmãos.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://exemplo.com.br/">
  <script type="application/ld+json">{"@type":"Restaurant"}</script>
</head>
<body>
  <h1>Restaurante Exemplo</h1>
  <h2>Cardápio e reservas</h2>
  <a href="https://wa.me/5551999999999">Fale conosco no WhatsApp</a>
  <a href="https://instagram.com/exemplo">Instagram</a>
  <form><input name="nome"></form>
  <img src="foto.jpg" alt="Prato do restaurante">
</body>
</html>`;

const audit = inspectWebsiteHtml({
  html,
  url: "https://exemplo.com.br",
  status: 200,
  responseTimeMs: 450,
  contentType: "text/html",
});

test("calcula score técnico", audit.score >= 70);
test("identifica título", audit.title.includes("Restaurante Exemplo"));
test("identifica meta description", audit.metaDescription.includes("restaurante"));
test("identifica configuração mobile", audit.hasViewport === true);
test("identifica WhatsApp", audit.hasWhatsapp === true);
test("identifica chamada para ação", audit.ctas.length > 0);
test("identifica dados estruturados", audit.hasStructuredData === true);
test("identifica cobertura de alt", audit.imageAltCoverage === 1);

const prompt = buildConsultingAuditPrompt({
  lead: { name: "Restaurante Exemplo", segment: "Restaurante", grade: "C", score: 35 },
  profile: { name: "Saulo", profession: "Engenheiro de software" },
  websiteAudit: audit,
  instagramUrl: "https://instagram.com/exemplo",
  instagramNotes: "Bio informa endereço, mas não possui chamada clara para reservas.",
  priceCents: 5000,
});

test("prompt inclui empresa", prompt.prompt.includes("Restaurante Exemplo"));
test("prompt impede invenções", prompt.systemPrompt.includes("Não invente"));
test("prompt inclui preço", prompt.prompt.includes("R$ 50,00") || prompt.prompt.includes("R$ 50,00"));
test("prompt limita análise do Instagram", prompt.prompt.includes("Não afirme que visualizou"));
test("mensagem vem antes do relatório", prompt.prompt.indexOf("[[MENSAGEM_WHATSAPP]]") < prompt.prompt.indexOf("[[RELATORIO]]"));

const validJson = parseConsultingAuditResponse(JSON.stringify({
  overallScore: 78,
  executiveSummary: "Resumo válido.",
  report: "Relatório válido.",
  whatsappMessage: "Mensagem válida.",
}));
test("aceita JSON válido legado", validJson.overallScore === 78 && validJson.report === "Relatório válido.");

const fencedJson = parseConsultingAuditResponse(`\`\`\`json
{"overallScore":81,"executiveSummary":"Resumo","report":"Relatório","whatsappMessage":"Olá"}
\`\`\``);
test("aceita JSON dentro de markdown", fencedJson.overallScore === 81 && fencedJson.whatsappMessage === "Olá");

const marked = parseConsultingAuditResponse(`[[SCORE]]
74
[[RESUMO]]
Resumo da análise.
[[MENSAGEM_WHATSAPP]]
Olá, preparei uma análise.
[[RELATORIO]]
1. DIAGNÓSTICO
Relatório completo.
[[FIM]]`);
test("interpreta resposta delimitada", marked.overallScore === 74 && marked.report.includes("Relatório completo"));
test("resposta completa não é marcada como recuperada", marked.recovered === false);

const truncatedMarkers = parseConsultingAuditResponse(`[[SCORE]]
66
[[RESUMO]]
Resumo parcial.
[[MENSAGEM_WHATSAPP]]
Mensagem preservada.
[[RELATORIO]]
Relatório interrompido pelo limite de tokens`);
test("aproveita resposta delimitada truncada", truncatedMarkers.report.includes("interrompido") && truncatedMarkers.whatsappMessage === "Mensagem preservada.");
test("identifica recuperação de resposta truncada", truncatedMarkers.recovered === true);

const truncatedJson = parseConsultingAuditResponse(`{"overallScore":59,"executiveSummary":"Resumo","report":"Linha 1\\nLinha 2 sem fechamento`);
test("recupera relatório de JSON truncado", truncatedJson.overallScore === 59 && truncatedJson.report.includes("Linha 2"));

console.log("\n" + pass + " passaram, " + fail + " falharam");
process.exit(fail ? 1 : 0);

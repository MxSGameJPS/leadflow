import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const testData = path.resolve(here, "../data/ai-test");
if (existsSync(testData)) rmSync(testData, { recursive: true, force: true });
process.env.LEADFLOW_DATA_DIR = testData;

const {
  generateWithDefaultProvider,
  generateResilientWithDefaultProvider,
  getDefaultProviderInternal,
  getProviderInternal,
  listProviderModels,
  listProvidersPublic,
  removeProvider,
  upsertProvider,
} = await import("../src/services/ai/providerService.js");
const {
  buildLeadMessagePrompt,
  generateLeadMessage,
} = await import("../src/services/ai/leadMessageService.js");
const {
  buildObjectionAdvisorPrompt,
  analyzeLeadConversation,
} = await import("../src/services/ai/objectionAdvisorService.js");
const { buildLeadOutreachPrompt } = await import("../src/services/ai/leadOutreachService.js");
const { buildSalesIntelPrompt } = await import("../src/services/ai/salesIntelService.js");
const { buildQualificationCopilotPrompt } = await import("../src/services/ai/qualificationCopilotService.js");

let pass = 0, fail = 0;
const t = (name, condition) => {
  if (condition) pass++;
  else { fail++; console.error("FAIL:", name); }
};

const originalFetch = global.fetch;
const requests = [];
global.fetch = async (url, options = {}) => {
  const request = {
    url: String(url),
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body ? JSON.parse(options.body) : null,
  };
  requests.push(request);

  if (request.body?.model === "site-fail") {
    return new Response(JSON.stringify({ error: { message: "site route unavailable" } }), { status: 503, headers: { "Content-Type": "application/json" } });
  }

  if (request.url.endsWith("/models")) {
    return new Response(JSON.stringify({
      data: [{ id: "auto/reasoning:free" }, { id: "modelo-teste" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({
    choices: [{ message: { content: "Oi! Esta é uma mensagem gerada para teste." } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

try {
  const created = await upsertProvider({
    name: "OmniRoute local",
    type: "openai-compatible",
    baseUrl: "http://localhost:20128/v1",
    endpoint: "/chat/completions",
    model: "",
    apiKey: "sk-chave-super-secreta",
    enabled: true,
    isDefault: false,
    headersJson: "{}",
  });

  t("cria provedor sem exigir modelo", Boolean(created.id));
  t("primeiro provedor ativo vira padrão", created.isDefault === true);
  t("não devolve apiKey", !("apiKey" in created));
  t("informa chave mascarada", created.apiKeyMasked.includes("••"));

  const models = await listProviderModels(created.id);
  t("consulta modelos no endpoint OpenAI", requests.at(-1).url === "http://localhost:20128/v1/models");
  t("lista modelos do OmniRoute", models.includes("auto/reasoning:free"));
  t("envia Bearer na consulta", requests.at(-1).headers.Authorization === "Bearer sk-chave-super-secreta");

  const publicList = await listProvidersPublic();
  t("lista um provedor", publicList.length === 1);
  t("lista não expõe chave", !("apiKey" in publicList[0]));
  t("marca como padrão", publicList[0].isDefault === true);

  const internal = await getProviderInternal(created.id);
  t("arquivo criptografado preserva chave", internal.apiKey === "sk-chave-super-secreta");

  await upsertProvider({ ...publicList[0], apiKey: "", name: "OmniRoute atualizado", model: "auto/reasoning:free" });
  const updated = await getProviderInternal(created.id);
  t("atualiza nome", updated.name === "OmniRoute atualizado");
  t("campo vazio mantém chave", updated.apiKey === "sk-chave-super-secreta");
  t("salva modelo escolhido", updated.model === "auto/reasoning:free");

  const defaultProvider = await getDefaultProviderInternal();
  t("resolve provedor padrão", defaultProvider.id === created.id);

  const generation = await generateWithDefaultProvider({
    systemPrompt: "Instrução do sistema",
    prompt: "Mensagem do usuário",
  });
  const generationRequest = requests.at(-1);
  t("gera pelo chat completions", generationRequest.url === "http://localhost:20128/v1/chat/completions");
  t("envia modelo escolhido", generationRequest.body.model === "auto/reasoning:free");
  t("envia system e user", generationRequest.body.messages[0].role === "system" && generationRequest.body.messages[1].role === "user");
  t("retorna metadados do provedor", generation.providerName === "OmniRoute atualizado");

  const roleGeneration = await generateWithDefaultProvider({
    systemPrompt: "Diretor de criação",
    prompt: "Crie algo único",
    model: "modelo-premium-codegen",
    temperature: 0.72,
    maxTokens: 12000,
    timeoutMs: 180000,
    retries: 1,
  });
  const roleRequest = requests.at(-1);
  t("aceita override de modelo por tarefa", roleRequest.body.model === "modelo-premium-codegen");
  t("aceita override de temperatura", roleRequest.body.temperature === 0.72);
  t("aceita override de max tokens", roleRequest.body.max_tokens === 12000);
  t("retorna modelo efetivamente usado", roleGeneration.model === "modelo-premium-codegen");

  const secondary = await upsertProvider({
    name: "Fallback geral",
    type: "openai-compatible",
    baseUrl: "http://localhost:29999/v1",
    endpoint: "/chat/completions",
    model: "general-fallback",
    apiKey: "secondary-key",
    enabled: true,
    isDefault: false,
    headersJson: "{}",
  });
  const beforeIsolated = requests.length;
  let isolatedError = null;
  try {
    await generateResilientWithDefaultProvider({
      prompt: "Site isolado",
      model: "site-fail",
      isolatedRouting: true,
      disableTools: true,
      timeoutMs: 5000,
    });
  } catch (error) {
    isolatedError = error;
  }
  const isolatedRequests = requests.slice(beforeIsolated);
  t("rota isolada falha sem escapar para provedor geral", Boolean(isolatedError) && isolatedRequests.length === 1);
  t("rota isolada não usa modelo do provedor secundário", !isolatedRequests.some(item => item.body?.model === "general-fallback"));
  await removeProvider(secondary.id);

  const prompt = buildLeadMessagePrompt({
    kind: "initial",
    lead: { name: "Mercado Silva", segment: "Mercado", city: "Dois Irmãos", problem: "Não possui site próprio" },
    currentMessage: "Mensagem antiga",
  });
  t("prompt contém lead", prompt.prompt.includes("Mercado Silva"));
  t("prompt exige fatos reais", prompt.systemPrompt.includes("Não invente"));

  const lastAttemptPrompt = buildLeadMessagePrompt({
    kind: "last_attempt",
    lead: { name: "Mercado Silva", segment: "Mercado", city: "Dois Irmãos" },
    currentMessage: "Vou encerrar o contato por aqui.",
  });
  t("prompt aceita última tentativa", lastAttemptPrompt.kind === "last_attempt");
  t("última tentativa considera duas mensagens sem resposta", lastAttemptPrompt.prompt.includes("duas mensagens já foram enviadas"));
  t("última tentativa evita pressão", lastAttemptPrompt.prompt.includes("não gere culpa") && lastAttemptPrompt.prompt.includes("não haverá nova insistência"));

  const callPrompt = buildLeadMessagePrompt({
    kind: "call",
    lead: { name: "Mercado Silva", segment: "Mercado", city: "Dois Irmãos" },
  });
  t("prompt aceita roteiro de ligação", callPrompt.kind === "call");
  t("roteiro de ligação pede perguntas abertas", callPrompt.prompt.includes("perguntas abertas"));

  const leadMessage = await generateLeadMessage({
    kind: "followup",
    lead: { name: "Mercado Silva", segment: "Mercado", city: "Dois Irmãos" },
    currentMessage: "Oi, posso mostrar uma ideia?",
  });
  t("gera mensagem para lead", leadMessage.text.includes("mensagem gerada"));
  t("retorna modelo usado", leadMessage.model === "auto/reasoning:free");
  t("prompt de lead foi enviado", requests.at(-1).body.messages[1].content.includes("Mercado Silva"));

  const lastAttemptMessage = await generateLeadMessage({
    kind: "last_attempt",
    lead: { name: "Mercado Silva", segment: "Mercado", city: "Dois Irmãos" },
    currentMessage: "Vou encerrar o contato por aqui.",
  });
  t("gera última tentativa com IA", lastAttemptMessage.text.includes("mensagem gerada"));
  t("envia contexto de última tentativa ao provedor", requests.at(-1).body.messages[1].content.includes("última tentativa após duas mensagens sem resposta"));

  const outreachPrompt = buildLeadOutreachPrompt({
    lead: { name: "Mercado Silva", segment: "Mercado", city: "Dois Irmãos", googleRating: "4.8", googleReviews: "140" },
    profile: { name: "Saulo", profession: "Desenvolvedor" },
    workspace: { previewUrl: "https://preview.example.com" },
  });
  t("pacote multicanal inclui lead e prévia", outreachPrompt.prompt.includes("Mercado Silva") && outreachPrompt.prompt.includes("preview.example.com"));
  t("pacote multicanal proíbe invenções", outreachPrompt.systemPrompt.includes("Não invente"));

  const meetingPrompt = buildSalesIntelPrompt({
    kind: "meeting_prep",
    lead: { name: "Mercado Silva", segment: "Mercado", site: "", weakSite: true, problem: "Não possui site próprio" },
    profile: { name: "Saulo", profession: "Desenvolvedor" },
    workspace: { qualification: { authorityContact: "Carlos", authorityRole: "Proprietário", decisionMaker: true } },
  });
  t("briefing comercial inclui BANT e MEDDIC", meetingPrompt.prompt.includes("QUALIFICAÇÃO CALCULADA") && meetingPrompt.prompt.includes("MEDDIC"));
  t("briefing comercial não permite inventar orçamento", meetingPrompt.systemPrompt.includes("Não invente orçamento"));

  const proposalPrompt = buildSalesIntelPrompt({
    kind: "proposal",
    lead: { name: "Mercado Silva", proposalValue: 1800 },
    profile: { name: "Saulo" },
    workspace: { sale: { paymentTerms: "Entrada + 2 parcelas" }, qualification: {} },
  });
  t("proposta usa valor já registrado", proposalPrompt.prompt.includes("1800") && proposalPrompt.prompt.includes("Entrada + 2 parcelas"));

  const objectionPrompt = buildObjectionAdvisorPrompt({
    lead: { name: "Mercado Silva", segment: "Mercado", proposalValue: 1500 },
    conversation: "CLIENTE: Gostei da prévia, mas achei caro. EU: Entendo.",
    tone: "consultative",
    objective: "understand",
  });
  t("prompt de objeção contém conversa real", objectionPrompt.prompt.includes("achei caro"));
  t("prompt de objeção proíbe inventar condição", objectionPrompt.systemPrompt.includes("Nunca invente preço, desconto"));

  const objectionAnalysis = await analyzeLeadConversation({
    lead: { name: "Mercado Silva", segment: "Mercado" },
    conversation: "CLIENTE: Gostei, mas agora não sei se preciso disso.",
  });
  t("analista aceita fallback textual", objectionAnalysis.response.includes("mensagem gerada"));
  t("analista retorna interesse", objectionAnalysis.interestLevel === "incerto");
  t("analista envia conversa ao provedor", requests.at(-1).body.messages[1].content.includes("não sei se preciso"));

  await removeProvider(created.id);
  t("remove provedor", (await listProvidersPublic()).length === 0);
} finally {
  global.fetch = originalFetch;
  if (existsSync(testData)) rmSync(testData, { recursive: true, force: true });
}

console.log("\n" + pass + " passaram, " + fail + " falharam");
process.exit(fail ? 1 : 0);

const qualificationPrompt=buildQualificationCopilotPrompt({lead:{name:"Padaria Teste",stage:"novo",problem:"usa apenas Facebook"},workspace:{qualification:{budgetStatus:"unknown"},evidenceClaims:[{field:"site",value:"não encontrado",status:"suggested",band:"probable",score:.55,method:"website"}]}});
assert.match(qualificationPrompt.systemPrompt,/nunca invente/i);
assert.match(qualificationPrompt.prompt,/usa apenas Facebook/);
assert.match(qualificationPrompt.prompt,/budgetStatus/);

import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const testData = path.resolve(here, "../data/ai-test");
if (existsSync(testData)) rmSync(testData, { recursive: true, force: true });
process.env.LEADFLOW_DATA_DIR = testData;

const {
  getProviderInternal,
  listProvidersPublic,
  removeProvider,
  upsertProvider,
} = await import("../src/services/ai/providerService.js");

let pass = 0, fail = 0;
const t = (name, condition) => {
  if (condition) pass++;
  else { fail++; console.error("FAIL:", name); }
};

try {
  const created = await upsertProvider({
    name: "API de teste",
    type: "openai-compatible",
    baseUrl: "https://api.example.com/v1",
    endpoint: "/chat/completions",
    model: "modelo-teste",
    apiKey: "sk-chave-super-secreta",
    enabled: true,
    isDefault: true,
    headersJson: "{}",
  });

  t("cria provedor", Boolean(created.id));
  t("não devolve apiKey", !("apiKey" in created));
  t("informa chave mascarada", created.apiKeyMasked.includes("••"));

  const publicList = await listProvidersPublic();
  t("lista um provedor", publicList.length === 1);
  t("lista não expõe chave", !("apiKey" in publicList[0]));
  t("marca como padrão", publicList[0].isDefault === true);

  const internal = await getProviderInternal(created.id);
  t("arquivo criptografado preserva chave", internal.apiKey === "sk-chave-super-secreta");

  await upsertProvider({ ...publicList[0], apiKey: "", name: "API atualizada" });
  const updated = await getProviderInternal(created.id);
  t("atualiza nome", updated.name === "API atualizada");
  t("campo vazio mantém chave", updated.apiKey === "sk-chave-super-secreta");

  await removeProvider(created.id);
  t("remove provedor", (await listProvidersPublic()).length === 0);
} finally {
  if (existsSync(testData)) rmSync(testData, { recursive: true, force: true });
}

console.log("\n" + pass + " passaram, " + fail + " falharam");
process.exit(fail ? 1 : 0);

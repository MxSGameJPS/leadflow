const SERVICE_LABELS = {
  all: "Todos os serviços",
  website: "Sites e landing pages",
  system: "Sistemas sob medida",
  app: "Aplicativos mobile",
  ecommerce: "E-commerce",
  automation: "Automação e integrações",
};

const SOURCE_LABELS = {
  web: "Web aberta",
  freelance: "Plataformas freelance",
  reddit: "Reddit",
  twitter: "X / Twitter",
  facebook: "Facebook",
};

const DEFAULT_QUERIES = {
  website: [
    "preciso de um site",
    "procuro desenvolvedor de site",
    "alguém indica quem faz site",
    "orçamento criação de site",
    "preciso reformular meu site",
    "empresa para criar site profissional",
  ],
  system: [
    "preciso desenvolver um sistema",
    "procuro desenvolvedor de sistema",
    "sistema sob medida para empresa",
    "orçamento sistema web",
    "preciso automatizar minha empresa",
    "sistema para controlar pedidos estoque clientes",
  ],
  app: [
    "preciso criar um aplicativo",
    "procuro desenvolvedor de aplicativo",
    "orçamento aplicativo android ios",
    "empresa para desenvolver app",
    "quero transformar minha ideia em aplicativo",
    "desenvolvimento de app sob medida",
  ],
  ecommerce: [
    "preciso criar uma loja virtual",
    "procuro desenvolvedor ecommerce",
    "orçamento loja online",
    "quero vender pela internet site",
    "preciso de ecommerce para minha empresa",
  ],
  automation: [
    "preciso automatizar processo da empresa",
    "integração whatsapp sistema empresa",
    "automatizar pedidos whatsapp",
    "preciso integrar sistemas da empresa",
    "automação comercial sob medida",
  ],
};

const FREELANCE_DOMAINS = [
  { key: "99freelas", domain: "99freelas.com.br" },
  { key: "workana", domain: "workana.com" },
  { key: "freelancer", domain: "freelancer.com" },
];

export function cleanIntentQuery(value, max = 220) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[&|<>^%!"`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function serviceLabel(service) {
  return SERVICE_LABELS[service] || SERVICE_LABELS.all;
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || String(source || "Fonte");
}

export function intentServiceOptions() {
  return Object.entries(SERVICE_LABELS).map(([value, label]) => ({ value, label }));
}

export function intentSourceOptions() {
  return Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }));
}

export function buildIntentQueries({ service = "all", query = "", maxQueries = 6 } = {}) {
  const explicit = cleanIntentQuery(query);
  if (explicit) return [explicit];

  const limit = Math.max(1, Math.min(12, Number(maxQueries) || 6));
  if (service !== "all" && DEFAULT_QUERIES[service]) {
    return DEFAULT_QUERIES[service].slice(0, limit);
  }

  const balanced = [];
  const buckets = Object.values(DEFAULT_QUERIES);
  for (let index = 0; balanced.length < limit; index++) {
    let added = false;
    for (const bucket of buckets) {
      if (bucket[index] && balanced.length < limit) {
        balanced.push(bucket[index]);
        added = true;
      }
    }
    if (!added) break;
  }
  return balanced;
}

export function buildFreelanceQueries(query) {
  const base = cleanIntentQuery(query);
  if (!base) return [];
  return FREELANCE_DOMAINS.map(item => ({
    source: item.key,
    query: `site:${item.domain} ${base}`,
  }));
}
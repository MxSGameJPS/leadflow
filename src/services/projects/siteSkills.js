const SKILL_DEFINITIONS = [
  {
    id: "creative-web-director",
    label: "Design Premium",
    shortLabel: "Design",
    description: "Direção visual, composição, tipografia, motion e acabamento autoral.",
    systemPrompt: [
      "Atue como Creative Web Director sênior.",
      "Defina uma tese visual clara para o hero, hierarquia deliberada, composição específica ao nicho e um elemento de assinatura memorável.",
      "Evite aparência de template, estética genérica de IA, excesso de cards, gradientes gratuitos, sombras pesadas e decisões visuais intercambiáveis.",
      "Use motion somente para hierarquia, continuidade espacial ou feedback, sempre respeitando prefers-reduced-motion."
    ].join(" ")
  },
  {
    id: "brand-system-architect",
    label: "Branding",
    shortLabel: "Marca",
    description: "Traduz o negócio em paleta, tipografia, linguagem e sistema visual coerente.",
    systemPrompt: [
      "Atue como Brand System Architect.",
      "Transforme os fatos verificados do negócio em uma linguagem visual própria: personalidade, paleta, tipografia, densidade, contraste, tom e assinatura.",
      "Não copie marcas de referência nem invente atributos de marca que não possam ser sustentados pelo contexto.",
      "Mantenha consistência entre headline, cores, tipografia, imagens e microcopy."
    ].join(" ")
  },
  {
    id: "seo-content-engine",
    label: "SEO",
    shortLabel: "SEO",
    description: "Estrutura intenção local, headings, title, meta description e conteúdo encontrável.",
    systemPrompt: [
      "Atue como SEO Content Engine para negócios locais.",
      "Crie title e meta description claros, intenção de busca local natural, headings semanticamente úteis e texto que responda ao que o visitante procura.",
      "Não faça keyword stuffing, não invente localização, serviços ou diferenciais e não sacrifique clareza para repetir palavras-chave.",
      "O H1 deve comunicar a proposta principal da página e o conteúdo deve permanecer humano e persuasivo."
    ].join(" ")
  },
  {
    id: "conversion-director",
    label: "Conversão",
    shortLabel: "Conversão",
    description: "Organiza hero, prova, benefícios e CTAs para reduzir atrito e gerar contato.",
    systemPrompt: [
      "Atue como Conversion Director.",
      "Organize a página para reduzir fricção entre descoberta, confiança e contato.",
      "O CTA principal deve ser inequívoco, coerente com os canais reais disponíveis e repetido somente quando fizer sentido.",
      "Use prova apenas quando existir nos dados fornecidos. Não invente depoimentos, resultados, números, urgência, preços ou garantias."
    ].join(" ")
  },
  {
    id: "screenshot-to-ui-blueprint",
    label: "Referência Visual",
    shortLabel: "Referência",
    description: "Interpreta prints e referências sem copiar marcas, textos ou identidade de terceiros.",
    systemPrompt: [
      "Atue como Screenshot to UI Blueprint.",
      "Quando houver imagens de referência, extraia apenas princípios de composição, hierarquia, ritmo, espaçamento, atmosfera, densidade, proporção e tratamento visual.",
      "Não copie textos, logotipos, identidade proprietária, ilustrações ou elementos distintivos de terceiros.",
      "Reinterprete a referência para a identidade do negócio atual."
    ].join(" ")
  },
  {
    id: "organizacao-padrao-saulo",
    label: "Padrão Saulo",
    shortLabel: "Organização",
    description: "Mantém exportação em JavaScript, sem Tailwind/TypeScript e com estrutura previsível.",
    systemPrompt: [
      "Aplique Organização — Padrão Saulo ao resultado técnico.",
      "Mantenha JavaScript/JSX, não introduza TypeScript ou Tailwind e preserve responsabilidades claras entre conteúdo, componentes, estilos e integrações.",
      "Não adicione dependências sem necessidade e priorize código auditável, responsivo e simples de manter."
    ].join(" ")
  }
];

export const SITE_SKILLS = Object.freeze(SKILL_DEFINITIONS.map(skill => Object.freeze({ ...skill })));
const SKILL_IDS = new Set(SITE_SKILLS.map(skill => skill.id));
const AUTO_CORE = ["creative-web-director", "brand-system-architect", "seo-content-engine", "conversion-director", "organizacao-padrao-saulo"];
const VISUAL_REFERENCE_PATTERN = /(refer[eê]ncia|print|screenshot|imagem|layout|inspir|parecid|visual|interface|ui\b)/i;

function clean(value, max = 5000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

export function normalizeSiteSkillMode(value) {
  return value === "manual" ? "manual" : "auto";
}

export function normalizeSiteSkillIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => clean(item, 80)).filter(item => SKILL_IDS.has(item)))];
}

export function resolveSiteSkills({
  mode = "auto",
  selectedSkills = [],
  instruction = "",
  referenceImages = [],
  phase = "create"
} = {}) {
  const normalizedMode = normalizeSiteSkillMode(mode);
  if (normalizedMode === "manual") {
    const skills = normalizeSiteSkillIds(selectedSkills);
    return {
      mode: normalizedMode,
      skills,
      reason: skills.length
        ? "Seleção manual definida pelo usuário."
        : "Modo manual sem skills especializadas selecionadas."
    };
  }

  const skills = [...AUTO_CORE];
  const hasReferences = Array.isArray(referenceImages) && referenceImages.length > 0;
  const asksForVisualReference = VISUAL_REFERENCE_PATTERN.test(clean(instruction, 5000));
  if (hasReferences || asksForVisualReference) skills.push("screenshot-to-ui-blueprint");

  return {
    mode: normalizedMode,
    skills: normalizeSiteSkillIds(skills),
    reason: hasReferences || asksForVisualReference
      ? `Roteamento automático para ${phase === "refine" ? "refinamento" : "criação"} com leitura de referência visual.`
      : `Roteamento automático para ${phase === "refine" ? "refinamento" : "criação"} com direção, marca, SEO, conversão e organização.`
  };
}

export function getSiteSkill(id) {
  return SITE_SKILLS.find(skill => skill.id === id) || null;
}

export function buildSiteSkillsSystemPrompt(skillIds = []) {
  const selected = normalizeSiteSkillIds(skillIds).map(getSiteSkill).filter(Boolean);
  if (!selected.length) return "Nenhuma skill especializada adicional foi ativada. Siga apenas o briefing-base do gerador.";
  return [
    "SKILLS ESPECIALIZADAS ATIVAS:",
    ...selected.map((skill, index) => `${index + 1}. ${skill.label}: ${skill.systemPrompt}`)
  ].join("\n");
}

export function siteSkillsPublicList() {
  return SITE_SKILLS.map(({ id, label, shortLabel, description }) => ({ id, label, shortLabel, description }));
}

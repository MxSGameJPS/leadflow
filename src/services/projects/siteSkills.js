import { SITE_SKILL_OPTIONS,normalizeSiteSkillIds,normalizeSiteSkillMode,resolveSiteSkills } from "./siteSkillsCatalog.js";

export { SITE_SKILL_OPTIONS,normalizeSiteSkillIds,normalizeSiteSkillMode,resolveSiteSkills } from "./siteSkillsCatalog.js";

const SKILL_PROMPTS={
  "creative-web-director":[
    "Atue como Creative Web Director sênior.",
    "Defina uma tese visual clara para o hero, hierarquia deliberada, composição específica ao nicho e um elemento de assinatura memorável.",
    "Evite aparência de template, estética genérica de IA, excesso de cards, gradientes gratuitos, sombras pesadas e decisões visuais intercambiáveis.",
    "Use motion somente para hierarquia, continuidade espacial ou feedback, sempre respeitando prefers-reduced-motion."
  ].join(" "),
  "brand-system-architect":[
    "Atue como Brand System Architect.",
    "Transforme os fatos verificados do negócio em uma linguagem visual própria: personalidade, paleta, tipografia, densidade, contraste, tom e assinatura.",
    "Não copie marcas de referência nem invente atributos de marca que não possam ser sustentados pelo contexto.",
    "Mantenha consistência entre headline, cores, tipografia, imagens e microcopy."
  ].join(" "),
  "seo-content-engine":[
    "Atue como SEO Content Engine para negócios locais.",
    "Crie title e meta description claros, intenção de busca local natural, headings semanticamente úteis e texto que responda ao que o visitante procura.",
    "Não faça keyword stuffing, não invente localização, serviços ou diferenciais e não sacrifique clareza para repetir palavras-chave.",
    "O H1 deve comunicar a proposta principal da página e o conteúdo deve permanecer humano e persuasivo."
  ].join(" "),
  "conversion-director":[
    "Atue como Conversion Director.",
    "Organize a página para reduzir fricção entre descoberta, confiança e contato.",
    "O CTA principal deve ser inequívoco, coerente com os canais reais disponíveis e repetido somente quando fizer sentido.",
    "Use prova apenas quando existir nos dados fornecidos. Não invente depoimentos, resultados, números, urgência, preços ou garantias."
  ].join(" "),
  "screenshot-to-ui-blueprint":[
    "Atue como Screenshot to UI Blueprint.",
    "Quando houver imagens de referência, extraia apenas princípios de composição, hierarquia, ritmo, espaçamento, atmosfera, densidade, proporção e tratamento visual.",
    "Não copie textos, logotipos, identidade proprietária, ilustrações ou elementos distintivos de terceiros.",
    "Reinterprete a referência para a identidade do negócio atual."
  ].join(" "),
  "organizacao-padrao-saulo":[
    "Aplique Organização — Padrão Saulo ao resultado técnico.",
    "Mantenha JavaScript/JSX, não introduza TypeScript ou Tailwind e preserve responsabilidades claras entre conteúdo, componentes, estilos e integrações.",
    "Não adicione dependências sem necessidade e priorize código auditável, responsivo e simples de manter."
  ].join(" ")
};

export function getSiteSkill(id){
  const option=SITE_SKILL_OPTIONS.find(skill=>skill.id===id);
  return option?{...option,systemPrompt:SKILL_PROMPTS[id]||""}:null;
}

export function buildSiteSkillsSystemPrompt(skillIds=[]){
  const selected=normalizeSiteSkillIds(skillIds).map(getSiteSkill).filter(Boolean);
  if(!selected.length)return"Nenhuma skill especializada adicional foi ativada. Siga apenas o briefing-base do gerador.";
  return["SKILLS ESPECIALIZADAS ATIVAS:",...selected.map((skill,index)=>`${index+1}. ${skill.label}: ${skill.systemPrompt}`)].join("\n");
}

export function siteSkillsPublicList(){
  return SITE_SKILL_OPTIONS.map(skill=>({...skill}));
}

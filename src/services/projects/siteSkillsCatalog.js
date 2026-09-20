export const SITE_SKILL_OPTIONS = Object.freeze([
  {id:"creative-web-director",auto:"core",label:"Design Premium",shortLabel:"Design",description:"Direção visual, composição, tipografia, motion e acabamento autoral."},
  {id:"brand-system-architect",auto:"core",label:"Branding",shortLabel:"Marca",description:"Traduz o negócio em paleta, tipografia, linguagem e sistema visual coerente."},
  {id:"seo-content-engine",auto:"core",label:"SEO",shortLabel:"SEO",description:"Estrutura intenção local, headings, title, meta description e conteúdo encontrável."},
  {id:"conversion-director",auto:"core",label:"Conversão",shortLabel:"Conversão",description:"Organiza hero, prova, benefícios e CTAs para reduzir atrito e gerar contato."},
  {id:"screenshot-to-ui-blueprint",auto:"reference",label:"Referência Visual",shortLabel:"Referência",description:"Interpreta prints e referências sem copiar marcas, textos ou identidade de terceiros."},
  {id:"organizacao-padrao-saulo",auto:"core",label:"Padrão Saulo",shortLabel:"Organização",description:"Mantém exportação em JavaScript, sem Tailwind/TypeScript e com estrutura previsível."},
]);

const SKILL_IDS=new Set(SITE_SKILL_OPTIONS.map(skill=>skill.id));
const AUTO_CORE=SITE_SKILL_OPTIONS.filter(skill=>skill.auto==="core").map(skill=>skill.id);
const PATTERNS={
  reference:/(refer[eê]ncia|print|screenshot|imagem de exemplo|parecid|inspirad|layout de referência|visual de referência)/i,
  design:/(design|visual|hero|layout|composi[cç][aã]o|tipograf|anima[cç][aã]o|motion|premium|sofisticad|moderno|minimal|est[eé]tica|interface|ui\b|espa[cç]amento)/i,
  brand:/(brand|branding|marca|identidade|paleta|cor|cores|fonte|tipograf|logo|tom de voz|linguagem visual)/i,
  seo:/(seo|google|busca|pesquisa|palavra.?chave|keyword|meta description|meta title|title|heading|h1|h2|indexa[cç][aã]o|ranque|ranking|local)/i,
  conversion:/(convers[aã]o|converter|cta|bot[aã]o|whatsapp|contato|lead|venda|copy|headline|chamada|prova social|benef[ií]cio|funil|hero)/i,
  organization:/(organiza[cç][aã]o|estrutura|c[oó]digo|componente|arquivo|pasta|exporta[cç][aã]o|next|react|css module|tailwind|typescript|javascript|jsx)/i,
};

function clean(value,max=5000){return String(value??"").replace(/\u0000/g,"").trim().slice(0,max)}

export function normalizeSiteSkillMode(value){return value==="manual"?"manual":"auto"}

export function normalizeSiteSkillIds(value){
  if(!Array.isArray(value))return[];
  return[...new Set(value.map(item=>clean(item,80)).filter(item=>SKILL_IDS.has(item)))];
}

function addUnique(list,...ids){for(const id of ids)if(SKILL_IDS.has(id)&&!list.includes(id))list.push(id)}

export function resolveSiteSkills({mode="auto",selectedSkills=[],instruction="",referenceImages=[],phase="create"}={}){
  const normalizedMode=normalizeSiteSkillMode(mode);
  if(normalizedMode==="manual"){
    const skills=normalizeSiteSkillIds(selectedSkills);
    return{mode:normalizedMode,skills,reason:skills.length?"Seleção manual definida pelo usuário.":"Modo manual sem skills especializadas selecionadas."};
  }

  const text=clean(instruction,5000);
  const hasReferences=Array.isArray(referenceImages)&&referenceImages.length>0;
  const isRefine=phase==="refine";
  const skills=[];

  if(!isRefine){
    addUnique(skills,...AUTO_CORE);
    if(hasReferences||PATTERNS.reference.test(text))addUnique(skills,"screenshot-to-ui-blueprint");
    return{mode:normalizedMode,skills,reason:hasReferences||PATTERNS.reference.test(text)?"Criação automática completa com leitura de referência visual.":"Criação automática completa com direção, marca, SEO, conversão e organização."};
  }

  if(PATTERNS.design.test(text))addUnique(skills,"creative-web-director");
  if(PATTERNS.brand.test(text))addUnique(skills,"brand-system-architect","creative-web-director");
  if(PATTERNS.seo.test(text))addUnique(skills,"seo-content-engine");
  if(PATTERNS.conversion.test(text))addUnique(skills,"conversion-director");
  if(PATTERNS.organization.test(text))addUnique(skills,"organizacao-padrao-saulo");

  const needsReference=PATTERNS.reference.test(text)||(hasReferences&&!text);
  if(needsReference)addUnique(skills,"screenshot-to-ui-blueprint","creative-web-director","brand-system-architect");

  if(!skills.length)addUnique(skills,...AUTO_CORE);
  return{
    mode:normalizedMode,
    skills,
    reason:skills.length===AUTO_CORE.length&&skills.every(id=>AUTO_CORE.includes(id))
      ?"Refinamento amplo: o router manteve a equipe completa."
      :"Refinamento direcionado: o router ativou somente as skills relacionadas ao pedido."
  };
}

import fs from "node:fs/promises";
import path from "node:path";
import { generateWithDefaultProvider } from "../ai/providerService.js";
import { buildSiteSkillsSystemPrompt,resolveSiteSkills } from "./siteSkills.js";

const GENERATED_ROOT = path.join(process.cwd(), "generated-sites");
const RUNTIME_COMPONENT_PATH = path.join(process.cwd(), "src", "components", "GeneratedSiteRuntime", "GeneratedSiteRuntime.jsx");
const RUNTIME_CSS_PATH = path.join(process.cwd(), "src", "components", "GeneratedSiteRuntime", "GeneratedSiteRuntime.module.css");
const PLACE_DETAILS_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "googleMapsUri",
  "regularOpeningHours",
  "editorialSummary",
  "photos",
].join(",");

const DIRECTIONS = new Set(["editorial", "cinematic", "precision", "organic", "bold", "minimal"]);
const HERO_LAYOUTS = new Set(["split", "immersive", "asymmetric"]);
const FONT_PAIRS = new Set(["editorial", "modern", "geometric", "humanist", "luxury"]);
const MOTION_LEVELS = new Set(["subtle", "standard", "expressive"]);
const RADIUS_LEVELS = new Set(["sharp", "soft", "rounded"]);
const ARCHETYPES = new Set(["editorial-offset", "cinematic-collage", "precision-grid", "poster-grid", "soft-story", "minimal-frame", "immersive-layered"]);
const NAV_STYLES = new Set(["bar", "floating", "minimal"]);
const SERVICE_LAYOUTS = new Set(["editorial-mosaic", "indexed-list", "stacked", "poster-grid", "split-list"]);
const GALLERY_LAYOUTS = new Set(["duo", "filmstrip", "masonry", "fullbleed", "strip"]);
const SECTION_RHYTHMS = new Set(["contrast", "alternating", "structured", "flowing", "continuous"]);
const DENSITY_LEVELS = new Set(["airy", "balanced", "dense"]);
const HERO_MEDIA = new Set(["side", "collage", "portrait", "fullbleed", "layered"]);
const ACCENT_SHAPES = new Set(["line", "block", "frame", "circle", "none"]);
const SITE_EFFECTS = new Set(["entrance-motion", "section-reveal", "parallax-hero", "glass-header", "hover-lift", "ambient-glow", "cta-pulse", "smooth-scroll"]);

function normalizeEffects(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => clean(item, 60)).filter(item => SITE_EFFECTS.has(item)))];
}

function clean(value, max = 5000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

export function slugifySiteName(value) {
  return clean(value, 180)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "site-gerado";
}

function safeColor(value, fallback) {
  const color = clean(value, 20);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function safeUrl(value) {
  const url = clean(value, 1000);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function mobileWhatsapp(phone) {
  let digits = clean(phone, 40).replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return /^55\d{2}9\d{8}$/.test(digits) ? digits : "";
}

function segmentIncludes(segment, words) {
  const normalized = clean(segment, 200).toLocaleLowerCase("pt-BR");
  return words.some(word => normalized.includes(word));
}

function fallbackComposition(input) {
  const segment = input.segment || "negócio local";
  if (segmentIncludes(segment, ["restaurante", "pizz", "caf", "bar", "padaria", "hamburg", "marmit", "sorvet"])) {
    return { archetype: "cinematic-collage", navStyle: "floating", servicesLayout: "editorial-mosaic", galleryLayout: "filmstrip", sectionRhythm: "contrast", density: "airy", heroMedia: "collage", accentShape: "block", variance: 9, motion: 7, densityDial: 4 };
  }
  if (segmentIncludes(segment, ["advoc", "contab", "segur", "imobili", "clínica", "medic", "odont", "laboratório"])) {
    return { archetype: "precision-grid", navStyle: "bar", servicesLayout: "indexed-list", galleryLayout: "duo", sectionRhythm: "structured", density: "balanced", heroMedia: "side", accentShape: "line", variance: 5, motion: 4, densityDial: 6 };
  }
  if (segmentIncludes(segment, ["estética", "beleza", "salão", "manicure", "spa", "pilates", "yoga", "nutri", "psico", "fisi"])) {
    return { archetype: "soft-story", navStyle: "minimal", servicesLayout: "stacked", galleryLayout: "masonry", sectionRhythm: "flowing", density: "airy", heroMedia: "portrait", accentShape: "circle", variance: 7, motion: 5, densityDial: 3 };
  }
  if (segmentIncludes(segment, ["loja", "supermerc", "farmácia", "óptica", "joalher", "papelaria", "material", "auto peças"])) {
    return { archetype: "poster-grid", navStyle: "floating", servicesLayout: "poster-grid", galleryLayout: "strip", sectionRhythm: "alternating", density: "balanced", heroMedia: "fullbleed", accentShape: "frame", variance: 9, motion: 7, densityDial: 6 };
  }
  return { archetype: "editorial-offset", navStyle: "minimal", servicesLayout: "split-list", galleryLayout: "duo", sectionRhythm: "alternating", density: "airy", heroMedia: "side", accentShape: "line", variance: 7, motion: 5, densityDial: 4 };
}

function fallbackDesign(input) {
  const segment = input.segment || "negócio local";

  if (segmentIncludes(segment, ["restaurante", "pizz", "caf", "bar", "padaria", "hamburg", "marmit", "sorvet"])) {
    return {
      direction: "cinematic",
      heroLayout: "asymmetric",
      fontPair: "editorial",
      motion: "expressive",
      radius: "soft",
      signatureLabel: "Sabor, presença e experiência local",
      colors: { primary: "#5A1F16", accent: "#E6A93D", background: "#F8F3EA", surface: "#FFFDF8", text: "#1F1714", muted: "#75665F" },
      composition: fallbackComposition(input),
    };
  }

  if (segmentIncludes(segment, ["advoc", "contab", "segur", "imobili", "clínica", "medic", "odont", "laboratório"])) {
    return {
      direction: "precision",
      heroLayout: "split",
      fontPair: "modern",
      motion: "standard",
      radius: "sharp",
      signatureLabel: "Clareza para decidir com confiança",
      colors: { primary: "#10253F", accent: "#C89B4A", background: "#F3F5F7", surface: "#FFFFFF", text: "#111A24", muted: "#66717D" },
      composition: fallbackComposition(input),
    };
  }

  if (segmentIncludes(segment, ["estética", "beleza", "salão", "manicure", "spa", "pilates", "yoga", "nutri", "psico", "fisi"])) {
    return {
      direction: "organic",
      heroLayout: "immersive",
      fontPair: "humanist",
      motion: "standard",
      radius: "rounded",
      signatureLabel: "Cuidado percebido em cada detalhe",
      colors: { primary: "#24483D", accent: "#D69A79", background: "#F5F1EA", surface: "#FFFCF7", text: "#17221F", muted: "#6D7974" },
      composition: fallbackComposition(input),
    };
  }

  if (segmentIncludes(segment, ["loja", "supermerc", "farmácia", "óptica", "joalher", "papelaria", "material", "auto peças"])) {
    return {
      direction: "bold",
      heroLayout: "asymmetric",
      fontPair: "geometric",
      motion: "expressive",
      radius: "soft",
      signatureLabel: "Uma presença feita para ser lembrada",
      colors: { primary: "#152A4A", accent: "#F05A38", background: "#F5F6F8", surface: "#FFFFFF", text: "#101722", muted: "#657080" },
      composition: fallbackComposition(input),
    };
  }

  return {
    direction: "minimal",
    heroLayout: "split",
    fontPair: "modern",
    motion: "standard",
    radius: "soft",
    signatureLabel: "Presença digital com identidade própria",
    colors: { primary: "#17324D", accent: "#D59B42", background: "#F3F1EC", surface: "#FFFFFF", text: "#14202A", muted: "#68737D" },
    composition: fallbackComposition(input),
  };
}

function fallbackSpec(input) {
  const segment = input.segment || "negócio local";
  const city = input.city || "sua região";
  const design = fallbackDesign(input);
  return {
    brandName: input.name,
    audience: `Pessoas que procuram ${segment} em ${city}`,
    pageJob: "Gerar confiança imediata e conduzir o visitante ao contato",
    eyebrow: `${segment} em ${city}`,
    heroTitle: `${input.name}, apresentado com a força que o negócio merece`,
    heroText: input.editorialSummary || `Uma prévia criada para organizar as informações essenciais, transmitir confiança e facilitar o próximo contato com a ${input.name}.`,
    primaryCta: "Falar agora",
    secondaryCta: "Ver localização",
    aboutTitle: "Uma presença que traduz o negócio",
    aboutText: input.editorialSummary || `A ${input.name} ganha uma apresentação clara, responsiva e construída para valorizar sua atuação em ${city}, sem promessas genéricas nem informações inventadas.`,
    servicesTitle: "O que o cliente encontra aqui",
    servicesIntro: "Informação útil, hierarquia clara e um caminho de contato sem atrito.",
    services: [
      { title: "Atendimento direto", description: "Telefone, WhatsApp e localização organizados para o visitante agir sem procurar demais." },
      { title: "Presença local", description: `Uma comunicação alinhada ao contexto de ${city} e ao público que já busca este tipo de serviço.` },
      { title: "Decisão com confiança", description: "Conteúdo objetivo, prova disponível e experiência consistente no celular e no computador." },
    ],
    proofTitle: "Confiança antes do primeiro contato",
    proofText: input.rating ? `O negócio possui avaliação ${input.rating} no Google e ${input.reviews || 0} avaliações registradas.` : "A página reúne apenas dados verificáveis e conduz o visitante com clareza.",
    contactTitle: "O próximo passo precisa ser simples",
    contactText: "Entre em contato para confirmar atendimento, disponibilidade e demais informações.",
    seoTitle: `${input.name} | ${segment} em ${city}`,
    seoDescription: `Conheça a ${input.name}, ${segment} em ${city}. Veja informações, localização e formas de contato.`,
    design,
  };
}

function normalizeServices(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const services = value.slice(0, 5).map(item => ({ title: clean(item?.title, 90), description: clean(item?.description, 280) })).filter(item => item.title && item.description);
  return services.length >= 3 ? services : fallback;
}

function dial(value, fallback) {
  const number = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(number) ? Math.max(1, Math.min(10, number)) : fallback;
}

function normalizeComposition(value, fallback) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    archetype: ARCHETYPES.has(data.archetype) ? data.archetype : fallback.archetype,
    navStyle: NAV_STYLES.has(data.navStyle) ? data.navStyle : fallback.navStyle,
    servicesLayout: SERVICE_LAYOUTS.has(data.servicesLayout) ? data.servicesLayout : fallback.servicesLayout,
    galleryLayout: GALLERY_LAYOUTS.has(data.galleryLayout) ? data.galleryLayout : fallback.galleryLayout,
    sectionRhythm: SECTION_RHYTHMS.has(data.sectionRhythm) ? data.sectionRhythm : fallback.sectionRhythm,
    density: DENSITY_LEVELS.has(data.density) ? data.density : fallback.density,
    heroMedia: HERO_MEDIA.has(data.heroMedia) ? data.heroMedia : fallback.heroMedia,
    accentShape: ACCENT_SHAPES.has(data.accentShape) ? data.accentShape : fallback.accentShape,
    variance: dial(data.variance, fallback.variance),
    motion: dial(data.motion, fallback.motion),
    densityDial: dial(data.densityDial, fallback.densityDial),
  };
}

function normalizeDesign(value, fallback) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    direction: DIRECTIONS.has(data.direction) ? data.direction : fallback.direction,
    heroLayout: HERO_LAYOUTS.has(data.heroLayout) ? data.heroLayout : fallback.heroLayout,
    fontPair: FONT_PAIRS.has(data.fontPair) ? data.fontPair : fallback.fontPair,
    motion: MOTION_LEVELS.has(data.motion) ? data.motion : fallback.motion,
    radius: RADIUS_LEVELS.has(data.radius) ? data.radius : fallback.radius,
    signatureLabel: clean(data.signatureLabel, 140) || fallback.signatureLabel,
    colors: {
      primary: safeColor(data.colors?.primary, fallback.colors.primary),
      accent: safeColor(data.colors?.accent, fallback.colors.accent),
      background: safeColor(data.colors?.background, fallback.colors.background),
      surface: safeColor(data.colors?.surface, fallback.colors.surface),
      text: safeColor(data.colors?.text, fallback.colors.text),
      muted: safeColor(data.colors?.muted, fallback.colors.muted),
    },
    composition: normalizeComposition(data.composition, fallback.composition || fallbackComposition({ segment: "" })),
  };
}

function normalizeSpec(value, input) {
  const fallback = fallbackSpec(input);
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    brandName: clean(data.brandName, 120) || fallback.brandName,
    audience: clean(data.audience, 220) || fallback.audience,
    pageJob: clean(data.pageJob, 220) || fallback.pageJob,
    eyebrow: clean(data.eyebrow, 100) || fallback.eyebrow,
    heroTitle: clean(data.heroTitle, 190) || fallback.heroTitle,
    heroText: clean(data.heroText, 520) || fallback.heroText,
    primaryCta: clean(data.primaryCta, 60) || fallback.primaryCta,
    secondaryCta: clean(data.secondaryCta, 60) || fallback.secondaryCta,
    aboutTitle: clean(data.aboutTitle, 130) || fallback.aboutTitle,
    aboutText: clean(data.aboutText, 900) || fallback.aboutText,
    servicesTitle: clean(data.servicesTitle, 130) || fallback.servicesTitle,
    servicesIntro: clean(data.servicesIntro, 380) || fallback.servicesIntro,
    services: normalizeServices(data.services, fallback.services),
    proofTitle: clean(data.proofTitle, 130) || fallback.proofTitle,
    proofText: clean(data.proofText, 520) || fallback.proofText,
    contactTitle: clean(data.contactTitle, 130) || fallback.contactTitle,
    contactText: clean(data.contactText, 520) || fallback.contactText,
    seoTitle: clean(data.seoTitle, 70) || fallback.seoTitle,
    seoDescription: clean(data.seoDescription, 170) || fallback.seoDescription,
    design: normalizeDesign(data.design, fallback.design),
  };
}

export function parseAiJson(text) {
  const raw = clean(text, 30000)
    .replace(/^\uFEFF/, "")
    .replace(/^\`\`\`(?:json|javascript|js)?\s*/i, "")
    .replace(/\s*\`\`\`$/i, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("A IA não retornou JSON reconhecível.");

  const candidate = raw.slice(start, end + 1);
  const attempts = [
    candidate,
    candidate
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/([{,]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'\s*:/g, '$1"$2":')
      .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'(?=\s*[,}])/g, (_, value) => ': "' + String(value).replace(/"/g, '\\"') + '"')
      .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$-]*)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, "$1"),
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try { return JSON.parse(attempt); } catch (error) { lastError = error; }
  }
  throw lastError || new Error("JSON inválido.");
}

async function parseAiJsonWithRepair(text) {
  try {
    return parseAiJson(text);
  } catch (firstError) {
    const repair = await generateWithDefaultProvider({
      systemPrompt: "Você é um reparador de JSON. Retorne somente JSON estrito e válido, sem markdown, sem comentários e sem texto adicional. Preserve os valores e a estrutura do conteúdo recebido.",
      prompt: "Corrija este conteúdo para JSON estrito válido:\n\n" + clean(text, 28000),
    });
    try {
      return parseAiJson(repair.text);
    } catch {
      throw new Error("JSON inválido após tentativa automática de reparo: " + firstError.message);
    }
  }
}

async function fetchPlaceDetails(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !placeId) return null;
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR&regionCode=BR`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": PLACE_DETAILS_MASK },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

function extensionFromType(type) {
  const normalized = clean(type, 100).toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  return "jpg";
}

async function downloadPlacePhotos(place, publicDir) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const photos = Array.isArray(place?.photos) ? place.photos.slice(0, 5) : [];
  if (!apiKey || !photos.length) return { images: [], attributions: [] };
  const imageDir = path.join(publicDir, "images");
  await fs.mkdir(imageDir, { recursive: true });
  const images = [];
  const attributions = [];

  for (let index = 0; index < photos.length; index++) {
    const photo = photos[index];
    if (!photo?.name) continue;
    try {
      const mediaResponse = await fetch(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=2200&skipHttpRedirect=true&key=${encodeURIComponent(apiKey)}`, { cache: "no-store" });
      if (!mediaResponse.ok) continue;
      const media = await mediaResponse.json();
      const uri = safeUrl(media.photoUri);
      if (!uri) continue;
      const imageResponse = await fetch(uri, { cache: "no-store" });
      if (!imageResponse.ok) continue;
      const extension = extensionFromType(imageResponse.headers.get("content-type"));
      const fileName = `google-place-${index + 1}.${extension}`;
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      await fs.writeFile(path.join(imageDir, fileName), buffer);
      images.push(`/images/${fileName}`);
      for (const author of photo.authorAttributions || []) {
        const name = clean(author?.displayName, 160);
        const uriValue = safeUrl(author?.uri);
        if (name && !attributions.some(item => item.name === name && item.uri === uriValue)) attributions.push({ name, uri: uriValue });
      }
    } catch {
      // Uma foto indisponível não deve impedir a criação do projeto.
    }
  }
  return { images, attributions };
}

function buildAiPrompt(input, currentSiteData = null, instruction = "") {
  const facts = {
    name: input.name,
    segment: input.segment,
    city: input.city,
    address: input.address,
    phone: input.phone,
    rating: input.rating,
    reviews: input.reviews,
    editorialSummary: input.editorialSummary,
    openingHours: input.openingHours,
    existingWebsite: input.existingWebsite,
    template: input.template,
    description: input.description,
    requestedChanges: clean(instruction, 5000),
    effects: normalizeEffects(input.effects),
    skillMode: input.skillMode || "auto",
    skills: Array.isArray(input.skills) ? input.skills : [],
  };

  return {
    systemPrompt: [
      "Você é diretor de criação, estrategista de conversão, redator e designer de produto digital.",
      buildSiteSkillsSystemPrompt(input.skills),
      "Impeccable e UI/UX Pro Max são skills ativas de verdade quando presentes em input.skills; obedeça às instruções delas no briefing especializado.",
      "Aplique identidade específica ao assunto, hierarquia real, acessibilidade WCAG AA, mobile-first, tipografia deliberada, uma assinatura visual memorável e movimento com propósito.",
      "A landing será enviada como prévia comercial. Ela precisa causar a impressão de trabalho autoral de um estúdio de alto nível, não de template WordPress, tema PHP ou interface genérica criada por IA.",
      "Evite purple gradient genérico, excesso de cards arredondados, sombras pesadas, seções intercambiáveis, números decorativos sem significado, texto corporativo vazio e a combinação automática de fundo creme com serifada apenas por hábito.",
      "Escolha UMA direção estética coerente com o nicho, o público e o objetivo da página. Assuma um risco visual justificável em um único elemento de assinatura e mantenha o restante disciplinado.",
      "Não reutilize automaticamente a mesma arquitetura de landing. O objeto design.composition deve alterar de verdade hero, navegação, ritmo, serviços, galeria, densidade e relação texto/imagem.",
      "Use variance como coragem compositiva (1 conservador, 10 muito autoral), motion como intensidade de movimento e densityDial como densidade informacional. Eles devem ser coerentes com o negócio, não aleatórios.",
      "Planeje composição, paleta, tipografia e movimento antes de escrever. O hero deve funcionar como uma tese visual do negócio.",
      "As animações devem usar transform e opacity, respeitar prefers-reduced-motion e reforçar hierarquia, continuidade espacial ou feedback. Não anime por decorar.",
      "Use exclusivamente os fatos fornecidos. Não invente serviços, preços, promoções, resultados, prêmios, depoimentos, tempo de mercado, certificações ou diferenciais não comprovados.",
      "Quando houver imagens de referência anexadas, use-as apenas para compreender composição, hierarquia, atmosfera, densidade, tipografia aparente e linguagem visual. Não extraia delas fatos sobre o negócio e não copie marcas, textos ou identidade de terceiros.",
      "Os efeitos selecionados pelo usuário são uma restrição explícita. Não proponha efeitos extras quando a lista estiver vazia.",
      "Escreva em português do Brasil, em voz ativa, sem emojis, hashtags ou clichês.",
      "Retorne apenas um objeto JSON válido, sem markdown, comentários ou texto fora do JSON.",
    ].join(" "),
    prompt: [
      "Crie a direção completa de conteúdo e design para uma landing page comercial premium.",
      "A página será implementada em Next.js 15 + React 19, com Framer Motion para entrada e microinterações e GSAP ScrollTrigger para revelações de scroll.",
      "Escolha valores somente entre os enums informados e mantenha contraste suficiente.",
      "O rodapé será assinado como: Prévia desenvolvida por Saulo Pavanello.",
      "Formato obrigatório:",
      JSON.stringify({
        brandName: "", audience: "", pageJob: "", eyebrow: "", heroTitle: "", heroText: "", primaryCta: "", secondaryCta: "",
        aboutTitle: "", aboutText: "", servicesTitle: "", servicesIntro: "",
        services: [{ title: "", description: "" }, { title: "", description: "" }, { title: "", description: "" }],
        proofTitle: "", proofText: "", contactTitle: "", contactText: "", seoTitle: "", seoDescription: "",
        design: {
          direction: "editorial | cinematic | precision | organic | bold | minimal",
          heroLayout: "split | immersive | asymmetric",
          fontPair: "editorial | modern | geometric | humanist | luxury",
          motion: "subtle | standard | expressive",
          radius: "sharp | soft | rounded",
          signatureLabel: "",
          colors: { primary: "#000000", accent: "#000000", background: "#000000", surface: "#000000", text: "#000000", muted: "#000000" },
          composition: {
            archetype: "editorial-offset | cinematic-collage | precision-grid | poster-grid | soft-story | minimal-frame | immersive-layered",
            navStyle: "bar | floating | minimal",
            servicesLayout: "editorial-mosaic | indexed-list | stacked | poster-grid | split-list",
            galleryLayout: "duo | filmstrip | masonry | fullbleed | strip",
            sectionRhythm: "contrast | alternating | structured | flowing | continuous",
            density: "airy | balanced | dense",
            heroMedia: "side | collage | portrait | fullbleed | layered",
            accentShape: "line | block | frame | circle | none",
            variance: 7,
            motion: 5,
            densityDial: 4
          },
        },
      }, null, 2),
      instruction ? "ALTERAÇÃO SOLICITADA PELO USUÁRIO:\n" + clean(instruction, 5000) : "",
      "EFEITOS VISUAIS SELECIONADOS PELO USUÁRIO:\n" + JSON.stringify(normalizeEffects(input.effects), null, 2),
      Array.isArray(input.referenceImages) && input.referenceImages.length ? "Há " + input.referenceImages.length + " imagem(ns) de referência visual anexada(s). Analise-as como inspiração estética." : "Nenhuma imagem de referência visual foi anexada.",

      currentSiteData ? "ESTADO ATUAL APROVADO DO SITE. Preserve o que não foi pedido para mudar:\n" + JSON.stringify(currentSiteData, null, 2) : "",

      "DADOS CONFIÁVEIS DO NEGÓCIO:",

      JSON.stringify(facts, null, 2),
    ].join("\n"),
    images: Array.isArray(input.referenceImages) ? input.referenceImages.map(item => ({ dataUrl: item.dataUrl, label: item.label || "Referência visual" })) : [],
  };
}

async function downloadExternalImages(urls, publicDir) {
  const list = Array.isArray(urls) ? urls : [];
  if (!list.length) return [];
  const imageDir = path.join(publicDir, "images");
  await fs.mkdir(imageDir, { recursive: true });
  const images = [];
  const seen = new Set();
  for (const raw of list.slice(0, 8)) {
    const url = safeUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 LeadFlow Site Preview" } });
      clearTimeout(timer);
      if (!response.ok) continue;
      const type = String(response.headers.get("content-type") || "").toLowerCase();
      if (!type.startsWith("image/")) continue;
      const length = Number(response.headers.get("content-length") || 0);
      if (length > 10 * 1024 * 1024) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > 10 * 1024 * 1024) continue;
      const extension = extensionFromType(type);
      const fileName = "reference-" + (images.length + 1) + "." + extension;
      await fs.writeFile(path.join(imageDir, fileName), buffer);
      images.push("/images/" + fileName);
    } catch {}
  }
  return images;
}

async function outputFolder(name, folderPath) {
  const requested = clean(folderPath, 500);
  if (!requested) return uniqueFolder(name);
  const absolutePath = path.resolve(process.cwd(), requested);
  if (!absolutePath.startsWith(GENERATED_ROOT + path.sep) || absolutePath === GENERATED_ROOT) throw new Error("A pasta existente do projeto é inválida.");
  await fs.mkdir(path.join(absolutePath, "app"), { recursive: true });
  await fs.mkdir(path.join(absolutePath, "public"), { recursive: true });
  return { folderName: path.basename(absolutePath), absolutePath };
}

async function uniqueFolder(name) {
  await fs.mkdir(GENERATED_ROOT, { recursive: true });
  const base = slugifySiteName(name);
  let candidate = base;
  let index = 2;
  while (true) {
    try {
      await fs.access(path.join(GENERATED_ROOT, candidate));
      candidate = `${base}-${index++}`;
    } catch {
      return { folderName: candidate, absolutePath: path.join(GENERATED_ROOT, candidate) };
    }
  }
}

function fontSource(pair) {
  const configs = {
    editorial: { imports: "Cormorant_Garamond, Manrope", display: 'const display = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });', body: 'const body = Manrope({ subsets: ["latin"], variable: "--font-body" });' },
    modern: { imports: "Space_Grotesk, DM_Sans", display: 'const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });', body: 'const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });' },
    geometric: { imports: "Space_Grotesk, Manrope", display: 'const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });', body: 'const body = Manrope({ subsets: ["latin"], variable: "--font-body" });' },
    humanist: { imports: "Fraunces, DM_Sans", display: 'const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });', body: 'const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });' },
    luxury: { imports: "Cormorant_Garamond, DM_Sans", display: 'const display = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });', body: 'const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });' },
  };
  return configs[pair] || configs.modern;
}

function pageSource(data) {
  return `import GeneratedSiteRuntime from "../components/GeneratedSiteRuntime/GeneratedSiteRuntime.jsx";

const site = ${JSON.stringify(data, null, 2)};

export default function Home() {
  return <GeneratedSiteRuntime site={site} />;
}
`;
}

function layoutSource(data) {
  return `import "./globals.css";

export const metadata = { title: ${JSON.stringify(data.seoTitle)}, description: ${JSON.stringify(data.seoDescription)} };

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
`;
}

function cssSource() {
  return `html,body{margin:0;padding:0;min-height:100%;background:#fff}body{min-width:320px}*{box-sizing:border-box}`;
}

export async function syncGeneratedSiteRuntime(folderPath, siteData) {
  const requested = clean(folderPath, 500);
  if (!requested) throw new Error("Este projeto ainda não possui uma pasta gerada.");
  const absolutePath = path.resolve(process.cwd(), requested);
  if (!absolutePath.startsWith(GENERATED_ROOT + path.sep) || absolutePath === GENERATED_ROOT) {
    throw new Error("A pasta do projeto está fora do diretório permitido.");
  }
  if (!siteData || typeof siteData !== "object") throw new Error("O projeto não possui dados visuais para sincronizar.");

  const appDir = path.join(absolutePath, "app");
  const runtimeDir = path.join(absolutePath, "components", "GeneratedSiteRuntime");
  await Promise.all([
    fs.mkdir(appDir, { recursive: true }),
    fs.mkdir(runtimeDir, { recursive: true }),
  ]);

  const [runtimeComponent, runtimeCss] = await Promise.all([
    fs.readFile(RUNTIME_COMPONENT_PATH, "utf8"),
    fs.readFile(RUNTIME_CSS_PATH, "utf8"),
  ]);

  await Promise.all([
    fs.writeFile(path.join(appDir, "layout.js"), layoutSource(siteData), "utf8"),
    fs.writeFile(path.join(appDir, "page.js"), pageSource(siteData), "utf8"),
    fs.writeFile(path.join(appDir, "globals.css"), cssSource(), "utf8"),
    fs.writeFile(path.join(runtimeDir, "GeneratedSiteRuntime.jsx"), runtimeComponent, "utf8"),
    fs.writeFile(path.join(runtimeDir, "GeneratedSiteRuntime.module.css"), runtimeCss, "utf8"),
  ]);

  return absolutePath;
}

function refinementPrompt(data) {
  return `# Refinamento opcional no Claude Code

Este projeto já incorpora no gerador as skills **Impeccable** e **UI/UX Pro Max**, além da direção visual e organização do LeadFlow.

Ao abrir esta pasta no Claude Code, execute:

\`\`\`text
/ui-ux-pro-max
/frontend-design
\`\`\`

Depois use este pedido:

\`\`\`text
Revise esta landing page como diretor de criação e engenheiro front-end sênior.

Negócio: ${data.brandName}
Público: ${data.audience}
Objetivo único: ${data.pageJob}
Direção escolhida: ${data.design.direction}
Assinatura visual: ${data.design.signatureLabel}
Skills do LeadFlow: ${(data.skills || []).join(", ") || "briefing-base"}

Preserve apenas informações verificáveis. Não invente serviços, resultados, preços ou depoimentos.
Aprimore composição, tipografia, imagens, responsividade, acessibilidade WCAG AA e movimento com propósito.
Evite aparência de template, estética genérica de IA, excesso de cards, gradientes gratuitos e animações decorativas.
Mantenha o runtime compartilhado leve: CSS, transform/opacity e IntersectionObserver; não introduza bibliotecas de animação sem necessidade.
Antes de entregar, valide 320px, 768px, 1024px e 1440px, foco por teclado e prefers-reduced-motion.
\`\`\`
`;
}

export async function generateSiteFolder(input = {}) {
  const name = clean(input.name, 220);
  if (!name) throw new Error("Informe o nome do negócio.");
  const folder = await outputFolder(name, input.folderPath);
  const publicDir = path.join(folder.absolutePath, "public");
  await fs.mkdir(path.join(folder.absolutePath, "app"), { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });

  const place = await fetchPlaceDetails(clean(input.placeId, 300));
  const placeData = {
    name: clean(place?.displayName?.text, 220) || name,
    segment: clean(input.segment, 140),
    city: clean(input.city, 160),
    address: clean(place?.formattedAddress || input.address, 500),
    phone: clean(place?.nationalPhoneNumber || input.phone, 80),
    rating: place?.rating ?? input.rating ?? null,
    reviews: place?.userRatingCount ?? input.reviews ?? null,
    mapsLink: safeUrl(place?.googleMapsUri || input.mapsLink),
    existingWebsite: safeUrl(place?.websiteUri || input.existingWebsite),
    editorialSummary: clean(place?.editorialSummary?.text || input.description, 1200),
    openingHours: Array.isArray(place?.regularOpeningHours?.weekdayDescriptions) ? place.regularOpeningHours.weekdayDescriptions.slice(0, 7).map(item => clean(item, 180)) : [],
    template: clean(input.template, 80) || "institutional",
    description: clean(input.description, 1600),
    effects: normalizeEffects(input.effects),
    referenceImages: Array.isArray(input.referenceImages) ? input.referenceImages.slice(0, 6) : [],
    skillMode: input.skillMode || "auto",
    skills: Array.isArray(input.skills) ? input.skills : [],
  };

  const skillRouting = resolveSiteSkills({
    mode: input.skillMode,
    selectedSkills: input.skills,
    instruction: input.instruction,
    referenceImages: placeData.referenceImages,
    phase: input.existingSiteData ? "refine" : "create",
  });
  placeData.skillMode = skillRouting.mode;
  placeData.skills = skillRouting.skills;

  let aiUsed = false;
  let aiWarning = "";
  let spec = input.existingSiteData ? normalizeSpec(input.existingSiteData, placeData) : fallbackSpec(placeData);
  try {
    if (!input.skipAi) {
      const request = buildAiPrompt(placeData, input.existingSiteData, input.instruction);
      let result;
      try {
        result = await generateWithDefaultProvider(request);
      } catch (imageError) {
        if (!request.images?.length) throw imageError;
        result = await generateWithDefaultProvider({ ...request, images: [] });
        aiWarning = "O modelo configurado não aceitou as imagens de referência; a direção criativa foi gerada apenas com o briefing textual.";
      }
      spec = normalizeSpec(await parseAiJsonWithRepair(result.text), placeData);
      aiUsed = true;
    }
  } catch (error) {
    aiWarning = `A IA não concluiu a direção criativa: ${error.message}. Foi aplicado um sistema visual profissional específico para o nicho.`;
    spec = normalizeSpec(spec, placeData);
  }

  const media = await downloadPlacePhotos(place, publicDir);
  const externalImages = await downloadExternalImages(input.assetUrls, publicDir);
  const siteData = {
    ...spec,
    segment: placeData.segment,
    city: placeData.city,
    address: placeData.address,
    phone: placeData.phone,
    whatsapp: mobileWhatsapp(placeData.phone),
    rating: placeData.rating ? String(placeData.rating).replace(".", ",") : "",
    reviews: placeData.reviews ? new Intl.NumberFormat("pt-BR").format(Number(placeData.reviews)) : "",
    mapsLink: placeData.mapsLink,
    existingWebsite: placeData.existingWebsite,
    hours: placeData.openingHours,
    images: [...media.images, ...externalImages].slice(0, 8),
    attributions: media.attributions,
    effects: normalizeEffects(input.effects),
    skillMode: skillRouting.mode,
    skills: skillRouting.skills,
  };

  const runtimeDir = path.join(folder.absolutePath, "components", "GeneratedSiteRuntime");
  await fs.mkdir(runtimeDir, { recursive: true });
  const [runtimeComponent, runtimeCss] = await Promise.all([
    fs.readFile(RUNTIME_COMPONENT_PATH, "utf8"),
    fs.readFile(RUNTIME_CSS_PATH, "utf8"),
  ]);

  const packageJson = {
    name: folder.folderName,
    version: "2.0.0",
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: { next: "15.1.6", react: "19.0.0", "react-dom": "19.0.0" },
  };

  const report = {
    generatedAt: new Date().toISOString(),
    generatorVersion: 2,
    aiUsed,
    aiWarning,
    source: place ? "Google Places + CRM" : "CRM ou descrição",
    design: siteData.design,
    composition: siteData.design?.composition,
    runtimeIntegrity: "shared-runtime-v1",
    audience: siteData.audience,
    pageJob: siteData.pageJob,
    effects: siteData.effects,
    referenceImageCount: Array.isArray(input.referenceImages) ? input.referenceImages.length : 0,
    skillMode: skillRouting.mode,
    skills: skillRouting.skills,
    skillRoutingReason: skillRouting.reason,
    photoAttributions: media.attributions,
    validationRequired: true,
  };

  await Promise.all([
    fs.writeFile(path.join(folder.absolutePath, "package.json"), JSON.stringify(packageJson, null, 2), "utf8"),
    fs.writeFile(path.join(folder.absolutePath, ".gitignore"), "node_modules\n.next\n.env*\n", "utf8"),
    fs.writeFile(path.join(folder.absolutePath, "app", "layout.js"), layoutSource(siteData), "utf8"),
    fs.writeFile(path.join(folder.absolutePath, "app", "page.js"), pageSource(siteData), "utf8"),
    fs.writeFile(path.join(folder.absolutePath, "app", "globals.css"), cssSource(), "utf8"),
    fs.writeFile(path.join(runtimeDir, "GeneratedSiteRuntime.jsx"), runtimeComponent, "utf8"),
    fs.writeFile(path.join(runtimeDir, "GeneratedSiteRuntime.module.css"), runtimeCss, "utf8"),
    fs.writeFile(path.join(folder.absolutePath, "generation-report.json"), JSON.stringify(report, null, 2), "utf8"),
    fs.writeFile(path.join(folder.absolutePath, "CLAUDE-REFINEMENT.md"), refinementPrompt(siteData), "utf8"),
    fs.writeFile(path.join(folder.absolutePath, "README.md"), `# ${placeData.name}\n\nLanding page premium gerada pelo LeadFlow.\n\n## Executar\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nAbra http://localhost:3000.\n\n## Stack visual\n\n- Next.js 15 + React 19\n- Framer Motion para entrada e microinterações\n- GSAP ScrollTrigger para movimento de scroll\n- Tipografia via next/font\n- Direção visual específica para o nicho\n- prefers-reduced-motion e foco por teclado\n\n## Validação obrigatória\n\n- Revise textos, telefones, horários e serviços antes do deploy.\n- Confirme com o cliente o direito de uso das imagens.\n- Mantenha as atribuições das fotos quando existirem.\n- Teste em 320px, 768px, 1024px e 1440px.\n- A assinatura \"Prévia desenvolvida por Saulo Pavanello\" já está aplicada.\n- Consulte CLAUDE-REFINEMENT.md para uma segunda passada com /ui-ux-pro-max e /frontend-design.\n`, "utf8"),
  ]);

  return { folderName: folder.folderName, folderPath: path.relative(process.cwd(), folder.absolutePath).replace(/\\/g, "/"), aiUsed, warning: aiWarning, imageCount: siteData.images.length, designDirection: siteData.design.direction, skillMode: skillRouting.mode, skills: skillRouting.skills, skillRoutingReason: skillRouting.reason, siteData };
}

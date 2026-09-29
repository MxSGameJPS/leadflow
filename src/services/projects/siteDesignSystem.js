function clean(value,max=1800){return String(value??"").replace(/\u0000/g,"").trim().slice(0,max)}
function safeColor(value,fallback){const raw=clean(value,40);return /^#[0-9a-fA-F]{3,8}$/.test(raw)?raw:fallback}
function list(value,fallback=[]){if(!Array.isArray(value))return fallback;return value.map(item=>clean(item,220)).filter(Boolean).slice(0,8)}
function densityTokens(site){
  const density=site?.design?.composition?.density||"balanced";
  if(density==="airy")return{section:"clamp(5.5rem,10vw,9rem)",sectionCompact:"clamp(3.5rem,7vw,6rem)",gutter:"clamp(1.25rem,5vw,4.5rem)",content:"76rem",narrow:"46rem"};
  if(density==="compact")return{section:"clamp(3.5rem,7vw,6rem)",sectionCompact:"clamp(2.5rem,5vw,4rem)",gutter:"clamp(1rem,3.5vw,3rem)",content:"72rem",narrow:"44rem"};
  return{section:"clamp(4.5rem,8vw,7.5rem)",sectionCompact:"clamp(3rem,6vw,5rem)",gutter:"clamp(1.125rem,4vw,3.75rem)",content:"74rem",narrow:"45rem"};
}
function radiusTokens(site){
  const radius=site?.design?.radius||"soft";
  if(radius==="sharp")return{sm:"4px",md:"8px",lg:"12px",pill:"999px"};
  if(radius==="rounded")return{sm:"12px",md:"22px",lg:"36px",pill:"999px"};
  return{sm:"8px",md:"14px",lg:"24px",pill:"999px"};
}
export function fallbackCodegenDesignSystem(site={}){
  const c=site?.design?.colors||{},spacing=densityTokens(site),radius=radiusTokens(site);
  return{
    signatureMotif:clean(site?.design?.signatureLabel,220)||"Um gesto visual reconhecível que se repete com moderação e conecta a marca às seções.",
    shapeLanguage:"Geometria coerente com o nicho e com a direção visual; variar escala sem repetir o mesmo card em toda a página.",
    surfaceLanguage:"Superfícies com hierarquia clara entre fundo, planos de conteúdo e destaques; profundidade somente quando tiver função.",
    typeHierarchy:"Título de display expressivo, corpo de leitura confortável e microcopy curta; contraste forte de escala em vez de excesso de pesos.",
    spacingRhythm:"Respiração generosa entre blocos, alternando momentos densos e abertos para criar ritmo editorial.",
    imageTreatment:"Fotografia real como evidência do negócio, com cortes deliberados, proporções variadas e sem repetição decorativa da mesma imagem.",
    buttonLanguage:"CTAs com hierarquia inequívoca, área de toque confortável e tratamento visual consistente com a identidade.",
    antiPatterns:["grades de cards idênticos sem necessidade","gradiente roxo/azul genérico","glassmorphism aplicado em todas as seções","mesmo border-radius em cada elemento","hero SaaS genérico para negócio local","ícones ou imagens placeholder"],
    tokens:{
      primary:safeColor(c.primary,"#17324D"),accent:safeColor(c.accent,"#D59B42"),background:safeColor(c.background,"#F5F5F3"),surface:safeColor(c.surface,"#FFFFFF"),text:safeColor(c.text,"#14202A"),muted:safeColor(c.muted,"#66717D"),
      sectionSpace:spacing.section,sectionSpaceCompact:spacing.sectionCompact,gutter:spacing.gutter,contentMax:spacing.content,contentNarrow:spacing.narrow,
      radiusSm:radius.sm,radiusMd:radius.md,radiusLg:radius.lg,radiusPill:radius.pill,
      shadowSoft:"0 12px 34px rgba(15,23,42,.08)",shadowElevated:"0 26px 70px rgba(15,23,42,.14)",
      transitionFast:"160ms cubic-bezier(.2,.8,.2,1)",transitionBase:"320ms cubic-bezier(.2,.8,.2,1)",
      focusRing:"0 0 0 3px rgba(37,99,235,.28)",buttonHeight:"48px",readingMeasure:"68ch"
    }
  };
}
export function normalizeCodegenDesignSystem(value,site={}){
  const fallback=fallbackCodegenDesignSystem(site);
  const source=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  return{
    signatureMotif:clean(source.signatureMotif,600)||fallback.signatureMotif,
    shapeLanguage:clean(source.shapeLanguage,700)||fallback.shapeLanguage,
    surfaceLanguage:clean(source.surfaceLanguage,700)||fallback.surfaceLanguage,
    typeHierarchy:clean(source.typeHierarchy,700)||fallback.typeHierarchy,
    spacingRhythm:clean(source.spacingRhythm,700)||fallback.spacingRhythm,
    imageTreatment:clean(source.imageTreatment,700)||fallback.imageTreatment,
    buttonLanguage:clean(source.buttonLanguage,700)||fallback.buttonLanguage,
    antiPatterns:list(source.antiPatterns,fallback.antiPatterns),
    tokens:fallback.tokens
  };
}
export function codegenThemeCss(site={},plan={}){
  const system=normalizeCodegenDesignSystem(plan?.designSystem,site),t=system.tokens;
  return '.body{--color-primary:'+t.primary+';--color-accent:'+t.accent+';--color-background:'+t.background+';--color-surface:'+t.surface+';--color-text:'+t.text+';--color-muted:'+t.muted+';--space-section:'+t.sectionSpace+';--space-section-compact:'+t.sectionSpaceCompact+';--space-gutter:'+t.gutter+';--content-max:'+t.contentMax+';--content-narrow:'+t.contentNarrow+';--radius-sm:'+t.radiusSm+';--radius-md:'+t.radiusMd+';--radius-lg:'+t.radiusLg+';--radius-pill:'+t.radiusPill+';--radius:'+t.radiusMd+';--shadow-soft:'+t.shadowSoft+';--shadow-elevated:'+t.shadowElevated+';--transition-fast:'+t.transitionFast+';--transition-base:'+t.transitionBase+';--focus-ring:'+t.focusRing+';--button-height:'+t.buttonHeight+';--reading-measure:'+t.readingMeasure+';margin:0;background:var(--color-background);color:var(--color-text);font-family:var(--font-body),Arial,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}';
}

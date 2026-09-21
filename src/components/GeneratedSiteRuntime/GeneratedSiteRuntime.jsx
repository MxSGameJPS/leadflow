"use client";

import { useEffect, useMemo, useRef } from "react";
import s from "./GeneratedSiteRuntime.module.css";

const FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap";
const FONT_PAIRS = {
  editorial: { display: '"Cormorant Garamond", Georgia, serif', body: '"Manrope", Arial, sans-serif' },
  modern: { display: '"Space Grotesk", Arial, sans-serif', body: '"DM Sans", Arial, sans-serif' },
  geometric: { display: '"Space Grotesk", Arial, sans-serif', body: '"Manrope", Arial, sans-serif' },
  humanist: { display: '"Fraunces", Georgia, serif', body: '"DM Sans", Arial, sans-serif' },
  luxury: { display: '"Cormorant Garamond", Georgia, serif', body: '"DM Sans", Arial, sans-serif' },
};

function assetUrl(source, assetBase) {
  const value = String(source || "");
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (!assetBase) return value.startsWith("/") ? value : "/" + value;
  return String(assetBase).replace(/\/$/, "") + "/" + value.replace(/^\/+/, "");
}

function Icon({ name }) {
  const paths = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.92Z"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    star: <path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9L12 3Z"/>,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></>,
    spark: <><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.check}</svg>;
}

function actionHref(action, site) {
  if (action === "whatsapp" && site.whatsapp) return "https://wa.me/" + site.whatsapp;
  if (action === "phone" && site.phone) return "tel:" + String(site.phone).replace(/[^+\d]/g, "");
  if (action === "instagram" && site.instagram) return site.instagram;
  if (action === "maps" && site.mapsLink) return site.mapsLink;
  return "#contato";
}

function actionIcon(action) {
  if (action === "whatsapp" || action === "phone") return "phone";
  if (action === "instagram") return "instagram";
  if (action === "maps") return "pin";
  return "arrow";
}

function ActionLink({ config, site, className = "" }) {
  if (!config?.label) return null;
  const href = actionHref(config.action, site);
  const external = /^https?:/i.test(href);
  return <a className={className} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}><span>{config.label}</span><Icon name={actionIcon(config.action)}/></a>;
}

function SectionShell({ section, children, className = "", id }) {
  return <section id={id} className={className} data-tone={section.tone || "base"} data-variant={section.variant || ""} data-align={section.align || "left"} data-lf-reveal>{children}</section>;
}

function Visual({ site, images, index = 0, className = "", label = "" }) {
  const image = images[index] || images[0] || "";
  if (image) return <figure className={className}><img src={image} alt={label || ("Imagem de " + (site.brandName || "negócio"))}/></figure>;
  return <div className={className + " " + s.mediaFallback}><span>{String(site.brandName || "L").slice(0,1)}</span><small>{site.segment || "Negócio local"}</small></div>;
}

function Hero({ section, site, images }) {
  const primary = site.ctas?.primary || { label: site.primaryCta || "Falar agora", action: "contact" };
  const secondary = site.ctas?.secondary || { label: site.secondaryCta || "Ver localização", action: "maps" };
  const variant = section.variant || "split-minimal";

  return <SectionShell section={section} className={s.hero} id="top">
    <div className={s.heroBg} aria-hidden="true">{variant === "fullbleed-cinematic" && images[section.imageIndex || 0] ? <img src={images[section.imageIndex || 0]} alt=""/> : null}</div>
    <div className={s.heroInner}>
      <div className={s.heroCopy}>
        <span className={s.eyebrow}><Icon name="spark"/>{site.eyebrow}</span>
        <h1>{site.heroTitle}</h1>
        <p>{site.heroText}</p>
        <div className={s.heroActions}><ActionLink config={primary} site={site} className={s.primary}/><ActionLink config={secondary} site={site} className={s.secondary}/></div>
        <div className={s.trustLine}>
          {site.rating && <div><strong>{site.rating}</strong><span>Google</span></div>}
          {site.reviews && <div><strong>{site.reviews}</strong><span>avaliações</span></div>}
          {site.city && <div><strong>{site.city}</strong><span>atendimento local</span></div>}
        </div>
      </div>

      <div className={s.heroVisual}>
        <Visual site={site} images={images} index={section.imageIndex || 0} className={s.heroMainMedia} label={"Apresentação de " + (site.brandName || "negócio")}/>
        {variant === "collage" && images.length > 1 && <Visual site={site} images={images} index={(section.imageIndex || 0) + 1} className={s.heroSecondMedia} label={"Detalhe de " + (site.brandName || "negócio")}/>}
        {variant === "portrait-editorial" && <div className={s.verticalSignature}>{site.design?.signatureLabel || site.brandName}</div>}
        {["layered","collage"].includes(variant) && <div className={s.heroNote}><small>Conceito</small><strong>{site.blueprint?.visualThesis || site.pageJob}</strong></div>}
      </div>
    </div>
  </SectionShell>;
}

function About({ section, site, images }) {
  const showImage = section.variant === "image-note";
  return <SectionShell section={section} className={s.about} id="sobre">
    <div className={s.aboutInner}>
      <div className={s.aboutTitle}><span className={s.sectionLabel}>Sobre</span><h2>{site.aboutTitle}</h2></div>
      <div className={s.aboutBody}><p>{site.aboutText}</p><span className={s.audience}>Para {site.audience}</span></div>
      {showImage && <Visual site={site} images={images} index={section.imageIndex || 1} className={s.aboutMedia} label={"Sobre " + (site.brandName || "negócio")}/>}
    </div>
  </SectionShell>;
}

function Services({ section, site }) {
  const services = Array.isArray(site.services) ? site.services : [];
  if (!services.length) return null;
  return <SectionShell section={section} className={s.services} id="servicos">
    <div className={s.sectionHead}><div><span className={s.sectionLabel}>Informações</span><h2>{site.servicesTitle}</h2></div>{site.servicesIntro && <p>{site.servicesIntro}</p>}</div>
    <div className={s.serviceList}>{services.map((item,index)=><article className={s.serviceItem} key={(item.title || "item")+index}><span className={s.serviceIndex}>{String(index+1).padStart(2,"0")}</span><div className={s.serviceText}><h3>{item.title}</h3><p>{item.description}</p></div><Icon name={index===0?"spark":"arrow"}/></article>)}</div>
  </SectionShell>;
}

function Gallery({ section, site, images }) {
  if (images.length < 2) return null;
  return <SectionShell section={section} className={s.gallery}>
    <div className={s.galleryHead}><span className={s.sectionLabel}>Atmosfera</span><strong>{site.brandName}</strong></div>
    <div className={s.galleryGrid}>{images.slice(0,5).map((image,index)=><figure key={image+index}><img src={image} alt={"Imagem " + (index+1) + " de " + (site.brandName || "negócio")}/></figure>)}</div>
  </SectionShell>;
}

function Proof({ section, site }) {
  const hasFacts = site.rating || site.reviews || site.address || site.phone || site.city;
  if (!hasFacts && !site.proofText) return null;
  return <SectionShell section={section} className={s.proof}>
    <div className={s.proofIntro}><span className={s.sectionLabel}>Confiança</span><h2>{site.proofTitle}</h2><p>{site.proofText}</p></div>
    <div className={s.proofFacts}>
      {site.rating && <div className={s.ratingFact}><Icon name="star"/><strong>{site.rating}</strong><span>avaliação no Google</span></div>}
      {site.reviews && <div><strong>{site.reviews}</strong><span>avaliações registradas</span></div>}
      {site.city && <div><strong>{site.city}</strong><span>cidade</span></div>}
      {site.phone && <div><strong>{site.phone}</strong><span>contato</span></div>}
    </div>
  </SectionShell>;
}

function Location({ section, site, images }) {
  if (!site.address && !site.mapsLink) return null;
  const mapsConfig = { label: "Abrir no Google Maps", action: "maps" };
  const hasLocationMedia = images.length > 1;
  return <SectionShell section={section} className={s.location}>
    <div className={s.locationInner} data-has-media={hasLocationMedia ? "true" : "false"}>
      <div className={s.locationCopy}><span className={s.sectionLabel}>Localização</span><h2>{site.city ? "Em " + site.city : "Onde encontrar"}</h2>{site.address && <p>{site.address}</p>}<ActionLink config={mapsConfig} site={site} className={s.locationAction}/></div>
      {hasLocationMedia && <Visual site={site} images={images} index={section.imageIndex || 1} className={s.locationMedia} label={"Localização de " + (site.brandName || "negócio")}/>}
    </div>
  </SectionShell>;
}

function Contact({ section, site }) {
  const primary = site.ctas?.primary || { label: site.primaryCta || "Falar agora", action: "contact" };
  const secondary = site.ctas?.secondary || { label: site.secondaryCta || "Ver localização", action: "maps" };
  return <SectionShell section={section} className={s.contact} id="contato">
    <div className={s.contactInner}><div><span className={s.sectionLabel}>Próximo passo</span><h2>{site.contactTitle}</h2><p>{site.contactText}</p></div><div className={s.contactActions}><ActionLink config={primary} site={site} className={s.contactPrimary}/><ActionLink config={secondary} site={site} className={s.contactSecondary}/></div></div>
  </SectionShell>;
}

function MobileActionBar({ site }) {
  const primary = site.ctas?.primary || { label: site.primaryCta || "Falar agora", action: "contact" };
  const candidate = site.ctas?.secondary;
  const secondary = candidate && candidate.action !== primary.action ? candidate : (site.mapsLink ? { label: "Como chegar", action: "maps" } : null);
  return <div className={s.mobileActionBar} aria-label="Ações rápidas">
    <ActionLink config={primary} site={site} className={s.mobilePrimaryAction}/>
    {secondary && <ActionLink config={secondary} site={site} className={s.mobileSecondaryAction}/>}
  </div>;
}

function RenderSection({ section, site, images }) {
  if (section.type === "hero") return <Hero section={section} site={site} images={images}/>;
  if (section.type === "about") return <About section={section} site={site} images={images}/>;
  if (section.type === "services") return <Services section={section} site={site}/>;
  if (section.type === "gallery") return <Gallery section={section} site={site} images={images}/>;
  if (section.type === "proof") return <Proof section={section} site={site}/>;
  if (section.type === "location") return <Location section={section} site={site} images={images}/>;
  if (section.type === "contact") return <Contact section={section} site={site}/>;
  return null;
}

export default function GeneratedSiteRuntime({ site = {}, assetBase = "" }) {
  const rootRef = useRef(null);
  const design = site.design || {};
  const colors = design.colors || {};
  const composition = design.composition || {};
  const images = Array.isArray(site.images) ? site.images.map(image=>assetUrl(image,assetBase)).filter(Boolean) : [];
  const sections = Array.isArray(site.blueprint?.sections) && site.blueprint.sections.length ? site.blueprint.sections : [
    {type:"hero",variant:"split-minimal",tone:"base",imageIndex:0,align:"left"},
    {type:"about",variant:"large-type",tone:"primary",imageIndex:1,align:"left"},
    {type:"proof",variant:"facts-list",tone:"surface",imageIndex:0,align:"left"},
    {type:"location",variant:"editorial",tone:"base",imageIndex:1,align:"left"},
    {type:"contact",variant:"band",tone:"accent",imageIndex:0,align:"left"},
  ];
  const effects = useMemo(()=>new Set(Array.isArray(site.effects)?site.effects:[]),[site.effects]);
  const effectKey=[...effects].sort().join(" ");
  const fonts=FONT_PAIRS[design.fontPair]||FONT_PAIRS.modern;
  const radius=design.radius==="sharp"?"2px":design.radius==="rounded"?"28px":"14px";
  const style={
    "--primary":colors.primary||"#17324D",
    "--accent":colors.accent||"#D59B42",
    "--background":colors.background||"#F3F1EC",
    "--surface":colors.surface||"#FFFFFF",
    "--text":colors.text||"#14202A",
    "--muted":colors.muted||"#68737D",
    "--radius":radius,
    "--font-display":fonts.display,
    "--font-body":fonts.body,
  };

  useEffect(()=>{
    if(!document.getElementById("leadflow-generated-site-fonts")){
      const link=document.createElement("link");link.id="leadflow-generated-site-fonts";link.rel="stylesheet";link.href=FONT_STYLESHEET;document.head.appendChild(link);
    }
  },[]);

  useEffect(()=>{
    const root=rootRef.current;if(!root)return;
    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const reveal=[...root.querySelectorAll("[data-lf-reveal]")];
    let observer=null;
    if(effects.has("section-reveal")&&!reduced&&"IntersectionObserver" in window){
      observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.setAttribute("data-lf-visible","true");observer.unobserve(entry.target)}}},{threshold:.1,rootMargin:"0px 0px -7% 0px"});
      reveal.forEach(element=>observer.observe(element));
    }else reveal.forEach(element=>element.setAttribute("data-lf-visible","true"));
    const previous=document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior=effects.has("smooth-scroll")?"smooth":"";
    return()=>{observer?.disconnect();document.documentElement.style.scrollBehavior=previous};
  },[effectKey,effects]);

  const primary=site.ctas?.primary||{label:site.primaryCta||"Falar agora",action:"contact"};

  return <main ref={rootRef} className={s.root} style={style} data-effects={effectKey} data-concept={site.blueprint?.concept||"editorial-local"} data-direction={design.direction||"minimal"} data-density={composition.density||"balanced"}>
    <header className={s.siteHeader} data-nav={composition.navStyle||"minimal"}>
      <a className={s.brand} href="#top">{site.brandName}</a>
      <nav aria-label="Navegação principal"><a href="#sobre">Sobre</a>{Array.isArray(site.services)&&site.services.length>0&&<a href="#servicos">Informações</a>}<a href="#contato">Contato</a></nav>
      <ActionLink config={primary} site={site} className={s.headerCta}/>
    </header>

    <div className={s.blueprint}>{sections.map((section,index)=><RenderSection key={section.type+"-"+index} section={section} site={site} images={images}/>)}</div>

    <footer className={s.footer}><div><strong>{site.brandName}</strong><span>{site.segment}{site.city?" · "+site.city:""}</span></div><p>Prévia desenvolvida por Saulo Pavanello</p></footer>
    {Array.isArray(site.attributions)&&site.attributions.length>0&&<div className={s.attributions}>Fotos: {site.attributions.map((item,index)=><span key={(item.name||"foto")+index}>{index>0?" · ":""}{item.uri?<a href={item.uri} target="_blank" rel="noreferrer">{item.name}</a>:item.name}</span>)}</div>}
    <MobileActionBar site={site}/>
    {site.whatsapp&&<a className={s.floatingWhatsapp} href={"https://wa.me/"+site.whatsapp} target="_blank" rel="noreferrer" aria-label="Conversar pelo WhatsApp"><Icon name="phone"/><span>WhatsApp</span></a>}
  </main>;
}

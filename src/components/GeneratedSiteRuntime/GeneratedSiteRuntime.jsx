"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
    spark: <><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.check}</svg>;
}

function ActionLink({ href, children, className = "", icon = "arrow" }) {
  if (!href) return null;
  const external = /^https?:/i.test(href);
  return <a className={className} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}><span>{children}</span><Icon name={icon}/></a>;
}

export default function GeneratedSiteRuntime({ site = {}, assetBase = "" }) {
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const design = site.design || {};
  const composition = design.composition || {};
  const colors = design.colors || {};
  const services = Array.isArray(site.services) ? site.services : [];
  const images = Array.isArray(site.images) ? site.images.map(image => assetUrl(image, assetBase)).filter(Boolean) : [];
  const effects = useMemo(() => new Set(Array.isArray(site.effects) ? site.effects : []), [site.effects]);
  const effectKey = [...effects].sort().join(" ");
  const hasEffect = name => effects.has(name);
  const phoneHref = site.phone ? "tel:" + String(site.phone).replace(/[^+\d]/g, "") : "";
  const whatsappHref = site.whatsapp ? "https://wa.me/" + site.whatsapp : "";
  const primaryHref = whatsappHref || phoneHref || site.mapsLink || "#contato";
  const fonts = FONT_PAIRS[design.fontPair] || FONT_PAIRS.modern;
  const radius = design.radius === "sharp" ? "2px" : design.radius === "rounded" ? "28px" : "14px";
  const motionDistance = (composition.motion || 5) >= 8 ? 46 : design.motion === "expressive" ? 38 : design.motion === "subtle" ? 14 : 26;

  const style = {
    "--primary": colors.primary || "#17324D",
    "--accent": colors.accent || "#D59B42",
    "--background": colors.background || "#F3F1EC",
    "--surface": colors.surface || "#FFFFFF",
    "--text": colors.text || "#14202A",
    "--muted": colors.muted || "#68737D",
    "--radius": radius,
    "--font-display": fonts.display,
    "--font-body": fonts.body,
  };

  useEffect(() => {
    if (!document.getElementById("leadflow-generated-site-fonts")) {
      const link = document.createElement("link");
      link.id = "leadflow-generated-site-fonts";
      link.rel = "stylesheet";
      link.href = FONT_STYLESHEET;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = hasEffect("smooth-scroll") ? "smooth" : "";
    if (reducedMotion || !rootRef.current || (!hasEffect("section-reveal") && !hasEffect("parallax-hero"))) {
      return () => { document.documentElement.style.scrollBehavior = previousScrollBehavior; };
    }
    let context;
    let active = true;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([gsapModule, triggerModule]) => {
      if (!active || !rootRef.current) return;
      const gsap = gsapModule.gsap;
      const ScrollTrigger = triggerModule.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        if (hasEffect("section-reveal")) {
          gsap.utils.toArray("[data-lf-reveal]").forEach(element => {
            gsap.fromTo(element, { y: motionDistance, opacity: 0 }, { y: 0, opacity: 1, duration: design.motion === "subtle" ? 0.5 : 0.82, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 86%", once: true } });
          });
        }
        if (hasEffect("parallax-hero")) {
          gsap.utils.toArray("[data-lf-parallax]").forEach(element => {
            gsap.to(element, { yPercent: -8, ease: "none", scrollTrigger: { trigger: element, start: "top bottom", end: "bottom top", scrub: 0.8 } });
          });
        }
      }, rootRef);
    });
    return () => {
      active = false;
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      if (context) context.revert();
    };
  }, [reducedMotion, motionDistance, effectKey]);

  const heroInitial = reducedMotion || !hasEffect("entrance-motion") ? false : { opacity: 0, y: motionDistance };
  const heroTransition = { duration: design.motion === "subtle" ? 0.45 : 0.8, ease: [0.22, 1, 0.36, 1] };

  return <main
    ref={rootRef}
    className={s.root}
    style={style}
    data-direction={design.direction || "minimal"}
    data-archetype={composition.archetype || "editorial-offset"}
    data-nav={composition.navStyle || "minimal"}
    data-services={composition.servicesLayout || "split-list"}
    data-gallery={composition.galleryLayout || "duo"}
    data-rhythm={composition.sectionRhythm || "alternating"}
    data-density={composition.density || "airy"}
    data-hero-media={composition.heroMedia || "side"}
    data-accent-shape={composition.accentShape || "line"}
    data-effects={effectKey}
  >
    <header className={s.siteHeader}>
      <a className={s.brand} href="#top" aria-label={"Ir ao início de " + (site.brandName || "site")}>{site.brandName}</a>
      <nav aria-label="Navegação principal"><a href="#sobre">Sobre</a><a href="#servicos">Diferenciais</a><a href="#contato">Contato</a></nav>
      <ActionLink href={primaryHref} className={s.headerCta}>{site.primaryCta || "Falar agora"}</ActionLink>
    </header>

    <section className={s.hero} id="top">
      <div className={s.heroAtmosphere} aria-hidden="true"/>
      <motion.div className={s.heroCopy} initial={heroInitial} animate={{ opacity: 1, y: 0 }} transition={heroTransition}>
        <span className={s.eyebrow}><Icon name="spark"/>{site.eyebrow}</span>
        <h1>{site.heroTitle}</h1>
        <p>{site.heroText}</p>
        <div className={s.heroActions}><ActionLink href={primaryHref} className={s.primary}>{site.primaryCta || "Falar agora"}</ActionLink>{site.mapsLink && <ActionLink href={site.mapsLink} className={s.secondary} icon="pin">{site.secondaryCta || "Ver localização"}</ActionLink>}</div>
        <div className={s.trustLine} aria-label="Informações de confiança">{site.rating && <div><strong>{site.rating}</strong><span>avaliação no Google</span></div>}{site.reviews && <div><strong>{site.reviews}</strong><span>avaliações registradas</span></div>}{site.city && <div><strong>{site.city}</strong><span>atendimento local</span></div>}</div>
      </motion.div>

      <motion.div className={s.heroVisual} initial={reducedMotion || !hasEffect("entrance-motion") ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...heroTransition, delay: 0.12 }}>
        <div className={s.signatureRail}><span>{design.signatureLabel}</span></div>
        <div className={s.heroImage} data-lf-parallax>{images[0] ? <img src={images[0]} alt={"Ambiente ou apresentação de " + (site.brandName || "negócio")}/> : <div className={s.mediaFallback}><span>{String(site.brandName || "L").slice(0,1)}</span><small>{site.segment || "Negócio local"}</small></div>}</div>
        <div className={s.heroNote}><span>Direção</span><strong>{site.pageJob}</strong></div>
        {images[1] && <div className={s.heroImageSecondary}><img src={images[1]} alt={"Detalhe de " + (site.brandName || "negócio")}/></div>}
      </motion.div>
    </section>

    <section className={s.statement} id="sobre" data-lf-reveal>
      <div><span className={s.sectionLabel}>Direção</span><h2>{site.aboutTitle}</h2></div>
      <div className={s.statementBody}><p>{site.aboutText}</p><span className={s.audience}>Criado para: {site.audience}</span></div>
    </section>

    <section className={s.services} id="servicos">
      <div className={s.sectionHead} data-lf-reveal><div><span className={s.sectionLabel}>Experiência</span><h2>{site.servicesTitle}</h2></div><p>{site.servicesIntro}</p></div>
      <div className={s.serviceComposition}>{services.map((service,index)=><article className={s.serviceCard} key={service.title || index} data-lf-reveal><span className={s.serviceMarker}>{String(index+1).padStart(2,"0")}</span><div className={s.serviceIcon}><Icon name={index===0?"spark":"check"}/></div><h3>{service.title}</h3><p>{service.description}</p></article>)}</div>
    </section>

    {images.length > 2 && <section className={s.gallery} aria-label={"Galeria de " + (site.brandName || "negócio")}>{images.slice(2,6).map((image,index)=><figure key={image+index} data-lf-reveal><img src={image} alt={"Imagem " + (index+1) + " de " + (site.brandName || "negócio")}/></figure>)}</section>}

    <section className={s.proof} data-lf-reveal>
      <div className={s.proofCopy}><span className={s.sectionLabel}>Confiança</span><h2>{site.proofTitle}</h2><p>{site.proofText}</p></div>
      <div className={s.proofPanel}>{site.address && <div><Icon name="pin"/><span><small>Endereço</small><strong>{site.address}</strong></span></div>}{Array.isArray(site.hours) && site.hours.length>0 && <div><Icon name="clock"/><span><small>Horários informados</small><strong>{site.hours.slice(0,2).join(" · ")}</strong></span></div>}{site.phone && <div><Icon name="phone"/><span><small>Contato</small><strong>{site.phone}</strong></span></div>}</div>
    </section>

    <section className={s.contact} id="contato" data-lf-reveal>
      <div><span className={s.sectionLabel}>Próximo passo</span><h2>{site.contactTitle}</h2><p>{site.contactText}</p></div>
      <div className={s.contactActions}><ActionLink href={primaryHref} className={s.contactPrimary}>{site.primaryCta || "Falar agora"}</ActionLink>{site.mapsLink && <ActionLink href={site.mapsLink} className={s.contactSecondary} icon="pin">Abrir no Google Maps</ActionLink>}</div>
    </section>

    <footer className={s.footer}><div><strong>{site.brandName}</strong><span>{site.segment}{site.city ? " · " + site.city : ""}</span></div><p>Prévia desenvolvida por Saulo Pavanello</p></footer>
    {Array.isArray(site.attributions) && site.attributions.length>0 && <div className={s.attributions}>Fotos: {site.attributions.map((item,index)=><span key={(item.name||"foto")+index}>{index>0?" · ":""}{item.uri?<a href={item.uri} target="_blank" rel="noreferrer">{item.name}</a>:item.name}</span>)}</div>}
    {whatsappHref && <motion.a className={s.floatingWhatsapp} href={whatsappHref} target="_blank" rel="noreferrer" aria-label="Conversar pelo WhatsApp" whileHover={reducedMotion?undefined:{y:-3}} whileTap={reducedMotion?undefined:{scale:.96}}><Icon name="phone"/><span>WhatsApp</span></motion.a>}
  </main>;
}

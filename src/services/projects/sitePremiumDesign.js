import fs from 'node:fs/promises';
import path from 'node:path';

const hex=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?value:null;
const text=(value,fallback)=>typeof value==='string'&&/^[\w\s,"'-]+$/.test(value)&&value.length<220?value:fallback;
function luminance(color){const channels=color.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722}
export function contrastRatio(a,b){const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05)}
const readable=(preferred,background)=>hex(preferred)&&contrastRatio(preferred,background)>=4.5?preferred:contrastRatio('#000000',background)>=contrastRatio('#FFFFFF',background)?'#000000':'#FFFFFF';
const seeds=[['#C33A27','#F4B942','#FFF9F2'],['#164F43','#CB9656','#F6FAF7'],['#244775','#A87432','#F6F8FC'],['#61374D','#BE8566','#FCF7FA'],['#464D2B','#D6A23F','#FBFAF2']];
export function premiumDesignSystem(direction={},site={}){
  const raw=direction.palette||{},observed=site.brandEvidence||{},existing=site.design?.colors||{};
  const hash=[...(site.brandName||site.segment||'lead')].reduce((sum,c)=>((sum*31)+c.codePointAt(0))>>>0,0);
  const seed=seeds[hash%seeds.length];
  const choose=(...values)=>values.map(hex).find(Boolean);
  const brand=choose(raw.brand,raw.primary,raw.ember,raw.tomato,raw.leaf,raw.ink,observed.dominantColors?.[0],existing.primary,seed[0]);
  const accent=choose(raw.accent,raw.cheese,raw.corn,raw.leaf,observed.accentColors?.[0],existing.accent,seed[1]);
  const background=choose(raw.background,raw.paper,existing.background,seed[2]);
  const surface=choose(raw.surface,existing.surface,'#FFFFFF');
  const foreground=readable(choose(raw.text,raw.charcoal,raw.ink,existing.text),background);
  return {
    version:1,palette:{brand,accent,background,surface,text:foreground,muted:readable(raw.muted,background),onBrand:readable(raw.onBrand,brand),onSurface:readable(raw.onSurface,surface),border:choose(raw.border,raw.steel,'#D6D9DC')},
    typography:{display:text(direction.typography?.display,'system-ui, -apple-system, "Segoe UI", sans-serif'),body:text(direction.typography?.body,'system-ui, -apple-system, "Segoe UI", sans-serif'),readingMeasure:'66ch'},
    tokens:{gutter:'clamp(1rem, 4vw, 4rem)',contentMax:'80rem',sectionSpace:'clamp(3rem, 6vw, 6rem)',controlHeight:'44px',radius:'12px',motion:'180ms cubic-bezier(.2,.8,.2,1)'},
    signature:String(direction.signature||site.design?.signatureLabel||'').slice(0,800),
    requirements:['Uma identidade específica ao negócio; nenhuma sequência fixa de seções.','Ação central evidente, estados vazio/erro/sucesso e teclado.','Texto de leitura confortável, contraste AA e controles de 44px.','Mídia dimensionada sem depender da altura intrínseca; mobile 320px.'],
  };
}
export function premiumFoundationCss(system){
  const p=system.palette,t=system.tokens;
  const colors=Object.entries(p).map(([key,value])=>`--lf-color-${key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${value}`).join(';');
  return `:root{${colors};--lf-font-display:${system.typography.display};--lf-font-body:${system.typography.body};--lf-gutter:${t.gutter};--lf-content-max:${t.contentMax};--lf-section-space:${t.sectionSpace};--lf-control-height:${t.controlHeight};--lf-radius:${t.radius};--lf-motion:${t.motion}}\n*,*::before,*::after{box-sizing:border-box}body{margin:0;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}button,input,select,textarea{font:inherit}button,input:not([type=checkbox]):not([type=radio]),select{min-height:var(--lf-control-height)}img,video{max-width:100%;display:block}button,a,input,select,textarea{-webkit-tap-highlight-color:transparent}:focus-visible{outline:3px solid currentColor;outline-offset:4px}button:disabled{cursor:not-allowed}textarea{resize:vertical}@media(max-width:640px){input,select,textarea{font-size:16px}}@media(prefers-reduced-motion:reduce){html:focus-within{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}\n.leadflow-inspect-hover{outline:2px dashed #2563eb!important;outline-offset:-2px}.leadflow-inspect-selected{outline:3px solid #2563eb!important;outline-offset:-3px}\n`;
}
export function inspectionScript(){return `(function(){if(new URLSearchParams(location.search).get('leadflowInspect')!=='1'||window.top===window)return;var selected=null;function marker(event){return event.target.closest&&event.target.closest('[data-leadflow-component]')}document.addEventListener('click',function(event){var item=marker(event);if(!item)return;event.preventDefault();event.stopPropagation();if(selected)selected.classList.remove('leadflow-inspect-selected');selected=item;item.classList.add('leadflow-inspect-selected');window.parent.postMessage({type:'leadflow:component-selected',component:item.getAttribute('data-leadflow-component')},'*')},true);document.addEventListener('mouseover',function(event){var item=marker(event);if(item)item.classList.add('leadflow-inspect-hover')},true);document.addEventListener('mouseout',function(event){var item=marker(event);if(item)item.classList.remove('leadflow-inspect-hover')},true);window.addEventListener('keydown',function(event){if(event.key==='Escape'){if(selected)selected.classList.remove('leadflow-inspect-selected');selected=null;window.parent.postMessage({type:'leadflow:component-selected',component:''},'*')}})})();`}
export async function installPremiumFoundation(root,system){
  await fs.mkdir(path.join(root,'app'),{recursive:true});await fs.mkdir(path.join(root,'public'),{recursive:true});
  await fs.writeFile(path.join(root,'app/leadflow-foundation.css'),premiumFoundationCss(system));
  await fs.writeFile(path.join(root,'public/leadflow-inspector.js'),inspectionScript());
  const file=path.join(root,'app/layout.jsx');let source=await fs.readFile(file,'utf8');
  if(!source.includes('./leadflow-foundation.css')){const directive=source.match(/^\s*["']use client["'];\s*/);const offset=directive?directive[0].length:0;source=source.slice(0,offset)+'import "./leadflow-foundation.css";\n'+source.slice(offset);}
  // The script stays inert outside the local builder's inspect query.
  if(!source.includes('/leadflow-inspector.js'))source=source.replace('</body>','{process.env.NODE_ENV==="development" ? <script src="/leadflow-inspector.js" defer /> : null}</body>');
  await fs.writeFile(file,source);
}
export function builderComponentManifest(plan={}){
  const names=new Set(['Page']),components=[{name:'Page',role:'custom',sourceFile:'app/page.jsx',targetFiles:['app/page.jsx','app/globals.css']}];
  for(const task of plan.tasks||[])for(const sourceFile of task.targetFiles||[]){
    if(!sourceFile.endsWith('.jsx')||/State|Provider/.test(sourceFile))continue;
    const name=path.posix.basename(sourceFile,'.jsx');if(names.has(name))continue;names.add(name);
    components.push({name,role:'custom',purpose:task.title,sourceFile,targetFiles:task.targetFiles});
  }
  return components;
}

export function weakPremiumDimensions(dimensions={}){return ["visualCraft","brandSpecificity","brandFidelity","productIntent","mobile"].filter(key=>!Number.isFinite(dimensions[key])||dimensions[key]<7)}

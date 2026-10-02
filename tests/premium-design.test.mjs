import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {premiumDesignSystem,contrastRatio,premiumFoundationCss,installPremiumFoundation,builderComponentManifest,weakPremiumDimensions} from '../src/services/projects/sitePremiumDesign.js';
import {qualityPresentation,selectionFromPreviewMessage} from '../src/services/projects/siteBuilderPresentation.js';

const design=premiumDesignSystem({palette:{brand:'#E93624',background:'#FFF8ED',text:'#FFF8ED'},typography:{body:'url(https://bad.test/font)'}},{brandName:'Casa do Burguer'});
assert.equal(design.palette.brand,'#E93624');assert.ok(contrastRatio(design.palette.text,design.palette.background)>=4.5);assert.ok(contrastRatio(design.palette.onBrand,design.palette.brand)>=4.5);assert.ok(!design.typography.body.includes('url'));
assert.notDeepEqual(premiumDesignSystem({}, {brandName:'Alfa'}).palette,premiumDesignSystem({}, {brandName:'Beta'}).palette);
assert.match(premiumFoundationCss(design),/prefers-reduced-motion/);assert.match(premiumFoundationCss(design),/44px/);
const manifest=builderComponentManifest({tasks:[{targetFiles:['components/Catalog/Catalog.jsx','components/Catalog/Catalog.module.css','components/State/Provider.jsx']}]});
assert.equal(manifest.find(item=>item.name==='Catalog').sourceFile,'components/Catalog/Catalog.jsx');assert.ok(!manifest.some(item=>item.name==='Provider'));
assert.deepEqual(weakPremiumDimensions({visualCraft:9,brandSpecificity:9,brandFidelity:9,productIntent:9,mobile:4}),["mobile"]);
const frame={};assert.equal(selectionFromPreviewMessage({source:frame,origin:'http://local',data:{type:'leadflow:component-selected',component:'Catalog'}},frame,'http://local',manifest),'Catalog');
assert.equal(selectionFromPreviewMessage({source:{},origin:'http://local',data:{type:'leadflow:component-selected',component:'Catalog'}},frame,'http://local',manifest),null);
assert.equal(selectionFromPreviewMessage({source:frame,origin:'https://external',data:{type:'leadflow:component-selected',component:'Catalog'}},frame,'http://local',manifest),null);
assert.equal(qualityPresentation({pass:false,metrics:{functional:{pass:true,available:true,steps:['cart']}}}).visual,'Avaliação visual pendente');
const original=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'leadflow-premium-'));process.chdir(temp);
const root=path.join(temp,'generated-sites/test');
const {createProjectZip}=await import('../src/services/projects/zipProject.js');
try {
 await fs.mkdir(path.join(root,'app'),{recursive:true});await fs.writeFile(path.join(root,'app/layout.jsx'),'export default function Layout({children}){return <html><body>{children}</body></html>}');
 await installPremiumFoundation(root,design);await installPremiumFoundation(root,design);
 await fs.writeFile(path.join(root,'app/layout.jsx'),'"use client";\nexport default function Layout({children}){return <html><body>{children}</body></html>}');
 await installPremiumFoundation(root,design);
 const layout=await fs.readFile(path.join(root,'app/layout.jsx'),'utf8');assert.match(layout,/^"use client";/);assert.equal(layout.match(/import "\.\/leadflow-foundation.css"/g).length,1);assert.equal(layout.match(/src="\/leadflow-inspector.js"/g).length,1);
 for(const dir of ['.leadflow-build','quality','public'])await fs.mkdir(path.join(root,dir),{recursive:true});
 for(const file of ['.env','private.key','.leadflow-build/compiled.js','quality/trace.log','director-plan.json'])await fs.writeFile(path.join(root,file),'INTERNAL_NOT_EXPORTABLE');
 await fs.writeFile(path.join(root,'public/photo.jpg'),'PUBLIC_PHOTO');
 const zip=await createProjectZip('generated-sites/test');const names=[];let offset=0;
 while(zip.readUInt32LE(offset)===0x04034b50){const size=zip.readUInt32LE(offset+18),nameLength=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28);names.push(zip.subarray(offset+30,offset+30+nameLength).toString());offset+=30+nameLength+extra+size}
 assert.ok(names.includes('public/photo.jpg'));assert.ok(names.includes('app/leadflow-foundation.css'));assert.ok(!names.some(name=>/\.env|\.key|\.leadflow-build|quality|director-plan/.test(name)));
}finally{process.chdir(original);await fs.rm(temp,{recursive:true,force:true})}
console.log('Premium audit tests passed: distinct identity, contrast, foundation, iframe selection and clean ZIP.');

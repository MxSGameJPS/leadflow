const TYPES=new Set(["text","number","boolean","date","select","multi_select","url"]);
function key(value){return String(value||"").trim().toLowerCase().replace(/[^a-z0-9_]+/g,"_").replace(/^_+|_+$/g,"").slice(0,64)}
function text(value,max=500){return String(value??"").trim().slice(0,max)}
export function normalizeCustomFieldDefinition(input={}){
  const type=TYPES.has(input.type)?input.type:"text",name=key(input.name||input.label);
  const options=type==="select"||type==="multi_select"?[...new Set((Array.isArray(input.options)?input.options:[]).map(v=>text(v,120)).filter(Boolean))].slice(0,80):[];
  return{name,label:text(input.label||name,120),type,description:text(input.description,500),required:Boolean(input.required),options,active:input.active!==false,order:Number.isFinite(Number(input.order))?Number(input.order):0};
}
export function normalizeCustomFieldDefinitions(input=[]){
  const seen=new Set();
  return (Array.isArray(input)?input:[]).map(normalizeCustomFieldDefinition).filter(field=>field.name&&field.label&&!seen.has(field.name)&&seen.add(field.name)).slice(0,80).sort((a,b)=>a.order-b.order);
}
export function validateCustomFieldValue(definition,value){
  const field=normalizeCustomFieldDefinition(definition);
  if(value==null||value===""){if(field.required)return{valid:false,error:"required"};return{valid:true,value:null}}
  if(field.type==="number"){const n=Number(value);return Number.isFinite(n)?{valid:true,value:n}:{valid:false,error:"number"}}
  if(field.type==="boolean"){if([true,false].includes(value))return{valid:true,value};if(["true","false"].includes(String(value)))return{valid:true,value:String(value)==="true"};return{valid:false,error:"boolean"}}
  if(field.type==="date"){const d=new Date(String(value));return Number.isNaN(d.getTime())?{valid:false,error:"date"}:{valid:true,value:d.toISOString().slice(0,10)}}
  if(field.type==="url"){try{const url=new URL(String(value));return["http:","https:"].includes(url.protocol)?{valid:true,value:url.toString()}:{valid:false,error:"url"}}catch{return{valid:false,error:"url"}}}
  if(field.type==="select"){const v=text(value,500);return !field.options.length||field.options.includes(v)?{valid:true,value:v}:{valid:false,error:"option"}}
  if(field.type==="multi_select"){const values=[...new Set((Array.isArray(value)?value:[value]).map(v=>text(v,120)).filter(Boolean))];return values.every(v=>!field.options.length||field.options.includes(v))?{valid:true,value:values}:{valid:false,error:"option"}}
  return{valid:true,value:text(value,4000)};
}
export function normalizeCustomFieldValues(definitions=[],values={}){
  const output={},errors={};
  for(const field of normalizeCustomFieldDefinitions(definitions)){const result=validateCustomFieldValue(field,values?.[field.name]);if(result.valid){if(result.value!==null)output[field.name]=result.value}else errors[field.name]=result.error}
  return{values:output,errors,valid:Object.keys(errors).length===0};
}
export const CUSTOM_FIELD_TYPES=Object.freeze([...TYPES]);

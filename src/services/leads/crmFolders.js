export const folderKey=value=>String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
export function nicheLabel(lead){const raw=String(lead?.segment||'').trim();const key=folderKey(raw);if(/^restaurantes?$/.test(key))return 'Restaurantes';if(/^lanchonetes?$/.test(key))return 'Lanchonetes';if(/^(esteticas?|clinicas? de estetica)$/.test(key))return 'Estéticas';return raw||'Sem nicho';}
export const nicheKey=lead=>folderKey(nicheLabel(lead));
export function groupNiches(leads){const map=new Map();for(const lead of leads){const key=nicheKey(lead);const item=map.get(key)||{value:key,label:nicheLabel(lead),count:0};item.count++;map.set(key,item)}return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));}

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_POLICY, validatePolicy } from "./policy.js";
const root = process.env.LEADFLOW_DATA_DIR ? path.resolve(process.env.LEADFLOW_DATA_DIR) : path.join(process.cwd(),"data");
const file = path.join(root,"commercial-policy.json");
export async function getCommercialPolicy() {
  try { return validatePolicy(JSON.parse(await readFile(file,"utf8"))); }
  catch(error) { if(error.code==="ENOENT") return structuredClone(DEFAULT_POLICY); throw error; }
}
export async function saveCommercialPolicy(input) {
  const policy=validatePolicy(input);
  await mkdir(root,{recursive:true});
  const tmp=file+".tmp";
  await writeFile(tmp,JSON.stringify(policy,null,2),{encoding:"utf8",mode:0o600});
  await rename(tmp,file);
  return policy;
}

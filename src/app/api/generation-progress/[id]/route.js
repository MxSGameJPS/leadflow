import { NextResponse } from "next/server";
import { getGenerationProgress } from "../../../../services/projects/generationProgressStore.js";
export const dynamic="force-dynamic";
export async function GET(_request,{params}){
  const {id}=await params;
  const state=await getGenerationProgress(id);
  return NextResponse.json(state||{id,status:"waiting",events:[],files:[]},{headers:{"Cache-Control":"no-store"}});
}

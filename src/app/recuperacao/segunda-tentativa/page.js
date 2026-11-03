import {prisma} from "../../../lib/prisma.js";
import RecoverySecondAttempt from "../../../components/RecoverySecondAttempt/RecoverySecondAttempt.jsx";
export const dynamic="force-dynamic";
export default async function Page(){
 const sessionId=process.env.OPENWA_SESSION_ID||"";
 const first=await prisma.recoveryDispatch.findMany({where:{sessionId,status:"sent"},select:{chatId:true},take:300});
 const attempts=await prisma.recoverySecondAttempt.findMany({where:{sessionId},take:300});
 return <main><a href="/recuperacao/fila">Voltar</a><h1>Segunda tentativa</h1><RecoverySecondAttempt candidates={first.map(x=>x.chatId)} rows={attempts}/></main>;
}

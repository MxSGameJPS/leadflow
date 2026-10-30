import {prisma} from "../../lib/prisma.js";
import SocialStudio from "../../components/SocialStudio/SocialStudio.jsx";
import styles from "./page.module.css";
export const dynamic="force-dynamic";
export default async function SocialMediaPage(){
 const posts=await prisma.socialPost.findMany({orderBy:{createdAt:"desc"},take:300});
 const initialPosts=posts.map(post=>({...post,createdAt:post.createdAt?.toISOString(),updatedAt:post.updatedAt?.toISOString(),scheduledAt:post.scheduledAt?.toISOString()||null,approvedAt:post.approvedAt?.toISOString()||null}));
 return <main className={styles.page}><header><h1>Agente Social Media</h1><p>Planejamento de conteúdo, produção de legendas e agenda de publicações para Instagram e Facebook.</p></header><SocialStudio initialPosts={initialPosts}/></main>;
}

import GeneratedSiteRuntime from "../GeneratedSiteRuntime/GeneratedSiteRuntime.jsx";
import styles from "./SitePreview.module.css";

export default function SitePreview({ project, previewUrl="", previewError="", inspect=false }) {
  if(previewError){
    return <main className={styles.error}><div><strong>Não foi possível abrir a prévia real.</strong><p>{previewError}</p></div></main>;
  }
  if(previewUrl){
    const separator=previewUrl.includes("?")?"&":"?";
    const src=inspect?previewUrl+separator+"leadflowInspect=1":previewUrl;
    return <main className={styles.frameShell}><iframe className={styles.frame} src={src} title={"Prévia de "+(project?.name||"site")}/></main>;
  }
  const site=project?.siteData||{};
  return <GeneratedSiteRuntime site={site} assetBase={"/api/projects/"+encodeURIComponent(project.id)+"/assets"}/>;
}

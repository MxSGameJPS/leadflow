import GeneratedSiteRuntime from "../GeneratedSiteRuntime/GeneratedSiteRuntime.jsx";
import styles from "./SitePreview.module.css";

export default function SitePreview({ project, previewUrl="", previewError="" }) {
  if(previewError){
    return <main className={styles.error}><div><strong>Não foi possível abrir a prévia real.</strong><p>{previewError}</p></div></main>;
  }
  if(previewUrl){
    return <main className={styles.frameShell}><iframe className={styles.frame} src={previewUrl} title={"Prévia de "+(project?.name||"site")}/></main>;
  }
  const site=project?.siteData||{};
  return <GeneratedSiteRuntime site={site} assetBase={"/api/projects/"+encodeURIComponent(project.id)+"/assets"}/>;
}

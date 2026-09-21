import GeneratedSiteRuntime from "../GeneratedSiteRuntime/GeneratedSiteRuntime.jsx";

export default function SitePreview({ project }) {
  const site = project?.siteData || {};
  return <GeneratedSiteRuntime site={site} assetBase={"/api/projects/" + encodeURIComponent(project.id) + "/assets"} />;
}

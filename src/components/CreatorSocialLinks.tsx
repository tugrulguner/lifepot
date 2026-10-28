const links = [
  ["GitHub", "https://github.com/tugrulguner"],
  ["LinkedIn", "https://www.linkedin.com/in/tugrulguner/"],
  ["X", "https://x.com/Tugrul_Guner"],
];
export function CreatorSocialLinks() {
  return <nav className="creator-social-links" aria-label="Tugrul Guner on social media">{links.map(([label, href]) => <a key={label} className="ph-no-autocapture" data-ph-no-autocapture="true" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`}>{label}</a>)}</nav>;
}

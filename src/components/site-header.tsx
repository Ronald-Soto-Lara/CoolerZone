import Link from "next/link";
import { ExternalLink, ShoppingBag } from "lucide-react";
import { siteConfig } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="CoolerZone inicio">
          <span className="brand-mark">CZ</span>
          <span>CoolerZone</span>
        </Link>
        <nav className="main-nav" aria-label="Navegación principal">
          <Link href="/#catalogo">Catálogo</Link>
          <Link href="/#contacto">Contacto</Link>
        </nav>
        <div className="social-links" aria-label="Redes sociales">
          {siteConfig.instagramUrl && (
            <a href={siteConfig.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram de CoolerZone">
              <ExternalLink size={18} />
            </a>
          )}
          {siteConfig.facebookUrl && (
            <a href={siteConfig.facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook de CoolerZone">
              <ExternalLink size={18} />
            </a>
          )}
          <Link className="header-bag" href="/#catalogo" aria-label="Ver catálogo">
            <ShoppingBag size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}
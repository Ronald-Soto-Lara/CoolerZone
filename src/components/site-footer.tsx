import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer" id="contacto">
      <div className="shell footer-grid">
        <div>
          <Link className="brand footer-brand" href="/">
            <span className="brand-mark">CZ</span>
            <span>CoolerZone</span>
          </Link>
          <p>Potencia tu partida. Enfría tu móvil.</p>
        </div>
        <div>
          <p className="footer-label">Encuéntranos</p>
          <div className="footer-socials">
            {siteConfig.instagramUrl && <a href={siteConfig.instagramUrl} target="_blank" rel="noreferrer"><ExternalLink size={18} /> Instagram</a>}
            {siteConfig.facebookUrl && <a href={siteConfig.facebookUrl} target="_blank" rel="noreferrer"><ExternalLink size={18} /> Facebook</a>}
          </div>
        </div>
        <div>
          <p className="footer-label">Atención</p>
          <p>Pedidos y consultas por WhatsApp</p>
        </div>
      </div>
      <div className="shell footer-bottom">© {new Date().getFullYear()} CoolerZone Bolivia</div>
    </footer>
  );
}
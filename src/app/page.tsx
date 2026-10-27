    import Link from "next/link";
    import { ArrowUpRight, MessageCircle, ShieldCheck, Truck } from "lucide-react";
    import { Catalog } from "@/components/catalog";
    import { SiteFooter } from "@/components/site-footer";
    import { SiteHeader } from "@/components/site-header";
    import { getPublishedProducts } from "@/lib/products";
    import { getWhatsAppUrl } from "@/lib/site";

    export default async function Home() {
      const products = await getPublishedProducts();
      const whatsappUrl = getWhatsAppUrl();

      return (
        <div className="site-shell">
          <SiteHeader />
          <main>
            <section className="hero shell">
              <div className="hero-copy">
                <p className="eyebrow">CoolerZone Bolivia / Gaming gear</p>
                <h1>Juega más. <span>Calienta menos.</span></h1>
                <p className="hero-description">Coolers para celular y accesorios que acompañan tus partidas largas, tus streams y cada victoria.</p>
                <div className="hero-actions">
                  <Link className="button button-primary" href="#catalogo">Explorar catálogo <ArrowUpRight size={18} /></Link>
                  {whatsappUrl && <a className="button button-ghost" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Consultar por WhatsApp</a>}
                </div>
              </div>
              <div className="hero-art" aria-label="CoolerZone para setups gaming" role="img">
                <div className="hero-art-label">COOL<br />YOUR<br />GAME</div>
                <div className="hero-ring" />
                <div className="hero-device"><span>ICE<br />MODE</span></div>
                <div className="hero-sticker">CZ<br /><small>01</small></div>
              </div>
            </section>
            <section className="trust-strip shell" aria-label="Beneficios CoolerZone">
              <div><ShieldCheck size={20} /><span>Productos seleccionados</span></div>
              <div><Truck size={20} /><span>Envíos en Bolivia</span></div>
              <div><MessageCircle size={20} /><span>Atención directa</span></div>
            </section>
            <Catalog products={products} />
            <section className="contact-band shell">
              <div><p className="eyebrow">¿Tienes dudas?</p><h2>Arma tu setup con nosotros.</h2></div>
              <p>Confirma disponibilidad, precios y opciones de entrega directamente por WhatsApp.</p>
              {whatsappUrl ? <a className="button button-light" href={whatsappUrl} target="_blank" rel="noreferrer">Hablar con CoolerZone <ArrowUpRight size={18} /></a> : <p className="config-note">WhatsApp estará disponible cuando se configure el número comercial.</p>}
            </section>
          </main>
          <SiteFooter />
        </div>
      );
    }

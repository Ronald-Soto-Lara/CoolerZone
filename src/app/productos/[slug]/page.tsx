import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ShareButton } from "@/components/share-button";
import { getPublishedProduct } from "@/lib/products";
import { getWhatsAppUrl, siteConfig } from "@/lib/site";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const { getPublishedProducts } = await import("@/lib/products");
  const products = await getPublishedProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) return { title: "Producto no encontrado | CoolerZone" };

  const description = product.description ?? `${product.name} disponible en CoolerZone Bolivia.`;
  return {
    title: `${product.name} | CoolerZone Bolivia`,
    description,
    keywords: [product.name, product.brand ?? "coolers para celular", product.category ?? "accesorios gaming"],
    alternates: { canonical: `/productos/${product.slug}` },
    openGraph: {
      title: `${product.name} | CoolerZone Bolivia`,
      description,
      url: `/productos/${product.slug}`,
      siteName: siteConfig.name,
      locale: "es_LA",
      type: "website",
      ...(product.image_url ? { images: [{ url: product.image_url, alt: product.name }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) notFound();

  const description = product.description ?? "Consulta detalles y disponibilidad de este producto CoolerZone.";
  const whatsappUrl = getWhatsAppUrl(product.name);
  const productUrl = `${siteConfig.url}/productos/${product.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    ...(product.image_url ? { image: [product.image_url] } : {}),
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "BOB",
      price: product.price,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="product-page shell">
        <Link className="back-link" href="/#catalogo"><ArrowLeft size={17} /> Volver al catálogo</Link>
        <div className="product-detail">
          <div className="detail-image">
            {product.image_url ? <Image src={product.image_url} alt={product.name} fill sizes="(max-width: 800px) 100vw, 55vw" unoptimized priority /> : <span className="image-placeholder">CoolerZone</span>}
          </div>
          <article className="detail-copy">
            <p className="product-category">{product.category ?? "Accesorios gaming"}</p>
            <h1>{product.name}</h1>
            {product.brand && <p className="detail-brand">{product.brand}</p>}
            <p className="detail-price">Bs {product.price.toFixed(2)}</p>
            <p className="detail-description">{description}</p>
            <p className={product.stock > 0 ? "stock-available" : "stock-unavailable"}>{product.stock > 0 ? "Disponible para consulta" : "Sin stock por el momento"}</p>
            <div className="detail-actions">
              {whatsappUrl && <a className="button button-primary" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Consultar por WhatsApp</a>}
              <ShareButton title={product.name} />
            </div>
          </article>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </main>
      <SiteFooter />
    </div>
  );
}
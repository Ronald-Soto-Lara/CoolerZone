"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import { getWhatsAppUrl } from "@/lib/site";

const formatPrice = (price: number) => `Bs ${price.toFixed(2)}`;

export function Catalog({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const categories = ["Todas", ...new Set(products.map((product) => product.category).filter(Boolean) as string[])];
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !normalizedQuery || `${product.name} ${product.brand ?? ""} ${product.description ?? ""}`.toLowerCase().includes(normalizedQuery);
      const matchesCategory = category === "Todas" || product.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [category, products, query]);

  return (
    <section className="catalog-section shell" id="catalogo">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Selección CoolerZone</p>
          <h2>Tu próximo upgrade empieza aquí</h2>
        </div>
        <p className="section-copy">Explora el catálogo disponible y escríbenos para confirmar stock y entrega.</p>
      </div>
      <div className="catalog-tools" aria-label="Filtros del catálogo">
        <label className="search-box">
          <Search size={18} />
          <span className="sr-only">Buscar productos</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o marca" />
        </label>
        <label className="category-select">
          <span className="sr-only">Filtrar por categoría</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      {filteredProducts.length > 0 ? (
        <div className="product-grid">
          {filteredProducts.map((product) => {
            const whatsappUrl = getWhatsAppUrl(product.name);
            return (
              <article className="product-card" key={product.id}>
                <Link className="product-image" href={`/productos/${product.slug}`}>
                  {product.image_url ? <Image src={product.image_url} alt={product.name} fill sizes="(max-width: 700px) 100vw, 33vw" unoptimized /> : <span className="image-placeholder">CoolerZone</span>}
                  {product.stock <= 0 && <span className="stock-badge">Agotado</span>}
                </Link>
                <div className="product-card-body">
                  <p className="product-category">{product.category ?? "Accesorios"}</p>
                  <h3><Link href={`/productos/${product.slug}`}>{product.name}</Link></h3>
                  <p className="product-price">{formatPrice(product.price)}</p>
                  <div className="product-actions">
                    <Link className="text-link" href={`/productos/${product.slug}`}>Ver detalle</Link>
                    {whatsappUrl && <a className="icon-action" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label={`Consultar ${product.name} por WhatsApp`}><MessageCircle size={18} /></a>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state"><h3>No hay productos para mostrar</h3><p>Agrega productos publicados desde Supabase o prueba otra búsqueda.</p></div>
      )}
    </section>
  );
}
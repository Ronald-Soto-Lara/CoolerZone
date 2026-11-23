import { supabase } from "./supabase";

export type Product = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  stock: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

const missingSupabaseConfig =
  "No se pudieron cargar los productos: faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.";

export async function getPublishedProducts() {
  if (!supabase) {
    console.error(missingSupabaseConfig);
    return [];
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, brand, description, price, category, image_url, stock, published, created_at, updated_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("No se pudieron cargar los productos:", error.message);
    return [];
  }

  return (data ?? []) as Product[];
}

export async function getPublishedProduct(slug: string) {
  if (!supabase) {
    console.error(missingSupabaseConfig);
    return null;
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, brand, description, price, category, image_url, stock, published, created_at, updated_at")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) {
    console.error("No se pudo cargar el producto:", error.message);
    return null;
  }

  return data as Product | null;
}
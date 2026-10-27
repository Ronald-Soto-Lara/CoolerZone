export const siteConfig = {
  name: "CoolerZone Bolivia",
  url: "https://cooler-zone.vercel.app",
  description: "Coolers para celulares y accesorios gaming en Bolivia.",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  facebookUrl: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? process.env.enlacefacebook ?? "",
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? process.env.enlaceinstagram ?? "",
};

export function getWhatsAppUrl(productName?: string) {
  if (!siteConfig.whatsappNumber) return "";

  const message = productName
    ? `Hola CoolerZone, quiero consultar por: ${productName}`
    : "Hola CoolerZone, quiero conocer el catálogo disponible.";

  return `https://wa.me/${siteConfig.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
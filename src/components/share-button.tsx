"use client";

import { Share2 } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  async function shareProduct() {
    const shareData = { title, text: `${title} en CoolerZone Bolivia`, url: window.location.href };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
  }

  return <button className="button button-outline" type="button" onClick={shareProduct}><Share2 size={18} /> Compartir producto</button>;
}
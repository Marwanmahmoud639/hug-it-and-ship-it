// Google Maps browser key from the Lovable Google Maps Platform connector.
// Referrer-restricted and safe to embed.
const GOOGLE_MAPS_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY ||
  "";

declare global {
  interface Window {
    google?: any;
    __lovableGmapsReady?: () => void;
    __lovableGmapsPromise?: Promise<typeof window.google | null>;
  }
}

export function loadGoogleMaps(): Promise<any | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (window.__lovableGmapsPromise) return window.__lovableGmapsPromise;
  if (!GOOGLE_MAPS_KEY) return Promise.resolve(null);

  window.__lovableGmapsPromise = new Promise((resolve) => {
    window.__lovableGmapsReady = () => resolve(window.google ?? null);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&loading=async&callback=__lovableGmapsReady`;
    script.async = true;
    script.defer = true;
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return window.__lovableGmapsPromise;
}

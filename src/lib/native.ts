// Native bridge helpers — safe to import from web code.
// All calls no-op gracefully when running in a browser (Capacitor.isNativePlatform === false).
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const nativePlatform = () => Capacitor.getPlatform(); // "ios" | "android" | "web"


// ---------- Camera ----------
export async function takePhoto(): Promise<string | null> {
  if (!isNative()) return null;
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt,
  });
  return photo.dataUrl ?? null;
}

// ---------- Geolocation ----------
export async function getCurrentLocation() {
  if (!isNative()) return null;
  const { Geolocation } = await import("@capacitor/geolocation");
  const perm = await Geolocation.requestPermissions();
  if (perm.location !== "granted") return null;
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

// ---------- Local Notifications ----------
export async function scheduleLocalNotification(title: string, body: string, atMs?: number) {
  if (!isNative()) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Math.random() * 2_000_000_000),
        title,
        body,
        schedule: atMs ? { at: new Date(atMs) } : undefined,
      },
    ],
  });
}

// ---------- Share ----------
export async function nativeShare(title: string, text: string, url?: string) {
  if (!isNative()) {
    if (navigator.share) return navigator.share({ title, text, url });
    return;
  }
  const { Share } = await import("@capacitor/share");
  await Share.share({ title, text, url, dialogTitle: title });
}

// ---------- Device info ----------
export async function getDeviceInfo() {
  const { Device } = await import("@capacitor/device");
  const [info, id] = await Promise.all([Device.getInfo(), Device.getId()]);
  return { ...info, identifier: id.identifier };
}

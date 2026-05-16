/**
 * Value for `<img crossOrigin>` when pixels must be readable without tainting
 * (canvas / WebGL). Omit the attribute for same-origin URLs (e.g. `/api/files/…`)
 * so the browser does a normal same-origin load.
 */
export function crossOriginForImgSrc(src: string): "anonymous" | undefined {
  if (typeof window === "undefined") return undefined;
  if (src.startsWith("/") || src.startsWith("blob:") || src.startsWith("data:")) {
    return undefined;
  }
  try {
    if (new URL(src, window.location.href).origin === window.location.origin) {
      return undefined;
    }
  } catch {
    return "anonymous";
  }
  return "anonymous";
}

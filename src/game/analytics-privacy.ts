function safeUrl(value: string): string {
  if (!value || value === "$direct") return value;
  if (!/^(https?:\/\/|\/)/.test(value)) return "";
  try {
    const url = new URL(value, "https://lifepot.modepot.io");
    return value.startsWith("/") && !value.startsWith("//") ? url.pathname : `${url.origin}${url.pathname}`;
  } catch { return ""; }
}
// Applied to every outbound event, including automatic pageleave/acquisition fields.
// Preserve useful route/referring-domain counts without shipping replay/query payloads.
export function sanitizeAnalyticsProperties<T>(value: T): T {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(item => sanitizeAnalyticsProperties(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      typeof item === "string" && /(?:url|referrer|href)$/.test(key) ? safeUrl(item) : sanitizeAnalyticsProperties(item),
    ])) as T;
  }
  return value;
}

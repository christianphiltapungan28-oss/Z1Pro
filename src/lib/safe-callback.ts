// Only same-site paths, so a crafted link can't bounce people elsewhere
// ("//host" and "/\host" are treated as other sites by browsers).
export function safeCallback(value: string | string[] | undefined) {
  const url = Array.isArray(value) ? value[0] : value;
  return url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\") ? url : "/";
}

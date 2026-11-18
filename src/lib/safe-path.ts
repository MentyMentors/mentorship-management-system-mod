/** A same-site path for post-login/sign-up redirects, or null. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.length > 300) return null;
  return value;
}

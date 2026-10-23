import { db } from "@/lib/db";

/**
 * Institutional email-domain validation.
 *
 * Rules (all enforced server-side; the browser's copy is cosmetic):
 *  - Emails are normalised (trimmed, lowercased) before anything else.
 *  - The domain is compared by EXACT host match against active
 *    InstitutionDomain rows. Substring/lookalike matches never pass:
 *      "mubas.ac.mw.evil.com"  !== "mubas.ac.mw"
 *      "notmubas.ac.mw"        !== "mubas.ac.mw"
 *  - Subdomains pass ONLY when the matched domain row explicitly sets
 *    allowSubdomains (e.g. "cs.mubas.ac.mw" vs domain "mubas.ac.mw").
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Returns the lowercased host part, or null when the address is malformed. */
export function extractDomain(email: string): string | null {
  const normalised = normalizeEmail(email);
  const at = normalised.lastIndexOf("@");
  if (at <= 0 || at === normalised.length - 1) return null;
  const host = normalised.slice(at + 1).replace(/\.+$/, "");
  // Reject whitespace, multiple @, and obviously bogus hosts.
  if (/\s/.test(host) || !/^[\w.-]+$/.test(host) || !host.includes(".")) {
    return null;
  }
  return host;
}

/**
 * Exact-match test of a candidate host against one registered domain.
 * Pure function — unit tested in isolation.
 */
export function hostMatches(
  registeredDomain: string,
  candidateHost: string,
  allowSubdomains: boolean
): boolean {
  const reg = registeredDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  const cand = candidateHost.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (reg === cand) return true;
  if (allowSubdomains && cand.endsWith("." + reg)) return true;
  return false;
}

export interface DomainMatch {
  institutionId: string;
  domain: string;
  allowSubdomains: boolean;
}

/**
 * Resolves an email address to an institution via the active domain table.
 * Returns null when no approved, active domain matches. Callers must reject
 * registration when this returns null (standard flow) unless the user is
 * covered by an authorised invitation exception, which is handled elsewhere.
 */
export async function findInstitutionByEmail(
  email: string
): Promise<DomainMatch | null> {
  const host = extractDomain(email);
  if (!host) return null;

  const rows = await db.institutionDomain.findMany({
    where: { isActive: true, institution: { status: "ACTIVE" } },
    select: {
      institutionId: true,
      domain: true,
      allowSubdomains: true,
    },
  });

  // Exact match first (cheapest, most common); subdomain allowance only
  // consulted when an exact match is absent.
  for (const row of rows) {
    if (row.domain === host) return row;
  }
  for (const row of rows) {
    if (row.allowSubdomains && host.endsWith("." + row.domain)) return row;
  }
  return null;
}

/** True when the email's domain is approved for standard registration. */
export async function isEmailDomainAllowed(email: string): Promise<boolean> {
  return (await findInstitutionByEmail(email)) !== null;
}

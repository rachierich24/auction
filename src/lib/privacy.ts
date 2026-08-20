/**
 * Public bid history shows activity without exposing who is in the room.
 * "Rahul Verma" -> "Rahul ****". Deterministic so the same bidder reads as the
 * same person down the ledger, but never resolvable back to an identity.
 */
export function maskBidderName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "Bidder";
  const shown = first.length <= 2 ? first : first;
  return `${shown} ****`;
}

/** "rahul.verma@example.com" -> "ra••••@example.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "••••";
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(3, local.length - 2))}@${domain}`;
}

/** Short stable badge for a bidder within one lot, e.g. "B-4A". */
export function bidderTag(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return `B-${hash.toString(36).toUpperCase().slice(0, 3)}`;
}

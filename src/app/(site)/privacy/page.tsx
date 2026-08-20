import type { Metadata } from "next";

import { LegalPage, type Clause } from "@/components/site/legal-page";
import { getContent } from "@/lib/content/site-content";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What personal data Groovy's Auction collects, why, how long it is kept, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const footer = await getContent("footer");

  const clauses: Clause[] = [
    {
      heading: "What we collect",
      body: [
        "Account details you give us: name, email address, and optionally a phone number used to reach winning bidders.",
        "Activity you generate: bids, maximums, watchlist entries, notifications and settlement records.",
        "Technical data needed to run the saleroom safely: the IP address and browser a session was created from, and the IP a bid was placed from. This is what lets us investigate a disputed bid or a compromised account.",
      ],
    },
    {
      heading: "What we do not collect",
      body: [
        "We do not store card or bank details. Payments are handled by our gateway; we retain only its reference and the outcome.",
        "We do not use advertising trackers or third-party analytics on this site.",
      ],
    },
    {
      heading: "What is public",
      body: [
        "The full bid history of every lot is public, because a saleroom that hides its bidding cannot be audited by the people bidding in it.",
        "Bidder identities in that history are masked — a first name and four asterisks. Your email address, phone number, full name and account activity are never shown to other bidders.",
      ],
    },
    {
      heading: "Why we hold it",
      body: [
        "To operate your account and let you bid. To determine and contact winning bidders. To invoice and settle sales. To send the notifications you would expect — outbid alerts, closing reminders, results.",
        "To meet our record-keeping obligations: bids and settlements are financial records and are retained even after an account closes.",
      ],
    },
    {
      heading: "Who sees it",
      body: [
        "Saleroom staff, limited by role — an auction manager can see bidder identities on the lots they run; a content manager cannot. Every privileged action is written to an append-only audit log.",
        "Our payment gateway and email provider, only to the extent needed to take a payment or deliver a message. We do not sell personal data, and we do not share it for marketing.",
      ],
    },
    {
      heading: "How long we keep it",
      body: [
        "Account details for as long as the account is open, and afterwards only where a record-keeping obligation requires it.",
        "Sessions expire automatically and expired ones are deleted. Bids, invoices and settlement records are retained as financial records.",
      ],
    },
    {
      heading: "How it is protected",
      body: [
        "Passwords are stored as scrypt hashes and are never recoverable — a reset sets a new one. Session cookies are httpOnly and only a hash of the session token is stored, so a database leak cannot be replayed as a login.",
        "Changing your password, or a change to your role, signs out every other device.",
      ],
    },
    {
      heading: "Your choices",
      body: [
        "You can view and correct your details, and change your password, from your account page. You can unsubscribe from the newsletter at any time; notifications tied to bidding are part of the service.",
        `To request a copy of your data, or its deletion where no record-keeping obligation applies, write to ${footer.email}.`,
      ],
    },
    {
      heading: "Cookies",
      body: [
        "One cookie, for your signed-in session. It is httpOnly, same-site, and set as secure in production. There are no advertising or tracking cookies on this site.",
      ],
    },
    {
      heading: "Contact",
      body: [
        `Privacy questions: ${footer.email}, or ${footer.phone}.`,
        `${footer.legalName}, ${footer.address}.`,
      ],
    },
  ];

  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy"
      intro="What we collect, why we hold it, who can see it, and what you can ask us to do about it."
      clauses={clauses}
    />
  );
}

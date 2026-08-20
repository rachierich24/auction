import type { Metadata } from "next";

import { LegalPage, type Clause } from "@/components/site/legal-page";
import { getContent } from "@/lib/content/site-content";

export const metadata: Metadata = {
  title: "Conditions of sale",
  description:
    "The terms on which Groovy Auction accepts bids, closes lots, applies reserves and buyer's premium, and settles sales.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const footer = await getContent("footer");

  const clauses: Clause[] = [
    {
      heading: "Registration",
      body: [
        "Bidding requires a registered account. You must provide accurate details and are responsible for everything done under your account. Tell us immediately if you believe it has been used without your permission.",
        "We may decline a registration, or suspend an account, where we have reasonable grounds to do so. A suspended account is signed out of every device and cannot bid; bids already placed from it remain valid and on the record.",
      ],
    },
    {
      heading: "Bids are binding",
      body: [
        "A bid is an offer to buy at that price and cannot be retracted. Every bid is confirmed in a dialog showing the exact amount before it is submitted.",
        "Bids are accepted, ordered and timed by our servers. A bid is placed at the moment our server records it, not the moment it leaves your device. Where two bids arrive together, the first recorded is accepted and the second is refused with the current price shown.",
      ],
    },
    {
      heading: "Increments and minimum bids",
      body: [
        "The first bid on a lot must meet its starting price. Each later bid must exceed the standing bid by at least the increment published on that lot. A bid below that minimum is refused.",
      ],
    },
    {
      heading: "Maximum (absentee) bids",
      body: [
        "You may leave a maximum. We will then bid on your behalf by the smallest step needed to keep you in front, and never above your maximum.",
        "Where two bidders have left maximums, the higher maximum leads, at one increment above the lower — not at the winner's own ceiling. A maximum may be withdrawn at any time while the lot is open; it lapses when the lot closes.",
      ],
    },
    {
      heading: "Closing and extensions",
      body: [
        "A lot closes at its published time as determined by our servers. Where extensions are enabled, a bid inside the closing window pushes the close out by the published duration, and repeats for as long as bidding continues, so a lot is decided by the highest bidder rather than the fastest connection.",
        "The scheduled close and every extension are recorded and shown on the lot.",
      ],
    },
    {
      heading: "Reserves",
      body: [
        "Some lots carry a confidential minimum agreed with the consignor. Whether a lot carries a reserve is disclosed before bidding opens, and whether it has been met is shown live. The figure itself is not disclosed.",
        "If bidding closes below the reserve the lot is unsold, no contract of sale arises, and the highest bidder is under no obligation.",
      ],
    },
    {
      heading: "Buyer's premium and invoicing",
      body: [
        "A buyer's premium, stated on each lot before you bid, is added to the hammer price. Your invoice itemises the hammer price and the premium separately. Taxes and duties, where they apply, are payable in addition.",
      ],
    },
    {
      heading: "Payment",
      body: [
        "Payment is due within five business days of the lot closing. Card details are handled by our payment gateway and are never held on our servers.",
        "Where payment is not received we may cancel the sale, re-offer the lot, and decline further bids from the account.",
      ],
    },
    {
      heading: "Collection and delivery",
      body: [
        "Title passes on receipt of payment in full. Shipping or collection is arranged once payment clears; collection in person is free of charge and by appointment.",
        "Risk in a lot passes to the buyer on collection or on despatch, whichever is earlier.",
      ],
    },
    {
      heading: "Condition and descriptions",
      body: [
        "Catalogue entries, condition reports and images are statements of opinion given in good faith, not warranties. Lots are sold as they stand, and you are responsible for satisfying yourself as to condition before bidding. Additional images and reports are available on request.",
      ],
    },
    {
      heading: "Withdrawal",
      body: [
        "We may withdraw a lot from sale at any time before it closes. A withdrawn lot makes no sale, and bids placed on it are retained for the record only.",
      ],
    },
    {
      heading: "Privacy",
      body: [
        "Bid history is public in full, with bidder identities masked. Your name, contact details and account activity are visible only to you and to saleroom staff. See our privacy policy for how we handle personal data.",
      ],
    },
    {
      heading: "Contact",
      body: [
        `Questions about these conditions should go to ${footer.email} or ${footer.phone}.`,
        `${footer.legalName}, ${footer.address}.`,
      ],
    },
  ];

  return (
    <LegalPage
      eyebrow="Legal"
      title="Conditions of sale"
      intro="These conditions govern bidding and buying at Groovy Auction. By registering and placing a bid you agree to them."
      clauses={clauses}
    />
  );
}

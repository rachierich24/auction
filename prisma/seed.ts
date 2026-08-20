/**
 * Demo catalogue.
 *
 * Produces a saleroom that is already mid-sale: lots closing in minutes, lots
 * open for days, lots not yet opened, and lots already settled both ways
 * (sold, and unsold on an unmet reserve) — so every state in the lifecycle is
 * visible the moment the app boots.
 *
 * Makers, artists and consignors are invented. No claim is made about any real
 * company, person or object.
 *
 * Run with: npm run db:seed   (or npm run db:reset to rebuild from scratch)
 */

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

/** Rupees -> paise. Every monetary column is an integer in minor units. */
const inr = (rupees: number) => Math.round(rupees * 100);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const now = Date.now();
const at = (offsetMs: number) => new Date(now + offsetMs);

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    slug: "horology",
    name: "Horology",
    description:
      "Wristwatches, pocket watches and clocks, catalogued with movement and case detail.",
    image:
      "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 1,
    fieldSchema: [
      { key: "maker", label: "Maker", type: "text", required: true },
      { key: "reference", label: "Reference", type: "text" },
      { key: "year", label: "Year", type: "text" },
      { key: "caseMaterial", label: "Case material", type: "text" },
      { key: "caseDiameter", label: "Case diameter", type: "text" },
      { key: "movement", label: "Movement", type: "text" },
      { key: "condition", label: "Condition", type: "text", required: true },
      { key: "boxAndPapers", label: "Box & papers", type: "text" },
    ],
  },
  {
    slug: "fine-art",
    name: "Fine Art",
    description:
      "Modern and contemporary painting, works on paper and sculpture.",
    image:
      "https://images.unsplash.com/photo-1578321272176-b7bbc0679853?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 2,
    fieldSchema: [
      { key: "artist", label: "Artist", type: "text", required: true },
      { key: "year", label: "Year", type: "text" },
      { key: "medium", label: "Medium", type: "text", required: true },
      { key: "dimensions", label: "Dimensions", type: "text" },
      { key: "provenance", label: "Provenance", type: "textarea" },
      { key: "framed", label: "Framed", type: "text" },
      { key: "certificate", label: "Certificate", type: "text" },
    ],
  },
  {
    slug: "motor-cars",
    name: "Motor Cars",
    description: "Collectors' automobiles, sold with documented history.",
    image:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 3,
    fieldSchema: [
      { key: "manufacturer", label: "Manufacturer", type: "text", required: true },
      { key: "model", label: "Model", type: "text", required: true },
      { key: "year", label: "Year", type: "text", required: true },
      { key: "mileage", label: "Odometer", type: "text" },
      { key: "registration", label: "Registration", type: "text" },
      { key: "transmission", label: "Transmission", type: "text" },
      { key: "condition", label: "Condition", type: "text" },
    ],
  },
  {
    slug: "jewellery",
    name: "Jewellery",
    description: "Period and contemporary jewellery, with gemmological detail.",
    image:
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 4,
    fieldSchema: [
      { key: "metal", label: "Metal", type: "text", required: true },
      { key: "stones", label: "Stones", type: "text" },
      { key: "carat", label: "Total carat weight", type: "text" },
      { key: "period", label: "Period", type: "text" },
      { key: "hallmark", label: "Hallmark", type: "text" },
      { key: "condition", label: "Condition", type: "text" },
    ],
  },
  {
    slug: "collectibles",
    name: "Collectibles",
    description: "Design objects, rare editions and cultural artefacts.",
    image:
      "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 5,
    fieldSchema: [
      { key: "maker", label: "Maker", type: "text" },
      { key: "year", label: "Year", type: "text" },
      { key: "size", label: "Size", type: "text" },
      { key: "edition", label: "Edition", type: "text" },
      { key: "condition", label: "Condition", type: "text", required: true },
      { key: "provenance", label: "Provenance", type: "textarea" },
    ],
  },
  {
    slug: "sporting-memorabilia",
    name: "Sporting Memorabilia",
    description: "Match-worn, match-used and signed material with provenance.",
    image:
      "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 6,
    fieldSchema: [
      { key: "sport", label: "Sport", type: "text", required: true },
      { key: "event", label: "Event", type: "text" },
      { key: "year", label: "Year", type: "text" },
      { key: "signedBy", label: "Signed by", type: "text" },
      { key: "authentication", label: "Authentication", type: "text" },
      { key: "condition", label: "Condition", type: "text" },
    ],
  },
  {
    slug: "property",
    name: "Property",
    description: "Land and residential property offered at auction.",
    image:
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 7,
    fieldSchema: [
      { key: "location", label: "Location", type: "text", required: true },
      { key: "area", label: "Built-up area", type: "text", required: true },
      { key: "bedrooms", label: "Bedrooms", type: "text" },
      { key: "bathrooms", label: "Bathrooms", type: "text" },
      { key: "yearBuilt", label: "Year built", type: "text" },
      { key: "tenure", label: "Tenure", type: "text" },
    ],
  },
];

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const ADMIN_PASSWORD = "Saleroom!2026";
const BIDDER_PASSWORD = "Collector!2026";

const STAFF = [
  {
    name: "Devika Raghunathan",
    email: "admin@maison.auction",
    role: "SUPER_ADMIN",
  },
  { name: "Imran Sheikh", email: "ops@maison.auction", role: "AUCTION_MANAGER" },
  {
    name: "Leela Krishnan",
    email: "editor@maison.auction",
    role: "CONTENT_MANAGER",
  },
];

const BIDDERS = [
  { name: "Rahul Verma", email: "rahul.verma@example.com" },
  { name: "Priya Nair", email: "priya.nair@example.com" },
  { name: "Arjun Mehta", email: "arjun.mehta@example.com" },
  { name: "Sana Qureshi", email: "sana.qureshi@example.com" },
  { name: "Vikram Rao", email: "vikram.rao@example.com" },
  { name: "Neha Bhatt", email: "neha.bhatt@example.com" },
];

// ---------------------------------------------------------------------------
// Lots
// ---------------------------------------------------------------------------

const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

type LotSeed = {
  lotNumber: string;
  title: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  startingPrice: number;
  minimumIncrement: number;
  reservePrice?: number;
  buyerPremiumBps?: number;
  startAt: Date;
  endAt: Date;
  status: string;
  featured?: boolean;
  images: string[];
  attributes: Record<string, string>;
  location?: string;
  /** How many bids to simulate, and the outcome to force for settled lots. */
  bids?: number;
  settle?: "SOLD" | "UNSOLD";
};

const LOTS: LotSeed[] = [
  // -- Horology -------------------------------------------------------------
  {
    lotNumber: "101",
    title: "Voclain Type XX Flyback Chronograph, circa 1958",
    slug: "voclain-type-xx-flyback-chronograph-circa-1958",
    category: "horology",
    shortDescription:
      "A military-issue flyback chronograph in stainless steel, retaining its original bidirectional bezel and tritium dial.",
    description: `Issued to a state aviation unit in 1958 and retained by the original recipient's family until consignment, this Type XX is offered in notably honest condition.

The 38mm stainless steel case retains strong lug definition with no evidence of over-polishing; the case back stamping remains fully legible. The black dial has aged to a uniform warm patina with matching tritium in the hands, and the flyback function operates crisply across all three positions.

The movement was serviced by our workshop in March 2026 and is running within chronometric tolerance. Offered with an extract from the maker's archive confirming the reference and year of manufacture, together with a modern leather strap; the original bracelet is not present.

Condition report and additional images are available on request.`,
    startingPrice: inr(480_000),
    minimumIncrement: inr(20_000),
    reservePrice: inr(650_000),
    startAt: at(-3 * DAY),
    endAt: at(2 * DAY + 4 * HOUR),
    status: "LIVE",
    featured: true,
    images: [
      u("photo-1523170335258-f5ed11844a49"),
      u("photo-1587836374828-4dbafa94cf0e"),
      u("photo-1547996160-81dfa63595aa"),
    ],
    attributes: {
      maker: "Voclain",
      reference: "Type XX / 5100",
      year: "circa 1958",
      caseMaterial: "Stainless steel",
      caseDiameter: "38 mm",
      movement: "Manual winding, flyback chronograph",
      condition: "Very good, unpolished case",
      boxAndPapers: "Archive extract only",
    },
    location: "Mumbai",
    bids: 11,
  },
  {
    lotNumber: "102",
    title: "Aubert & Fils Perpetual Calendar in Rose Gold",
    slug: "aubert-et-fils-perpetual-calendar-rose-gold",
    category: "horology",
    shortDescription:
      "A perpetual calendar wristwatch with moonphase in 18-carat rose gold, complete with box and certificate.",
    description: `A refined perpetual calendar from the maker's small-series production, cased in 18-carat rose gold with a silvered opaline dial.

The calendar displays day, date and month with a moonphase at six o'clock, all of which advance correctly under test. The 39mm case measures within factory tolerance and the sapphire case back gives an unobstructed view of the finished movement, with Geneva striping and blued screws throughout.

Supplied with its fitted presentation box, certificate of origin dated 2018, and both service records. A discreet, wearable complication in excellent order.`,
    startingPrice: inr(1_850_000),
    minimumIncrement: inr(50_000),
    reservePrice: inr(2_400_000),
    startAt: at(-2 * DAY),
    endAt: at(4 * DAY),
    status: "LIVE",
    images: [
      u("photo-1595950653106-6c9ebd614d3a"),
      u("photo-1524592094714-0f0654e20314"),
      u("photo-1533139502658-0198f920d8e8"),
    ],
    attributes: {
      maker: "Aubert & Fils",
      reference: "PC-3902",
      year: "2018",
      caseMaterial: "18ct rose gold",
      caseDiameter: "39 mm",
      movement: "Automatic, perpetual calendar with moonphase",
      condition: "Excellent",
      boxAndPapers: "Box, certificate and service records present",
    },
    location: "Mumbai",
    bids: 7,
  },
  {
    lotNumber: "103",
    title: "Steel Dive Watch, Reference 5513-A, circa 1969",
    slug: "steel-dive-watch-reference-5513a-circa-1969",
    category: "horology",
    shortDescription:
      "A gilt-dial dive watch of the period, with matched tritium and a correct riveted bracelet.",
    description: `A well-preserved example of the classic 200m dive watch of the late 1960s, retaining its gilt dial with matched creamy tritium hour plots and hands.

The case is unpolished with sharp chamfers, and the bidirectional bezel insert shows the light fading typical of a piece worn and enjoyed rather than stored. The riveted bracelet is correct to the period and stretches only slightly.

The movement was overhauled in 2024 and keeps time to +4 seconds per day over a five-position test. Offered without box or papers.`,
    startingPrice: inr(720_000),
    minimumIncrement: inr(25_000),
    reservePrice: inr(900_000),
    startAt: at(-5 * DAY),
    // Closing shortly: exercises the "Ending Soon" rail and the anti-snipe path.
    endAt: at(38 * MINUTE),
    status: "LIVE",
    featured: true,
    images: [
      u("photo-1524805444758-089113d48a6d"),
      u("photo-1612817159949-195b6eb9e31a"),
    ],
    attributes: {
      maker: "Unsigned Swiss",
      reference: "5513-A",
      year: "circa 1969",
      caseMaterial: "Stainless steel",
      caseDiameter: "40 mm",
      movement: "Automatic",
      condition: "Very good, honest wear",
      boxAndPapers: "None",
    },
    location: "Mumbai",
    bids: 16,
  },

  // -- Fine Art -------------------------------------------------------------
  {
    lotNumber: "204",
    title: "Untitled (Monsoon Field), 1998 — Ramesh Iyer",
    slug: "untitled-monsoon-field-1998-ramesh-iyer",
    category: "fine-art",
    shortDescription:
      "Oil on canvas from the artist's field series, acquired directly from the studio.",
    description: `Painted in the summer of 1998, this canvas belongs to the field series the artist worked on across two monsoons in coastal Karnataka.

The paint is worked wet-into-wet across the lower two thirds, with the horizon resolved in a single confident band — a device that recurs across the series and is generally read as the artist's response to the flattening light of heavy rain.

Acquired directly from the studio by the present owner in 1999 and unexhibited since. The canvas is unlined and in stable condition, with no restoration under ultraviolet examination. Presented in a plain hardwood frame of later date.`,
    startingPrice: inr(340_000),
    minimumIncrement: inr(15_000),
    startAt: at(-4 * DAY),
    endAt: at(1 * DAY + 6 * HOUR),
    status: "LIVE",
    images: [
      u("photo-1578321272176-b7bbc0679853"),
      u("photo-1579783902614-a3fb3927b6a5"),
    ],
    attributes: {
      artist: "Ramesh Iyer (b. 1954)",
      year: "1998",
      medium: "Oil on canvas",
      dimensions: "120 × 90 cm",
      provenance: "Acquired directly from the artist's studio, 1999; private collection, Bengaluru.",
      framed: "Yes — plain hardwood, later",
      certificate: "Studio certificate accompanies the lot",
    },
    location: "Bengaluru",
    bids: 9,
  },
  {
    lotNumber: "205",
    title: "Study for a Standing Figure — Anjali Bose, 1974",
    slug: "study-for-a-standing-figure-anjali-bose-1974",
    category: "fine-art",
    shortDescription:
      "Charcoal and wash on handmade paper, a preparatory study for the artist's 1975 mural commission.",
    description: `A preparatory study in charcoal and dilute ink wash for the standing figure at the left of the artist's 1975 mural for a Kolkata public library.

The sheet carries the artist's working annotations in the lower margin, including the squared grid used to transfer the composition to scale. Studies from this commission rarely appear at auction; the majority remain with the commissioning institution.

Handmade paper with deckled edges, hinged to an acid-free mount. Light time-toning consistent with age; no foxing.`,
    startingPrice: inr(95_000),
    minimumIncrement: inr(5_000),
    startAt: at(2 * DAY),
    endAt: at(9 * DAY),
    status: "UPCOMING",
    images: [
      u("photo-1579783902614-a3fb3927b6a5"),
      u("photo-1578321272176-b7bbc0679853"),
    ],
    attributes: {
      artist: "Anjali Bose (1931–2009)",
      year: "1974",
      medium: "Charcoal and ink wash on handmade paper",
      dimensions: "56 × 38 cm",
      provenance: "Estate of the artist; thence by descent.",
      framed: "No — hinged to mount",
      certificate: "Estate stamp verso",
    },
    location: "Kolkata",
  },
  {
    lotNumber: "206",
    title: "Vermilion Composition No. 7 — K. Sundaram",
    slug: "vermilion-composition-no-7-k-sundaram",
    category: "fine-art",
    shortDescription:
      "Acrylic on board, from the vermilion sequence exhibited in Chennai in 1986.",
    description: `One of eleven boards in the vermilion sequence, exhibited together at Chennai in 1986 and dispersed shortly afterwards.

The pigment is applied in flat, unmodulated fields with the board's grain deliberately left visible at the edges. Number seven is among the most reduced of the group, resolving to two fields and a single interrupting line.

Exhibited: 'Eleven Vermilions', Chennai, 1986, cat. no. 7. Private collection since 1987.`,
    startingPrice: inr(260_000),
    minimumIncrement: inr(10_000),
    reservePrice: inr(300_000),
    startAt: at(-16 * DAY),
    endAt: at(-2 * DAY),
    status: "LIVE",
    settle: "SOLD",
    images: [
      u("photo-1549298916-b41d501d3772"),
      u("photo-1578662996442-48f60103fc96"),
    ],
    attributes: {
      artist: "K. Sundaram (1928–2001)",
      year: "1986",
      medium: "Acrylic on board",
      dimensions: "76 × 61 cm",
      provenance: "'Eleven Vermilions', Chennai, 1986, cat. no. 7; private collection.",
      framed: "Yes — artist's frame",
      certificate: "Exhibition catalogue accompanies the lot",
    },
    location: "Chennai",
    bids: 14,
  },

  // -- Motor Cars -----------------------------------------------------------
  {
    lotNumber: "301",
    title: "1971 Grand Tourer Coupé, Matching Numbers",
    slug: "1971-grand-tourer-coupe-matching-numbers",
    category: "motor-cars",
    shortDescription:
      "A two-owner grand tourer in original Verde Scuro, with continuous service history from new.",
    description: `Delivered new to Bombay in March 1971 and retained by the first owner for thirty-four years, this coupé has covered 61,400 documented kilometres.

The car is presented in its original Verde Scuro over tan hide, both believed original and showing the light patina consistent with careful use. The engine, gearbox and rear axle numbers match the factory build record, a copy of which accompanies the lot.

Mechanically the car has been maintained continuously by a single marque specialist since 2006, with the most recent major service in November 2025 including a full fluid change, brake overhaul and new tyres. It starts readily, idles evenly and pulls cleanly through the range.

Offered with the original tool roll, jack, handbook, and a substantial history file of invoices dating back to 1974.`,
    startingPrice: inr(6_500_000),
    minimumIncrement: inr(250_000),
    reservePrice: inr(8_500_000),
    buyerPremiumBps: 1000,
    startAt: at(-1 * DAY),
    endAt: at(5 * DAY + 3 * HOUR),
    status: "LIVE",
    featured: true,
    images: [
      u("photo-1503376780353-7e6692767b70"),
      u("photo-1552519507-da3b142c6e3d"),
      u("photo-1541899481282-d53bffe3c35d"),
      u("photo-1618221195710-dd6b41faaea6"),
    ],
    attributes: {
      manufacturer: "Cassini",
      model: "2000 GT Coupé",
      year: "1971",
      mileage: "61,400 km (documented)",
      registration: "MH-01 · on original number",
      transmission: "5-speed manual",
      condition: "Very good original, sympathetically maintained",
    },
    location: "Mumbai",
    bids: 6,
  },
  {
    lotNumber: "302",
    title: "1963 Roadster, Body-Off Restoration",
    slug: "1963-roadster-body-off-restoration",
    category: "motor-cars",
    shortDescription:
      "A comprehensively restored roadster finished in 2023, with fewer than 900 km since completion.",
    description: `Subject to a body-off restoration completed in September 2023 by a workshop in Pune specialising in the marque, this roadster has covered fewer than 900 kilometres since.

Photographs documenting every stage of the restoration accompany the lot, from bare shell through paint to final assembly. The car was stripped to bare metal, with new floor sections and sills fabricated where corrosion was found; all other panels are original to the car.

The engine was rebuilt to standard specification with new bearings, pistons and a reground crankshaft. The interior was retrimmed in correct-grain hide and the hood replaced in mohair.

Presented in exceptional order throughout and ready for immediate use or show.`,
    startingPrice: inr(4_200_000),
    minimumIncrement: inr(150_000),
    reservePrice: inr(5_000_000),
    buyerPremiumBps: 1000,
    startAt: at(3 * DAY),
    endAt: at(12 * DAY),
    status: "UPCOMING",
    images: [
      u("photo-1552519507-da3b142c6e3d"),
      u("photo-1503376780353-7e6692767b70"),
      u("photo-1449824913935-59a10b8d2000"),
    ],
    attributes: {
      manufacturer: "Cassini",
      model: "1600 Roadster",
      year: "1963",
      mileage: "870 km since restoration",
      registration: "Unregistered — on trade plates",
      transmission: "4-speed manual",
      condition: "Restored to concours standard, 2023",
    },
    location: "Pune",
  },

  // -- Jewellery ------------------------------------------------------------
  {
    lotNumber: "401",
    title: "Art Deco Diamond and Platinum Bracelet, circa 1928",
    slug: "art-deco-diamond-and-platinum-bracelet-circa-1928",
    category: "jewellery",
    shortDescription:
      "A geometric line bracelet set throughout with old European and baguette-cut diamonds.",
    description: `A characteristic bracelet of the late 1920s, the articulated platinum links set alternately with old European-cut and baguette-cut diamonds in a stepped geometric rhythm.

Total diamond weight is estimated at 11.40 carats, the principal stones of I–J colour and VS to SI clarity. The millegrain settings are crisp and complete throughout, with no evidence of later replacement.

The concealed box clasp with figure-of-eight safeties operates positively. Accompanied by an independent gemmological report dated January 2026.

Length 18.2 cm. Gross weight 41.6 g.`,
    startingPrice: inr(1_100_000),
    minimumIncrement: inr(40_000),
    reservePrice: inr(1_450_000),
    startAt: at(-6 * HOUR),
    endAt: at(3 * DAY + 8 * HOUR),
    status: "LIVE",
    images: [
      u("photo-1515562141207-7a88fb7ce338"),
      u("photo-1605100804763-247f67b3557e"),
      u("photo-1611930022073-b7a4ba5fcccd"),
    ],
    attributes: {
      metal: "Platinum",
      stones: "Old European and baguette-cut diamonds",
      carat: "11.40 ct (estimated total)",
      period: "Art Deco, circa 1928",
      hallmark: "Unmarked, tested as platinum",
      condition: "Excellent, settings complete",
    },
    location: "Mumbai",
    bids: 5,
  },
  {
    lotNumber: "402",
    title: "Burmese Ruby and Diamond Cluster Ring",
    slug: "burmese-ruby-and-diamond-cluster-ring",
    category: "jewellery",
    shortDescription:
      "A cushion-cut ruby of 3.05 carats within a brilliant-cut diamond surround.",
    description: `The cushion-cut ruby of strong, even saturation, claw-set within a surround of twelve brilliant-cut diamonds, mounted in 18-carat yellow gold and platinum.

An independent laboratory report dated February 2026 states the ruby to be of Burmese origin with no indications of heat treatment — an increasingly scarce combination at this size.

Ring size N (Indian 14). Accompanied by the laboratory report and a fitted case.`,
    startingPrice: inr(2_400_000),
    minimumIncrement: inr(100_000),
    reservePrice: inr(3_200_000),
    startAt: at(4 * DAY),
    endAt: at(11 * DAY),
    status: "UPCOMING",
    images: [
      u("photo-1605100804763-247f67b3557e"),
      u("photo-1515562141207-7a88fb7ce338"),
    ],
    attributes: {
      metal: "18ct yellow gold and platinum",
      stones: "Ruby with diamond surround",
      carat: "3.05 ct ruby; 1.20 ct diamonds",
      period: "Contemporary mount",
      hallmark: "18K",
      condition: "Excellent",
    },
    location: "Mumbai",
  },

  // -- Collectibles ---------------------------------------------------------
  {
    lotNumber: "501",
    title: "Limited Edition High-Top Sneakers, Deadstock, UK 9",
    slug: "limited-edition-high-top-sneakers-deadstock-uk-9",
    category: "collectibles",
    shortDescription:
      "An unworn pair from a 500-piece collaboration release, retaining original box and accessories.",
    description: `Unworn and complete, from a numbered collaboration release limited to 500 pairs worldwide.

The pair is number 219 of 500, with the edition number printed on the interior collar and repeated on the box label. Both shoes retain their original tissue, spare laces and the printed insert card.

The midsole foam shows no yellowing and the adhesive lines are clean throughout — condition that is increasingly difficult to find in releases of this age.

UK 9 / EU 43 / US 10.`,
    startingPrice: inr(85_000),
    minimumIncrement: inr(5_000),
    startAt: at(-2 * DAY),
    // Closes within the hour, so the anti-snipe window is reachable in a demo.
    endAt: at(52 * MINUTE),
    status: "LIVE",
    images: [
      u("photo-1552346154-21d32810aba3"),
      u("photo-1595341888016-a392ef81b7de"),
      u("photo-1560343090-f0409e92791a"),
    ],
    attributes: {
      maker: "Collaboration release",
      year: "2021",
      size: "UK 9 / EU 43",
      edition: "219 of 500",
      condition: "Deadstock — unworn, complete",
      provenance: "Purchased at release and stored unworn.",
    },
    location: "Delhi",
    bids: 13,
  },
  {
    lotNumber: "502",
    title: "First Edition Hardback, Signed and Inscribed",
    slug: "first-edition-hardback-signed-and-inscribed",
    category: "collectibles",
    shortDescription:
      "A first printing in original cloth, inscribed by the author to the first owner.",
    description: `First edition, first printing, in the original publisher's cloth with the dust jacket present.

Inscribed by the author on the front free endpaper to the first owner, dated in the year of publication. Inscribed copies of this title from the year of publication are uncommon.

The jacket shows light rubbing at the spine ends and a short closed tear to the rear panel, now in a removable protective sleeve. The text block is clean and tight with no foxing.`,
    startingPrice: inr(140_000),
    minimumIncrement: inr(10_000),
    // Reserve deliberately set above what the bidding reaches, so the demo
    // includes a genuine unsold lot.
    reservePrice: inr(260_000),
    startAt: at(-14 * DAY),
    endAt: at(-1 * DAY),
    status: "LIVE",
    settle: "UNSOLD",
    images: [
      u("photo-1512909006721-3d6018887383"),
      u("photo-1516387938699-a93567ec168e"),
    ],
    attributes: {
      maker: "—",
      year: "First printing",
      size: "8vo",
      edition: "First edition, first printing",
      condition: "Very good in a good dust jacket",
      provenance: "Inscribed to the first owner; thence by descent.",
    },
    location: "Delhi",
    bids: 4,
  },

  // -- Sporting Memorabilia -------------------------------------------------
  {
    lotNumber: "601",
    title: "Signed Test Match Bat, 1983 Touring XI",
    slug: "signed-test-match-bat-1983-touring-xi",
    category: "sporting-memorabilia",
    shortDescription:
      "A match-used bat carrying the signatures of the full 1983 touring squad.",
    description: `A match-used willow bat, signed in ink across the face by all fourteen members of the 1983 touring squad together with the team management.

The signatures remain strong and legible, having been protected under a clear lacquer applied shortly after signing — a practice common at the time and here executed evenly, without pooling.

The bat shows genuine middle wear and two repaired edge cracks consistent with match use. Accompanied by a letter of provenance from the family of the player who assembled the signatures.`,
    startingPrice: inr(180_000),
    minimumIncrement: inr(10_000),
    reservePrice: inr(240_000),
    startAt: at(-3 * DAY),
    endAt: at(6 * HOUR),
    status: "LIVE",
    images: [
      u("photo-1531297484001-80022131f5a1"),
      u("photo-1571019613454-1cb2f99b2d8b"),
    ],
    attributes: {
      sport: "Cricket",
      event: "1983 tour",
      year: "1983",
      signedBy: "Full touring squad and management",
      authentication: "Letter of provenance from the consignor's family",
      condition: "Good — genuine match wear, two repaired edge cracks",
    },
    location: "Mumbai",
    bids: 8,
  },
  {
    lotNumber: "602",
    title: "Championship Final Match Jersey, Signed",
    slug: "championship-final-match-jersey-signed",
    category: "sporting-memorabilia",
    shortDescription:
      "A match-worn jersey from a championship final, signed and photo-matched.",
    description: `Match-worn in a championship final and signed on the reverse in silver marker.

The jersey has been photo-matched to the final using three separate images, with the matching points documented in the accompanying report: a pull to the left shoulder seam, an ink mark below the maker's badge, and the specific alignment of the number stitching.

Unwashed since the match, with sweat staining and grass marks present as expected. Framed to museum standard with UV-filtering glazing; the frame may be removed at the buyer's option.`,
    startingPrice: inr(260_000),
    minimumIncrement: inr(15_000),
    reservePrice: inr(300_000),
    startAt: at(-20 * DAY),
    endAt: at(-4 * DAY),
    status: "LIVE",
    settle: "SOLD",
    images: [
      u("photo-1571019613454-1cb2f99b2d8b"),
      u("photo-1531297484001-80022131f5a1"),
    ],
    attributes: {
      sport: "Football",
      event: "Championship final",
      year: "2016",
      signedBy: "Match-worn and signed by the player",
      authentication: "Photo-matched, report accompanies the lot",
      condition: "Unwashed, as worn",
    },
    location: "Goa",
    bids: 10,
  },

  // -- Property -------------------------------------------------------------
  {
    lotNumber: "701",
    title: "Heritage Villa with Sea Frontage, Alibaug",
    slug: "heritage-villa-with-sea-frontage-alibaug",
    category: "property",
    shortDescription:
      "A restored four-bedroom villa on 0.6 acres with direct sea frontage, offered freehold.",
    description: `A 1930s villa restored between 2019 and 2022, set within 0.6 acres of mature garden with approximately 40 metres of direct sea frontage.

The principal house provides four bedroom suites over two floors, arranged around a double-height central hall retaining its original teak roof structure and Mangalore tile. A separate two-room guest pavilion sits to the north of the plot.

The restoration retained the original lime plaster walls and stone plinth while introducing modern services throughout: rewiring, new plumbing, solar water heating and a 15 kVA backup supply.

Offered freehold with clear and marketable title. Title documents, the approved plan and the completion certificate are available in the data room to registered bidders.

Viewing strictly by appointment through the saleroom.`,
    startingPrice: inr(48_000_000),
    minimumIncrement: inr(1_000_000),
    reservePrice: inr(62_000_000),
    buyerPremiumBps: 200,
    startAt: at(6 * DAY),
    endAt: at(20 * DAY),
    status: "UPCOMING",
    images: [
      u("photo-1600185365483-26d7a4cc7519"),
      u("photo-1568605114967-8130f3a36994"),
      u("photo-1502877338535-766e1452684a"),
    ],
    attributes: {
      location: "Alibaug, Raigad district, Maharashtra",
      area: "5,400 sq ft built-up on 0.6 acres",
      bedrooms: "4 suites, plus 2-room guest pavilion",
      bathrooms: "5",
      yearBuilt: "circa 1934, restored 2019–2022",
      tenure: "Freehold",
    },
    location: "Alibaug",
  },

  // -- A draft, to prove drafts never surface publicly ----------------------
  {
    lotNumber: "801",
    title: "Bronze Study of a Seated Figure",
    slug: "bronze-study-of-a-seated-figure",
    category: "fine-art",
    shortDescription:
      "Cast bronze with dark brown patina, from an edition of nine. Catalogue entry in preparation.",
    description:
      "Full cataloguing, condition report and provenance research are in progress. This lot is not yet released for bidding.",
    startingPrice: inr(420_000),
    minimumIncrement: inr(20_000),
    startAt: at(10 * DAY),
    endAt: at(24 * DAY),
    status: "DRAFT",
    images: [u("photo-1578662996442-48f60103fc96")],
    attributes: {
      artist: "Attributed",
      medium: "Bronze with dark brown patina",
      dimensions: "42 cm high",
    },
    location: "Mumbai",
  },
];

// ---------------------------------------------------------------------------

async function main() {
  console.info("→ Clearing existing data");
  // Order matters: children before parents.
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.winner.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.proxyBid.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.auctionImage.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.newsletterSubscriber.deleteMany();
  await prisma.siteContent.deleteMany();
  await prisma.user.deleteMany();

  // -- People ---------------------------------------------------------------
  console.info("→ Creating accounts");
  const adminHash = await hashPassword(ADMIN_PASSWORD);
  const bidderHash = await hashPassword(BIDDER_PASSWORD);

  const staff = await Promise.all(
    STAFF.map((person) =>
      prisma.user.create({
        data: {
          name: person.name,
          email: person.email,
          passwordHash: adminHash,
          role: person.role,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          phone: "+91 98200 00000",
        },
      }),
    ),
  );
  const superAdmin = staff[0];

  const bidders = await Promise.all(
    BIDDERS.map((person, index) =>
      prisma.user.create({
        data: {
          name: person.name,
          email: person.email,
          passwordHash: bidderHash,
          role: "BIDDER",
          status: index === BIDDERS.length - 1 ? "SUSPENDED" : "ACTIVE",
          emailVerifiedAt: new Date(),
          createdAt: at(-(30 - index * 4) * DAY),
        },
      }),
    ),
  );
  // The final bidder is seeded suspended so the admin's account-status
  // handling is visible without an admin having to suspend someone first.
  const activeBidders = bidders.slice(0, -1);

  // -- Categories -----------------------------------------------------------
  console.info("→ Creating departments");
  const categories = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        status: "ACTIVE",
        sortOrder: category.sortOrder,
        fieldSchema: JSON.stringify(category.fieldSchema),
      },
    });
    categories.set(category.slug, created.id);
  }

  // -- Lots -----------------------------------------------------------------
  console.info("→ Cataloguing lots");
  let bidTotal = 0;

  for (const lot of LOTS) {
    const categoryId = categories.get(lot.category);
    if (!categoryId) throw new Error(`Unknown category ${lot.category}`);

    const auction = await prisma.auction.create({
      data: {
        lotNumber: lot.lotNumber,
        title: lot.title,
        slug: lot.slug,
        categoryId,
        shortDescription: lot.shortDescription,
        description: lot.description,
        startingPrice: lot.startingPrice,
        minimumIncrement: lot.minimumIncrement,
        reservePrice: lot.reservePrice ?? null,
        buyerPremiumBps: lot.buyerPremiumBps ?? 1200,
        currency: "INR",
        startAt: lot.startAt,
        endAt: lot.endAt,
        originalEndAt: lot.endAt,
        status: lot.status,
        featured: lot.featured ?? false,
        attributes: JSON.stringify(lot.attributes),
        location: lot.location ?? null,
        extensionEnabled: true,
        extensionThresholdSec: 120,
        extensionDurationSec: 120,
        proxyBiddingEnabled: true,
        watchlistEnabled: true,
        publishedAt: lot.status === "DRAFT" ? null : at(-7 * DAY),
        createdById: superAdmin.id,
        viewCount: 40 + Math.floor(Math.random() * 900),
        images: {
          create: lot.images.map((url, index) => ({
            url,
            altText: `${lot.title} — view ${index + 1}`,
            sortOrder: index,
            isPrimary: index === 0,
          })),
        },
      },
    });

    if (!lot.bids) continue;

    // -- Simulated bidding history -----------------------------------------
    // Written directly rather than through the engine: the engine enforces the
    // server clock, and this history is deliberately backdated.
    const count = lot.bids;
    let amount = lot.startingPrice;
    let leaderId = "";
    let leadingBidId = "";
    const openMs = lot.startAt.getTime();
    const closeMs = Math.min(lot.endAt.getTime(), now);
    const span = Math.max(closeMs - openMs, HOUR);

    for (let i = 0; i < count; i++) {
      if (i > 0) {
        // Mostly single increments, with the occasional decisive jump.
        const steps = Math.random() < 0.22 ? 2 + Math.floor(Math.random() * 3) : 1;
        amount += lot.minimumIncrement * steps;
      }

      // Never let a bidder follow their own bid, as the engine forbids it.
      let bidder = activeBidders[Math.floor(Math.random() * activeBidders.length)];
      let guard = 0;
      while (bidder.id === leaderId && guard++ < 10) {
        bidder = activeBidders[Math.floor(Math.random() * activeBidders.length)];
      }

      // Bids cluster toward the close, as they do in a real sale.
      const progress = Math.pow((i + 1) / count, 1.6);
      const createdAt = new Date(openMs + span * progress * 0.97);

      const bid = await prisma.bid.create({
        data: {
          auctionId: auction.id,
          userId: bidder.id,
          amount,
          status: "WINNING",
          isAutoBid: Math.random() < 0.18,
          createdAt,
        },
      });

      if (leadingBidId) {
        await prisma.bid.update({
          where: { id: leadingBidId },
          data: { status: "OUTBID" },
        });
      }

      leadingBidId = bid.id;
      leaderId = bidder.id;
      bidTotal++;
    }

    await prisma.auction.update({
      where: { id: auction.id },
      data: {
        currentBid: amount,
        highestBidderId: leaderId,
        bidCount: count,
        version: count,
      },
    });

    // -- Settlement for lots whose sale has already closed ------------------
    if (lot.settle) {
      const reserveMet = lot.reservePrice === undefined || amount >= lot.reservePrice;
      const finalStatus = lot.settle === "SOLD" && reserveMet ? "SOLD" : "UNSOLD";

      await prisma.bid.updateMany({
        where: { auctionId: auction.id, id: { not: leadingBidId } },
        data: { status: "LOST" },
      });
      await prisma.bid.update({
        where: { id: leadingBidId },
        data: { status: finalStatus === "SOLD" ? "WON" : "LOST" },
      });
      await prisma.auction.update({
        where: { id: auction.id },
        data: { status: finalStatus, settledAt: lot.endAt },
      });

      if (finalStatus === "SOLD") {
        const premiumBps = lot.buyerPremiumBps ?? 1200;
        const premium = Math.round((amount * premiumBps) / 10_000);

        const winner = await prisma.winner.create({
          data: {
            auctionId: auction.id,
            userId: leaderId,
            winningBidId: leadingBidId,
            winningAmount: amount,
            buyerPremium: premium,
            totalDue: amount + premium,
            // One settled lot is left awaiting payment and one is paid, so both
            // sides of the post-sale flow are visible.
            status: lot.lotNumber === "602" ? "PAYMENT_COMPLETED" : "PAYMENT_PENDING",
          },
        });

        if (winner.status === "PAYMENT_COMPLETED") {
          await prisma.payment.create({
            data: {
              auctionId: auction.id,
              userId: leaderId,
              amount: amount + premium,
              currency: "INR",
              provider: "mock",
              providerOrderId: `mock_order_seed_${auction.lotNumber}`,
              providerPaymentId: `mock_pay_seed_${auction.lotNumber}`,
              status: "PAID",
              createdAt: at(-3 * DAY),
            },
          });
        }

        await prisma.notification.create({
          data: {
            userId: leaderId,
            type: "AUCTION_WON",
            title: `Congratulations — you won Lot ${lot.lotNumber}`,
            message: `You won ${lot.title}. Complete payment to proceed.`,
            href: `/payment/${auction.id}`,
            createdAt: lot.endAt,
          },
        });
      }
    }
  }

  // -- Watchlists and a little inbox activity -------------------------------
  console.info("→ Seeding watchlists and notifications");
  const liveLots = await prisma.auction.findMany({
    where: { status: { in: ["LIVE", "UPCOMING"] } },
    select: { id: true, slug: true, lotNumber: true, title: true },
  });

  for (const bidder of activeBidders) {
    const picks = liveLots
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, 2 + Math.floor(Math.random() * 3));

    for (const lot of picks) {
      await prisma.watchlist
        .create({ data: { userId: bidder.id, auctionId: lot.id } })
        .catch(() => undefined);
    }
  }

  // Give the primary demo bidder a readable inbox.
  const demoBidder = activeBidders[0];
  const outbidLot = liveLots[0];
  if (outbidLot) {
    await prisma.notification.createMany({
      data: [
        {
          userId: demoBidder.id,
          type: "OUTBID",
          title: "You have been outbid",
          message: `Lot ${outbidLot.lotNumber} — ${outbidLot.title} has moved above your bid.`,
          href: `/auction/${outbidLot.slug}`,
          createdAt: at(-2 * HOUR),
        },
        {
          userId: demoBidder.id,
          type: "ENDING_SOON",
          title: "A lot you are watching is closing",
          message: `Lot ${outbidLot.lotNumber} closes shortly.`,
          href: `/auction/${outbidLot.slug}`,
          createdAt: at(-40 * MINUTE),
        },
      ],
    });
  }

  // -- Operational history --------------------------------------------------
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: superAdmin.id,
        action: "auction.publish",
        entityType: "auction",
        entityId: null,
        metadata: JSON.stringify({ note: "Autumn Collectors' Sale released" }),
        createdAt: at(-7 * DAY),
      },
      {
        actorId: staff[1].id,
        action: "category.create",
        entityType: "category",
        metadata: JSON.stringify({ note: "Property department opened" }),
        createdAt: at(-6 * DAY),
      },
    ],
  });

  await prisma.newsletterSubscriber.createMany({
    data: [
      { email: "collector.one@example.com" },
      { email: "collector.two@example.com" },
    ],
  });

  // -- Summary --------------------------------------------------------------
  const [auctions, users] = await Promise.all([
    prisma.auction.count(),
    prisma.user.count(),
  ]);

  console.info(`
──────────────────────────────────────────────
  Seed complete
──────────────────────────────────────────────
  Lots        ${auctions}
  Bids        ${bidTotal}
  Accounts    ${users}

  Admin console — /admin
    admin@maison.auction    ${ADMIN_PASSWORD}   (Super Admin)
    ops@maison.auction      ${ADMIN_PASSWORD}   (Auction Manager)
    editor@maison.auction   ${ADMIN_PASSWORD}   (Content Manager)

  Bidders — /login
    rahul.verma@example.com ${BIDDER_PASSWORD}
    priya.nair@example.com  ${BIDDER_PASSWORD}
    (all example.com bidders share this password)
──────────────────────────────────────────────
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

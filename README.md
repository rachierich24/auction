# Groovy Auction

A production-shaped auction platform: a public saleroom with live bidding, and
an operations console for running sales.

Built around one principle — **the server is the only authority on the state of
a lot**. Price, timing, status and outcome are re-derived from the database on
every mutation. Nothing the browser says about an auction is trusted.

---

## Running it

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET (openssl rand -base64 48)
npm run db:push               # create the schema
npm run db:seed               # 16 catalogued lots, 9 accounts, live bidding
npm run dev
```

Open <http://localhost:3000>.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@groovy.auction` | `Saleroom!2026` |
| Auction Manager | `ops@groovy.auction` | `Saleroom!2026` |
| Content Manager | `editor@groovy.auction` | `Saleroom!2026` |
| Bidder | `rahul.verma@example.com` | `Collector!2026` |
| Bidder | `priya.nair@example.com` | `Collector!2026` |

The console is at `/admin`. Sign in as each role to see permissions differ —
the Content Manager can reach content and departments but is redirected away
from bids, users and the audit log.

The seed deliberately produces a sale already in progress: lots closing in
minutes (so the anti-snipe extension is reachable), lots open for days, lots not
yet opened, a lot sold and awaiting payment, a lot sold and settled, a lot
unsold on an unmet reserve, and a draft that never appears publicly.

### Commands

```bash
npm run dev              # development server
npm run build            # production build
npm run typecheck        # tsc --noEmit
npm run db:reset         # drop, recreate and reseed
npm run db:studio        # Prisma Studio
npm run close:auctions   # run the settlement sweep once, by hand
npm run test:e2e-flow    # 53-assertion end-to-end verification (see below)
```

---

## Verifying it actually works

```bash
npm run test:e2e-flow
```

This drives the real bidding engine and settlement code — not a stub — through
the full lifecycle, and cleans up after itself. It asserts, among other things:

- a draft lot refuses bids even if its id is known
- the state machine rejects `DRAFT → SOLD` and `ENDED → LIVE`
- a bid below the next increment, a negative bid, a bid from a suspended
  account, and a bid from the current leader are each refused with a distinct
  reason
- **two simultaneous identical bids resolve to exactly one winner**, the loser
  is told the price moved, and the bid counter still matches the row count
- a standing maximum executes at the smallest winning step, not at its ceiling
- a bid inside the closing window extends the lot, marks it `EXTENDED`, and
  preserves the originally scheduled close
- the highest valid bid wins; the buyer's premium and total due are exact
- a lot closing below its reserve is `UNSOLD` with no winner record
- settlement is idempotent — settling twice does not create a second winner
- a bid after the hammer is refused

```
────────────────────────────────────────────────────
  53 passed
────────────────────────────────────────────────────
```

---

## How the important parts work

### The bidding engine — `src/lib/bidding/engine.ts`

The client sends exactly one number: the amount it wants to bid. Everything
else — the current bid, the minimum, whether the lot is open, what time it is —
is re-read inside the transaction that decides the bid.

Concurrency is handled with an **optimistic compare-and-set on
`auctions.version`**. Two bidders landing in the same millisecond both read
version *N*; the first to write moves it to *N+1*, and the second's `UPDATE`
matches zero rows and is rejected. A unique index on `(auction_id, amount)` is
the database-level backstop underneath that.

A rejected bid is **never retried on the bidder's behalf** — the price has
moved, so the bidder is shown the new price and asked to decide again
("The current bid has changed. Please review the latest bid.").

### Proxy bidding

A bidder can leave a ceiling. When someone challenges, the bidder with the
higher ceiling ends up in front and the price rises only to the smallest step
that beats the underbidder — the way a saleroom clerk works an absentee bid.
Each round moves the price to one of the two ceilings, so a pair of duelling
proxies settles in at most two rounds.

### Anti-sniping

A bid inside the configured window (default: final 2 minutes) pushes the close
out (default: by 2 minutes) and marks the lot `EXTENDED`. `originalEndAt` keeps
the scheduled close for the record. Configurable per lot.

### Settlement — `src/lib/auction/settlement.ts`

Driven from three places that converge on one transaction: the scheduled sweep,
an admin closing a lot early, and opportunistically whenever a read notices a
lot has passed its boundary. Every entry point is idempotent — two sweeps racing
cannot produce two winners.

Highest valid bid wins. Reserve met → `SOLD` plus a winner record and an emailed
notification. Reserve not met → `UNSOLD`, no sale.

### Time

All instants are stored UTC. `effectiveStatus()` derives what a lot's status
*should* be from the server clock, so the public site is never a tick behind the
sweeper. The browser's countdown is decoration: when it reaches zero it asks the
server rather than deciding anything itself.

### Money

Every monetary column is a **`BigInt` count of minor units** (paise). No floats
touch money anywhere. 64-bit is not optional — a 32-bit column caps a lot at
about ₹21 crore, which a property lot passes straight through. Reads normalise
to JS `number` at the query boundary (`minor()`), exact to 2^53 minor units, so
no arithmetic ever mixes `bigint` with `number`.

Buyer's premium is stored in basis points (`1200` = 12%).

---

## Security

- **Sessions** — opaque 32-byte tokens in an httpOnly, SameSite=Lax cookie. Only
  the SHA-256 hash is stored, so a database dump cannot be replayed as a login.
  A suspended account resolves to no user, locking it out everywhere at once.
- **Passwords** — scrypt (N=2^17) from `node:crypto`, parameters embedded in the
  hash so they can be raised later without invalidating existing hashes.
  Sign-in spends comparable time on a missing account, so timing does not
  distinguish "no such user" from "wrong password".
- **Authorisation** — capability-based (`src/lib/auth/rbac.ts`). Routes ask for a
  capability, never a role. The `/admin` guard runs once in a layout so a page
  that forgets its own check is still protected, and pages then re-assert the
  specific capability they need.
- **Rate limiting** — sign-in, registration, password reset, bidding and uploads.
- **Uploads** — magic-number sniffing decides the file type; the browser's MIME
  type and filename are discarded and the storage key is generated, which removes
  path traversal and double-extension tricks as a class.
- **CSRF** — Server Actions carry Next.js's own origin protection; the plain route
  handlers add an explicit same-origin check.
- **Enumeration** — password reset and registration return identical responses
  whether or not the address exists.
- **Open redirect** — `?next=` is validated to a same-site path.
- **Audit** — every privileged mutation appends to `audit_logs`. Append-only:
  nothing updates or deletes a row there.
- **Bid history** — public and complete, with identities masked (`Rahul ****`) at
  the query boundary, so no render path can leak a bidder's name.

Bids are never editable, by anyone. A lot that must be undone is *withdrawn*,
which preserves its history.

---

## Architecture

```
src/
  app/
    (site)/          public saleroom — home, catalogue, lot detail, profile,
                     notifications, payment, terms, privacy
    (auth)/          sign in, register, reset, verify
    admin/(console)/ operations console, behind the capability guard
    api/             SSE bid stream, uploads, cron, logout
    actions/         server actions — thin transport over the domain layer
  components/        ui/ · auction/ · admin/ · site/ · auth/ · payment/
  lib/
    auth/            sessions, passwords, RBAC, guards, tokens
    auction/         state machine, queries, settlement
    bidding/         the engine
    payments/        provider abstraction (mock · Razorpay · Cashfree)
    storage/         driver abstraction (local · S3 · Supabase)
    email/           transport abstraction (console · Resend)
    notifications/   in-app + email
    admin/           operator reads and analytics
    validation/      Zod schemas — the single source of truth for enums
prisma/              schema + seed
scripts/             settlement runner, end-to-end verification
```

Business logic never lives in a component. Pages read through a query layer and
mutate through server actions that delegate to the domain layer.

### Realtime

Server-Sent Events (`/api/auctions/[id]/stream`). One-directional, survives
proxies that mangle upgrades, and the browser reconnects on its own — bids
themselves go through a server action, so the channel is read-only by
construction. The opening frame carries authoritative state so a reconnecting
client re-syncs immediately.

Backed by an in-process event bus. To scale across instances, replace `publish`
and `subscribe` in `src/lib/realtime/bus.ts` with Redis pub/sub or Supabase
Realtime; nothing else changes.

---

## Configuration

The accent colour is defined once in `src/app/globals.css` (`--color-accent`) and
the whole product follows — buttons, focus rings, live indicators, charts.

Swappable via environment variables, each behind a narrow interface:

| Concern | Default | Alternatives |
|---|---|---|
| `STORAGE_DRIVER` | `local` (`./public/uploads`) | `s3`, `supabase` |
| `EMAIL_DRIVER` | `console` (logs to stdout) | `resend` |
| `PAYMENT_PROVIDER` | `mock` (settles in dev) | `razorpay`, `cashfree` |

The mock payment provider still creates an order, signs it and verifies the
signature, so the production flow is exercised end to end in development.

### Scheduled settlement

`/api/cron` opens due lots, closes and settles finished ones, warns watchers, and
prunes expired sessions. `vercel.json` schedules it every minute. Authorise with
`Authorization: Bearer $CRON_SECRET`. Settlement also runs opportunistically on
read, so a missed tick delays bookkeeping but never shows a stale lot.

---

## Database

Local development uses **SQLite** so the app runs with zero infrastructure.

To move to **PostgreSQL**: set `provider = "postgresql"` in
`prisma/schema.prisma`, point `DATABASE_URL` at the instance, run
`prisma db push`. Nothing else changes — the schema deliberately avoids
provider-specific constructs. Status columns are plain strings validated by Zod
(`src/lib/validation/enums.ts`) rather than native enums, and JSON payloads are
TEXT.

---

## Known limitations

- Rate limiting and the realtime bus are **in-process**. Correct for a single
  instance; both need Redis behind a load balancer. The swap points are
  `src/lib/rate-limit.ts` and `src/lib/realtime/bus.ts`.
- The **S3 storage driver** is stubbed — it needs `@aws-sdk/client-s3`, kept out
  of the dependency tree until the driver is switched on. The Supabase driver is
  implemented.
- The **Cashfree** payment adapter is a stub; mirror the Razorpay adapter in
  `src/lib/payments/provider.ts`. Neither real gateway's checkout widget is
  mounted in the client — the panel says so explicitly rather than failing
  silently.
- Uploaded images are stored at their original resolution. Next.js generates
  responsive variants at request time; a production deployment would want a
  processing step (sharp, or a transforming CDN) on upload.
- `REQUIRE_EMAIL_VERIFICATION` defaults off so the demo flows without an inbox.
  Set it to `true` to gate bidding on a confirmed address; the engine enforces
  it server-side.
- **There is no unit-test framework.** `npm run test:e2e-flow` covers the domain
  layer thoroughly — the engine, the state machine, settlement, the bid race —
  but there is no Vitest/Playwright suite around components, server actions or
  the rendered UI. Adding one is the first thing I would do next.
- A route with a `loading.tsx` streams, so an unauthorised request to it returns
  **200** with the redirect embedded in the payload rather than a `307`. The
  guard still holds and no protected data is emitted (verified), but a scanner
  reading status codes alone will read it as allowed.

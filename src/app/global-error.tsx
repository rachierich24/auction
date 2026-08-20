"use client";

import * as React from "react";

/**
 * Last-resort boundary: catches failures in the root layout itself, where the
 * site chrome and design tokens are not available. It therefore ships its own
 * markup and inline styles rather than relying on anything above it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[root] fatal render error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f7f6f2",
          color: "#111111",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "26rem", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.6875rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#8f8b83",
              margin: 0,
            }}
          >
            Groovy Auction
          </p>

          <h1
            style={{
              margin: "1.25rem 0 0",
              fontSize: "1.75rem",
              fontWeight: 600,
              lineHeight: 1.15,
            }}
          >
            The site is temporarily unavailable
          </h1>

          <p
            style={{
              margin: "0.875rem 0 0",
              fontSize: "0.9375rem",
              lineHeight: 1.6,
              color: "#666666",
            }}
          >
            We hit an unexpected error. Bidding is recorded on our servers, so
            nothing you have placed is affected.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              padding: "0.7rem 1.4rem",
              border: "none",
              borderRadius: "2px",
              background: "#111111",
              color: "#ffffff",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Reload
          </button>

          {error.digest ? (
            <p
              style={{
                marginTop: "2rem",
                fontSize: "0.6875rem",
                fontFamily: "ui-monospace, monospace",
                color: "#8f8b83",
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}

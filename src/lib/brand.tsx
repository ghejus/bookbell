// Bookbell's look, for pictures drawn on the server (icons and link previews).
// These pictures can't use Tailwind classes, so the colours live here too.
// They match the brand colours in src/app/globals.css.

export const brand = {
  violet: "#7c3aed", // brand-600
  violetDark: "#5b21b6", // brand-800
  violetSoft: "#ede9fe", // brand-100
  ground: "#f3f4f6", // gray-100
  ink: "#111827", // gray-900
  muted: "#4b5563", // gray-600
};

/** A white bell on a violet square: the app icon. `size` is in pixels. */
export function BellMark({ size, rounded = true }: { size: number; rounded?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brand.violet,
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      {/* The bell drawing from the lucide icon set, which the app already uses. */}
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.268 21a2 2 0 0 0 3.464 0" />
        <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
      </svg>
    </div>
  );
}

/** The 1200×630 picture people see when a Bookbell link is shared in a chat or post. */
export function ShareCard({ title, subtitle, footer }: { title: string; subtitle: string; footer: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        fontFamily: "Inter",
        background: brand.ground,
        color: brand.ink,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <BellMark size={64} />
        <div style={{ fontSize: 40, fontWeight: 600, color: brand.violetDark }}>Bookbell</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: title.length > 40 ? 60 : 76,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            // Very long shop names stop after two lines instead of spilling off the picture.
            display: "block",
            lineClamp: 2,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 32, color: brand.muted, lineHeight: 1.4, display: "block", lineClamp: 2 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 600,
            color: "#ffffff",
            background: brand.violet,
            borderRadius: 14,
            padding: "16px 32px",
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}

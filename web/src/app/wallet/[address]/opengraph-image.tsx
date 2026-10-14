import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getFadeList, getWallet } from "@/lib/data";
import { AddressSchema } from "@/lib/fade-list";
import { cents, MINUS, shortAddress } from "@/lib/format";

export const alt = "Contra wallet card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const dir = join(process.cwd(), "src/assets/og");
const fontsP = Promise.all([
  readFile(join(dir, "Geist-SemiBold.ttf")),
  readFile(join(dir, "Geist-Medium.ttf")),
  readFile(join(dir, "GeistMono-Medium.ttf")),
]);
const logoP = readFile(join(process.cwd(), "public/brand/contra-lockup.svg"), "base64");

const C = { surface: "#f7f7f4", ink: "#0c1222", muted: "#586070", brand: "#2442d6", tint: "#e8ecfc", loss: "#c42b26" };

export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const [semibold, medium, mono] = await fontsP;
  const logo = await logoP;
  const list = getFadeList();
  const w = AddressSchema.safeParse(address).success ? getWallet(address) : undefined;
  const pct = Math.round(list.confidencePrice * 100);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.surface, color: C.ink, fontFamily: "Geist" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 40px 44px 56px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <img src={`data:image/svg+xml;base64,${logo}`} height={36} width={193} alt="" />
            <span style={{ fontFamily: "Geist Mono", fontSize: 18, color: C.muted }}>Fade List</span>
          </div>
          {w ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <span style={{ fontFamily: "Geist Mono", fontSize: 24, color: C.muted }}>{shortAddress(w.address)}</span>
              <span style={{ fontSize: 58, lineHeight: 1.08, fontWeight: 600, letterSpacing: "-0.03em" }}>
                {`Lost ${w.confLosses} of ${w.confBets} bets it was at least ${pct}% sure about.`}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 64, fontWeight: 600, letterSpacing: "-0.03em" }}>Bet against the worst.</span>
          )}
          {w ? (
            <div style={{ display: "flex", gap: 56 }}>
              <Stat value={String(Math.round(w.expectedConfLosses))} label="losses the odds expected" />
              <Stat value={`${w.sigma < 0 ? MINUS : "+"}${Math.abs(w.sigma).toFixed(1)}`} sigma label="below the odds" color={C.loss} />
              <Stat value={String(w.resolvedBets)} label="resolved bets" />
            </div>
          ) : (
            <span style={{ fontSize: 24, color: C.muted }}>The other side of bad bets.</span>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, color: C.muted, fontWeight: 500 }}>
            <span>{w?.worstCall ? `Worst call: ${w.worstCall.outcome} at ${cents(w.worstCall.price)}. It lost.` : "contra"}</span>
            <span>{list.sample ? "Sample data · Not financial advice" : "Not financial advice"}</span>
          </div>
        </div>
        <div style={{ width: 230, background: C.brand, display: "flex", flexWrap: "wrap", alignContent: "center", justifyContent: "center", gap: 28, padding: 28, borderRadius: "16px 0 0 16px" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <svg key={i} width="56" height="56" viewBox="0 0 56 56">
              <path d="M26 6 A22 22 0 0 0 26 50 Z" fill="none" stroke={C.surface} strokeWidth="4" />
              <path d="M30 4 A24 24 0 0 1 30 52 Z" fill={C.surface} />
            </svg>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
        { name: "Geist", data: medium, weight: 500, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}

function Stat({ value, label, color, sigma }: { value: string; label: string; color?: string; sigma?: boolean }) {
  const c = color ?? C.ink;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ display: "flex", alignItems: "flex-end", gap: 4, fontFamily: "Geist Mono", fontSize: 44, fontWeight: 500, color: c }}>
        {value}
        {sigma && (
          // Geist has no Greek glyphs, so the σ is drawn.
          <svg width="26" height="30" viewBox="0 0 26 30" style={{ marginBottom: 8 }}>
            <circle cx="11" cy="18" r="8.5" fill="none" stroke={c} strokeWidth="3.4" />
            <path d="M11 9.5 H25" stroke={c} strokeWidth="3.4" />
          </svg>
        )}
      </span>
      <span style={{ fontSize: 17, fontWeight: 500, color: C.muted }}>{label}</span>
    </div>
  );
}

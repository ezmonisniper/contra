import { sigma } from "@/lib/format";
import ui from "./ui.module.css";

/** σ score: always signed, always with an arrow, so it never relies on color alone. */
export function SigmaBadge({ value }: { value: number }) {
  const down = value < 0;
  return (
    <span className={`${ui.badge} ${ui.figure} ${down ? ui.loss : ui.gain}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d={down ? "M1 3 L5 8 L9 3 Z" : "M1 7 L5 2 L9 7 Z"} fill="currentColor" />
      </svg>
      {sigma(value)}
    </span>
  );
}

export function SampleNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className={ui.notice}>
      Sample data: illustrative wallets and markets until the first real list is published. Fades are disabled on
      sample markets.
    </p>
  );
}

/** Win/loss marker for a resolved bet: word + color, never color alone. */
export function Outcome({ won }: { won: boolean }) {
  return <span className={`${ui.figure} ${won ? ui.gain : ui.loss}`}>{won ? "Won" : "Lost"}</span>;
}

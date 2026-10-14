import type { Metadata } from "next";
import { PositionsView } from "@/components/positions/PositionsView";
import ui from "@/components/ui.module.css";
import styles from "../prose.module.css";

export const metadata: Metadata = { title: "My fades", robots: { index: false } };

export default function PositionsPage() {
  return (
    <div className={`${ui.container} ${styles.prose}`}>
      <p className={ui.eyebrow}>My fades</p>
      <h1 className={ui.title}>Your positions</h1>
      <p className={ui.muted}>Read from the chain for the connected wallet. Winning positions can be claimed here.</p>
      <PositionsView />
    </div>
  );
}

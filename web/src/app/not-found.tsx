import Link from "next/link";
import ui from "@/components/ui.module.css";
import styles from "./prose.module.css";

export default function NotFound() {
  return (
    <div className={`${ui.container} ${styles.prose}`}>
      <h1 className={ui.title}>Not on the list</h1>
      <p className={ui.muted}>That page or wallet isn&apos;t here. Wallets only appear once they qualify for the Fade List.</p>
      <p>
        <Link href="/">Back to the Fade List</Link>
      </p>
    </div>
  );
}

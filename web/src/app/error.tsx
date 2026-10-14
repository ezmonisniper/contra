"use client";

import ui from "@/components/ui.module.css";
import styles from "./prose.module.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={`${ui.container} ${styles.prose}`}>
      <h1 className={ui.title}>Something broke</h1>
      <p className={ui.muted}>Nothing was sent to the chain. Try again.</p>
      <p>
        <button type="button" className={ui.secondary} onClick={reset}>
          Try again
        </button>
      </p>
    </div>
  );
}

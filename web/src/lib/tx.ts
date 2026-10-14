import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { PublicError } from "./errors";

/** Solana's maximum serialized transaction size. */
export const MAX_TX_BYTES = 1232;

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export function decodeTx(b64: string): VersionedTransaction {
  if (typeof b64 !== "string" || b64.length === 0 || b64.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new PublicError("Malformed transaction.", 400, "bad_transaction");
  }
  const bytes = b64ToBytes(b64);
  if (bytes.length > MAX_TX_BYTES) throw new PublicError("Transaction too large.", 400, "bad_transaction");
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    throw new PublicError("Malformed transaction.", 400, "bad_transaction");
  }
}

export function feePayer(tx: VersionedTransaction): PublicKey {
  const payer = tx.message.staticAccountKeys[0];
  if (!payer) throw new PublicError("Transaction has no fee payer.", 400, "bad_transaction");
  return payer;
}

/**
 * The person signing must be the one paying and the only required signer.
 * This stops an upstream response (or anyone in the middle) from handing the
 * user a transaction that spends someone else's authority or needs a second key.
 */
export function assertOnlySigner(tx: VersionedTransaction, owner: string): void {
  if (!feePayer(tx).equals(new PublicKey(owner))) {
    throw new PublicError("Transaction fee payer doesn't match your wallet. Not signing it.", 502, "fee_payer_mismatch");
  }
  if (tx.message.header.numRequiredSignatures !== 1) {
    throw new PublicError("Transaction needs more than your signature. Not signing it.", 502, "extra_signers");
  }
}

/** Every required signature slot is filled (no all-zero placeholders). */
export function assertFullySigned(tx: VersionedTransaction): void {
  const n = tx.message.header.numRequiredSignatures;
  if (tx.signatures.length < n) throw new PublicError("Transaction isn't signed.", 400, "unsigned");
  for (let i = 0; i < n; i++) {
    const sig = tx.signatures[i];
    if (!sig || sig.every((b) => b === 0)) throw new PublicError("Transaction isn't signed.", 400, "unsigned");
  }
}

/** Program ids the transaction invokes. Programs are always static keys. */
export function programIds(tx: VersionedTransaction): string[] {
  const keys = tx.message.staticAccountKeys;
  return [...new Set(tx.message.compiledInstructions.map((ix) => keys[ix.programIdIndex]?.toBase58() ?? "?"))];
}

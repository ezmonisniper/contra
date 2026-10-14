import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

const BLOCKHASH = "11111111111111111111111111111111";

/** A real v0 transaction paid by `payer`, optionally requiring a second signer. */
export function makeTx(payer: Keypair, extraSigner?: Keypair): VersionedTransaction {
  const ix = SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1 });
  if (extraSigner) ix.keys.push({ pubkey: extraSigner.publicKey, isSigner: true, isWritable: false });
  const msg = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: BLOCKHASH, instructions: [ix] }).compileToV0Message();
  return new VersionedTransaction(msg);
}

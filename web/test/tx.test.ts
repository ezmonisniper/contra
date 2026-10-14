import { Keypair, SystemProgram } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { assertFullySigned, assertOnlySigner, bytesToB64, decodeTx, programIds } from "@/lib/tx";
import { makeTx } from "./helpers";

describe("transaction checks", () => {
  it("round-trips base64", () => {
    const tx = makeTx(Keypair.generate());
    const back = decodeTx(bytesToB64(tx.serialize()));
    expect(back.message.staticAccountKeys[0]!.equals(tx.message.staticAccountKeys[0]!)).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(() => decodeTx("not base64!!")).toThrow(/Malformed/);
    expect(() => decodeTx(btoa("hello"))).toThrow(/Malformed/);
    expect(() => decodeTx("A".repeat(3000))).toThrow();
  });

  it("accepts a transaction only the owner signs and pays for", () => {
    const owner = Keypair.generate();
    expect(() => assertOnlySigner(makeTx(owner), owner.publicKey.toBase58())).not.toThrow();
  });

  it("refuses a transaction paid by someone else", () => {
    const owner = Keypair.generate();
    expect(() => assertOnlySigner(makeTx(Keypair.generate()), owner.publicKey.toBase58())).toThrow(/fee payer/);
  });

  it("refuses a transaction that needs a second signer", () => {
    const owner = Keypair.generate();
    expect(() => assertOnlySigner(makeTx(owner, Keypair.generate()), owner.publicKey.toBase58())).toThrow(/more than your signature/);
  });

  it("detects unsigned vs signed", () => {
    const owner = Keypair.generate();
    const tx = makeTx(owner);
    expect(() => assertFullySigned(tx)).toThrow(/isn't signed/);
    tx.sign([owner]);
    expect(() => assertFullySigned(tx)).not.toThrow();
  });

  it("lists invoked programs", () => {
    expect(programIds(makeTx(Keypair.generate()))).toEqual([SystemProgram.programId.toBase58()]);
  });
});

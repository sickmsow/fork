import { assert } from "@std/assert";
import { signMessage } from "./sign.ts";
import { Keyring } from "https://deno.land/x/polkadot@0.2.45/keyring/mod.ts";
import {
  signatureVerify,
} from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";

Deno.test("signMessage signs a message correctly", async () => {
  const MNEMONIC =
    "sample split bamboo west visual approve brain fox arch impact relief smile";
  const keyring = new Keyring();
  const pair = keyring.createFromUri(MNEMONIC);
  const message = "this is our message";
  const signature = await signMessage(message, MNEMONIC);
  const verif = await signatureVerify(message, signature, pair.address);
  assert(verif, "Signature is Valid");
});

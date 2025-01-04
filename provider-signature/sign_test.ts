import { assert } from "@std/assert";
import { signMessage } from "./sign.ts";
import {
  signatureVerify,
} from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";

// Make the test work with environment variables
const mnemonic ="sample split bamboo west visual approve brain fox arch impact relief smile";  

Deno.test("signMessage signs a message correctly", async () => {
  const message = "this is our message";
  const signedMessage = await signMessage(message, mnemonic);
  const verif = await signatureVerify(message, signedMessage.signature, signedMessage.address);
  assert(verif, "Signature is Valid");
});

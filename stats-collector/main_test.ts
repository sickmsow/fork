import { assert } from "@std/assert";
import { signMessage } from "./main.ts";
import {
  signatureVerify,
} from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";

Deno.test("signMessage signs a message correctly", async () => {
  const message = "this is our message";
  const signedMessage = await signMessage(message);
  const verif = await signatureVerify(
    message,
    signedMessage.signature,
    signedMessage.address,
  );
  assert(verif, "Signature is Valid");
});

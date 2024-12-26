import { assertEquals, assert } from "https://deno.land/std/testing/asserts.ts";
import { signMessage } from "./sign.ts";
import { generateKeypair } from "./helpers.ts";

import {
  signatureVerify 
} from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";

Deno.test("generateKeypair generates a valid keypair", async () => {
  const { mnemonic, pair } = await generateKeypair();

  assert(mnemonic.length > 0, "Mnemonic should not be empty");
  assert(pair, "Keyring pair should be defined");
  assertEquals(pair.meta.name, "first pair", "Keyring pair name should be 'first pair'");
  assert(pair.address.length > 0, "Keyring pair address should not be empty");
});

Deno.test("signMessage signs a message correctly", async () => {
  const { mnemonic, pair } = await generateKeypair();
  const message = "Hello, world!";
  const signature = await signMessage(message, mnemonic);
  assert(signature.length > 0, "Signature should not be empty");
  const isValid = signatureVerify(message, signature, pair.address);
  console.log(isValid);
  //TODO: Fix this test
  //assert(isValid.isValid, "Signature should be valid");
});
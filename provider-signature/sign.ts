import {
  cryptoWaitReady,
} from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";

import { Keyring } from "https://deno.land/x/polkadot@0.2.45/keyring/mod.ts";

import { stringToU8a } from "https://deno.land/x/polkadot@0.2.45/util/mod.ts";

export async function signMessage(message: string, mnemonic: string) {
  await cryptoWaitReady();
  const keyring = new Keyring();
  const pair = keyring.createFromUri(mnemonic);
  const u8tifiedMsg = stringToU8a(message);
  const signature = pair.sign(u8tifiedMsg);
  return signature;
}

import {
    mnemonicGenerate 
  } from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";

  import { Keyring } from "https://deno.land/x/polkadot@0.2.45/keyring/mod.ts";
  
  export async function generateKeypair(): Promise<{ mnemonic: string, pair: any }> {
    const keyring = new Keyring({ type: "ed25519", ss58Format: 42 });
    const mnemonic = mnemonicGenerate();
    // create & add the pair to the keyring some metadata
    const pair = keyring.addFromUri(mnemonic, { name: "first pair" }, "ed25519");
    // the pair has been added to our keyring
    console.log(keyring.pairs.length, "pairs available");
    // log the name & address (the latter encoded with the ss58Format)
    console.log(pair.meta.name, "has address", pair.address);
    return {
      mnemonic,
      pair
    };
  }
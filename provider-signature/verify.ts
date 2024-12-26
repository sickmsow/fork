// Will be used by the platform orchestration side to verify the signature of the provider.

import { sr25519Verify } from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";

const message = 'Health check data for provider';
const signature = 'SIGNED_MESSAGE_FROM_REQUEST';
const publicKey = 'PROVIDER_PUBLIC_KEY_FROM_REQUEST';

async function verifySignature() {
  const encoder = new TextEncoder();
  
  const isValid = sr25519Verify(
    hexToUint8Array(signature),
    encoder.encode(message),
    hexToUint8Array(publicKey)
  );

  console.log(isValid ? 'Signature is valid!' : 'Invalid signature!');
}

function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );
}

await verifySignature();
import { etc, signAsync } from '@noble/ed25519';

type SignedRequest = {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
};

// This private key matches env.dev SIGNATURE_PUBLIC_KEY in wrangler.toml.
const FALLBACK_DEV_SIGNATURE_PRIVATE_KEY = 'd46b224eca160429fbbd3c903994bb93da0532635839530a1fd6cdac1bd4023e';

export async function signRequest(body: object): Promise<SignedRequest> {
  const timestamp = Date.now().toString();
  const json = JSON.stringify(body);
  const message = new TextEncoder().encode(timestamp + json);
  const privateKeyHex = process.env.SIGNATURE_PRIVATE_KEY ?? FALLBACK_DEV_SIGNATURE_PRIVATE_KEY;
  const privateKey = etc.hexToBytes(privateKeyHex);
  const signatureBytes = await signAsync(message, privateKey);

  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': etc.bytesToHex(signatureBytes),
      'x-signature-timestamp': timestamp,
    },
    body: json,
  };
}

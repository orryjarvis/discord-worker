import { etc, signAsync } from '@noble/ed25519';

type SignedRequest = {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
};

export async function signRequest(body: object): Promise<SignedRequest> {
  const timestamp = Date.now().toString();
  const json = JSON.stringify(body);
  const message = new TextEncoder().encode(timestamp + json);
  const privateKeyHex = process.env.SIGNATURE_PRIVATE_KEY;
  if (!privateKeyHex) {
    throw new Error('SIGNATURE_PRIVATE_KEY environment variable is required. Set it to the hex-encoded private key matching the SIGNATURE_PUBLIC_KEY configured for your target environment.');
  }
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

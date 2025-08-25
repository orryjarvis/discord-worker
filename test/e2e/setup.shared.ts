import * as ed from '@noble/ed25519';

type SimpleRequestInit = {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
};

async function signRequest(body: object): Promise<SimpleRequestInit> {
  const timestamp = Date.now().toString();
  const json = JSON.stringify(body);
  const message = new TextEncoder().encode(timestamp + json);
  const privateKeyHex = process.env.SIGNATURE_PRIVATE_KEY || "bfbb3f0da095ff411191941cf30bc7a4afaa2a223b78ad05a049751b265f5049";
  const privateKey = Uint8Array.from(Buffer.from(privateKeyHex, "hex"));
  const signatureUint8 = await ed.signAsync(message, privateKey);
  const signatureHex = Buffer.from(signatureUint8).toString('hex');
  const request: SimpleRequestInit = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': signatureHex,
      'x-signature-timestamp': timestamp,
    },
    body: JSON.stringify(body),
  }

  return request
}

export { signRequest };

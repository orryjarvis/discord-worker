import * as ed from '@noble/ed25519';

async function generateEd25519KeyPair() {
  const { secretKey, publicKey } = await ed.keygenAsync();

  console.log('Private Key:', Buffer.from(secretKey).toString('hex'));
  console.log('Public Key:', Buffer.from(publicKey).toString('hex'));
}

generateEd25519KeyPair();

import { sha512 } from '@noble/hashes/sha512';
import * as ed from '@noble/ed25519';

ed.etc.sha512Sync = sha512;

async function generateEd25519KeyPair() {
  const privateKey = ed.utils.randomPrivateKey()
  const publicKey = await ed.getPublicKey(privateKey);

  console.log('Private Key:', Buffer.from(privateKey).toString('hex'));
  console.log('Public Key:', Buffer.from(publicKey).toString('hex'));
}

generateEd25519KeyPair();

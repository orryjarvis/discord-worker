import { inject, injectable } from 'tsyringe';
import * as ed from "@noble/ed25519"
import type { Env } from './types.js';

@injectable()
export class Auth {

    constructor(@inject('Env') private env: Env) {}

    async performChecks(request: Request): Promise<Response | undefined> {
        const signature = request.headers.get('x-signature-ed25519');
        const timestamp = request.headers.get('x-signature-timestamp');
        const discord_pub_key = this.env.SIGNATURE_PUBLIC_KEY;
        const body = await request.clone().text();
    if (!signature || !timestamp || !(await this.verifySignature(signature, timestamp, body, String(discord_pub_key)))) {
            console.error('Invalid Request');
            return new Response('Bad request signature.', { status: 401 });
        }
    }

    async verifySignature(
        signature: string,
        timestamp: string,
        body: string,
        clientPublicKey: string
    ): Promise<boolean> {
        const message = new TextEncoder().encode(timestamp + body)
        const sigHex = ed.etc.hexToBytes(signature)
        const pubKeyHex = ed.etc.hexToBytes(clientPublicKey)
        const isVerified = await ed.verifyAsync(sigHex, message, pubKeyHex)
        return isVerified
    }

}

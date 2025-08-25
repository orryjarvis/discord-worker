import { inject, injectable } from 'tsyringe';
import * as ed from "@noble/ed25519"
import { Configuration } from './config';

@injectable()
export class Auth {

    constructor(@inject(Configuration) private config: Configuration) {}

    async performChecks(request: Request): Promise<Response | undefined> {
        const signature = request.headers.get('x-signature-ed25519');
        const timestamp = request.headers.get('x-signature-timestamp');
        const discord_pub_key = this.config.get('SIGNATURE_PUBLIC_KEY');
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
        const isVerified = await ed.verifyAsync(signature, message, clientPublicKey)
        return isVerified
    }

}

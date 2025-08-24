import { inject, injectable } from 'tsyringe';
import * as ed from "@noble/ed25519"
import { Configuration } from './config';

@injectable()
export class Auth {

    constructor(@inject(Configuration) private config: Configuration) {}

    async performChecks(request: Request): Promise<Response | undefined> {
        if (this.config.get('SKIP_SIGNATURE_CHECK') === 'true') {
            return;
        }
        const signature = request.headers.get('x-signature-ed25519') ?? "";
        const timestamp = request.headers.get('x-signature-timestamp') ?? "";
        const body = await request.clone().text();
        const discord_pub_key = this.config.get('DISCORD_PUBLIC_KEY');
        const isValidRequest = await this.verifySignature(signature, timestamp, body, discord_pub_key);
        if (!isValidRequest) {
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

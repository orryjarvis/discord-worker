import { injectable } from 'tsyringe';
import * as ed from "@noble/ed25519"
import { Env } from './types';

@injectable()
export class Auth {

    async performChecks(request: Request, env: Env): Promise<Response | undefined> {
        if (env.SKIP_SIGNATURE_CHECK === 'true') {
            return;
        }
        const signature = request.headers.get('x-signature-ed25519') ?? "";
        const timestamp = request.headers.get('x-signature-timestamp') ?? "";
        const body = await request.clone().text();
        const isValidRequest = await this.verifySignature(signature, timestamp, body, env.DISCORD_PUBLIC_KEY);
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

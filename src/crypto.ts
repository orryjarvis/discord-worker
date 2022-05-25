import * as ed from "@noble/ed25519"

export const verifySignature = async (
    signature: string,
    timestamp: string,
    body: string,
    clientPublicKey: string
) => {
    const message = new TextEncoder().encode(timestamp + body)
    const isVerified = await ed.verify(signature, message, clientPublicKey)
    return isVerified
}
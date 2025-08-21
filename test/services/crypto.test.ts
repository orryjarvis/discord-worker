import { verifySignature } from "../../src/crypto"
import * as ed from "@noble/ed25519"
import { describe, it, expect, vi } from 'vitest';

describe("verifySignature", () => {
  it("returns true for a valid signature", async () => {
    const privateKey = ed.utils.randomPrivateKey()
    const publicKey = await ed.getPublicKeyAsync(privateKey)
    const timestamp = "1234567890"
    const body = "test-body"
    const message = new TextEncoder().encode(timestamp + body)
    const signature = await ed.signAsync(message, privateKey)
    const signatureHex = Buffer.from(signature).toString("hex")
    const publicKeyHex = Buffer.from(publicKey).toString("hex")
    const result = await verifySignature(signatureHex, timestamp, body, publicKeyHex)
    expect(result).toBe(true)
  })

  it("returns false for an invalid signature", async () => {
    const privateKey = ed.utils.randomPrivateKey()
    const publicKey = await ed.getPublicKeyAsync(privateKey)
    const timestamp = "1234567890"
    const body = "test-body"
    const message = new TextEncoder().encode(timestamp + body)
    const signature = await ed.signAsync(message, privateKey)
    const signatureHex = Buffer.from(signature).toString("hex")
    const publicKeyHex = Buffer.from(publicKey).toString("hex")
    // Tamper with the signature
    const badSignatureHex = signatureHex.replace(/a/g, "b")
    const result = await verifySignature(badSignatureHex, timestamp, body, publicKeyHex)
    expect(result).toBe(false)
  })
})

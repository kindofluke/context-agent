/**
 * HMAC-SHA256 request signing utilities for secure communication
 * with the Deno Sandbox.
 */

/**
 * Sign a request payload using HMAC-SHA256.
 *
 * @param payload - The request body as a string
 * @param secret - The shared secret key
 * @returns Base64-encoded signature
 */
export async function signRequest(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();

  // Import the secret as a cryptographic key
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign the payload
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  // Convert to base64 for transport
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}

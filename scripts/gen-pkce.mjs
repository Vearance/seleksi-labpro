import { createHash, randomBytes } from "node:crypto";

// helper: generate a PKCE code_verifier + code_challenge pair for
// manually exercising the OAuth authorize/token flow via curl.
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");

console.log(`VERIFIER=${verifier}`);
console.log(`CHALLENGE=${challenge}`);

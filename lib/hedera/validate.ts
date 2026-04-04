/**
 * lib/hedera/validate.ts
 *
 * Run this before any Hedera SDK call.
 * Throws a clear, human-readable error listing every missing env var
 * instead of the cryptic "failed to parse entity id" SDK error.
 */

export interface ValidationResult {
  ok:     boolean;
  errors: string[];
}

export function validateHederaEnv(): ValidationResult {
  const errors: string[] = [];

  const REQUIRED: Array<[string, string]> = [
    ["HEDERA_OPERATOR_ID",  "Your Hedera account ID (e.g. 0.0.12345). Get one free at portal.hedera.com"],
    ["HEDERA_OPERATOR_KEY", "Your Hedera private key (302e…). Found in the Hedera portal under 'Keys'"],
    ["HCS_TOPIC_ID",        "HCS topic ID — run: npm run setup"],
    ["HTS_TOKEN_ID",        "HTS token ID — run: npm run setup"],
  ];

  for (const [key, hint] of REQUIRED) {
    const val = process.env[key];
    if (!val || val.trim() === "" || val.includes("XXXXXX") || val === "302e...") {
      errors.push(`${key} is not set. ${hint}`);
    }
  }

  // Validate ID format (must be 0.0.NNNNN)
  const id = process.env.HEDERA_OPERATOR_ID ?? "";
  if (id && !/^0\.0\.\d+$/.test(id.trim())) {
    errors.push(`HEDERA_OPERATOR_ID has wrong format: "${id}". Expected format: 0.0.12345`);
  }

  const topicId = process.env.HCS_TOPIC_ID ?? "";
  if (topicId && !/^0\.0\.\d+$/.test(topicId.trim())) {
    errors.push(`HCS_TOPIC_ID has wrong format: "${topicId}". Run: npm run setup`);
  }

  const tokenId = process.env.HTS_TOKEN_ID ?? "";
  if (tokenId && !/^0\.0\.\d+$/.test(tokenId.trim())) {
    errors.push(`HTS_TOKEN_ID has wrong format: "${tokenId}". Run: npm run setup`);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Throws a clean error with all missing vars listed if validation fails.
 */
export function requireHederaEnv(): void {
  const { ok, errors } = validateHederaEnv();
  if (!ok) {
    throw new Error(
      `Hedera configuration incomplete:\n\n` +
      errors.map(e => `  • ${e}`).join("\n") +
      `\n\nSteps to fix:\n` +
      `  1. Copy .env.local.example → .env.local\n` +
      `  2. Fill in HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY\n` +
      `  3. Run: npm run setup  (creates HCS topic + HTS token)\n` +
      `  4. Restart the dev server`
    );
  }
}

#!/usr/bin/env node
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");

function mask(value) {
  if (!value) return "(empty)";
  if (value.length <= 6) return "*".repeat(value.length);
  return value.slice(0, 4) + "*".repeat(value.length - 8) + value.slice(-4);
}

async function tryEndpoint(label, endpoint) {
  console.log(`\n--- ${label}: ${endpoint} ---`);
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  try {
    const result = await client.send(new ListBucketsCommand({}));
    const names = (result.Buckets || []).map((b) => b.Name);
    if (names.length === 0) {
      console.log("  Connected, but this token can't see ANY buckets here.");
      console.log(
        "  -> The token's bucket scope doesn't include this endpoint/account, or there really are no buckets under it.",
      );
      return { ok: true, names: [] };
    }
    console.log(`  Buckets visible here: ${names.join(", ")}`);
    if (names.includes(process.env.R2_BUCKET)) {
      console.log(
        `  ✓ "${process.env.R2_BUCKET}" IS here — this is the correct endpoint to use.`,
      );
    } else {
      console.log(`  ✗ "${process.env.R2_BUCKET}" is NOT in this list.`);
    }
    return { ok: true, names };
  } catch (err) {
    console.log(`  Failed: ${err.name || err.message}`);
    if (err.$metadata?.httpStatusCode)
      console.log(`  HTTP status: ${err.$metadata.httpStatusCode}`);
    return { ok: false, error: err.name || err.message };
  }
}

async function main() {
  console.log("=== Current .env values (secret masked) ===");
  console.log("R2_ACCOUNT_ID:      ", process.env.R2_ACCOUNT_ID || "(empty)");
  console.log(
    "R2_ENDPOINT:        ",
    process.env.R2_ENDPOINT || "(empty, would fall back to default)",
  );
  console.log("R2_BUCKET:          ", process.env.R2_BUCKET || "(empty)");
  console.log("R2_ACCESS_KEY_ID:   ", mask(process.env.R2_ACCESS_KEY_ID));
  console.log("R2_SECRET_ACCESS_KEY:", mask(process.env.R2_SECRET_ACCESS_KEY));

  if (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY
  ) {
    console.log(
      "\n✗ One or more required values is empty — fill in .env first, this diagnostic can't do much without them.",
    );
    return;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const defaultEndpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const euEndpoint = `https://${accountId}.eu.r2.cloudflarestorage.com`;

  const results = {};
  results.default = await tryEndpoint("Default endpoint", defaultEndpoint);
  results.eu = await tryEndpoint("EU jurisdiction endpoint", euEndpoint);

  console.log("\n=== Verdict ===");
  const bucket = process.env.R2_BUCKET;
  if (results.default.ok && results.default.names?.includes(bucket)) {
    console.log(
      `Use the DEFAULT endpoint. Set in .env: R2_ENDPOINT=${defaultEndpoint}`,
    );
  } else if (results.eu.ok && results.eu.names?.includes(bucket)) {
    console.log(`Use the EU endpoint. Set in .env: R2_ENDPOINT=${euEndpoint}`);
  } else if (!results.default.ok && !results.eu.ok) {
    console.log(
      "Both endpoints failed to even connect — this points at the credentials themselves (wrong Access Key ID/Secret, or the token was revoked/deleted). Re-check the token in the Cloudflare dashboard, or create a fresh one.",
    );
  } else {
    const seenAnywhere = [
      ...(results.default.names || []),
      ...(results.eu.names || []),
    ];
    if (seenAnywhere.length > 0) {
      console.log(
        `Connected fine on at least one endpoint, but "${bucket}" doesn't appear in either bucket list.`,
      );
      console.log(
        `Buckets this token CAN see: ${seenAnywhere.join(", ") || "(none)"}`,
      );
      console.log(
        `Compare that spelling character-by-character against R2_BUCKET in .env, and check this token's bucket scope in the dashboard (Manage R2 API Tokens -> your token -> which buckets it's restricted to).`,
      );
    } else {
      console.log(
        `Connected fine, but this token can't see ANY buckets on either endpoint — almost certainly a token scope issue. In the dashboard, either widen the token's scope to include "${bucket}", or create a fresh token scoped to "All buckets" to confirm.`,
      );
    }
  }
}

main().catch((err) => {
  console.error("Unexpected error running diagnostics:", err);
  process.exit(1);
});

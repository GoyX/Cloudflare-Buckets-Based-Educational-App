#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require("@aws-sdk/client-s3");

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function main() {
  const origins = process.argv.slice(2);
  if (origins.length === 0) {
    fail('Usage: node scripts/set-r2-cors.js "http://localhost:3000"');
  }

  for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
    if (!process.env[key]) fail(`Missing ${key} in .env`);
  }

  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  console.log(`Setting CORS on bucket "${process.env.R2_BUCKET}" for origins:`);
  origins.forEach((o) => console.log(`  - ${o}`));

  await client.send(
    new PutBucketCorsCommand({
      Bucket: process.env.R2_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  console.log("\n✓ CORS policy set. Verifying by reading it back...\n");

  const current = await client.send(new GetBucketCorsCommand({ Bucket: process.env.R2_BUCKET }));
  console.log(JSON.stringify(current.CORSRules, null, 2));
}

main().catch((err) => {
  console.error("\n✗ Failed to set CORS policy:");
  console.error(err);
  if (err.name === "InvalidAccessKeyId" || err.name === "SignatureDoesNotMatch" || err.$metadata?.httpStatusCode === 403) {
    console.error(
      "\nThis looks like an R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY problem in your .env — double check " +
      "the API token was created with Object Read & Write (or Admin) permissions on this bucket, and that " +
      "you copied both values correctly (the secret is only shown once when the token is created).",
    );
  }
  process.exit(1);
});

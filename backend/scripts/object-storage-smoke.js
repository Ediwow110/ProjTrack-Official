#!/usr/bin/env node
require('dotenv').config();

const { randomUUID } = require('node:crypto');
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

async function main() {
  const required = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
  const missing = required.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) {
    throw new Error(`Missing object storage environment variables: ${missing.join(', ')}`);
  }

  const bucket = process.env.S3_BUCKET;
  const key = `.smoke/projtrack-${Date.now()}-${randomUUID()}.txt`;
  const client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || 'false').toLowerCase() === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from('projtrack object storage smoke', 'utf8'),
    ContentType: 'text/plain',
  }));
  await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: 'attachment; filename="projtrack-storage-smoke.txt"',
    }),
    { expiresIn: Math.min(300, Number(process.env.S3_SIGNED_URL_TTL_SECONDS || 300)) },
  );
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Signed download failed with ${response.status}`);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

  console.log(JSON.stringify({
    ok: true,
    bucket,
    keyDeleted: true,
    signedDownloadStatus: response.status,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});


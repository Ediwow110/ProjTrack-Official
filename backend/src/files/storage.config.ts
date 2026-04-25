export function getStorageMode() {
  return String(process.env.OBJECT_STORAGE_MODE || process.env.FILE_STORAGE_MODE || 'local').toLowerCase();
}

export function getS3Config() {
  return {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || '',
    endpoint: process.env.S3_ENDPOINT || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || 'false').toLowerCase() === 'true',
    signedUrlTtlSeconds: Number(process.env.S3_SIGNED_URL_TTL_SECONDS || 300),
  };
}

export function getStorageSummary() {
  const mode = getStorageMode();
  if (mode === 's3') {
    const s3 = getS3Config();
    return {
      mode,
      bucket: s3.bucket,
      region: s3.region,
      endpoint: s3.endpoint,
      signedUrlTtlSeconds: s3.signedUrlTtlSeconds,
    };
  }
  return {
    mode: 'local',
    bucket: '',
    region: '',
    endpoint: '',
    signedUrlTtlSeconds: 0,
  };
}

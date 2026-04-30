import * as assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { BrandingService } from '../src/branding/branding.service';
import { BRAND_NAME, DEFAULT_FAVICON_PATH } from '../src/branding/branding.constants';

const transparentPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0GQAAAAASUVORK5CYII=';
const transparentWebpBase64 =
  'UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAkA4JaQAA3AA/v89WAAAAA==';
const safeSvgBase64 = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="#0f172a" stroke-width="2"/></svg>',
  'utf8',
).toString('base64');

const sandboxRoot = mkdtempSync(join(tmpdir(), 'projtrack-branding-'));
const uploadsDir = join(sandboxRoot, 'uploads');
const dataDir = join(sandboxRoot, 'data');

const service = new BrandingService();
service.configureForTesting({ uploadsDir, dataDir });

function expectBadRequest(label: string, fn: () => unknown) {
  let caught = false;
  try {
    fn();
  } catch (error) {
    caught = true;
    assert(error instanceof BadRequestException, `${label} should reject with BadRequestException.`);
  }
  assert(caught, `${label} should throw.`);
}

try {
  const defaults = service.getPublicBranding();
  assert.equal(defaults.brandName, BRAND_NAME, 'Default branding must expose the ProjTrack brand name.');
  assert.equal(defaults.logoUrl, null, 'Default branding must not fabricate a full logo URL.');
  assert.equal(defaults.iconUrl, null, 'Default branding must not fabricate an icon logo URL.');
  assert.equal(defaults.faviconUrl, DEFAULT_FAVICON_PATH, 'Default branding must fall back to the default favicon.');

  const pngUpload = service.uploadAsset('logo', {
    fileName: '../transparent-logo.png',
    mimeType: 'image/png',
    contentBase64: transparentPngBase64,
  });
  assert.match(pngUpload.logoUrl ?? '', /^\/branding-assets\/logo-/);
  assert(!pngUpload.logoUrl?.includes('..'), 'Branding URLs must not expose traversal segments.');
  const metadataAfterLogo = JSON.parse(readFileSync(join(dataDir, 'branding.json'), 'utf8'));
  assert.equal(metadataAfterLogo.logoUrl, pngUpload.logoUrl, 'Persisted branding metadata must include the active uploaded logo URL.');

  const svgUpload = service.uploadAsset('icon', {
    fileName: 'portal-icon.svg',
    mimeType: 'image/svg+xml',
    contentBase64: safeSvgBase64,
  });
  assert.match(svgUpload.iconUrl ?? '', /^\/branding-assets\/icon-/);

  const webpUpload = service.uploadAsset('logo', {
    fileName: 'transparent-logo.webp',
    mimeType: 'image/webp',
    contentBase64: transparentWebpBase64,
  });
  assert.match(webpUpload.logoUrl ?? '', /^\/branding-assets\/logo-/);

  const faviconUpload = service.uploadAsset('favicon', {
    fileName: 'favicon.png',
    mimeType: 'image/png',
    contentBase64: transparentPngBase64,
  });
  assert.match(faviconUpload.faviconUrl ?? '', /^\/branding-assets\/favicon-/);

  expectBadRequest('oversized branding file', () =>
    service.uploadAsset('logo', {
      fileName: 'too-large.png',
      mimeType: 'image/png',
      contentBase64: Buffer.alloc((2 * 1024 * 1024) + 1, 1).toString('base64'),
    }),
  );

  expectBadRequest('invalid branding file type', () =>
    service.uploadAsset('logo', {
      fileName: 'logo.exe',
      mimeType: 'application/octet-stream',
      contentBase64: Buffer.from('MZ').toString('base64'),
    }),
  );

  expectBadRequest('unsafe svg', () =>
    service.uploadAsset('icon', {
      fileName: 'unsafe.svg',
      mimeType: 'image/svg+xml',
      contentBase64: Buffer.from('<svg><script>alert(1)</script></svg>', 'utf8').toString('base64'),
    }),
  );

  const reset = service.resetBranding();
  assert.equal(reset.logoUrl, null, 'Reset must remove custom full logos.');
  assert.equal(reset.iconUrl, null, 'Reset must remove custom icon logos.');
  assert.equal(reset.faviconUrl, DEFAULT_FAVICON_PATH, 'Reset must restore the default favicon.');
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

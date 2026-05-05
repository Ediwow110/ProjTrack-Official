import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const PDF_HEADER = Buffer.from('%PDF-1.4\n%binary-data\n', 'utf8');
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]);
const OLE_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);

function emptyPrisma(): PrismaService {
  return {} as PrismaService;
}
function emptyAccess(): AccessService {
  return {} as AccessService;
}
function emptyAudit(): AuditLogsService {
  return {} as AuditLogsService;
}

function makeService() {
  return new FilesService(emptyPrisma(), emptyAccess(), emptyAudit());
}

describe('FilesService upload security', () => {
  const ORIGINAL_CWD = process.cwd();
  const ORIGINAL_ENV = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NODE_ENV;
    delete process.env.APP_ENV;
    delete process.env.OBJECT_STORAGE_MODE;
    delete process.env.FILE_STORAGE_MODE;
    delete process.env.FILE_UPLOAD_MAX_MB;
    delete process.env.FILE_UPLOAD_ALLOWED_EXTENSIONS;
    delete process.env.FILE_UPLOAD_ALLOW_ARCHIVES;
    delete process.env.FILE_MALWARE_SCAN_MODE;
    delete process.env.FILE_MALWARE_SCANNER;
    delete process.env.CLAMAV_HOST;
    delete process.env.CLAMAV_PORT;
    delete process.env.ALLOW_BASE64_UPLOADS_IN_PRODUCTION;
    tmpDir = mkdtempSync(join(tmpdir(), 'projtrack-files-spec-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    process.env = { ...ORIGINAL_ENV };
  });

  describe('extension policy', () => {
    it.each([
      ['.exe', 'malware.exe'],
      ['.sh', 'shell.sh'],
      ['.js', 'payload.js'],
      ['.mjs', 'mod.mjs'],
      ['.php', 'shell.php'],
      ['.html', 'phish.html'],
      ['.htm', 'phish.htm'],
      ['.bat', 'run.bat'],
      ['.cmd', 'run.cmd'],
      ['.ps1', 'run.ps1'],
      ['.vbs', 'run.vbs'],
      ['.scr', 'fake.scr'],
      ['.jar', 'app.jar'],
      ['.msi', 'install.msi'],
    ])('rejects executable/script extension %s', async (_ext, fileName) => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName, buffer: Buffer.from('x'), contentType: 'application/octet-stream' }),
      ).rejects.toThrow(/Executable, script, or active content/);
    });

    it('rejects archive uploads when FILE_UPLOAD_ALLOW_ARCHIVES is not "true"', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'bundle.zip', buffer: ZIP_HEADER, contentType: 'application/zip' }),
      ).rejects.toThrow(/Archive uploads are disabled/);
    });

    it('allows archive uploads when FILE_UPLOAD_ALLOW_ARCHIVES=true and content is a valid ZIP', async () => {
      process.env.FILE_UPLOAD_ALLOW_ARCHIVES = 'true';
      process.env.FILE_UPLOAD_ALLOWED_EXTENSIONS = '.zip,.pdf';
      process.env.FILE_MALWARE_SCAN_MODE = 'disabled';
      const svc = makeService();
      const result = await svc.uploadBuffer({
        fileName: 'bundle.zip',
        buffer: ZIP_HEADER,
        contentType: 'application/zip',
      });
      expect(result.fileName).toBe('bundle.zip');
      expect(result.scope).toBe('general');
      expect(existsSync(result.path)).toBe(true);
    });

    it('rejects an extension that is not in the allowlist', async () => {
      process.env.FILE_UPLOAD_ALLOWED_EXTENSIONS = '.pdf,.png';
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'note.txt', buffer: Buffer.from('hello'), contentType: 'text/plain' }),
      ).rejects.toThrow(/Unsupported file type/);
    });

    it('rejects a file with no extension', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'noext', buffer: Buffer.from('x'), contentType: 'application/octet-stream' }),
      ).rejects.toThrow(/Unsupported file type/);
    });
  });

  describe('MIME ↔ extension matching', () => {
    it('rejects a PDF declared as text/plain', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'doc.pdf', buffer: PDF_HEADER, contentType: 'text/plain' }),
      ).rejects.toThrow(/MIME type text\/plain does not match \.pdf/);
    });

    it('rejects a PNG declared as image/jpeg', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'pic.png', buffer: PNG_HEADER, contentType: 'image/jpeg' }),
      ).rejects.toThrow(/does not match \.png/);
    });

    it('accepts an empty contentType (relies on magic-byte check downstream)', async () => {
      process.env.FILE_MALWARE_SCAN_MODE = 'disabled';
      const svc = makeService();
      const result = await svc.uploadBuffer({ fileName: 'doc.pdf', buffer: PDF_HEADER, contentType: '' });
      expect(result.fileName).toBe('doc.pdf');
    });
  });

  describe('content magic-byte enforcement (extension spoofing defence)', () => {
    it('rejects a .pdf whose content does not start with %PDF', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'fake.pdf', buffer: Buffer.from('plain text, not a pdf'), contentType: 'application/pdf' }),
      ).rejects.toThrow(/does not match the \.pdf file type/);
    });

    it('rejects a .png whose content has the wrong signature', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'fake.png', buffer: Buffer.from('not a png at all'), contentType: 'image/png' }),
      ).rejects.toThrow(/does not match the \.png file type/);
    });

    it('rejects a .jpg whose content has the wrong signature', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'fake.jpg', buffer: Buffer.from('not a jpeg'), contentType: 'image/jpeg' }),
      ).rejects.toThrow(/does not match the \.jpg file type/);
    });

    it('rejects a .docx whose content is not a ZIP-based OOXML', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({
          fileName: 'fake.docx',
          buffer: Buffer.from('some plain bytes here, not zip header'),
          contentType: 'application/octet-stream',
        }),
      ).rejects.toThrow(/does not match the \.docx file type/);
    });

    it('rejects a .doc whose content lacks the OLE signature', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({
          fileName: 'fake.doc',
          buffer: Buffer.from('not an ole compound document'),
          contentType: 'application/msword',
        }),
      ).rejects.toThrow(/does not match the \.doc file type/);
    });

    it('accepts a real OLE-compound .doc', async () => {
      process.env.FILE_MALWARE_SCAN_MODE = 'disabled';
      const svc = makeService();
      const result = await svc.uploadBuffer({
        fileName: 'real.doc',
        buffer: OLE_HEADER,
        contentType: 'application/msword',
      });
      expect(result.fileName).toBe('real.doc');
    });

    it('rejects a .txt that contains a NUL byte (binary masquerading as text)', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({
          fileName: 'fake.txt',
          buffer: Buffer.concat([Buffer.from('hello'), Buffer.from([0x00]), Buffer.from('binary')]),
          contentType: 'text/plain',
        }),
      ).rejects.toThrow(/does not match the \.txt file type/);
    });

    it('accepts a clean text .txt', async () => {
      process.env.FILE_MALWARE_SCAN_MODE = 'disabled';
      const svc = makeService();
      const result = await svc.uploadBuffer({
        fileName: 'good.txt',
        buffer: Buffer.from('clean ASCII content\nwith newlines\n'),
        contentType: 'text/plain',
      });
      expect(result.fileName).toBe('good.txt');
    });
  });

  describe('size limits + empty bodies', () => {
    it('rejects an empty buffer', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'empty.pdf', buffer: Buffer.alloc(0), contentType: 'application/pdf' }),
      ).rejects.toThrow(/empty/i);
    });

    it('rejects an oversized upload', async () => {
      process.env.FILE_UPLOAD_MAX_MB = '1';
      const svc = makeService();
      const big = Buffer.alloc(2 * 1024 * 1024, 0x20);
      // Use a magic-byte-valid prefix so it reaches the size check.
      const buf = Buffer.concat([PDF_HEADER, big]);
      await expect(
        svc.uploadBuffer({ fileName: 'huge.pdf', buffer: buf, contentType: 'application/pdf' }),
      ).rejects.toThrow(/exceeds the .* MB limit/);
    });
  });

  describe('scope validation', () => {
    it('rejects scopes containing invalid characters', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({
          fileName: 'doc.pdf',
          buffer: PDF_HEADER,
          contentType: 'application/pdf',
          scope: '../etc',
        }),
      ).rejects.toThrow(/Invalid upload scope/);
    });

    it('rejects scopes with whitespace', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBuffer({
          fileName: 'doc.pdf',
          buffer: PDF_HEADER,
          contentType: 'application/pdf',
          scope: 'has space',
        }),
      ).rejects.toThrow(/Invalid upload scope/);
    });
  });

  describe('filename sanitization (path-traversal defence)', () => {
    it('strips path components from the supplied filename so the storage key cannot escape the scope', async () => {
      process.env.FILE_MALWARE_SCAN_MODE = 'disabled';
      const svc = makeService();
      const result = await svc.uploadBuffer({
        fileName: '../../etc/passwd.pdf',
        buffer: PDF_HEADER,
        contentType: 'application/pdf',
      });
      // basename strips path; remaining must not contain ".." or slashes
      expect(result.fileName).not.toMatch(/\.\./);
      expect(result.fileName).not.toContain('/');
      expect(result.fileName).not.toContain('\\');
      expect(result.relativePath.startsWith('general/')).toBe(true);
      expect(result.relativePath.includes('..')).toBe(false);
    });
  });

  describe('malware scan mode', () => {
    it('fail-closes in production when no scanner is configured', async () => {
      process.env.NODE_ENV = 'production';
      // No FILE_MALWARE_SCAN_MODE set ⇒ defaults to 'fail-closed' in production.
      // No FILE_MALWARE_SCANNER set ⇒ scanForMalware throws ServiceUnavailableException.
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'doc.pdf', buffer: PDF_HEADER, contentType: 'application/pdf' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('fail-closes when explicitly set and scanner is not "clamav"', async () => {
      process.env.FILE_MALWARE_SCAN_MODE = 'fail-closed';
      process.env.FILE_MALWARE_SCANNER = 'unknown-scanner';
      const svc = makeService();
      await expect(
        svc.uploadBuffer({ fileName: 'doc.pdf', buffer: PDF_HEADER, contentType: 'application/pdf' }),
      ).rejects.toThrow(/no malware scanner is configured/);
    });

    it('fail-opens (logs warning, allows upload) when explicitly set even without a scanner', async () => {
      process.env.FILE_MALWARE_SCAN_MODE = 'fail-open';
      const svc = makeService();
      const result = await svc.uploadBuffer({
        fileName: 'doc.pdf',
        buffer: PDF_HEADER,
        contentType: 'application/pdf',
      });
      expect(result.fileName).toBe('doc.pdf');
    });

    it('skips scanning when explicitly disabled', async () => {
      process.env.FILE_MALWARE_SCAN_MODE = 'disabled';
      const svc = makeService();
      const result = await svc.uploadBuffer({
        fileName: 'doc.pdf',
        buffer: PDF_HEADER,
        contentType: 'application/pdf',
      });
      expect(result.fileName).toBe('doc.pdf');
    });
  });

  describe('base64 upload production gate', () => {
    it('blocks base64 JSON uploads in production by default', async () => {
      process.env.NODE_ENV = 'production';
      const svc = makeService();
      await expect(
        svc.uploadBase64({
          fileName: 'doc.pdf',
          contentBase64: PDF_HEADER.toString('base64'),
        }),
      ).rejects.toThrow(/disabled in production/);
    });

    it('allows base64 JSON uploads in production only when ALLOW_BASE64_UPLOADS_IN_PRODUCTION=true', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_BASE64_UPLOADS_IN_PRODUCTION = 'true';
      process.env.FILE_MALWARE_SCAN_MODE = 'disabled';
      const svc = makeService();
      const result = await svc.uploadBase64({
        fileName: 'doc.pdf',
        contentBase64: PDF_HEADER.toString('base64'),
      });
      expect(result.fileName).toBe('doc.pdf');
    });

    it('rejects malformed base64 content', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBase64({ fileName: 'doc.pdf', contentBase64: 'this is not @@@ valid base64!' }),
      ).rejects.toThrow(/valid base64/);
    });

    it('rejects base64 strings containing internal whitespace', async () => {
      const svc = makeService();
      await expect(
        svc.uploadBase64({ fileName: 'doc.pdf', contentBase64: 'JVBE Rg0K' }),
      ).rejects.toThrow(/valid base64/);
    });

    it('strips a data: URL prefix before decoding', async () => {
      process.env.FILE_MALWARE_SCAN_MODE = 'disabled';
      const svc = makeService();
      const dataUrl = `data:application/pdf;base64,${PDF_HEADER.toString('base64')}`;
      const result = await svc.uploadBase64({ fileName: 'doc.pdf', contentBase64: dataUrl });
      expect(result.fileName).toBe('doc.pdf');
    });
  });

  describe('happy path computes a sha256 + relative path', () => {
    it('writes a small valid PDF to local storage and returns metadata', async () => {
      process.env.FILE_MALWARE_SCAN_MODE = 'disabled';
      const svc = makeService();
      const result = await svc.uploadBuffer({
        fileName: 'paper.pdf',
        buffer: PDF_HEADER,
        contentType: 'application/pdf',
        scope: 'submissions',
      });
      expect(result.scope).toBe('submissions');
      expect(result.fileName).toBe('paper.pdf');
      expect(result.storedName.endsWith('.pdf')).toBe(true);
      expect(result.relativePath.startsWith('submissions/')).toBe(true);
      expect(result.sizeBytes).toBe(PDF_HEADER.byteLength);
      expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(existsSync(result.path)).toBe(true);
    });
  });
});

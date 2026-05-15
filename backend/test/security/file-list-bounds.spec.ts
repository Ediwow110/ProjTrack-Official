import { readFileSync } from 'fs';
import { join } from 'path';

describe('file listing static bounds guard', () => {
  const filesServiceSource = readFileSync(
    join(process.cwd(), 'src', 'files', 'files.service.ts'),
    'utf8',
  );
  const filesControllerSource = readFileSync(
    join(process.cwd(), 'src', 'files', 'files.controller.ts'),
    'utf8',
  );

  it('keeps file metadata listing hard bounded', () => {
    expect(filesServiceSource).toContain('DEFAULT_FILE_LIST_TAKE = 100');
    expect(filesServiceSource).toContain('MAX_FILE_LIST_TAKE = 500');
    expect(filesServiceSource).toContain('take,');
    expect(filesServiceSource).toContain('skip,');
    expect(filesServiceSource).toContain('this.prisma.submissionFile.findMany({');
  });

  it('keeps storage object listing hard bounded', () => {
    expect(filesServiceSource).toContain('DEFAULT_STORAGE_OBJECT_LIST_TAKE = 100');
    expect(filesServiceSource).toContain('MAX_STORAGE_OBJECT_LIST_TAKE = 500');
    expect(filesServiceSource).toContain('if (rows.length >= take) return;');
    expect(filesServiceSource).toContain('MaxKeys: Math.min(take - rows.length, 1000)');
    expect(filesServiceSource).toContain('rows.length < take');
  });

  it('does not return merged file listing results without a final response cap', () => {
    expect(filesServiceSource).toContain('.slice(0, take)');
  });

  it('does not paginate through every S3 object when listing files', () => {
    expect(filesServiceSource).not.toContain('} while (continuationToken);');
  });

  it('keeps file list pagination explicit at the controller boundary', () => {
    expect(filesControllerSource).toContain("@Query('take') take: string | undefined");
    expect(filesControllerSource).toContain("@Query('skip') skip: string | undefined");
    expect(filesControllerSource).toContain('parseOptionalPositiveInt(take)');
    expect(filesControllerSource).toContain('parseOptionalPositiveInt(skip)');
    expect(filesControllerSource).toContain('this.files.list(scope, { userId: req.user?.sub, role: req.user?.role }, {');
  });
});

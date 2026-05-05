import { AdminOpsRepository } from './admin-ops.repository';

describe('AdminOpsRepository.ensureAcademicYearLevel', () => {
  it('reuses the same academic year level across repeated sync calls', async () => {
    const records = new Map<
      string,
      { id: string; academicYearId: string; name: string; sortOrder: number | null }
    >();
    let nextId = 1;

    const prisma = {
      academicYearLevel: {
        upsert: jest.fn(async ({ where, create }: any) => {
          const key = `${where.academicYearId_name.academicYearId}:${where.academicYearId_name.name}`;
          const existing = records.get(key);
          if (existing) return existing;

          const created = {
            id: `level-${nextId++}`,
            academicYearId: create.academicYearId,
            name: create.name,
            sortOrder: create.sortOrder ?? null,
          };
          records.set(key, created);
          return created;
        }),
      },
    };

    const repository = new AdminOpsRepository(prisma as any);

    const first = await (repository as any).ensureAcademicYearLevel('ay-1', '1st year', 1);
    const second = await (repository as any).ensureAcademicYearLevel('ay-1', '1st Year', 1);

    expect(first).toEqual(second);
    expect(prisma.academicYearLevel.upsert).toHaveBeenCalledTimes(2);
    expect(records.size).toBe(1);
    expect(records.get('ay-1:1st Year')).toEqual(first);
  });
});

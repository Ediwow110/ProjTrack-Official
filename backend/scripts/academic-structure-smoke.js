require('reflect-metadata');

const path = require('path');
const { config } = require('dotenv');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { PrismaClient } = require('@prisma/client');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const backendDir = path.resolve(__dirname, '..');
  config({ path: path.join(backendDir, '.env') });

  const { AppModule } = require(path.join(backendDir, 'dist', 'app.module'));

  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({ origin: true });
  await app.listen(0);

  const prisma = new PrismaClient();
  const baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  const now = new Date();
  const suffix = `${Date.now()}`.slice(-6);
  const sourceEmail = `academic-smoke.${suffix}@projtrack.local`;
  const importEmail = `academic-import.${suffix}@projtrack.local`;
  const createdUserIds = [];
  const createdSectionIds = [];
  const createdAcademicYearIds = [];
  const createdAcademicYearLevelIds = [];

  const request = async (relativeUrl, init = {}) => {
    const response = await fetch(`${baseUrl}${relativeUrl}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: response.status, body };
  };

  try {
    const candidateIdentifiers = [process.env.SMOKE_ADMIN_IDENTIFIER].filter(Boolean);
    const password = process.env.SMOKE_ADMIN_PASSWORD || '';
    expect(
      candidateIdentifiers.length > 0 && String(password).trim().length > 0,
      'Missing SMOKE_ADMIN_IDENTIFIER or SMOKE_ADMIN_PASSWORD for academic-structure smoke.',
    );
    let login = null;
    for (const identifier of candidateIdentifiers) {
      const attempt = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          password,
          expectedRole: 'ADMIN',
        }),
      });
      if (attempt.status === 200 || attempt.status === 201) {
        login = attempt;
        break;
      }
    }
    expect(login && (login.status === 200 || login.status === 201), `Admin login failed for ${candidateIdentifiers.join(', ')}.`);
    const authHeader = { authorization: `Bearer ${login.body.accessToken}` };

    const academicYearsResponse = await request('/admin/academic-years', {
      method: 'GET',
      headers: authHeader,
    });
    expect(
      academicYearsResponse.status === 200,
      `Academic years lookup failed: ${JSON.stringify(academicYearsResponse.body)}`,
    );

    const academicYears = Array.isArray(academicYearsResponse.body) ? academicYearsResponse.body : [];
    const sourceAcademicYear =
      academicYears.find((year) => year.status === 'Active') ??
      academicYears[0];
    expect(Boolean(sourceAcademicYear?.id), 'An existing academic year is required for the smoke test.');

    const nextStartYear = Math.max(now.getFullYear() + 1, 2035);
    const destinationAcademicYearName = `${nextStartYear}-${nextStartYear + 1}`;
    const createAcademicYear = await request('/admin/academic-years', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: destinationAcademicYearName,
        status: 'Upcoming',
      }),
    });
    expect(
      createAcademicYear.status === 200 || createAcademicYear.status === 201,
      `Create academic year failed: ${JSON.stringify(createAcademicYear.body)}`,
    );
    createdAcademicYearIds.push(createAcademicYear.body.id);

    const createSourceYearLevel = await request(
      `/admin/academic-years/${encodeURIComponent(sourceAcademicYear.id)}/year-levels`,
      {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          name: '1st Year',
        }),
      },
    );
    expect(
      createSourceYearLevel.status === 200 || createSourceYearLevel.status === 201,
      `Create source year level failed: ${JSON.stringify(createSourceYearLevel.body)}`,
    );
    createdAcademicYearLevelIds.push(createSourceYearLevel.body.id);

    const createDestinationYearLevel = await request(
      `/admin/academic-years/${encodeURIComponent(createAcademicYear.body.id)}/year-levels`,
      {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          name: '2nd Year',
        }),
      },
    );
    expect(
      createDestinationYearLevel.status === 200 || createDestinationYearLevel.status === 201,
      `Create destination year level failed: ${JSON.stringify(createDestinationYearLevel.body)}`,
    );
    createdAcademicYearLevelIds.push(createDestinationYearLevel.body.id);

    const sourceSectionCode = `BSIT-1SM-${suffix}`;
    const destinationSectionCode = `BSIT-2SM-${suffix}`;

    const createSourceSection = await request('/admin/sections', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        code: sourceSectionCode,
        program: 'BSIT',
        yearLevelId: createSourceYearLevel.body.id,
        yearLevelName: createSourceYearLevel.body.name,
        yearLevel: createSourceYearLevel.body.name,
        academicYearId: sourceAcademicYear.id,
        academicYear: sourceAcademicYear.name,
      }),
    });
    expect(
      createSourceSection.status === 200 || createSourceSection.status === 201,
      `Create source section failed: ${JSON.stringify(createSourceSection.body)}`,
    );
    createdSectionIds.push(createSourceSection.body.id);

    const createDestinationSection = await request('/admin/sections', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        code: destinationSectionCode,
        program: 'BSIT',
        yearLevelId: createDestinationYearLevel.body.id,
        yearLevelName: createDestinationYearLevel.body.name,
        yearLevel: createDestinationYearLevel.body.name,
        academicYearId: createAcademicYear.body.id,
        academicYear: createAcademicYear.body.name,
      }),
    });
    expect(
      createDestinationSection.status === 200 || createDestinationSection.status === 201,
      `Create destination section failed: ${JSON.stringify(createDestinationSection.body)}`,
    );
    createdSectionIds.push(createDestinationSection.body.id);

    const sourceSectionsResponse = await request(
      `/admin/sections?academicYearId=${encodeURIComponent(sourceAcademicYear.id)}`,
      {
        method: 'GET',
        headers: authHeader,
      },
    );
    expect(
      sourceSectionsResponse.status === 200,
      `Scoped source sections failed: ${JSON.stringify(sourceSectionsResponse.body)}`,
    );
    const sourceSection = Array.isArray(sourceSectionsResponse.body)
      ? sourceSectionsResponse.body.find((section) => section.id === createSourceSection.body.id)
      : null;
    expect(Boolean(sourceSection), 'Source section should appear under its academic year.');
    expect(sourceSection.academicYearId === sourceAcademicYear.id, 'Source section academic year mismatch.');
    expect(sourceSection.program === 'BSIT', `Source section course mismatch: ${sourceSection.program}`);
    expect(String(sourceSection.yearLevel) === '1', `Source section year level mismatch: ${sourceSection.yearLevel}`);
    expect(
      sourceSection.yearLevelId === createSourceYearLevel.body.id,
      `Source section year level id mismatch: ${sourceSection.yearLevelId}`,
    );
    expect(
      sourceSection.yearLevelName === createSourceYearLevel.body.name,
      `Source section year level name mismatch: ${sourceSection.yearLevelName}`,
    );

    const updatedAcademicYearsResponse = await request('/admin/academic-years', {
      method: 'GET',
      headers: authHeader,
    });
    expect(
      updatedAcademicYearsResponse.status === 200,
      `Academic years refresh failed: ${JSON.stringify(updatedAcademicYearsResponse.body)}`,
    );
    const destinationAcademicYear = (updatedAcademicYearsResponse.body || []).find(
      (year) => year.id === createAcademicYear.body.id,
    );
    expect(Boolean(destinationAcademicYear), 'Destination academic year should be returned after creation.');
    expect(destinationAcademicYear.status === 'Upcoming', `Destination academic year status mismatch: ${destinationAcademicYear.status}`);
    expect(destinationAcademicYear.yearLevelCount >= 1, 'Destination academic year should report at least one year level.');
    expect(
      destinationAcademicYear.yearLevels.some(
        (level) =>
          level.id === createDestinationYearLevel.body.id &&
          level.name === '2nd Year' &&
          level.sectionCount >= 1,
      ),
      'Destination academic year should summarize sections by year level.',
    );

    const importTemplate = await request('/admin/students/template', {
      method: 'GET',
      headers: authHeader,
    });
    expect(
      importTemplate.status === 200,
      `Student import template failed: ${JSON.stringify(importTemplate.body)}`,
    );
    expect(
      Array.isArray(importTemplate.body?.columns),
      `Student import template should return columns: ${JSON.stringify(importTemplate.body)}`,
    );
    expect(
      [
        'student_id',
        'first_name',
        'middle_initial',
        'last_name',
        'email',
        'academic_year',
        'course_code',
        'course_name',
        'year_level',
        'section',
      ].every((column) => importTemplate.body.columns.includes(column)),
      `Student import template columns mismatch: ${JSON.stringify(importTemplate.body)}`,
    );

    const createStudent = await request('/admin/students', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        firstName: 'Academic',
        middleInitial: 'M',
        lastName: 'Smoke',
        email: sourceEmail,
        studentNumber: `ACY-${suffix}`,
        course: 'BSIT',
        yearLevelId: createSourceYearLevel.body.id,
        yearLevelName: createSourceYearLevel.body.name,
        yearLevel: createSourceYearLevel.body.name,
        section: createSourceSection.body.id,
        academicYearId: sourceAcademicYear.id,
        academicYear: sourceAcademicYear.name,
      }),
    });
    expect(
      createStudent.status === 200 || createStudent.status === 201,
      `Create student failed: ${JSON.stringify(createStudent.body)}`,
    );

    const createdStudent = await prisma.user.findUnique({
      where: { email: sourceEmail },
      include: { studentProfile: true },
    });
    expect(Boolean(createdStudent?.id), 'Created academic-structure student was not found.');
    createdUserIds.push(createdStudent.id);
    expect(createdStudent.status === 'PENDING_ACTIVATION', `Created student status mismatch: ${createdStudent.status}`);
    expect(
      createdStudent.studentProfile?.sectionId === createSourceSection.body.id,
      `Created student section mismatch: ${createdStudent.studentProfile?.sectionId}`,
    );
    expect(
      createdStudent.studentProfile?.academicYearId === sourceAcademicYear.id,
      `Created student academic year mismatch: ${createdStudent.studentProfile?.academicYearId}`,
    );
    expect(createdStudent.studentProfile?.course === 'BSIT', `Created student course mismatch: ${createdStudent.studentProfile?.course}`);
    expect(String(createdStudent.studentProfile?.yearLevel) === '1', `Created student year level mismatch: ${createdStudent.studentProfile?.yearLevel}`);
    expect(
      createdStudent.studentProfile?.academicYearLevelId === createSourceYearLevel.body.id,
      `Created student year level id mismatch: ${createdStudent.studentProfile?.academicYearLevelId}`,
    );
    expect(
      createdStudent.studentProfile?.yearLevelName === createSourceYearLevel.body.name,
      `Created student year level name mismatch: ${createdStudent.studentProfile?.yearLevelName}`,
    );
    expect(
      createdStudent.studentProfile?.middleInitial === 'M',
      `Created student middle initial mismatch: ${createdStudent.studentProfile?.middleInitial}`,
    );

    const bulkMoveData = await request('/admin/bulk-move', {
      method: 'GET',
      headers: authHeader,
    });
    expect(bulkMoveData.status === 200, `Bulk move data failed: ${JSON.stringify(bulkMoveData.body)}`);
    expect(Array.isArray(bulkMoveData.body?.academicYears), 'Bulk move should return academicYears.');
    expect(Array.isArray(bulkMoveData.body?.sections), 'Bulk move should return sections.');
    expect(
      bulkMoveData.body.academicYears.some((year) => year.id === createAcademicYear.body.id),
      'Bulk move academicYears should include the destination academic year.',
    );
    expect(
      bulkMoveData.body.sections.some(
        (section) =>
          section.id === createDestinationSection.body.id &&
          section.yearLevelId === createDestinationYearLevel.body.id,
      ),
      'Bulk move sections should include the destination section and year level details.',
    );

    const moveStudents = await request('/admin/bulk-move', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        sourceSectionId: createSourceSection.body.id,
        destSectionId: createDestinationSection.body.id,
        ids: [createdStudent.id],
      }),
    });
    expect(
      moveStudents.status === 200 || moveStudents.status === 201,
      `Bulk move request failed: ${JSON.stringify(moveStudents.body)}`,
    );

    const movedStudent = await prisma.user.findUnique({
      where: { id: createdStudent.id },
      include: { studentProfile: true },
    });
    expect(
      movedStudent?.studentProfile?.sectionId === createDestinationSection.body.id,
      `Moved student section mismatch: ${movedStudent?.studentProfile?.sectionId}`,
    );
    expect(
      movedStudent?.studentProfile?.academicYearId === createAcademicYear.body.id,
      `Moved student academic year mismatch: ${movedStudent?.studentProfile?.academicYearId}`,
    );
    expect(movedStudent?.studentProfile?.course === 'BSIT', `Moved student course mismatch: ${movedStudent?.studentProfile?.course}`);
    expect(String(movedStudent?.studentProfile?.yearLevel) === '2', `Moved student year level mismatch: ${movedStudent?.studentProfile?.yearLevel}`);
    expect(
      movedStudent?.studentProfile?.academicYearLevelId === createDestinationYearLevel.body.id,
      `Moved student year level id mismatch: ${movedStudent?.studentProfile?.academicYearLevelId}`,
    );
    expect(
      movedStudent?.studentProfile?.yearLevelName === createDestinationYearLevel.body.name,
      `Moved student year level name mismatch: ${movedStudent?.studentProfile?.yearLevelName}`,
    );

    const previewImport = await request('/admin/students/import', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        fileName: 'academic-structure.csv',
        fileType: 'csv',
        csvText: [
          'student_id,first_name,middle_initial,last_name,email,academic_year,course_code,course_name,year_level,section',
          `ACY-IMP-${suffix},Import,M,Structure,${importEmail},${createAcademicYear.body.name},BSIT,Bachelor of Science in Information Technology,2nd Year,${destinationSectionCode}`,
          `ACY-CRS-${suffix},Invalid,,Course,invalid-course.${suffix}@projtrack.local,${createAcademicYear.body.name},BSBA,Bachelor of Science in Business Administration,2nd Year,${destinationSectionCode}`,
          `ACY-YRL-${suffix},Invalid,,Year,invalid-year.${suffix}@projtrack.local,${createAcademicYear.body.name},BSIT,Bachelor of Science in Information Technology,3rd Year,${destinationSectionCode}`,
          `ACY-SEC-${suffix},Invalid,,Section,invalid-section.${suffix}@projtrack.local,${createAcademicYear.body.name},BSIT,Bachelor of Science in Information Technology,2nd Year,NOT-A-REAL-SECTION`,
          `ACY-${suffix},Duplicate,,StudentId,duplicate-id.${suffix}@projtrack.local,${createAcademicYear.body.name},BSIT,Bachelor of Science in Information Technology,2nd Year,${destinationSectionCode}`,
          `ACY-EML-${suffix},Duplicate,,Email,${sourceEmail},${createAcademicYear.body.name},BSIT,Bachelor of Science in Information Technology,2nd Year,${destinationSectionCode}`,
        ].join('\n'),
      }),
    });
    expect(
      previewImport.status === 200 || previewImport.status === 201,
      `Academic-structure import preview failed: ${JSON.stringify(previewImport.body)}`,
    );
    expect(previewImport.body?.validRows === 1, `Import preview validRows mismatch: ${JSON.stringify(previewImport.body)}`);
    expect(previewImport.body?.invalidRows === 5, `Import preview invalidRows mismatch: ${JSON.stringify(previewImport.body)}`);
    const invalidCourseRow = (previewImport.body?.preview || []).find((row) => row.row?.student_id === `ACY-CRS-${suffix}`);
    expect(
      invalidCourseRow?.issues?.some((issue) => issue.includes('Course BSBA does not exist in Academic Year')),
      `Invalid course row should explain the missing course: ${JSON.stringify(invalidCourseRow)}`,
    );
    const invalidYearRow = (previewImport.body?.preview || []).find((row) => row.row?.student_id === `ACY-YRL-${suffix}`);
    expect(
      invalidYearRow?.issues?.some((issue) => issue.includes('3rd Year is not configured for BSIT')),
      `Invalid year row should explain the course/year mismatch: ${JSON.stringify(invalidYearRow)}`,
    );
    const invalidSectionRow = (previewImport.body?.preview || []).find((row) => row.row?.student_id === `ACY-SEC-${suffix}`);
    expect(
      invalidSectionRow?.issues?.some((issue) => issue.includes('does not belong to BSIT / 2nd Year /')),
      `Invalid section row should explain the scoped section mismatch: ${JSON.stringify(invalidSectionRow)}`,
    );
    const duplicateIdRow = (previewImport.body?.preview || []).find((row) => row.row?.student_id === `ACY-${suffix}`);
    expect(
      duplicateIdRow?.issues?.includes('Duplicate student_id'),
      `Duplicate student ID row should be rejected: ${JSON.stringify(duplicateIdRow)}`,
    );
    const duplicateEmailRow = (previewImport.body?.preview || []).find((row) => row.row?.student_id === `ACY-EML-${suffix}`);
    expect(
      duplicateEmailRow?.issues?.includes('Duplicate email'),
      `Duplicate email row should be rejected: ${JSON.stringify(duplicateEmailRow)}`,
    );

    const confirmImport = await request('/admin/students/import/confirm', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        batchId: previewImport.body.batchId,
        acceptedRowIndexes: (previewImport.body.preview || [])
          .filter((row) => row.valid)
          .map((row) => row.index),
      }),
    });
    expect(
      confirmImport.status === 200 || confirmImport.status === 201,
      `Academic-structure import confirm failed: ${JSON.stringify(confirmImport.body)}`,
    );
    expect(confirmImport.body?.summary?.created === 1, `Import summary created mismatch: ${JSON.stringify(confirmImport.body)}`);
    expect(confirmImport.body?.summary?.invalidRows === 5, `Import summary invalid rows mismatch: ${JSON.stringify(confirmImport.body)}`);
    expect(confirmImport.body?.summary?.pendingActivation === 1, `Import summary pending activation mismatch: ${JSON.stringify(confirmImport.body)}`);

    const importedStudent = await prisma.user.findUnique({
      where: { email: importEmail },
      include: { studentProfile: true },
    });
    expect(Boolean(importedStudent?.id), 'Imported academic-structure student was not found.');
    createdUserIds.push(importedStudent.id);
    expect(importedStudent.status === 'PENDING_ACTIVATION', `Imported student status mismatch: ${importedStudent.status}`);
    expect(
      importedStudent.studentProfile?.academicYearId === createAcademicYear.body.id,
      `Imported student academic year mismatch: ${importedStudent.studentProfile?.academicYearId}`,
    );
    expect(
      importedStudent.studentProfile?.sectionId === createDestinationSection.body.id,
      `Imported student section mismatch: ${importedStudent.studentProfile?.sectionId}`,
    );
    expect(importedStudent.studentProfile?.course === 'BSIT', `Imported student course mismatch: ${importedStudent.studentProfile?.course}`);
    expect(String(importedStudent.studentProfile?.yearLevel) === '2', `Imported student year level mismatch: ${importedStudent.studentProfile?.yearLevel}`);
    expect(
      importedStudent.studentProfile?.middleInitial === 'M',
      `Imported student middle initial mismatch: ${importedStudent.studentProfile?.middleInitial}`,
    );

    const masterList = await request(`/admin/sections/${encodeURIComponent(createDestinationSection.body.id)}/master-list`, {
      method: 'GET',
      headers: authHeader,
    });
    expect(
      masterList.status === 200,
      `Section master list failed: ${JSON.stringify(masterList.body)}`,
    );
    const importedMasterListRow = (masterList.body?.rows || []).find(
      (student) => student.studentId === `ACY-IMP-${suffix}`,
    );
    expect(
      Boolean(importedMasterListRow),
      `Imported student should appear in section master list: ${JSON.stringify(masterList.body)}`,
    );
    expect(
      importedMasterListRow?.accountStatus === 'Pending Activation',
      `Imported student master list status mismatch: ${JSON.stringify(importedMasterListRow)}`,
    );

    const importEmailJobs = await prisma.emailJob.count({
      where: { userEmail: importEmail },
    });
    expect(importEmailJobs === 0, `Imported academic-structure student should not auto-send email, found ${importEmailJobs}.`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          verified: {
            academicYearCreation: true,
            yearLevelCreation: true,
            scopedSectionCreation: true,
            academicYearGrouping: true,
            manualStudentPlacement: true,
            middleInitialSupport: true,
            bulkMoveAcrossAcademicYears: true,
            importTemplateHierarchy: true,
            importScopedValidation: true,
            importPendingActivation: true,
            importMasterListVisibility: true,
            importNoAutoEmail: true,
          },
          sourceAcademicYear: sourceAcademicYear.name,
          destinationAcademicYear: createAcademicYear.body.name,
          sections: {
            source: sourceSectionCode,
            destination: destinationSectionCode,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    try {
      await prisma.emailJob.deleteMany({
        where: {
          userEmail: { in: [sourceEmail, importEmail] },
        },
      });
      for (const userId of createdUserIds) {
        await prisma.notification.deleteMany({ where: { userId } });
        await prisma.auditLog.deleteMany({ where: { actorUserId: userId } });
        await prisma.authSession.deleteMany({ where: { userId } });
        await prisma.accountActionToken.deleteMany({ where: { userId } });
        await prisma.studentProfile.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
      }
      if (createdSectionIds.length) {
        await prisma.section.deleteMany({
          where: { id: { in: createdSectionIds } },
        });
      }
      if (createdAcademicYearLevelIds.length) {
        await prisma.academicYearLevel.deleteMany({
          where: { id: { in: createdAcademicYearLevelIds } },
        });
      }
      if (createdAcademicYearIds.length) {
        await prisma.academicYear.deleteMany({
          where: { id: { in: createdAcademicYearIds } },
        });
      }
    } finally {
      await prisma.$disconnect();
      await app.close();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

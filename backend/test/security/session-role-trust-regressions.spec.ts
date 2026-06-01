import 'reflect-metadata';
import { ROLES_KEY } from '../../src/auth/guards/roles.decorator';
import { AdminController } from '../../src/admin/admin.controller';
import { SubmissionsController } from '../../src/submissions/submissions.controller';

/**
 * Regression coverage for silent auth/session and role-access risks
 * (BUG-AUTH-001, BUG-AUTH-002, BUG-ACCESS-001 from silent-bug audit).
 *
 * These tests reinforce that the backend is the source of truth for role authorization.
 * They complement (and do not duplicate) the existing authorization-abuse and session-abuse specs.
 */

function classRoles(controller: Function): string[] | undefined {
  return Reflect.getMetadata(ROLES_KEY, controller);
}

function methodRoles(controller: Function, methodName: string): string[] | undefined {
  return Reflect.getMetadata(ROLES_KEY, controller.prototype[methodName]);
}

describe('silent auth/session and role-access regressions', () => {
  describe('role decorator boundaries remain strict', () => {
    it('keeps the admin controller strictly admin-only', () => {
      expect(classRoles(AdminController)).toEqual(['ADMIN']);
    });

    it('keeps teacher submission review actions teacher-only', () => {
      expect(methodRoles(SubmissionsController, 'review')).toEqual(['TEACHER']);
    });

    it('keeps student submission actions student-only', () => {
      expect(methodRoles(SubmissionsController, 'submit')).toEqual(['STUDENT']);
      expect(methodRoles(SubmissionsController, 'studentDetail')).toEqual(['STUDENT']);
    });
  });

});

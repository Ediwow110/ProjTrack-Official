import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || '5m';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.95'],
  },
};

function required(name) {
  const value = __ENV[name];
  if (!value) throw new Error(`${name} is required for this synthetic load test.`);
  return value;
}

function headers(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function getOk(name, path, token) {
  const response = http.get(`${BASE_URL}${path}`, headers(token));
  check(response, { [`${name} ok`]: (res) => res.status >= 200 && res.status < 300 });
}

export function setup() {
  return {
    student: required('LOAD_STUDENT_TOKEN'),
    teacher: required('LOAD_TEACHER_TOKEN'),
    admin: required('LOAD_ADMIN_TOKEN'),
  };
}

export default function (data) {
  const bucket = __VU % 20;

  if (bucket < 14) {
    group('student read flow', () => {
      getOk('student dashboard summary', '/student/dashboard/summary', data.student);
      getOk('student dashboard charts', '/student/dashboard/charts', data.student);
      getOk('student submissions list', '/student/submissions', data.student);
      getOk('student subjects', '/student/subjects', data.student);
      getOk('student submit catalog', '/student/submit-catalog', data.student);
      getOk('student calendar events', '/student/calendar/events', data.student);
      sleep(1);
    });
    return;
  }

  if (bucket < 19) {
    group('teacher read flow', () => {
      getOk('teacher dashboard summary', '/teacher/dashboard/summary', data.teacher);
      getOk('teacher submissions list', '/teacher/submissions', data.teacher);
      getOk('teacher subjects', '/teacher/subjects', data.teacher);
      getOk('teacher students list', '/teacher/students?take=100&skip=0', data.teacher);
      getOk('teacher sections list', '/teacher/sections?take=100&skip=0', data.teacher);
      sleep(1);
    });
    return;
  }

  group('admin read flow', () => {
    getOk('admin dashboard summary', '/admin/dashboard/summary', data.admin);
    getOk('admin users list', '/admin/users', data.admin);
    getOk('admin settings', '/admin/settings', data.admin);
    sleep(1);
  });
}

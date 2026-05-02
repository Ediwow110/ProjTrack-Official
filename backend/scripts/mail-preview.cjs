'use strict';
/**
 * mail:preview — renders all email templates to local HTML/text files for
 * visual inspection. Does not send any email and does not require real
 * Mailrelay credentials.
 *
 * Usage:
 *   npm --prefix backend run mail:preview
 *
 * Output: backend/preview/mail/<template-key>-<variant>.html and .txt
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const outDir = path.join(__dirname, '..', 'preview', 'mail');
fs.mkdirSync(outDir, { recursive: true });

const tsCode = `
import { renderMailTemplate } from './src/mail/mail.templates';

const oneHour = new Date(Date.now() + 3_600_000).toISOString();
const baseUrl = 'http://localhost:5173';

const templates = [
  {
    key: 'password-reset',
    variant: 'reset',
    payload: {
      firstName: 'Alice',
      resetLink: \`\${baseUrl}/auth/reset-password?token=preview-token&ref=preview-ref\`,
      expiresAt: oneHour,
      isFirstTimeSetup: false,
    },
  },
  {
    key: 'password-reset',
    variant: 'setup',
    payload: {
      firstName: 'Bob',
      resetLink: \`\${baseUrl}/auth/reset-password?token=preview-token&ref=preview-ref\`,
      expiresAt: oneHour,
      isFirstTimeSetup: true,
    },
  },
  {
    key: 'account-activation',
    variant: 'default',
    payload: {
      firstName: 'Charlie',
      activationUrl: \`\${baseUrl}/auth/activate?token=preview-token&ref=preview-ref\`,
    },
  },
  {
    key: 'email-verification',
    variant: 'default',
    payload: {
      firstName: 'Dana',
      verificationLink: \`\${baseUrl}/auth/activate?token=preview-token&ref=preview-ref\`,
    },
  },
  {
    key: 'teacher-activity-notice',
    variant: 'default',
    payload: {
      firstName: 'Eve',
      activityTitle: 'Project Submission Reminder',
      title: 'Project Submission Reminder',
      body: 'Your teacher has posted a new activity update. Please check the activity page for details.',
      subjectName: 'BSCS 3A — Software Engineering',
      teacherName: 'Prof. Smith',
      activityLink: \`\${baseUrl}/student/subjects/preview-subject?tab=activities\`,
    },
  },
  {
    key: 'bulk-invitation',
    variant: 'default',
    payload: {
      firstName: 'Frank',
      inviteLink: \`\${baseUrl}/auth/activate?token=preview-token&ref=preview-ref\`,
      role: 'student',
      title: 'You have been invited to ProjTrack',
      body: 'You have been invited to join ProjTrack as a student. Click the button below to activate your account.',
    },
  },
  {
    key: 'broadcast',
    variant: 'default',
    payload: {
      firstName: 'Grace',
      title: 'Scheduled Maintenance Tonight',
      body: 'ProjTrack will undergo scheduled maintenance from 2:00 AM to 4:00 AM (Asia/Manila). The system will be briefly unavailable during this window.',
    },
  },
];

const outDir = process.argv[2] || './preview/mail';
const fs = require('fs');

for (const tmpl of templates) {
  try {
    const rendered = renderMailTemplate(tmpl.key, tmpl.payload);
    const slug = \`\${tmpl.key}-\${tmpl.variant}\`;
    fs.writeFileSync(\`\${outDir}/\${slug}.html\`, rendered.html, 'utf8');
    fs.writeFileSync(\`\${outDir}/\${slug}.txt\`, \`Subject: \${rendered.subject}\\n\\n\${rendered.text}\`, 'utf8');
    console.log(\`  ✓ \${slug}.html  — \${rendered.subject}\`);
  } catch (err) {
    console.error(\`  ✗ \${tmpl.key}-\${tmpl.variant}: \${err.message}\`);
    process.exitCode = 1;
  }
}

console.log('\\nOutput: ' + outDir);
`;

const tmpFile = path.join(__dirname, '_mail_preview_runner.ts');

try {
  fs.writeFileSync(tmpFile, tsCode, 'utf8');

  const backendDir = path.join(__dirname, '..');

  console.log('\nProjTrack — Mail Template Preview\n');
  console.log('Rendering templates (no email is sent) ...\n');

  execSync(
    `node -r ts-node/register "${tmpFile}" "${outDir}"`,
    { cwd: backendDir, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development', APP_ENV: 'development' } },
  );

  console.log('\nOpen the .html files in your browser to inspect the email design.');
  console.log('These files are gitignored and safe to regenerate at any time.\n');
} finally {
  try { fs.unlinkSync(tmpFile); } catch {}
}

Act as a senior UX designer and product designer creating a premium high-fidelity desktop web application for a school-based Project Submission Management System.

Do not generate a generic dashboard. Design this like a real production-ready academic platform with strong UX thinking, clear information hierarchy, polished visual consistency, and role-specific experiences.

PROJECT CONTEXT
This is a school-managed platform for project and activity submissions.
There are 3 user roles:
1. Student
2. Teacher
3. Superadmin

Core business rules:
- Students do NOT self-register.
- Student accounts are created, activated, assigned, and managed only by the Superadmin.
- This is a school workflow platform for managing submissions by subject, section, teacher, and student.
- The product must feel academic, institutional, trustworthy, and practical.
- Do NOT make it feel like e-commerce, fintech, social media, or a startup landing page.

PRIMARY DESIGN GOAL
Create a polished, modern, desktop-first academic SaaS experience that feels credible enough for a real college or university.
The final result must feel intentional, premium, structured, and highly usable.
Every screen must have clear hierarchy, realistic UI patterns, and role-appropriate complexity.

OVERALL EXPERIENCE PRINCIPLES
- Design for clarity first
- Prioritize the most important action on every page
- Avoid clutter and overdecorating
- Use strong visual hierarchy
- Make tables, filters, forms, and review flows feel polished
- Show urgency clearly for deadlines, pending reviews, and restricted states
- Make each role feel distinct:
  - Student = simple, guided, calm
  - Teacher = efficient, review-centered, operational
  - Superadmin = powerful, structured, system-level

VISUAL STYLE
- Modern academic SaaS dashboard
- Light theme only
- Desktop-first layouts
- Clean, professional, minimalist
- Primary color: deep blue
- Secondary accent: teal
- Support colors: white, cool gray, slate, soft success/warning/error tones
- Rounded corners
- Soft shadows
- Clean cards and data tables
- Spacious layout with strong section separation
- Accessible contrast and readable typography
- Premium but restrained visual style

DESIGN SYSTEM TO CREATE FIRST
Create a complete reusable design system page including:
- color palette
- typography scale
- spacing system based on 8px rhythm
- layout grid
- buttons: primary, secondary, ghost, danger
- form inputs: text, password, textarea, select, search, date picker, upload field
- tables
- cards
- tabs
- dropdowns
- status chips
- alerts and toasts
- confirmation modals
- side drawers
- empty states
- loading/skeleton states
- pagination
- breadcrumbs
- topbar
- sidebar
- dashboard KPI cards
- chart cards
- notification item patterns

STATUS CHIP SYSTEM
Use these statuses consistently:
- Pending
- Submitted
- Late
- Reviewed
- Graded
- Draft
- Returned for Revision
- Active
- Inactive
- Restricted

GLOBAL PRODUCT RULES
- Public pages use centered branded layouts
- Logged-in pages use a left sidebar + topbar + content layout
- Add breadcrumbs on deeper pages
- Add empty, loading, success, error, overdue, and restricted states where relevant
- Use realistic academic sample content
- Use realistic tables, filters, and forms
- Use modals for destructive or high-risk actions
- Keep navigation consistent inside each portal
- Use side panels or drawers for secondary details when appropriate
- Build every frame with auto-layout-friendly structure

REALISTIC SAMPLE CONTENT
Use realistic examples such as:
- Subjects: Capstone Project, Information Management, Web Systems, Database Systems
- Sections: BSIT 3A, BSIT 3B, BSCS 4A
- Submission titles: Final Project Proposal, Chapter 1 Documentation, System Prototype, Final Manuscript
- Teacher names and student names that feel realistic
- School year labels and due dates
- Grades, feedback, account statuses, and timeline history

UX DIRECTION BY ROLE

STUDENT EXPERIENCE GOAL
The student side should feel guided, calm, deadline-aware, and easy to understand.
Students should immediately know:
- what is due
- what is pending
- what has feedback
- what is graded
- where they need to act next

TEACHER EXPERIENCE GOAL
The teacher side should feel operational, efficient, and review-focused.
Teachers should immediately know:
- what needs review now
- which submissions are late
- what is awaiting grading
- which subjects or sections need attention

SUPERADMIN EXPERIENCE GOAL
The superadmin side should feel like a control center.
Admins should immediately know:
- account and system health
- pending requests
- academic setup status
- reporting insights
- operational risks and actions

INFORMATION ARCHITECTURE

STUDENT PORTAL
Sidebar navigation:
- Dashboard
- Subjects
- My Submissions
- Notifications
- Profile

Create these Student pages:

1. Student Landing Page
Purpose:
Introduce the system and direct students to log in.
Layout:
- left or center hero content
- right-side illustration or school-themed visual
Sections:
- school/system logo
- headline
- short supporting text
- primary Login button
- simple footer
Rules:
- no registration CTA
- no marketing-heavy content

2. Student Login Page
Purpose:
Fast and clear access.
Layout:
- centered auth card
Include:
- student ID or school email
- password
- remember me
- forgot password link
- sign in button
- support/help text
Rules:
- no register option

3. Forgot Password Page
Purpose:
Simple recovery.
Include:
- input for school email or student ID
- helper text
- send reset button
- success confirmation state

4. Reset Password Page
Include:
- new password
- confirm password
- helper text for password requirements
- reset button
- success state

5. Student Dashboard
Purpose:
Show what matters today.
Recommended layout:
- top header with greeting + quick action
- row of KPI cards
- two-column main content
Left column:
- upcoming deadlines / urgent activities
- recent submissions
Right column:
- notifications
- quick actions
KPI cards:
- active subjects
- pending submissions
- reviewed submissions
- graded submissions
Rules:
- overdue items must be visually obvious
- keep this page clean and not overloaded

6. Student Profile Page
Purpose:
Manage account details.
Layout:
- profile summary card on one side
- editable form on the other
Include:
- avatar
- full name
- student ID
- email
- section
- course/program
- password change area
- save changes button

7. Subjects List Page
Purpose:
Browse assigned subjects.
Layout:
- title and filters at top
- subject cards or clean table below
Include:
- subject code
- subject name
- teacher
- section
- term
- number of activities
- search and filters
Primary action:
- open subject details

8. Subject Details Page
Purpose:
Make requirements easy to understand.
Layout:
- subject hero/header
- tabbed content beneath
Tabs:
- Overview
- Activities
- Submission Rules
Include:
- subject code and title
- teacher
- section
- activities list
- due dates
- activity type
- submission type: individual or group
- file type rules
- submission instructions
Rules:
- requirements should be easy to scan
- due dates should be prominent

9. Submit Project Page
Purpose:
Make submission easy and confidence-building.
Layout:
- main form on left
- help/rules panel on right
Include:
- project title
- description
- subject
- activity
- submission type
- file upload
- external link
- member selection
- notes/comments
- submit button
- save draft button
Rules:
- show validation clearly
- show allowed file types and deadline near the form

10. Edit Submission Page
Purpose:
Allow safe editing before cutoff or according to status.
Include:
- prefilled form
- replace file
- edit team members
- current status
- deadline reminder
- update submission button

11. My Submissions Page
Purpose:
Track all submission records clearly.
Layout:
- filters and search at top
- table below
Columns:
- title
- subject
- type
- due date
- submitted date
- status
- grade
- actions
Include:
- teacher feedback preview via modal, drawer, or expandable row

12. Member Search Page
Purpose:
Support clean team creation.
Layout:
- searchable list on left
- selected members panel on right
Include:
- search by student ID, name, section
- add member action
- selected member chips/cards
- max team size validation
- confirm selection button

13. Notifications Page
Purpose:
Centralized student alerts.
Include:
- grouped by date
- unread/read styling
- notification filters
- mark all as read
Types:
- deadline reminder
- teacher feedback
- grade posted
- account update

TEACHER PORTAL
Sidebar navigation:
- Dashboard
- Subjects
- Students
- Submissions
- Notifications
- Profile

Create these Teacher pages:

1. Teacher Landing Page
Purpose:
Simple entry page for teachers.
Include:
- branding
- short description
- login CTA
Rules:
- clean and practical

2. Teacher Login Page
Include:
- teacher email or ID
- password
- remember me
- forgot password
- sign in button

3. Teacher Forgot Password Page
4. Teacher Reset Password Page

5. Teacher Dashboard
Purpose:
Support review triage and workflow overview.
Recommended layout:
- top KPI row
- middle section for review-needed items
- lower section for trends and notifications
KPI cards:
- handled subjects
- total students
- pending reviews
- graded submissions
Main content:
- recent submissions needing review
- submissions by status chart
- upcoming deadlines
- quick links
- recent notifications
Rules:
- highlight pending and late items strongly

6. Teacher Profile Page
Include:
- avatar
- full name
- employee ID
- email
- department
- editable contact details
- password change section

7. Teacher Subjects List Page
Include:
- subject cards or table
- code
- title
- section
- class size
- active activities
- search and filters

8. Subject View Page
Purpose:
Operational overview of one subject.
Layout:
- subject header
- tabs underneath
Tabs:
- Overview
- Activities
- Students
- Submission Progress
Include:
- activity list
- student roster summary
- progress cards
- submission counts
- CTA to view submissions

9. Students List Page
Purpose:
Track students in teacher scope.
Include:
- searchable table
- student ID
- name
- section
- subject count
- status
- email
- section and subject filters

10. Submissions List Page
Purpose:
Fast prioritization and filtering for review.
Layout:
- strong filter/action bar
- review-focused table
Columns:
- submission title
- student/team
- subject
- activity
- due date
- submitted date
- status
- grade
Include:
- late and pending items visually prioritized
- row actions for review
- bulk action patterns if appropriate

11. Submission Review Page
Purpose:
Support efficient but thoughtful grading.
Layout:
- split screen
Left side:
- submission details
- student/team information
- files/links
- description
- timeline/history
Right side:
- grading tools
- rubric or criteria
- feedback
- grade field
- action buttons
Actions:
- mark reviewed
- mark graded
- return for revision
Rules:
- keep status and deadline visible at top
- make the review action area sticky if useful

12. Print Submission View
Purpose:
Formal print-ready academic record.
Include:
- school header
- subject info
- submission title
- student/team details
- project details
- teacher feedback
- grade summary
- approval/signature area if appropriate

13. Teacher Notifications Page
Include:
- categories like new submission, grading reminder, deadline, system update
- unread/read states
- mark as read action

SUPERADMIN PORTAL
Sidebar navigation:
- Dashboard
- Students
- Teachers
- Subjects
- Sections
- Submissions
- Reports
- Academic Settings
- Requests
- Notifications
- Audit Logs
- Settings
- System Tools

Create these Superadmin pages:

1. Superadmin Landing Page
Purpose:
Professional secure admin entry point.
Include:
- school branding
- brief portal text
- secure login CTA

2. Superadmin Login Page
Include:
- username or email
- password
- secure sign-in presentation

3. Superadmin Dashboard
Purpose:
Show control, oversight, and health of the system.
Recommended layout:
- top KPI row
- middle actionable operations row
- lower analytics and activity row
KPI cards:
- total students
- total teachers
- total subjects
- total sections
- active submissions
- pending requests
Main content:
- recent activity feed
- quick actions
- system status panel
- academic year card
- charts for submission trends, subject distribution, status distribution

4. Students Management Page
Purpose:
This is where student accounts are created and managed.
Layout:
- page header with primary Add Student button
- secondary actions like Import Students
- filters/search/sort
- large management table
Columns:
- student ID
- full name
- email
- section
- status
- created by
- last active
Actions:
- view
- edit
- activate/deactivate
- reset password
- assign section
- bulk actions
Rules:
- make account creation visibly important

5. Student View Page
Purpose:
View and manage one student record.
Layout:
- profile summary + admin actions
- supporting tabs or sections
Include:
- account details
- assigned section
- assigned subjects
- recent submissions
- account status
- admin actions panel

6. Teachers Management Page
Include:
- add teacher button
- teacher table
- filters
- search
- row actions for manage/edit/status/password reset

7. Teacher View Page
Include:
- teacher summary
- handled subjects
- assigned sections
- contact info
- recent activity
- admin action panel

8. Teacher Preview Page
Purpose:
Compact read-only preview.

9. Subjects Management Page
Include:
- add subject button
- subject table
- filters and search
- teacher assignment visibility
- section visibility
- row actions

10. Subject View Page
Include:
- subject details
- teacher assignment
- section assignment
- activities
- enrolled students
- submission statistics

11. Subject Preview Page
Purpose:
Compact read-only preview.

12. Sections Management Page
Include:
- section cards or table
- adviser if applicable
- student count
- academic year
- status
- add/edit actions
- entry point to bulk move students

13. Submissions Management Page
Purpose:
Global oversight of all submissions.
Include:
- advanced filters
- export actions
- table with subject, section, teacher, student/team, status, grade, dates
- row actions to detailed view

14. Submission View Page
Include:
- metadata
- files/links
- student/team data
- teacher feedback
- grade
- audit timeline
- admin notes

15. Submission Preview Page
Purpose:
Compact read-only preview.

16. Reports Dashboard
Purpose:
Institutional reporting and insight.
Include:
- analytics cards
- charts
- completion rates
- late submission metrics
- review turnaround metrics
- filters by school year, term, section, subject
- export report actions

17. Print Report Page
Purpose:
Formal printable summary.
Include:
- school header
- metrics blocks
- summary sections
- footer/sign-off area

18. Academic Settings Page
Include:
- school year selector
- active term
- quarter/semester settings
- submission period controls
- save settings action

19. Requests Page
Include:
- request list/table
- requester
- request type
- date
- status
- approve/reject actions

20. Notifications Page
Include:
- system alerts
- unread/read states
- filters

21. Audit Logs Page
Purpose:
Make actions traceable and trustworthy.
Include:
- searchable table
- filters by date, user, role, module, action
- details drawer or modal

22. Settings Page
Include:
- branding/logo
- email settings
- password policy
- access rules
- backup preferences

23. System Tools Page
Include:
- backup/restore cards
- maintenance tools
- database utility actions
- last backup info
- warning states for risky actions

24. Bulk Move Students Page
Purpose:
Safe bulk reassignment between sections.
Layout:
- source section selector
- destination section selector
- searchable student list with multi-select
- review summary panel
- confirm move modal

STATE DESIGN REQUIREMENTS
Include realistic states for relevant screens:
- empty state
- loading/skeleton state
- success state
- error state
- overdue state
- restricted account state
- no notifications state
- no submissions state
- no subjects assigned state
- import success/failure state where relevant

PAGE-BY-PAGE UX DIRECTION
For each page, design with this hierarchy:
- Page title and context
- Primary action
- Secondary utilities like search/filter/export
- Main content
- Supporting content
- Feedback or status messaging

For deeper detail pages such as Subject View, Student View, Teacher View, Submission View:
- use breadcrumbs
- use summary cards or a detail header first
- then tabs or content sections
- then related records or history

TABLE UX RULES
- Keep row density readable
- Put filters above the table
- Keep status visible
- Use row actions menu for secondary actions
- Use sticky headers where useful
- Add pagination
- Add empty states with helpful next steps

FORM UX RULES
- Group related fields
- Use helper text
- Show required fields clearly
- Use inline validation
- Keep action buttons consistent
- Make upload interactions feel polished and trustworthy

OUTPUT REQUIREMENTS
- create full high-fidelity desktop screens
- organize frames by Student Portal, Teacher Portal, and Superadmin Portal
- include one full design system page
- make the system visually consistent and component-driven
- elevate the design beyond a generic dashboard
- make it feel like a premium academic product with excellent UX judgment
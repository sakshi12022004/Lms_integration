# Implementation Work Log — Student Class + Section Onboarding and Mentor Subject Templates

## 1. Project Work Summary

| Item | Detail |
|------|--------|
| Date of implementation | 7 October 2026 |
| Project | MyLMS Integrated V2 (React + Vite client, Node/Express server, SQLite database) |
| Features implemented | 1. Add Student with Class + Section and automatic classroom membership. 2. Class/section subject template for results with student-specific overrides. |
| Database used | SQLite (`server/data/lms_permanent.db`), the testing-environment database |

### Overall objective

Remove two repetitive manual steps from the daily workflow:

- An admin had to create a student and then, as a separate operation, add that student to a classroom.
- A mentor had to type the subject names and maximum marks again for every student when entering results.

### Problems that existed before

- The Add Student page had free-text "Class" and "Section" boxes. Whatever was typed was stored on the student record only; it was not checked against real classes and the student was not added to any classroom.
- There was no way to change a student's class from the admin user list.
- Results stored a list of subjects per result, and every subject name, marks, total and pass/fail value was typed by hand for each student.
- The Class Results page listed every student of the university instead of the students of the selected classroom.
- The authenticated result endpoint (`POST /api/results/add`) could not insert a new result on this database: it wrote to a `createdBy` column that the `results` table does not have.

### What the new workflow achieves

- The admin picks a Class and a Section from the classes that really exist. Saving the student also enrols the student in that classroom, in one step.
- The mentor configures the subjects and maximum marks once per class/section. Every student inherits them. Exceptions are handled per student without affecting anyone else.
- Marks can be typed straight into a table for the whole class and saved together.

---

## 2. Feature 1 — Student Class + Section Onboarding

### How class, section and classroom relate in this LMS

The codebase was inspected before any change. In this LMS a **classroom is a class (grade) plus a section**: the `classrooms` table has `grade`, `section` and a generated `name` such as `Grade 10 - A`. Membership is stored in `student_classroom_assignment (studentId, classroomId)` with a unique constraint on the pair. No separate class or section table exists, so none was created. The new dropdowns map onto this existing model.

### Previous workflow / problem

Admin opens Add Student → types class and section as free text → saves → opens the classroom → adds the student to the classroom manually.

### New Class dropdown

- Required field.
- Lists the distinct classes (grades) of the classrooms that exist in the admin's university.
- Nothing is hardcoded. The list is read from the existing `GET /api/classrooms` endpoint each time the page opens.

### New Section dropdown

- Required field. Disabled until a class is chosen, with the placeholder "Select a class first".
- Lists only the sections that exist for the chosen class.
- Each option carries the id of the classroom it stands for, so Class + Section resolves to exactly one classroom.
- If two classrooms share the same class and section (this exists in the sample data), the option label also shows the classroom name and id so the admin cannot pick the wrong one silently.

### Dynamic class and section loading

- A classroom created later appears in the dropdowns automatically, because the dropdowns read the live classroom list.
- Loading state: the Class dropdown shows "Loading classes...".
- Error state: a message with a Retry button.
- No classes yet: a message telling the admin to create a classroom first.
- Class with no sections: a message under the Section dropdown instead of an empty list.
- A class that has only one classroom is selected in a single click (the section is filled in automatically).

### Automatic classroom membership

On save the server, inside one database transaction:

1. creates the user,
2. creates the student record (grade and section taken from the classroom),
3. adds the membership row,
4. refreshes the classroom's student count,
5. gives the student the courses that belong to that classroom (same follow-up as the existing "assign student" flow).

If any step fails, everything is rolled back, so a student is never left without a class.

### Duplicate-membership protection

- The enrolment helper checks for an existing membership before inserting, so calling it twice creates one row.
- The table's existing `UNIQUE(studentId, classroomId)` constraint remains as a second guard.

### Existing student edit / reassignment behaviour

The admin user list had no edit action. A **Change Class** button was added for student rows. It opens a dialog that shows the current class and the same Class and Section dropdowns.

- The server moves the membership row to the new classroom and updates both classrooms' student counts, inside one transaction.
- Results, attendance, course enrolments and progress are **not** deleted. They are stored against the classroom and student ids and stay as history.
- If the student is already in the chosen classroom, nothing changes and a clear message is returned.
- If a student belongs to more than one classroom, the admin must choose which one is being changed. The server refuses to guess (HTTP 409).

### Validation and authorization

- Class is required; Section is required when the class uses sections. Both rules are enforced in the browser and on the server.
- The classroom must exist and belong to the admin's university. A classroom of another university is treated as not existing.
- If a classroom id is sent together with a class or section that does not match it, the request is rejected.
- Validation runs before the student is created, so a rejected request creates nothing.
- Creating a student and changing a class are admin-only.

### Frontend changes

- `ClassSectionSelect` — new reusable Class + Section dropdown pair.
- `AddStudent` page — free-text boxes replaced by the dropdowns; required checks added; the success message names the class the student was added to.
- `ChangeStudentClassModal` — new dialog for moving a student.
- `UserList` page — Change Class button on student rows.
- English labels added to the translation file; other languages fall back to English through the existing fallback.

### Backend changes

- `createStudent` validates and resolves the classroom, then creates and enrols in one transaction.
- New `getStudentClassrooms` and `changeStudentClassroom` controller functions and routes.
- New helper `classroomEnrollment.js` (resolve Class + Section to a classroom, idempotent enrol, student count refresh).
- New helper `dbAsync.js` (promise wrappers and a queued transaction helper for the shared SQLite connection).

### Database / migration changes

No database schema changes were required for Feature 1. It uses the existing `classrooms`, `student_classroom_assignment`, `students`, `users` and `course_students` tables.

---

## 3. Feature 2 — Mentor Subject Template + Student Overrides

### Previous problem

A result row stores its subjects as a list of `{ name, marks, total, status }`. Every part of that list was typed by hand for every student and every term.

### Data model chosen

An inheritance model, not a copy per student:

```
classroom_subjects            (the class/section template: subject + maximum marks)
        ↓ inherited by every student of the classroom
student_subject_overrides     (per-student exceptions: add / remove / max)
student_subject_settings      (per-student mode: inherit / custom)
```

The existing `results` table and its subject list are unchanged. A saved result keeps its own copy of subject names and maximum marks, which is what protects history.

### Class/section subject template

- A **Class Subjects** panel on the Class Results page shows the configured subjects and maximum marks.
- **Configure Subjects** opens a dialog to add, rename, re-mark and remove subjects.
- Saved once per classroom. Subject names are unique per classroom, ignoring upper/lower case.

### Default maximum marks

Each class subject has a maximum (1 to 1000). It becomes the default for every student of the class.

### Student inheritance

A student with no exceptions has no rows of their own. Their subjects are read from the class template each time, so a change to the template reaches them immediately.

### Student-specific subject removal

Removing an inherited subject for one student stores a `remove` exception for that student. The class subject itself is untouched. The removed subject is listed under "Removed for this student" with a Restore button.

### Student-specific subject addition

Adding a subject for one student stores an `add` exception with its own maximum marks. It is shown with a **Custom** badge.

### Replace All Subjects

- A red **Replace All Subjects** button opens a confirmation that states what will happen and what will not change.
- After confirmation the student's mode becomes `custom`: the class template is ignored for that student only, and the mentor adds the student's own subjects with the same Add Subject control.
- The server also requires an explicit `confirm: true` value, so the action cannot be triggered by accident.
- **Use Class Defaults** undoes it and returns the student to the class subjects.

### Student-specific maximum-mark override

Editing the Max box of an inherited subject stores a `max` exception. The subject is shown with an **Override** badge and a "Reset to class default (100)" link. Setting the value back to the class default removes the exception.

### How custom students differ from class defaults

| Student state | What the mentor sees |
|---------------|----------------------|
| Inherits everything | A marks box under each class subject column |
| Different maximum for a subject | The marks box plus the student's own maximum shown beneath it |
| Subject removed | A dash in that column |
| Has own subjects, or replaced all | One cell reading "Custom Subjects • Edit", which opens the result form for that student |

Badges are shown only for Custom, Override and "Saved earlier". Plain inherited subjects carry no badge.

### How historical results are protected

- Template and override changes never write to the `results` table.
- Changes affect results entered afterwards. A result that is already saved keeps the subject names and maximum marks it was saved with.
- When a saved result is edited, each subject may keep the maximum it was saved with, or the mentor can click "Use the current maximum" for that subject.
- A subject that was saved earlier but is no longer one of the student's subjects is still shown in the edit form, labelled "Saved earlier".
- Saving marks from the table keeps any saved subjects that are not table columns.

### Result entry screen

- The classroom list contains only the classrooms the mentor is allowed to manage.
- A Term box selects which term's results are shown and saved.
- Students listed are the members of the selected classroom.
- Marks are typed into the table and saved with **Save All Results**. A small P / F button marks a subject as Pass or Fail (default Pass, as before).
- The pencil opens the result form for one student with the subjects already filled in. The book icon opens Edit Subjects for that student.
- Fallback: when a class has no subjects configured, the result form works as before with typed subject rows, and a hint explains how to configure subjects once.

### Frontend changes

- `ClassResults` page rewritten around the new data, keeping the existing page route, the per-student result form and the GuideBot tour anchors.
- New `ClassSubjectsModal`, `StudentSubjectsModal` and a small request helper.
- One GuideBot tour sentence updated to describe the new table columns.

### Backend changes

- New `subjectConfigController.js` and `helpers/subjectConfig.js`.
- `resultController.addResult` now checks authorization, classroom membership, duplicate subjects, subject existence and marks against the maximum. It also no longer writes to the missing `createdBy` column.
- Ten new routes under `/api/results/subjects`.

### Database / migration changes

Three new tables and two indexes. See section 6.

---

## 4. File-Level Change Log

| File | Change | Reason |
|------|--------|--------|
| `server/helpers/dbAsync.js` | Created | Promise wrappers and a queued transaction helper for the shared SQLite connection |
| `server/helpers/classroomEnrollment.js` | Created | Resolve Class + Section to a classroom; idempotent enrolment; student count refresh |
| `server/helpers/subjectConfig.js` | Created | Authorization, validation and the inheritance calculation shared by subject and result code |
| `server/controllers/subjectConfigController.js` | Created | Class template and student override endpoints |
| `server/controllers/adminController.js` | Modified | `createStudent` validates the class and enrols in one transaction; added `getStudentClassrooms` and `changeStudentClassroom` |
| `server/controllers/resultController.js` | Modified | `addResult` validates against the student's subjects and maximum marks; removed the write to the missing `createdBy` column |
| `server/routes/adminRoutes.js` | Modified | Two new student classroom routes |
| `server/routes/resultRoutes.js` | Modified | Ten new subject configuration routes |
| `server/config/sqlite-db.js` | Modified | Creates the three new tables and two indexes at startup |
| `client/src/components/admin/ClassSectionSelect.jsx` | Created | Reusable Class + Section dropdowns |
| `client/src/components/admin/ChangeStudentClassModal.jsx` | Created | Dialog to change a student's class |
| `client/src/pages/admin/AddStudent.jsx` | Modified | Dropdowns replace free-text boxes; required checks; success message names the class |
| `client/src/pages/admin/UserList.jsx` | Modified | Change Class button for student rows |
| `client/src/components/mentor/resultSubjectsApi.js` | Created | Request helper for the result subject endpoints |
| `client/src/components/mentor/ClassSubjectsModal.jsx` | Created | Configure class subjects |
| `client/src/components/mentor/StudentSubjectsModal.jsx` | Created | Edit one student's subjects |
| `client/src/pages/mentor/ClassResults.jsx` | Rewritten | Marks table, class subjects panel, prefilled result form |
| `client/src/context/TranslationContext.jsx` | Modified | 18 English labels for the new admin screens |
| `client/src/guidebot/tours/mentor/overviewTour.js` | Modified | One sentence updated to match the new results table |
| `client/dist/` | Regenerated | Output of the production build run for verification |
| `IMPLEMENTATION_WORK_LOG.md` | Created | This document |

Files inspected and deliberately left unchanged: `client/src/components/admin/AddStudentModal.jsx` (not used by any page), `client/src/pages/mentor/AddResult.jsx` (older single-result page), `server/routes/universalRoutes.js` (older result endpoints).

---

## 5. API / Backend Change Log

### Modified endpoints

| Endpoint | Change |
|----------|--------|
| `POST /api/admin/create-student` | Now requires a class and section that resolve to an existing classroom of the admin's university. Accepts `classroomId`, `className`, `section`. Enrols the student. The response adds `student.classroom`. |
| `POST /api/results/add` | Now requires that the caller may manage the classroom and that the student is a member. Validates subjects and marks. The response adds `subjects`, `overallPercentage`, `overallStatus`. |

### New admin endpoints (admin only)

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/admin/students/:studentId/classrooms` | Read a student's current classroom(s) | Student and list of classrooms |
| `PUT /api/admin/students/:studentId/classroom` | Change a student's class/section. Body: `classroomId`, optional `className`, `section`, `fromClassroomId` | Previous classroom, new classroom with student count |

### New subject endpoints (mentor or admin)

All paths start with `/api/results/subjects`.

| Endpoint | Purpose |
|----------|---------|
| `GET /classrooms` | Classrooms the caller may manage |
| `GET /classroom/:classroomId` | Read the class subject template |
| `PUT /classroom/:classroomId` | Save the class subject template (full list) |
| `GET /classroom/:classroomId/students?term=` | Students with their effective subjects and the result saved for the term |
| `GET /classroom/:classroomId/student/:studentId` | Effective subjects of one student |
| `POST /classroom/:classroomId/student/:studentId/subjects` | Add a subject for one student |
| `DELETE /classroom/:classroomId/student/:studentId/subjects` | Remove a subject for one student |
| `PUT /classroom/:classroomId/student/:studentId/max-marks` | Override maximum marks for one student and subject |
| `PUT /classroom/:classroomId/student/:studentId/replace-all` | Replace all subjects for one student (requires `confirm: true`) |
| `POST /classroom/:classroomId/student/:studentId/restore-defaults` | Restore one inherited subject, or all class defaults |

### Authorization rules

- All new endpoints use the project's existing `authMiddleware` and `roleMiddleware`.
- The classroom must belong to the caller's university.
- An admin may manage any classroom of their university.
- A mentor may manage a classroom only if they are its class teacher, are listed in `classroomAssignments` for it, or teach a course attached to it.
- The student must have the student role, belong to the same university and be a member of the classroom.
- Classroom and student ids from the browser are always re-checked on the server.

### Validation rules

- Subject name: required, at most 100 characters, unique per classroom and per student, ignoring case and extra spaces.
- Maximum marks: a number from 1 to 1000.
- At most 50 subjects in a template.
- Result marks: required, from 0 to the subject's maximum.
- When the student has configured subjects, a result subject must be one of them or already be part of that saved result; the maximum sent must equal the configured maximum or the saved one.
- Multi-step changes (create student, change class, save template, remove subject, change maximum, replace all, restore all) run in a transaction.

---

## 6. Database Change Log

### Migration mechanism

This project has no numbered migration files for the core LMS tables. Core tables are created at server startup by `CREATE TABLE IF NOT EXISTS` statements in `server/config/sqlite-db.js`. The new tables were added there, following that convention. They are created automatically the next time the server starts. No statement was run against the database by hand.

### Tables created

**`classroom_subjects`** — the class/section subject template

| Column | Notes |
|--------|-------|
| `id` | Primary key |
| `classroomId` | References `classrooms(id)` |
| `name`, `nameKey` | Display name and lower-cased name used for uniqueness |
| `maxMarks` | Default maximum marks |
| `sortOrder` | Display order |
| `createdBy`, `createdAt`, `updatedAt` | Audit columns |
| Constraint | `UNIQUE(classroomId, nameKey)` |

**`student_subject_overrides`** — per-student exceptions

| Column | Notes |
|--------|-------|
| `id` | Primary key |
| `classroomId`, `studentId` | Classroom and student the exception belongs to |
| `classSubjectId` | The inherited class subject (empty for a custom subject) |
| `subjectName`, `nameKey` | Subject name |
| `action` | `add`, `remove` or `max` (CHECK constraint) |
| `maxMarks` | Maximum for `add` and `max` |
| `createdBy`, `createdAt`, `updatedAt` | Audit columns |

Indexes:

- `idx_student_subject_overrides_inherited` — unique on `(classroomId, studentId, classSubjectId)` where `classSubjectId` is set. One exception per inherited subject per student.
- `idx_student_subject_overrides_custom` — unique on `(classroomId, studentId, nameKey)` where `action = 'add'`. No duplicate custom subjects.

**`student_subject_settings`** — per-student mode

| Column | Notes |
|--------|-------|
| `classroomId`, `studentId` | `UNIQUE(classroomId, studentId)` |
| `mode` | `inherit` or `custom` (CHECK constraint) |
| `updatedBy`, `updatedAt` | Audit columns |

### Why the change was necessary

The existing schema had no place to store subjects at class level. Subjects existed only inside each saved result.

### Backward compatibility

- The change is additive: no existing table or column was altered, renamed or dropped.
- No existing row is rewritten.
- Classes with no template and students with no exceptions behave as before.
- PostgreSQL: the repository has no PostgreSQL adapter file (`server/config/postgres-db.js` does not exist), so the tables were added for SQLite only. See section 11.

---

## 7. User Workflow — Before vs After

### Admin: adding a student

**Before**

```
Admin creates student (types class and section as text)
→ opens the classroom
→ manually adds the student to the classroom
```

**After**

```
Admin creates student
→ selects Class
→ selects Section
→ student is automatically a member of that classroom
```

### Admin: changing a student's class

**Before:** no action in the user list.

**After**

```
User list → Change Class on the student row
→ selects new Class and Section
→ membership moves; earlier results and attendance stay
```

### Mentor: entering results

**Before**

```
Student 1 → type each subject, marks, total → save
Student 2 → type each subject, marks, total → save
Student 3 → type each subject, marks, total → save
```

**After**

```
Configure Subjects once for the class (Physics 100, Chemistry 100, Mathematics 100, Biology 70)
→ table shows one marks box per student per subject
→ type marks → Save All Results
→ student with different subjects: "Custom Subjects • Edit"
```

---

## 8. Testing / Verification Log

### How the tests were run

- No automated test suite existed in `server/` or `client/` (there is no `test` script in either `package.json`).
- A focused API test script was written for this task and run against the running backend on `http://localhost:5002`. It logs in through the real login endpoint as the demo admin, mentor and student accounts of Demo University, creates its own classrooms and students, and checks results through the API and by reading the SQLite file read-only.
- The database file was backed up before the run and **restored afterwards**, so no test classrooms, students or results remain in the data.
- The script was run twice. Run 1: 51 of 52 passed. The one failure (F2-05) was a wrong expected value in the test itself (it expected 82%; the correct value for 295 out of 370 is 80%, which the application returned). The expected value was corrected. Run 2: **52 of 52 passed**. The table below records run 2.
- The script is not part of the repository.

### Feature 1 — API tests

| Test | What was tested | Expected | Actual | Result |
|------|-----------------|----------|--------|--------|
| SETUP-1 | Create two classrooms (Grade 9, two new sections) | 201 + 201 | 201 + 201 | PASS |
| F1-01 | New class/section appears in the dropdown data source | Both new classrooms listed | Both listed | PASS |
| F1-02 | Create student with Class 9 + Section A | 201 and classroom returned | 201, classroom returned | PASS |
| F1-03 | Student is actually enrolled, no second step | Listed in classroom; 1 membership row | Listed; 1 row | PASS |
| F1-04 | Student count and student grade/section updated | Count 1, grade 9 | Count 1, grade 9, section set | PASS |
| F1-05 | Enrolling an already enrolled student | 200 and still 1 membership row | 200, 1 row, "already in this class and section" | PASS |
| F1-06 | Class + Section resolve without a classroom id | 201, correct classroom | 201, correct classroom | PASS |
| SETUP-2 | Create two more students | 201 + 201 | 201 + 201 | PASS |
| F1-07 | Missing class | 400 "Class is required", nothing created | 400, nothing created | PASS |
| F1-08 | Missing section when the class uses sections | 400 "Section is required", nothing created | 400, nothing created | PASS |
| F1-09 | Non-existent classroom id | 400, nothing created | 400, nothing created | PASS |
| F1-10 | Class does not match the selected classroom | 400, nothing created | 400, nothing created | PASS |
| F1-11 | Section does not exist in the class | 400, nothing created | 400, nothing created | PASS |
| F1-12 | Classroom of another university | 400, nothing created | 400, nothing created | PASS |
| F1-13 | Mentor tries to change a student's class | 403 | 403 | PASS |
| F1-14 | Change class moves the membership | 200; member of new classroom only; counts 2 and 2 | 200; new classroom only; 2 / 2 | PASS |
| F1-15 | Academic history preserved after class change | Same 2 results, still linked to old classroom, visible to student | 2 results, old classroom, 2 visible | PASS |
| F1-16 | Invalid target class / unknown student | 400 + 404 | 400 + 404 | PASS |
| F1-17 | Admin reads a student's current classroom | 200 and the new classroom | 200, new classroom | PASS |

### Feature 2 — API tests

| Test | What was tested | Expected | Actual | Result |
|------|-----------------|----------|--------|--------|
| F2-01 | Mentor configures 4 class subjects once | 200; Biology max 70 | 200; Physics 100, Chemistry 100, Mathematics 100, Biology 70 | PASS |
| F2-02 | Duplicate subject in template (different case) | 400 | 400 "Duplicate subject" | PASS |
| F2-03 | Invalid maximum marks (0, -5, abc, 1001, empty) | All 400; template unchanged | All 400; 4 subjects | PASS |
| F2-04 | All students inherit the subjects | 3 students × 4 default subjects | 3 students; 4 / 4 / 4 | PASS |
| F2-05 | Results saved for two students without sending subject definitions | 201 + 201; Biology total 70; 80% | 201 + 201; 70; 80% | PASS |
| F2-06 | Marks above the maximum | 400 | 400 "between 0 and 70" | PASS |
| F2-07 | Subject not configured for the student | 400 | 400 "not configured" | PASS |
| F2-08 | Duplicate subject in one result; tampered maximum | 400 + 400 | 400 + 400 | PASS |
| F2-09 | Remove Biology for Student A only | 3 subjects; Biology listed as removed | 3 subjects; Biology removed | PASS |
| F2-10 | Add Computer Science for Student A only | 201; marked custom | 201; custom | PASS |
| F2-11 | Duplicate subject for a student (custom, inherited, removed) | 409 × 3 | 409 × 3 | PASS |
| F2-12 | Override Physics maximum to 80 for Student A | Max 80, override, class default 100 | 80, override, 100 | PASS |
| F2-13 | Marks checked against the overridden maximum | 85 rejected; 80 accepted with total 80 | 400; 201, total 80 | PASS |
| F2-14 | Removed subject cannot be used in a new result | 400 | 400 | PASS |
| F2-15 | Other students and class defaults unchanged | Student 3: 4 defaults, Physics 100; template unchanged | As expected | PASS |
| F2-16 | Replace All without confirmation | 400 | 400 | PASS |
| F2-17 | Replace All for Student B | Mode custom; 0 subjects | Custom; 0 | PASS |
| F2-18 | Student B builds a custom set | 4 custom subjects, English 50 | 4 custom, English 50 | PASS |
| F2-19 | Student B results use custom subjects only | Custom saved; Physics rejected | 201; 400 | PASS |
| F2-20 | Class defaults unchanged after replacement | Template unchanged; Student 3 inherits 4 | As expected | PASS |
| F2-21 | Saved results keep their subjects | A: Biology 60/70; B: 4 subjects | As expected | PASS |
| F2-22 | Changing a class maximum affects future entry only | Student 3 Biology max 90; A's saved result still 60/70 | As expected | PASS |
| F2-23 | Editing a saved result with its saved maximums | 200 | 200 | PASS |
| F2-24 | Results that existed before this work | 5 rows identical | Identical | PASS |
| F2-25 | Restore one subject, then all class defaults | Physics 100 default; 4 defaults, not customized | As expected | PASS |
| F2-26 | Mentor not assigned to the classroom (5 operations) | 403 × 5 | 403 × 5 | PASS |
| F2-27 | Other university, student role, no token | 403 × 3 | 403 × 3 | PASS |
| F2-28 | Student not a member of the classroom | 400 + 400 | 400 + 400 | PASS |
| F2-29 | Mentor classroom list | Assigned classroom only | Assigned classroom only | PASS |
| F2-30 | Class with no template accepts typed subjects | 201 | 201 | PASS |
| F2-31 | Older result endpoints still work | 201 + 200 + 200 | 201 + 200 + 200 | PASS |
| F2-32 | Two class subjects swap names in one save | 200 | 200 | PASS |
| F2-33 | Deleting a class subject | Overrides removed; results kept | 0 overrides left; 4 results kept | PASS |

### Browser checks (performed in Chrome against the running app)

| Test | What was tested | Expected | Actual | Result |
|------|-----------------|----------|--------|--------|
| UI-01 | Add Student: Class dropdown content | Real classes only | "Select class", "Grade 9" | PASS |
| UI-02 | Add Student: Section before a class is chosen | Disabled, "Select a class first" | Disabled, "Select a class first" | PASS |
| UI-03 | Add Student: Section after choosing Grade 9 | The sections of Grade 9 | 4 sections listed | PASS |
| UI-04 | Add Student: save without a section | Blocked with "Section is required" | Blocked with that message | PASS |
| UI-05 | Add Student: save with class and section | Success message naming the class; student enrolled; form reset | Message shown; enrolled confirmed through the API; form reset | PASS |
| UI-06 | User list: Change Class dialog | Shows current class; moves student | Current class shown; "Student class updated successfully" | PASS |
| UI-07 | Class Results: page content | Mentor's classrooms, class subjects, marks table | All shown | PASS |
| UI-08 | Class Results: type marks in the table and Save All | Saved and shown again after reload | 88, 70, 81 saved; 82% | PASS |
| UI-09 | Edit Subjects: change a maximum | Override badge and reset link | Shown | PASS |
| UI-10 | Edit Subjects: add a subject | Custom badge; row becomes "Custom Subjects • Edit" | Shown | PASS |
| UI-11 | Result form for a custom student | Subjects prefilled with badges; saved-maximum hint | Shown; saved; 86% | PASS |
| UI-12 | Replace All Subjects confirmation and Cancel | Confirmation text; Cancel changes nothing | Shown; subjects unchanged | PASS |
| UI-13 | Configure Subjects dialog | Existing subjects and maximums loaded | Loaded | PASS |
| UI-14 | Browser console on the results page | No errors | No errors | PASS |

### Not tested

- The out-of-range check in the marks table (UI-08 typed 120 first): the save was attempted, but the error message was not captured, so this is not recorded as a pass. The same rule is covered on the server by F2-06.
- The GuideBot tour was not run end to end. Its anchors were kept in the page.
- Attendance records were not created during the class-change test; only results were used as history. The class-change code does not touch the attendance table.
- Arabic and Urdu display of the new labels was not checked.
- A student who belongs to two classrooms (the 409 path of Change Class) was not exercised.

---

## 9. Build / Validation Results

| Check | Result |
|-------|--------|
| Frontend production build (`npm run build` in `client/`) | Succeeded: 3428 modules, built in about 41 seconds. One existing warning about bundle size. |
| Backend syntax check (`node --check`) on all 9 changed or new server files | All passed |
| Backend start with the new code | Started; the three new tables were created |
| Focused API tests | 52 of 52 passed (second run) |
| Browser checks | 14 of 14 passed |
| Frontend lint (`npm run lint`) | Could not run: the project has no ESLint configuration file. This existed before this work. |
| Backend test suite | None exists in the project |
| Frontend test suite | None exists in the project |
| Type checks | Not applicable; the project is plain JavaScript |

One error appears in the server log at startup: `no such column: updatedAt` from the plan monitor. It was present before this work and is unrelated to it.

---

## 10. Safety / Backward Compatibility

- **Existing data preservation:** no existing table, column or row was altered. The schema change only adds tables.
- **Existing result preservation:** the five results in the database before this work were compared before and after the test run and were identical (test F2-24).
- **Duplicate protection:** membership is checked before insert and guarded by the existing unique constraint; subjects are unique per classroom and per student through unique indexes and server checks.
- **Authorization:** university, role, mentor assignment and classroom membership are checked on the server for every new endpoint.
- **Validation:** the same required-field and range rules exist in the browser and on the server; the server is the authority.
- **Transactions:** multi-row changes commit together or not at all.
- **Older endpoints:** `POST /api/results`, `GET /api/results/classroom/:id`, `GET /api/results/student/:id` and `DELETE /api/results/:id` were left as they were and still work (test F2-31).
- **Test data:** the database was backed up before testing and restored afterwards.

---

## 11. Known Limitations / Future Work

- **Older unauthenticated result endpoint.** `POST /api/results` in `server/routes/universalRoutes.js` existed before this work, has no login check, and does not apply the new validation. The new screens do not use it, but it remains reachable. It was not changed because the older Add Result page still depends on it.
- **Older Add Result page.** `/mentor/add-result` (opened from My Classroom) was not changed. It still uses typed subjects and the older endpoint.
- **Mentor classroom list is stricter than before.** The Class Results page now lists only classrooms a mentor is assigned to. Previously a mentor saw every classroom of the university on this page.
- **Transactions share one connection.** The application uses a single SQLite connection. Transactions started by the new helper are queued so they never overlap each other, but an unrelated query from another request that runs during a transaction would be part of it.
- **PostgreSQL.** The new tables are defined for SQLite only. The repository has no PostgreSQL adapter, so equivalent table definitions will be needed when the deployment database is set up.
- **Pass / Fail is still chosen by the mentor.** No pass mark exists in the system, so the status defaults to Pass as before.
- **Translations.** New admin labels were added in English only. The new mentor dialogs use English text directly, as the existing result form does.
- **Regenerated build output.** `client/dist/` was rebuilt by the verification build.

---

## 12. Implementation Ownership / Contribution

- This implementation introduced Class and Section dropdowns backed by the existing classroom data, and automatic, idempotent classroom enrolment on student creation.
- This work added an admin action and two endpoints for changing a student's class while keeping academic history.
- This work added a class/section subject template with per-student add, remove, maximum-mark override, replace-all and restore operations: three tables, ten endpoints and three interface components.
- This change modified the result save endpoint to enforce authorization, membership and marks validation, and corrected its insert so it works on the current schema.
- This change rewrote the mentor Class Results page as a class-wide marks table.
- The work was verified with 52 API tests, 14 browser checks and a production build.

---

## 13. Final Implementation Summary

Two workflow improvements were delivered end to end, in the interface, the API and the database.

An admin now adds a student by choosing a real Class and Section, and the student is enrolled in that classroom in the same step, with validation, duplicate protection and a safe way to change the class later.

A mentor now configures subjects and maximum marks once per class. Students inherit them, individual students can differ, and marks are entered in a single table. Saved results keep the subjects and maximum marks they were saved with.

Existing data and older endpoints were left intact. The remaining items are listed in section 11.


---
---

# Work Log Entry 2 — Report Sharing, Publish-Once, Notifications, Terms Modal

**Date of implementation:** 7 October 2026 (second entry of the day)

## 2.1 Summary

| # | Objective | Status |
|---|-----------|--------|
| 1 | AI Performance Report sharing works end to end (teacher shares, student is notified, opens the report, downloads the PDF) | Implemented and tested |
| 1 | Hugging Face configuration placed in the correct env file with a placeholder | Implemented |
| 1 | Short notification text from templates, with optional AI wording and safe fallback | Implemented and tested |
| 2 | A published assessment cannot be published again | Implemented and tested |
| 3 | Existing announcement/notification system connected to real workflows | Implemented and tested |
| Add-on | Terms & Conditions modal matches the LMS look | Implemented and checked in the browser |

## 2.2 What was found before changing anything

- **Notification system.** The LMS has one: the `announcements` table, the `/api/announcements` routes and the bell (`AnnouncementBell`). It could only broadcast by role (students / mentors / both) or by course. It could not address one person, carried no information about what it was about, and nothing happened on click. No second system existed and none was created.
- **Report sharing.** The backend of the AI Assessment Agent already stored reports, shared them idempotently and enforced that only the intended student can open one. The chain broke after that:
  1. Sharing created **no notification**. The student saw the report only as a list inside the My Tests page.
  2. There was **no report page**. The list offered a download button only, so a notification had nowhere to lead.
  3. The **bell was missing** on every student page except the dashboard.
  4. The bell's realtime socket connected to the **web page's own address**, not the backend, and the server never sent announcement events. Only the 10-second polling worked.
  5. **No AI provider was configured** in `server/.env`, so a new report could not be generated at all.
- **Publish duplication.** The page is the mentor portal's My Classroom → course → Create Assessment → Design Assessment (`/mentor/assessment/:id`). After a successful publish the Publish button and the question form stayed exactly as they were. The server accepted every repeat, did not check who was publishing, and reloading the page did not show that the assessment was already published.

## 2.3 Priority 1 — AI report sharing

- "Send to Student" now creates **one notification** for the student the report is about ("Performance Report Shared"). It is created on the first share only; repeat clicks return "already shared" and add nothing.
- New student page **`/student/assessment-agent/reports/:reportId`** shows the shared report and has a **Download PDF** button. The PDF is built in the browser from the same server data, with the same `reportPdf.js` the teacher uses. No second report system was built.
- The report list on My Tests gained a **View Report** link next to Download.
- Authorization is unchanged and server-side: a report is returned only when it belongs to the signed-in student's school, is about that student, and has been shared. Anything else is "not found".
- Existing report history was not modified.
- Report **generation** itself was not changed. It is covered by the module's existing tests with a mock provider (see 2.10).

## 2.4 Hugging Face configuration

```
ENV FILE:    server/.env
VARIABLE:    HF_TOKEN
PLACEHOLDER: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- `server/.env` is loaded by `server/server.js` (dotenv). The AI Assessment Agent has no env file of its own; it reads the server's environment in `ai-modules/ai-assessment-agent/backend/src/llm/generationConfig.js`. `HF_TOKEN` is the variable that file already defines for Hugging Face, so no new name was invented.
- Two companion settings were added beside it: `AIA_LLM_PROVIDER=huggingface` and `AIA_LLM_MODEL=Qwen/Qwen3-Next-80B-A3B-Instruct:deepinfra` (the example model from the module's own documentation; confirm the model before going live).
- The same block was added to `server/.env.example`, because `server/.env` is git-ignored.
- With the placeholder the module reports the key as invalid format, keeps AI **off** and calls nothing. AI switches on when a real `hf_...` token is put in.
- The token is backend only. It is sent only in the Authorization header to Hugging Face and is not an enumerable property, so it does not appear in logs, API responses or frontend code.

## 2.5 Notification text and prompt templates

File: `server/services/notificationText.js`.

- Eleven fixed templates, one per notification type, produce the title and a deterministic message.
- For three types (assessment published, assignment published, calendar event) an AI-written sentence may be used when a provider is configured. The prompt is built by the application from cleaned, trusted values (title, deadline, date).
- The AI controls **only** the sentence. Recipient, type, target, ids, permissions and dates are decided by application code.
- AI output is validated before use: it must be valid JSON with a `message`, 10–180 characters, contain the title, and contain no link, markup, placeholder or JSON. The same validation is applied to a message typed by an admin or teacher.
- Any failure (not configured, timeout after 8 seconds, provider error, unusable text) falls back to the template. The notification is still created and the user sees no error.

## 2.6 Priority 2 — publish once

**Backend** (`PUT /api/assessments/:assessmentId/publish`):

- Only the assessment's creator, the course teacher, or an admin of the course's school may publish (previously unchecked).
- An already published assessment returns **409** with `alreadyPublished: true` and changes nothing.
- The update runs with `WHERE isPublished = 0`, so simultaneous requests publish exactly once.
- The existing `isPublished` state is reused; no second lifecycle was added.

**Frontend** (`DesignAssessment.jsx`, `CreateAssessment.jsx`):

- The page reads the published state from the server, so a refresh shows it.
- After publishing, the Publish button and the question form are replaced by a success panel: "Assessment published successfully." with **View Course**, **Back to Classroom** and **Create New Assessment**.
- An immediate lock means rapid clicks send one request.
- Create Assessment ignores a double click while the request is running.

The AI-agent tests (`/teacher/assessments`) already rejected a second publish with 409; that was verified, not changed.

## 2.7 Priority 3 — notification architecture

**Storage.** Five columns were added to the existing `announcements` table:

| Column | Meaning |
|--------|---------|
| `recipientUserId` | The one user who may see the row. Empty = an ordinary announcement, as before. |
| `type` | What kind of notification it is. |
| `entityType`, `entityId` | What it is about. Used for click routing. |
| `dedupeKey` | Unique key: one notification per event per recipient. |

**Rules.**

- A targeted notification is visible to its recipient only. Other students, teachers and admins of the same school cannot list it, open it by id or mark it read.
- Recipients are always worked out on the server from the database. Recipient ids from the browser are never used.
- Every notification is created inside the recipient's own school.
- No URL is stored. The frontend maps `type + entityType + entityId` to a screen in `client/src/utils/notificationRoutes.js`.
- De-duplication is enforced by a unique index, so retries, double clicks, page refreshes and repeated reminder sweeps cannot duplicate.

**Delivery.** The existing bell shows the notifications, with an unread count, and each one opens its screen on click. The bell's socket now connects to the backend; a signed-in socket joins its own room and receives a `notification:new` event. The existing 10-second polling remains as the fallback. The bell was added to all student pages.

**Scheduler.** `server/schedulers/notification-scheduler.js` runs every 15 minutes (first run 20 seconds after start) for the time-based reminders.

### Scenarios implemented

| Recipient | Trigger | Notification | Opens |
|-----------|---------|--------------|-------|
| Student | AI-agent test published (whole class or selected students) | New Assessment | My Tests |
| Student | Course assessment published | New Assessment | The course page |
| Student | Assignment published | New Assignment | The assignment |
| Student | Assignment due within 24 hours and not submitted | Assignment Due Soon | The assignment |
| Student | Assignment deadline passed in the last 3 days, no submission | Assignment Deadline Missed | The assignment |
| Student | Teacher saves final marks for a submission | Result Available | The assignment |
| Student | Mentor saves a new result (Class Results) | Result Available | My Results |
| Student | Teacher shares an AI Performance Report | Performance Report Shared | That report |
| Student / Mentor | Calendar event created with "Notify participants" | New Calendar Event | Calendar |
| Mentor | Student submits an assignment | Assignment Submitted | Assignments |
| Mentor | Student finishes a test | Assessment Attempt Submitted | AI Assessments |
| Mentor | Attendance not marked today after 11:00 (not Sundays) | Attendance Pending | Attendance for that class |
| Admin | A teacher account is waiting for approval | Teacher Awaiting Approval | Mentor approvals |

Ordinary announcements (item 8 of the brief) already reached their audience through the bell and were left as they were.

### Calendar event → notification

The Create Event dialog has a **Notify participants** checkbox (off by default). When ticked, a message box appears with a **Suggest a message** button; the admin or teacher can edit the text or leave it empty for the standard message. The audience is the event's own audience: an admin event reaches the students, the mentors or both of that school as chosen; a mentor event reaches the students of that course, and only if the mentor teaches it.

### Not implemented / Remaining

- **"AI evaluation requires teacher confirmation" / "AI report pending review".** Not implemented. Both are produced by the teacher's own click and shown on the same screen at once, so a notification would only repeat what the teacher is looking at.
- **Preview/edit of the message when publishing a test or assignment.** Not implemented; those notifications use the template (or AI text when configured). Adding a preview step there would have meant redesigning the publish dialogs. Preview and edit exist for calendar events.
- **Pending/unactivated students for admins, workflow-failure alerts.** Not implemented.
- **Announcement details page.** Clicking an ordinary announcement in the bell still does nothing, as before.

## 2.8 Terms & Conditions modal

Presentation only; the acceptance logic, storage keys and terms text were not changed.

- Reused the LMS's existing visual language: gold `#B99652` primary button and accent, navy `#1e1b4b` text, cream `#fffdf4` surfaces, `#ebdcaa` borders, square corners and the DM Serif Display heading font, as used by the admin pages and dialogs.
- Removed the blue-to-purple gradient header. The header is now compact, white, with a gold top line and one supporting sentence.
- Section headings use the serif font with a light divider; line height and spacing were increased; the notice box uses the LMS cream/gold instead of blue.
- The footer is a separate cream action area. The Accept button uses the LMS primary button style and stays grey and disabled until the box is ticked.
- Added dialog semantics (`role="dialog"`, `aria-modal`, labelled title), a visible focus ring, and a scroll lock so the page behind does not scroll.
- The same styling was applied to the Terms dialog opened from the login page (`TermsConditionsModal.jsx`) so both look alike.

## 2.9 APIs, database, files

### APIs / routes

| Route | Change |
|-------|--------|
| `GET /api/announcements` | Also returns the caller's targeted notifications; hides other users' |
| `GET /api/announcements/:id` | New. One announcement/notification the caller may see |
| `PUT /api/announcements/:id/read` | A targeted notification can be marked read by its recipient only |
| `POST /api/announcements/suggest-text` | New. Admin/mentor preview of a short message; returns text only |
| `POST /api/calendar` | Accepts `notify` and `notifyMessage` |
| `PUT /api/assessments/:assessmentId/publish` | Ownership check; 409 when already published; notifies enrolled students |
| `POST /api/results/add` | Notifies the student when a result is first saved |
| `/api/assessment-agent/*` | No route added or changed. Six existing actions now report an event to the LMS after they succeed |
| Socket.IO | A connection with a valid token joins the room `user:<id>`; event `notification:new` |

### Database

No migration files were added. Following the project's existing convention for core tables, `server/config/sqlite-db.js` adds the five columns to `announcements` with `ALTER TABLE ... ADD COLUMN` at server start (ignored when they already exist) and creates two indexes: `idx_announcements_dedupe` (unique, on `dedupeKey` where set) and `idx_announcements_recipient`. Existing rows are untouched. The AI Assessment Agent's own tables and migrations were not changed.

### Files

| File | Change |
|------|--------|
| `server/services/notificationService.js` | Created. Creates targeted notifications in `announcements`; audience lookups |
| `server/services/notificationText.js` | Created. Templates, validation, optional AI text with fallback |
| `server/services/assessmentAgentNotifications.js` | Created. Turns AI-agent events into notifications |
| `server/schedulers/notification-scheduler.js` | Created. Deadline, attendance and approval reminders |
| `server/tests/notificationText.test.js` | Created. 16 unit tests |
| `server/config/sqlite-db.js` | Columns and indexes on `announcements` |
| `server/controllers/announcementController.js`, `server/routes/announcementRoutes.js` | Targeted visibility, read rule, two new handlers |
| `server/controllers/calendarController.js` | Optional notification on create |
| `server/controllers/assessmentController.js` | Publish once, ownership, notification |
| `server/controllers/resultController.js` | Notification on new result |
| `server/routes/assessmentAgentRoutes.js` | Passes the event handler to the agent |
| `server/server.js` | Socket rooms; starts the scheduler |
| `server/.env`, `server/.env.example` | Hugging Face block with placeholder |
| `ai-modules/ai-assessment-agent/backend/src/http/createAssessmentRouter.js` | Optional `onEvent` hook |
| `ai-modules/ai-assessment-agent/backend/src/assignments/assignmentRoutes.js` | Reports publish, submit and evaluate events |
| `ai-modules/ai-assessment-agent/backend/src/integration/lmsAssessmentAgent.js` | Passes `onEvent` through |
| `client/src/utils/notificationRoutes.js` | Created. Notification → screen |
| `client/src/pages/assessment-agent/StudentPerformanceReport.jsx` | Created. Student report page |
| `client/src/components/AnnouncementBell.jsx` | Backend socket, unread count, click routing |
| `client/src/components/StudentLayout.jsx` | Bell on student pages |
| `client/src/pages/assessment-agent/StudentReportNotifications.jsx` | View Report link |
| `client/src/App.jsx` | Report page route |
| `client/src/calendar/CreateEventModal.jsx` | Notify participants, message box, suggestion |
| `client/src/pages/mentor/DesignAssessment.jsx`, `CreateAssessment.jsx` | Publish-once behaviour |
| `client/src/components/ControlledTermsModal.jsx`, `TermsConditionsModal.jsx` | Styling |
| `client/dist/` | Regenerated by the verification build |

## 2.10 Tests performed

No real AI call was made in any test.

### Unit tests — `server/tests/notificationText.test.js` (node:test): 16 of 16 passed

Templates for every type and the agreed wording; unknown type refused; validation accepts a plain sentence and rejects links, markup, placeholders, JSON and bad lengths; a valid AI sentence is used and the title is never taken from the AI; provider failure, timeout and seven kinds of unusable output fall back to the template; the AI is not called when unconfigured or for template-only types; `HF_TOKEN` is the variable read, the placeholder keeps AI off; the token is absent from printed configuration and provider objects; with a fake fetch the token appears only in the Authorization header and in no log line, including on a rejected-credentials error.

### AI Assessment Agent's own suite (`npm test` in the module)

| | Before this work | After |
|---|---|---|
| Passed | 422 | 422 |
| Failed | 0 | 0 |
| Cancelled | 93 | 93 |

The 93 cancelled tests are the module's HTTP integration suites. They cannot start on this copy of the server because they require `server/config/jwt` and `server/middleware/requireTenant`, which do not exist here. This was the case before this work. The passing tests include report generation, validation and storage with a mock provider.

### API tests against the running server: 44 of 44 passed

Run on a backed-up database that was restored afterwards. Test users were signed in with locally signed development tokens; one unshared report was inserted as a fixture (a copy of an existing report) because generating one needs a real AI call. The first run scored 41 of 44: all three failures were wrong expectations in the test script (a status code name, and a membership row pointing at a user that does not exist), not application faults. After correcting the script the suite was rerun on a freshly restored database.

| Area | Tests | Result |
|------|-------|--------|
| Hugging Face: AI reported off with the placeholder; no token in the response; suggestion falls back to the template; students and unknown types refused | HF-01 to HF-04 | 4 PASS |
| Report: persisted and listed; correct student opens it; another student, another school and a teacher refused; re-share safe; cannot be opened or shared by the wrong people before sharing; share creates one notification with the right target; repeated shares add none; visible to the recipient only; cannot be read or marked by id by others; read/unread works; history unchanged | RPT-01 to RPT-12 | 12 PASS |
| Publish: once; repeat rejected with one row; refresh shows published; three simultaneous requests publish once; non-owner and student refused, empty assessment refused; a further assessment still publishes | PUB-01 to PUB-06 | 6 PASS |
| Notifications: course assessment, AI-agent test, nobody outside the class, attempt submitted, assignment published, assignment submitted, final marks, other school cannot open the target, mentor result, calendar without notify, calendar students only, edited message used, unsafe message replaced, mentor course event, due soon, missed deadline, attendance reminder, no duplicates after refreshes and sweeps, ordinary announcements still work, old announcements unchanged, every notification structured with a unique key and no URL, none crosses schools | NTF-01 to NTF-22 | 22 PASS |

Also checked: the server log of the test run contains neither the placeholder nor any `hf_` text, and no notification error.

### Browser checks (Chrome, running app): all passed

| Check | Result |
|-------|--------|
| Student bell shows the unread count and the list, including each new notification type | PASS |
| Clicking "Performance Report Shared" opens `/student/assessment-agent/reports/2` with the report's seven sections | PASS |
| Download PDF produces a PDF file (about 19.7 KB) with no error | PASS |
| After reading, the unread count clears | PASS |
| Another student opening the same report address sees "This report is not available" and no download | PASS |
| Publish: button and question form replaced by the success panel; refresh shows "This assessment is published" | PASS |
| Publish: three rapid clicks send one request (after the click lock was added; before it, three were sent and the server rejected two) | PASS |
| Create New Assessment from the success panel opens an empty form | PASS |
| Calendar: Notify participants is off by default, reveals the message box, Suggest a message fills it | PASS |
| Terms: new look shown on opening the portal; 10 sections unchanged; no gradient; page behind does not scroll | PASS |
| Terms: Accept disabled until the box is ticked, then active; accepting closes the dialog and stores acceptance | PASS |
| Terms at 500 px width: fits the viewport, no horizontal scroll, button inside and reachable | PASS |

### Build

Frontend production build: succeeded (3430 modules). Backend syntax check passed on all changed files. Lint could not run (the project has no ESLint configuration; unchanged from before).

### Not tested

- A real Hugging Face call (deliberately; needs a real token).
- Generating a brand-new report through the interface (needs a real AI call).
- The "Teacher Awaiting Approval" notification: the data has no unapproved teacher, so the rule ran but had nothing to create.
- Realtime arrival of a notification over the socket in the browser. Arrival through the bell's polling was observed.
- The GuideBot tours, phone-width layouts below 500 px, and Arabic/Urdu text.

## 2.11 Known limitations

- **First start on existing data.** When the server starts, students who missed an assignment deadline in the last three days, and class teachers whose attendance is not marked today, receive their notifications straight away.
- **Bell marks everything read on open.** This is the existing behaviour and was kept; a notification is not marked read individually on click.
- **Two bells on dashboards.** Admin, mentor and student dashboards already rendered a bell in addition to the layout's; this was not changed. The student layout hides its bell on the dashboard to avoid a third.
- **Attendance reminder hour** is fixed at 11:00 server time unless `ATTENDANCE_REMINDER_HOUR` is set; the LMS has no timetable to derive it from.
- **Re-publishing after unpublishing** an AI-agent test does not notify the students a second time.
- **Generic CRUD routes.** `server/routes/universalRoutes.js` still exposes generic update routes for many tables, including `announcements`, as it did before. The new read route takes precedence for `GET /api/announcements/:id`.
- **Calendar events have no school column.** Notifications are scoped to the creator's school; the calendar listing itself is unchanged.
- **Model name.** `AIA_LLM_MODEL` is set to the example from the module's documentation and must be confirmed.
- **Default JWT secret.** `server/.env` sets no `JWT_SECRET`, so the development default is in use. The tests relied on this to sign local test tokens. Set a real secret before deployment.

## 2.12 Implementation ownership / contribution

- This work connected the existing announcement system to thirteen workflow events, with per-user targeting, structured click routing and de-duplication, without adding a second notification system.
- This work completed the AI report sharing chain with a notification and a student report page, and configured the Hugging Face provider location with a placeholder.
- This change made assessment publishing idempotent on the server and unmistakable in the interface.
- This change restyled the Terms & Conditions dialogs to the LMS design language without altering their behaviour.
- Verified with 16 unit tests, 44 API tests, the module's 422 passing tests and the browser checks listed above.


---
---

# Work Log Entry 3 — Teaching Scope, Class/Section Targeting, Calendar Fix, Class Creation, AI Classroom, Question Pictures

**Date of implementation:** 8 October 2026

## 3.1 Implementation summary

| Workflow | Status |
|----------|--------|
| Shared teacher access scope (classes → sections → courses) with server-side checks | Implemented and tested |
| Announcements by Class → Section → optional Course | Implemented and tested |
| Calendar events by Class → Section → optional Course, with school and class scope | Implemented and tested |
| Calendar "Notify participants" end to end | Fixed and tested |
| Create a missing class/section from Add Student | Implemented and tested |
| AI assessment requires an authorized classroom | Implemented and tested |
| Academic level (grade + section) passed to AI generation | Implemented and tested |
| Optional picture on every question type, private storage | Implemented and tested |

No request/approval workflow, no new notification system and no multimodal AI were added, as decided.

## 3.2 Workflows changed

### Teaching scope (Phase 1)

One small helper, `server/helpers/teachingScope.js`, is now the single place that answers "may this user act on this classroom or course?".

- **Admin:** every classroom of their school and the courses inside them.
- **Teacher:** classrooms where they are the class teacher, are listed in `classroomAssignments`, or teach a course. Inside those, the courses they teach; a class teacher or assigned teacher may act on every course of that classroom.
- `authorizeClassroom` and `authorizeCourse` re-check every id that arrives from the browser. `authorizeCourse` also checks that the course belongs to the class and section that was selected.
- The result/subject code from Entry 1 now uses this helper instead of its own copy.
- `GET /api/classrooms/teaching-scope` returns the whole Class → Section → Course tree in two queries.

### Announcements (Phase 2)

- A teacher chooses **Whole class and section** or **One course**, then Class → Section (→ Course).
- A general class announcement is stored with the classroom and no course, and is shown to the students of that classroom only.
- A course announcement must name a course of the selected class and section.
- The admin's school-wide announcement is unchanged.

### Calendar (Phase 2)

- Teachers: Class → Section, optional Course. Admins: the existing "Display for" choices plus **One class and section**.
- Every event now stores its school and, when targeted, its classroom.
- The calendar list is limited to the user's own school, and to the user's own classes and courses.
- Editing an event can no longer change who it is for.

### Calendar "Notify participants" (the reported fault)

- **Root cause:** `calendar_events` had no school column. An event created by an admin of one school appeared on every school's calendar, while its notifications (correctly) went only to the creator's school. The two test events were created by `admin@gmail.com` of Demo University; their notifications existed, for Demo University users.
- **Fix:** events carry `university_id` and `classroomId`; the list is filtered by school; the audience is resolved from the event itself: course → enrolled students, class/section → students of that classroom, school-wide → students/mentors of the school.
- Clicking the notification opens the calendar on the month of that event (`?eventId=`).
- **Quote bug:** a message beginning with a quotation mark lost it. Only a pair of quotes wrapping the whole text is now removed.
- A notification failure does not undo the event; this was already the behaviour and was kept.

### Class creation from Add Student (Phase 3)

- Under the Class and Section dropdowns there is a link, **Class or section not listed? Create it**. The admin types the class and section, it is created, the list reloads and the new entry is selected.
- Only admins can do this, which matches who can add students and who can already create classrooms.
- The server refuses a duplicate class + section within a school (ignoring case and spaces) and returns the existing classroom, which the form then selects.
- Class names are no longer limited to Grade 1–12. Numbered grades keep the name "Grade 10 - A"; a named class becomes "BSc - A". The Create Classroom dialog also accepts a typed class name.
- A classroom is always created as class + section together, so a section cannot exist without its class.

### AI assessment (Phase 4)

- Generating questions and saving AI-reviewed questions now require a classroom, checked on the server.
- The classroom must be one the teacher is assigned to. This applies to every place the AI agent accepts a classroom from a teacher: creating and editing a test, publishing, listing students, generation, and assignments.
- The AI screen lists only the teacher's classes.
- A manually typed draft may still be started without a class, as before.
- The prompt now carries a structured `audience` object with **grade** and **section**, and one added rule telling the model to write for that academic level.
- **Deliberate difference from the brief:** the class *name* is not sent. The module has an existing privacy rule and test that the free-text class name never reaches the AI provider. Grade and section already state the level, so the rule was kept.
- No extra AI evaluation step was added; the existing output validation and content guard still apply.

### Question pictures (Phase 5)

- Every question type can carry one optional picture: single MCQ, multiple-select, numerical, descriptive (assignment) questions, AI-generated questions during review, and legacy course-assessment questions.
- **Storage:** the AI module's existing private file store, in its own folder `data/question-images` (git-ignored). The database holds only a short key. Nothing is placed in the public `/uploads` folder.
- **Upload:** PNG, JPG, GIF or WebP up to 2 MB. The type is detected from the file's bytes and must match the declared type. SVG is refused. Teachers only.
- **Viewing:** teachers load a picture by its key. Students are never given the key: they request "the picture of question N of test T", and the server checks that the student may see that question before returning it. The browser loads it with the user's token and shows it from memory.
- **Legacy course assessments:** the "paste image URL" box was replaced by the same upload control. Older questions that hold a web address still display. The `questionImage` value was previously dropped because the column did not exist; it is now stored.
- No multimodal AI: the picture is for people to look at; it is not sent to the AI.

## 3.3 Files changed

| File | Change |
|------|--------|
| `server/helpers/teachingScope.js` | Created. Classroom/course scope and authorization |
| `server/helpers/subjectConfig.js` | Uses the shared scope instead of its own copy |
| `server/controllers/classroomController.js`, `server/routes/classroomRoutes.js` | Scope endpoint; teacher classroom list fixed; duplicate check; named classes |
| `server/controllers/course-controller.js` | Role-limited list; access checks on classroom list, create, update, delete |
| `server/controllers/announcementController.js` | Class/section/course targeting and audience |
| `server/controllers/calendarController.js` | School + class scope, audience, list rewrite, fixed target on edit |
| `server/controllers/assessmentController.js`, `server/routes/assessmentRoutes.js` | Legacy question picture stored and served |
| `server/routes/assessmentAgentRoutes.js` | Shared private picture store |
| `server/config/sqlite-db.js` | Additive columns (see 3.4) |
| `server/services/notificationText.js` | Quote fix |
| `ai-modules/ai-assessment-agent/backend/src/core/questionImage.js` | Created. Picture validation and key format |
| `.../adapters/lms/migrations/009_aia_question_images.sql` and `.down.sql` | Created |
| `.../backend/scripts/applyMigration.js` | Knows migration 009 |
| `.../adapters/lms/SqliteAssessmentLmsAdapter.js`, `sqliteAssignmentStore.js` | Teacher classrooms; picture key read/write |
| `.../assignments/LocalSubmissionFileStore.js` | Same class can also hold picture files |
| `.../core/AssessmentService.js`, `.../assignments/AssignmentService.js` | Teacher classroom checks; classroom required on review-save; student picture lookup |
| `.../core/assessmentValidation.js`, `.../assignments/assignmentValidation.js`, `.../core/questionTypes.js` | `imageKey` on questions; `hasImage` for students |
| `.../core/ai/generationRequest.js`, `.../core/ai/generationPrompt.js` | Classroom required; `audience` |
| `.../http/createAssessmentRouter.js`, `.../integration/lmsAssessmentAgent.js` | Picture routes and store |
| `ai-modules/ai-assessment-agent/tests/scope/teacherScopeAndImages.test.js` | Created. 10 tests |
| Eight existing module test files and two test helpers | Updated for the new rules (classroom in requests, teacher assignments, new prompt field, new column) |
| `client/src/components/ClassSectionCoursePicker.jsx` | Created. Shared picker |
| `client/src/components/QuestionImage.jsx` | Created. Upload control and private image display |
| `client/src/components/announcements/CreateAnnouncementModal.jsx`, `client/src/calendar/CreateEventModal.jsx` | Use the picker |
| `client/src/calendar/CalendarPage.jsx`, `client/src/utils/notificationRoutes.js` | Open on the notified event |
| `client/src/components/admin/ClassSectionSelect.jsx`, `client/src/pages/admin/CreateClassroomModal.jsx` | Create class in place; named classes |
| `client/src/pages/assessment-agent/` — `AiAssessmentGenerator`, `QuestionEditor`, `questionForm`, `TeacherAssessments`, `StudentAttempt`, `TeacherAssignments`, `StudentAssignment` | Classroom required; pictures |
| `client/src/pages/mentor/DesignAssessment.jsx`, `client/src/pages/student/AttemptAssessment.jsx` | Legacy pictures |
| `client/src/context/TranslationContext.jsx` | Six English labels |
| `client/dist/` | Regenerated by the verification build |

## 3.4 Database / schema changes

All additive. No table, column or row was removed or rewritten, except the one back-fill noted below.

| Where | Change | Mechanism |
|-------|--------|-----------|
| `announcements` | `classroomId` | `sqlite-db.js` at server start |
| `calendar_events` | `university_id`, `classroomId` | `sqlite-db.js` at server start |
| `calendar_events` | Existing rows: `university_id` set to the school of the user who created the event | Same; runs only where the value is empty |
| `assessment_questions` | `questionImage` | `sqlite-db.js` at server start |
| `aia_questions`, `aia_assignment_questions` | `image_key` | Module migration **009**, applied with the module's own `applyMigration.js` after a backup |

All 10 existing calendar events had a known creator, so none was left without a school. No class relationship was invented for old events.

## 3.5 API changes

| Route | Change |
|-------|--------|
| `GET /api/classrooms/teaching-scope` | New. Class → Section → Course tree for the caller |
| `GET /api/classrooms/my-classrooms`, `/mentor/:id` | Teacher gets assigned classrooms only (previously every classroom of the school); 403 for other roles |
| `POST /api/classrooms` | 409 on duplicate class + section; named classes |
| `GET /api/courses` | Admin: school; teacher: courses they teach; student: enrolled courses |
| `GET /api/courses/classroom/:id` | Access-checked |
| `POST /api/courses/create-course`, `PUT`/`DELETE /api/courses/:id` | Classroom / ownership checked |
| `POST /api/announcements` | Teachers send `classroomId` and optional `courseId`; both validated. A course-only request is still accepted for a course the teacher may manage |
| `POST /api/calendar` | Accepts `classroomId` and `courseId`; validated |
| `GET /api/calendar` | Limited to the caller's school, classes and courses |
| `PUT /api/calendar/:id` | Only title, description and dates can change |
| `POST /api/assessments/add-question` | Stores `questionImage` |
| `GET /api/assessments/questions/:questionId/image` | New. Legacy question picture, access-checked |
| `POST /api/assessment-agent/teacher/question-images` | New. Upload |
| `GET /api/assessment-agent/teacher/question-images/:key` | New. Teacher view |
| `GET /api/assessment-agent/student/assessments/:id/questions/:questionId/image` | New |
| `GET /api/assessment-agent/student/assignments/:id/questions/:position/image` | New |
| `POST /api/assessment-agent/teacher/assessments/generate`, `/from-review` | `classroomId` required and must be the teacher's |
| Question payloads in the AI agent | Optional `imageKey`; student views return `hasImage` |

## 3.6 Authorization changes (bugs closed)

| Before | Now |
|--------|-----|
| Mentor classroom endpoints returned every classroom of the school | Assigned classrooms only |
| `GET /courses` returned every course of the school to any role | Limited by role |
| Classroom course list had no access check | Admin of the school, assigned teacher, or member student |
| A teacher could update or delete any course | Only one they may manage |
| A teacher could post an announcement for any course id | Class and course both validated |
| A teacher could create an event for any course id | Class and course both validated |
| The AI agent accepted any classroom of the school from a teacher | Only the teacher's classrooms |
| Calendar events were visible across schools | Limited to the creator's school |
| Editing an event could change its course or audience | Not possible |

## 3.7 Notification inventory (final)

| Trigger | Recipient | Type | Entity | Route | Status |
|---------|-----------|------|--------|-------|--------|
| Admin announcement | Students / mentors of the school | plain | — | none | Working |
| Teacher announcement, whole class | Students of the classroom | plain | classroom | none | Fixed (new targeting) |
| Teacher announcement, course | Enrolled students | plain | course | none | Fixed (course now validated) |
| AI test published | Class or selected students | ASSESSMENT_PUBLISHED | aia_assessment | My Tests | Working |
| Course assessment published | Enrolled students | ASSESSMENT_PUBLISHED | course | Course page | Working |
| Assignment published | Class | ASSIGNMENT_PUBLISHED | aia_assignment | Assignment | Working |
| Assignment due in 24h | Non-submitters | ASSIGNMENT_DUE_SOON | aia_assignment | Assignment | Working |
| Assignment deadline missed | Non-submitters | ASSIGNMENT_MISSED | aia_assignment | Assignment | Working |
| Final marks saved | That student | RESULT_AVAILABLE | aia_assignment | Assignment | Working |
| Mentor result saved | That student | RESULT_AVAILABLE | result | My Results | Working |
| Report shared | That student | REPORT_SHARED | performance_report | Report page | Working |
| Calendar event + notify | Course, class or school audience | CALENDAR_EVENT | calendar_event | Calendar on that event | Fixed |
| Assignment submitted | Teacher | ASSIGNMENT_SUBMITTED | aia_assignment | Assignments | Working |
| Test attempt submitted | Teacher | ATTEMPT_SUBMITTED | aia_assessment | AI Assessments | Working |
| Attendance not marked | Class teacher | ATTENDANCE_PENDING | classroom | Attendance | Working |
| Teacher awaiting approval | School admins | MENTOR_PENDING_APPROVAL | user | Approvals | Partial: rule runs, never exercised (no such data) |
| Stock request status | Requester | `request_notifications` table | request | — | Backend only (no screen reads it); untouched |
| Subscription expiry | SuperAdmin | — | — | — | Not implemented (log line only); untouched |
| Realtime announcement socket events | — | — | — | — | UI only (server never emits them); polling covers it |

"Working" and "Fixed" rows were exercised by the tests in 3.8. No notification type was added in this entry.

## 3.8 Tests executed

No real AI call was made: the test server ran with `AIA_AI_GENERATION_ENABLED=false`. The database was backed up first and restored afterwards.

### API tests for this entry: 45 of 45 passed

Passed on the first run, and again after the class-teacher comparison fix described below.

| Area | Tests | Covers (numbers refer to the brief's checklist) |
|------|-------|--------------------------------------------------|
| Teaching scope and courses | SCP-01 to SCP-08 | 6, 7, 8, 10, 14: assigned classes only; admin school-wide; course under its own class + section; course list by role; changing the classroom id refused; other teacher's course cannot be edited or deleted |
| Announcements | ANN-01 to ANN-05 | 11, 12: other class 403; course of another class 400; other teacher's course 403; general class announcement seen by that class only; course announcement; admin unchanged |
| Calendar | CAL-01 to CAL-12 | 13, 15, 16, 18, 19: other class/course refused; stored with school and class; exactly the class's students notified; quote kept; reaches the student's notification list with a routable target; shown on that class's calendar only; course event notifies enrolled students; another school's event invisible here and notifies nobody here; old events back-filled and readable; admin class and school-wide events; no duplicates; edit cannot re-target |
| Class creation and Add Student | CLS-01 to CLS-04 | 1, 2, 3, 4, 5: BSc created; duplicate refused (also different case/spaces); new section; numbered name kept; teacher refused; listed at once; student added once |
| AI assessment | AI-01 to AI-04 | 25, 26: missing classroom 400; unassigned or unknown classroom 400; authorized classroom passes validation; review-save needs an authorized classroom; AI screen lists own classes; manual draft still allowed |
| Question pictures | IMG-01 to IMG-12 | 28–35: upload; content, size, type and role checks; MCQ, multiple-select and numerical keep a picture; AI-reviewed save with a picture; add and remove on edit; forged key refused; survives publish and reload; student sees `hasImage` and never the key; identical bytes returned; other class, other school, student on the teacher route, no login and the public URL all refused; descriptive question; legacy picture and legacy web address kept; legacy access rules; only keys in the database |

Checklist item 9 (search cannot escape scope): the search box filters the list already loaded for that class in the browser, and the server re-checks the submitted course (ANN-01, CAL-01). The box appears only above six courses, and no class in the test data has that many, so the search box itself was not exercised.

Checklist item 27 (grade context reaches the generation layer) is covered by the module test below, since the API test deliberately made no AI call.

### Regression: the 44 notification and publish tests from Entry 2

- On a freshly restored database: **44 of 44 passed** (items 20–24).
- Two adjustments were needed to the test script, both because of this entry's rules: the teacher who creates AI-agent tests for classroom 10 must now be the teacher assigned to it, and the attendance check now counts today's reminders only.
- When the same script was later run on a database already used by the other suite, one count (NTF-01) was off by one because that suite had published one more assessment in the same course. On the clean database it passes.

### AI module test suite

| | Before this entry | After |
|---|---|---|
| Passed | 422 | 432 |
| Failed | 0 | 0 |
| Cancelled | 93 | 93 |

- Ten new tests were added in `tests/scope/teacherScopeAndImages.test.js`: assigned classes only; class-teacher and course-teacher relationships; an unassigned teacher of the same school refused; classroom required for AI paths but not for a manual draft; a Grade 9 and a Grade 12 prompt differ and carry `audience` without the class name; pictures for every type, hidden from students; forged keys refused; descriptive question pictures; upload validation by content.
- Existing tests were updated where the rules changed on purpose: requests now include a classroom, the fixture assigns teachers to their classes, and expectations include the new `audience` field and `image_key` column.
- The 93 cancelled tests are the module's HTTP suites, which cannot start on this copy of the server (they need `server/config/jwt` and `requireTenant`). Unchanged from before.
- One of the new tests found a real defect: the class-teacher check compared a text column with a number, which matched or not depending on the database driver. The comparison was made type-safe in the module and in the server helper, and all suites were rerun.

### Unit tests: `server/tests/notificationText.test.js` — 16 of 16 passed

### Browser checks (Chrome, running app)

| Check | Result |
|-------|--------|
| Add Student: create "BScUI…" section A in place; it appears in the Class list and is selected; a duplicate shows "already exists"; the student is saved into it | PASS |
| Add Student page crashed on first load of the new panel (found here, fixed, rechecked) | Fixed, PASS |
| Teacher calendar: Class shows only Grade 12, Section only BCA-A; course list shows only that class's two courses; event saved with school 20, classroom 10 | PASS |
| Student: bell shows the new calendar notification; clicking opens `/student/calendar?eventId=16` on May 2027 with the event visible | PASS |
| Teacher announcement: class required; course required in "One course" mode; published | PASS |
| Question editor: "Add a picture (optional)" uploads, shows a preview, saves the key; the question list shows the picture | PASS |
| Student attempt page shows the picture, loaded privately; no key in the page | PASS |
| Browser console on the attempt page | No errors |

### Not tested

- The AI generator screen in the browser: AI was switched off for the test server, so the screen was unavailable. Its rules are covered by API and module tests.
- A real AI generation with the new `audience` field (no real AI call was made; the Hugging Face account also has no credits).
- The course search box (needs more than six courses in one class).
- Legacy picture upload and display in the browser (covered by API tests IMG-10, IMG-11).
- The Create Classroom dialog's typed class name in the browser (the same server path is covered by CLS-01, CLS-03).
- GuideBot tours, Arabic/Urdu text, phone-width layouts of the new forms.

## 3.9 Build results

- Frontend production build: succeeded (3432 modules).
- Backend syntax check: passed on every changed file.
- Lint: not available (no ESLint configuration in the project).

## 3.10 Existing-data issues found (reported, not changed)

- **Teacher in one school, classes in another.** `rishi@core5.co.in` belongs to school 20 but is the class teacher of classrooms 4 and 8, and teaches courses 4–18, which all belong to school 15. Under the new rules he sees only his school-20 classrooms (9 and 11) and none of those courses.
- **Courses not attached to a class.** In school 20, courses 19 and 20 have no classroom, so no course appears under any class in the picker until courses are created in, or attached to, a class.
- **Memberships pointing at a missing user.** Classroom 10 and course 20 list student id 50, which does not exist.
- **Duplicate classrooms.** School 15 has two "Grade 10 - A" and two "Grade 10 - C". New duplicates are now refused; these were left as they are.
- **Class teacher stored as text.** `classrooms.classTeacher` holds the teacher id as text; the new checks handle this.

## 3.11 Known limitations

- **Orphan picture files.** A picture that is uploaded but never saved with a question, or is later replaced, stays on disk. Nothing references it and it cannot be reached without its key.
- **Test files left on disk.** Four test pictures and two test PDFs written during testing remain in `ai-modules/ai-assessment-agent/data/question-images` and `data/submissions`. The database was restored, so nothing references them. They can be deleted by hand.
- **No unique index on class + section.** Existing duplicates prevent adding one, so two simultaneous create requests could still both succeed.
- **Legacy assessment questions.** Adding a question to a course assessment still has no ownership check; that was not part of this work.
- **Admin class-targeted announcements.** Admins still announce by audience (students / mentors / both); only teachers got class and course targeting.
- **Plain announcements have no click target**, as before.
- **Transactions share one connection**, as noted in Entry 1.

## 3.12 Backward compatibility

- Text-only questions, existing tests, assignments, results and reports are unchanged.
- Older clients that send only a `courseId` for an announcement or event are still accepted, when the teacher may manage that course.
- Old calendar events remain visible to their own school and course audience.
- Old legacy questions that hold a web address still display.
- A database without migration 009 keeps working; pictures are simply unavailable until it is applied.

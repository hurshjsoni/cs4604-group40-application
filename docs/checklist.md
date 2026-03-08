# Phase 6 Final Submission Checklist

Use this checklist to track final deliverables for **Project Phase 6**.

> Scope note: this checklist intentionally excludes personal reflections and other non-code-only narrative items, and it skips SQL-specific requirements because this project uses Convex.

## 1) User Support (Authentication + Roles)

- [ ] Secure authentication is enabled for all user types.
- [ ] No hardcoded production passwords in frontend/backend logic.
- [ ] User records are stored in the database (not static files).
- [ ] Signup flow works.
- [ ] Login flow works.
- [ ] Logout flow works.
- [ ] Password change flow works.
- [ ] Password fields are masked in UI.
- [ ] Admin bootstrapping is handled safely (manual initial admin creation).
- [ ] Admin can create users from inside the application.
- [ ] Role-based access is enforced (student/provider/admin feature boundaries).
- [ ] Basic injection-safe coding practices are followed (validated inputs, no unsafe query construction).

## 2) Database Connection and Setup Documentation

- [ ] Final report documents frontend-to-backend database connection architecture.
- [ ] Final report includes setup steps and environment prerequisites.
- [ ] Final report includes issues encountered during setup.
- [ ] Final report includes lessons learned from setup/integration mistakes.

## 3) Data Model Documentation (Convex-focused)

- [ ] Initial schema/state is documented.
- [ ] Final schema/state is documented.
- [ ] Any schema changes are justified with reasons.
- [ ] Normalization rationale is documented.
- [ ] Final ER diagram is included and legible.
- [ ] ER diagram explanation includes relationships, cardinality, and participation notes.
- [ ] Each entity/table has documented keys and relationships (Convex IDs and references).
- [ ] Each major entity has at least 5 sample tuples documented (screenshots or table format).
- [ ] Each entity section includes at least one sample query/use case showing functionality.

## 4) System Functionality

- [ ] Core features are implemented for all applicable user tiers (student/provider/admin).
- [ ] CRUD flows are demonstrated through application UI.
- [ ] Database operations are exposed only through application APIs/mutations/queries.
- [ ] No direct end-user table editing workflow bypasses the app logic.

## 5) Reporting Facility

- [ ] At least two meaningful reports are implemented and documented.
- [ ] Reports include aggregation/grouping logic appropriate to project theme.
- [ ] Report outputs are visualized clearly (dashboard cards/charts/tables/screenshots).

## 6) GUI / UX Evidence

- [ ] GUI is operations-focused (not raw table-focused).
- [ ] Naming is user-friendly (not ID-heavy labels for end users).
- [ ] Screenshots cover all main pages by user tier.
- [ ] Screenshots demonstrate Create, Read, Update, Delete operations.
- [ ] Where relevant, before/after screenshots are included for operations.
- [ ] All screenshots are readable and caption-ready for report insertion.

## 7) Stack and Tooling Documentation

- [ ] Final report lists full stack (frontend, backend, auth, database, hosting, tooling).
- [ ] Final report explains why selected tools were used.
- [ ] Build/test/lint workflow is documented.

## 8) Final Report Formatting Items (Implementation-focused subset)

- [ ] Cover page included.
- [ ] Table of contents included.
- [ ] Page numbers included.
- [ ] Introduction section included (background + motivation).
- [ ] Figures/tables/images are numbered consistently.
- [ ] Every figure/table/image has a caption.
- [ ] Every figure/table/image is referenced in written paragraphs.
- [ ] Appendix includes working repository link.
- [ ] Appendix includes working demo video link.
- [ ] Final report exported to PDF and visually verified before submission.

## 9) Repository and Submission Logistics

- [ ] Repository includes required artifacts/directories (adapted for project setup):
  - [ ] `diagrams/` (phase-labeled diagrams)
  - [ ] `code/` (or equivalent app source directories already in repo)
  - [ ] `role/` (team member role text files)
- [ ] Repository remains private until grading/presentation requirements are complete.
- [ ] Instructor/TA access has been granted (Read/Triage or Reporter equivalent):
  - [ ] sehrishbasir@vt.edu
  - [ ] yeana@vt.edu
  - [ ] yuhangzheng@vt.edu
  - [ ] michaelp03@vt.edu
  - [ ] xinchen@vt.edu
- [ ] One team member submission includes:
  - [ ] Repository link
  - [ ] Demo video link

## 10) Final Pre-Submission QA

- [ ] App starts successfully in a clean environment.
- [ ] Lint/typecheck/tests pass on final branch.
- [ ] Authentication and role checks re-tested end to end.
- [ ] Broken links/screenshots in report have been fixed.
- [ ] Final branch/tag to submit is clearly identified.

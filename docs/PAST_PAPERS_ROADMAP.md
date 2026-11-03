# ROADMAP: Past Papers & Recalls Implementation

## Wave 1: Dashboard Reorganization & Feature Routing
- [ ] Task 1.1: Update `src/features/dashboard/dashboardActions.ts`
  - Replace "Saved MCQs" in `getQuickActions` with "Past Papers and Re-calls" (`/past-papers`, FileClock icon, appropriate gradient & badge).
  - Add "Saved MCQs" to `getPersonalizationActions` beside Mistake Book.
- [ ] Task 1.2: Update `HomeDashboardTab.tsx` DASHBOARD_FEATURE_BY_LINK mapping to support `/past-papers` (mapped to `mcqs` feature gate) and keep `/saved-mcqs` mapped to `saved_questions`.
- [ ] Task 1.3: Update Android hardware backhandler (`src/components/backhandler.tsx`) to support `/past-papers` routes cleanly.

## Wave 2: Remove Past Papers Tab from Practice MCQs
- [ ] Task 2.1: In `src/pages/mcq/MCQChapterSelectionPage.tsx`, simplify chapter list to exclusively show Question Bank chapters (`content_type !== 'past_paper'`), remove the tab bar switching between question bank and past papers, and ensure chapter counts reflect question bank.

## Wave 3: Create Dedicated Past Papers Flow
- [ ] Task 3.1: Create `src/pages/pastpapers/PastPaperSubjectSelectionPage.tsx`
  - Cloned and adapted from `MCQSubjectSelectionPage.tsx`.
  - Heading: "Past Papers & Recalls", Step 1 of 3: "Select Subject", back button to `/dashboard`, continue button navigating to `/past-papers/chapter/:subjectId`.
- [ ] Task 3.2: Create `src/pages/pastpapers/PastPaperChapterSelectionPage.tsx`
  - Cloned and adapted from `MCQChapterSelectionPage.tsx`.
  - Header badge: "Past Papers & Recalls", filters exclusively for `content_type === 'past_paper'`.
  - Heading: "Select Paper" / "Select Past Paper", continue button navigates to `/past-papers/settings/:subjectId/:chapterId`.
- [ ] Task 3.3: Create `src/pages/pastpapers/PastPaperSettingsPage.tsx`
  - Cloned and adapted from `MCQSettingsPage.tsx`.
  - Heading: "Paper Settings" / "Configure Past Paper", Start button navigates to `/mcqs/quiz/:subjectId/:chapterId`.
- [ ] Task 3.4: Register `/past-papers`, `/past-papers/chapter/:subjectId`, and `/past-papers/settings/:subjectId/:chapterId` routes in `src/App.tsx` (wrapped with FeatureGate `mcqs`).

## Wave 4: Verification & Testing
- [ ] Task 4.1: Run `npm run build` to verify TypeScript compile, bundles, and pre-rendering.
- [ ] Task 4.2: Verify route links, dashboard layout, and consistency across screens.

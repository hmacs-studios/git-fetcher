# SPEC: Past Papers & Recalls Separation & Dashboard Reorganization

## 1. Goal
1. **Remove Past Papers from Practice MCQs section**:
   - In MCQ practice (`MCQChapterSelectionPage`), remove the "Past Papers" tab so Practice MCQs exclusively shows Question Bank chapters.
2. **Dashboard Actions Restructure**:
   - In Quick Actions: Replace "Saved MCQs" with "Past Papers and Re-calls" (linking to `/past-papers`).
   - In Personalization Actions (beside Mistake Book): Move "Saved MCQs" here alongside Mistake Book and Smart Deck.
3. **Dedicated Past Papers Section**:
   - Independent route `/past-papers` with its own subject selection, chapter/paper selection, and test settings.
   - Exact same UI layout, motion, backhandler, and styling as Practice MCQs for maximum consistency, but tailored with appropriate headings/subtitles ("Past Papers and Re-calls" / "Past Papers & Recalls" / Step headers).
   - In chapter/paper selection for Past Papers, only show `content_type === 'past_paper'` (or Past Paper papers/years).
4. **Consistency**:
   - Subject Selection, Chapter Selection, and Test Settings components/pages reuse the tested design patterns and flow into the quiz engine seamlessly.

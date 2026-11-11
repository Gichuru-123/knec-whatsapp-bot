# TVET programme and series guidance

Checkpoint: 4 November 2026. The original `reg-tvet` article is now an internal comparison record. Public-draft records separate ten programme fee categories and three examination series. All remain unapproved.

## Why the separation matters

A Business TEP Diploma and a Technical Diploma must not inherit each other's basic fee. Higher Diploma and old-syllabus Technical Higher Diploma also have separate tariff records. The programme identifier selects exactly one basic/paper fee pair. Payment-route guidance accompanies it, but the pair is not a complete invoice: papers, projects, practicals, repeat charges and other applicable components still need confirmation.

Registration-window records are separate for November 2026, March 2027 and July 2027. The year in the answer context is the examination year. Registration opening during the previous calendar year does not change that examination year. Dates in these records describe the source circular; they do not independently establish that a window is currently open or that no amendment exists.

## Answer eligibility

The article schema accepts optional `scope.programmes` and `scope.series`. Series use `YYYY-MM`. When present, the approved-answer policy requires an exact matching `context.programme` or `context.series`. The supplied year must match the series year. Corpus validation rejects a series whose year is absent from the article's year scope.

These scope fields are part of the existing content hash, so changing them invalidates an old approval. Existing records without these optional dimensions retain their prior scope behavior. The engine must ask for missing programme or series information rather than guessing it. No live menu or fee calculator has been added.

## Remaining review

Independent fee verification, course eligibility, additional-charge applicability, later amendments and query deadline conflicts remain outstanding. The new records do not prove full coverage of every Business or Technical course. Institution-generated invoices remain the source for an individual's payable amount. Review the coverage report and obtain content approval before public use.

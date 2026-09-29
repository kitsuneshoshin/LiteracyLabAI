# LiteracyLab AI — Change Log

Internal engineering changelog, not linked from the site. One entry per shipped commit, newest first, grouped by day. Generated from git history — run `git log --format="%ad|%h|%s" --date=short` in the repo to regenerate or extend.

## 2026-09-29

- `4a0652e` Make Premium worth the upgrade, rotate interests, add a per-question reading review
- `93b5df2` Make Manage profile and Manage plan their own pages; make the essay timer real
- `50e7147` Fix exam-technique failures at the root and stop one bad spelling entry sinking feedback
- `c068ddb` Replace flag emoji with real flag images so they render on Windows
- `6876538` Stop the model silently skipping exam-technique objectives

## 2026-09-28

- `3267d7f` Fix reading-exercise white space, show the missing overall score, personalise titles, highlight what changed in "revised" text
- `dc692ba` Fix a production crash: stale grading result landing after the student switched exercises
- `79d60f7` Add an internal CHANGELOG.md, generated from git history
- `2b2c776` Widen Workspace layout, add an Account menu, grow reading passages to 5 questions, and fix stale marketing copy
- `39ebb61` Show more glow/grow highlights where the piece supports it; remove the "what will you try next time?" prompt
- `79c441d` Add Google Analytics (GA4) with a consent-gated cookie banner
- `b4573d5` Stop theming prompts on interest; ground framework tip in the student's own writing; fix look-alike-character validation gap
- `0c1c9fd` Homepage: fix broken mobile nav, reorder for orientation before persuasion, remove dead CSS
- `c9b92f9` Be honest when a piece has more than 8 spelling/grammar errors
- `1f913cd` Add a dedicated, always-shown spelling and grammar check to writing feedback
- `d8e22be` Workspace: single-column review after submission, no more duplicated text
- `16884ba` SEO/GEO fixes: remove stale copy, add social preview image, welcome AI crawlers
- `2e88fb7` Restructure the Parent and Student Dashboard into Snapshot / Learning activity / Account
- `baff577` Workspace UX fixes: keep state across navigation, remove dead cards, add a whole-piece score

## 2026-09-27

- `431d1ef` Pick the writing framework by the piece's actual genre, not the student's age
- `02c715f` Vocabulary: inline definitions with a usage example, and a self-test quiz
- `baa0767` Teach a named writing framework alongside every writing submission's feedback

## 2026-09-26

- `7672f8b` Remove prototype notices and the governing-law placeholder after legal review
- `28f9ada` New letter-tiles logo, favicon, and redirect away from the GitHub Pages copy

## 2026-09-25

- `5b1125d` Close direct table access; pause extra learners after a downgrade
- `9dd27cf` Test every pricing-table promise against the real endpoints, per plan
- `05a66f2` Turn on Sentry, and make it deliver reliably without children's writing
- `b5ce6c2` Show prices in each visitor's local currency

## 2026-09-23

- `04d72e5` Move to literacylabai.com
- `6b77d36` Load Sentry from its real CDN, async; remove test marker
- `afbd6e3` Create SANDBOX-TEST.md
- `390fff1` Split pricing into three tiers and build what they actually sell

## 2026-09-22

- `40c7342` Fix bullets splitting into columns when they contain inline markup
- `4f87af0` Fix copy errors and surface features the page never mentioned
- `981e221` Sell the personalisation mechanism, not a list of topics
- `619dd42` Add four missing FAQs, including the biggest unanswered objection
- `fb1c04a` Fix tooltip edge clipping with CSS after the JS clamp proved unverifiable
- `8bd570e` Fix three mobile layout defects exposed by the viewport fix
- `6c54dde` Fix the app rendering zoomed-out on every mobile device
- `fa47e61` Add real trust content instead of fabricated testimonials
- `82fe58c` Add the technical SEO/GEO layer the site was missing entirely
- `85b1b62` Fix a silent ThumbsFeedback save failure, and capture why on thumbs-down
- `c5598b2` Strengthen the zero-score reading fabrication fix with a hard check
- `e1847e8` Fix reading feedback fabricating a correct answer on an all-wrong attempt
- `97670f5` Add tooltips across the dashboard, not just the progress chart

## 2026-09-21

- `071eabe` Add more gridlines and hover tooltips to the progress timeline chart
- `7ad278f` Fix clipped rightmost date label on the progress timeline chart
- `31b18ec` Add standard protective clauses to Terms; make AI-drafting limits explicit
- `001f69c` Fix failed deploy: merge endpoints to stay under Vercel's 12-function cap
- `40edacf` Build real account deletion/export, and align legal docs with reality
- `d77c742` Give every avatar a truly unique icon and drop the color variation
- `9e406f0` Simplify avatar picker copy to a single label
- `56f291b` Give the 50 avatars far more icon variety, de-emphasizing color
- `ccfc7c3` Add 50 preset icon avatars instead of photo uploads
- `289572a` Add a regression test suite and extract testable pure logic
- `273fe18` Add progress time series and a league ladder to peer comparison
- `c9d4e0f` Add anonymous peer comparison: how a learner ranks vs same country+year
- `43ba3a8` Fix character cap shrinking for an older grade at a tier boundary
- `cdc3156` Make writing word/character limits syllabus-based per country and grade
- `5a63daf` Broaden the formal-tone fix and fix a double-punctuation splice glitch
- `bdb7010` Fix casual first-person asides leaking into formal essay revisions
- `0fd021f` Broaden the revision-duplication check to the whole story, not just adjacent text
- `dd3820e` Fix "Your story, revised" duplicating the previous sentence
- `d3b1d5d` Show the student's whole story rewritten, not just a note beside it
- `19283dc` Make the rate limit configurable via env vars
- `60dc75d` Remove the temporary curriculum audit endpoint
- `86d2032` Temporary: add curriculum audit endpoint to verify every country/grade combination
- `3790d3b` Remove temporary step-tracking diagnostic
- `fc6bf8c` Add temporary step tracking to bisect the profile-load crash
- `5dcdc85` Rename reportError helper to logAppError
- `f3fa0f6` Wire up multi-child UI, Sentry frontend, Grow revisions, and the new logo
- `39d4b50` Add rate limiting and multi-child support (backend)
- `582f342` Make Grow suggestions concrete by rewriting the student's own sentence
- `ce0cfac` Update the brand mark to the user-provided logo design
- `3d239bd` Add error monitoring (Sentry)

## 2026-09-20

- `2aaee96` Close the same race condition on grading a submission
- `8b5a7a2` Close the usage-cap race condition on prompt/passage generation
- `9e2363b` Fix Pro accounts seeing "1 of 999 Free Monthly Submissions Used"
- `8022498` Wire up the dead "Read prompt aloud" button for Early Years
- `62fd529` Fix Sign Out and Upgrade to Pro being completely inaccessible on mobile
- `069fa75` Fix the mastery progress dashboard being completely broken
- `f93e1e6` Fix dashboard stat tiles counting the wrong kind of submission
- `fd082db` Fix age-inappropriate "College / Exam Prep" interest defaulting
- `d769bfd` Stop auto-generating (and billing) on every tier/exercise-type switch
- `bcf4d84` Disable the writing textarea once feedback is shown
- `74d6e81` Fix credit-burning tab switches and harden child-profile lookups
- `05e21c3` Fix the real cause of repeated feedback validation failures
- `8652d53` Add annotated feedback and commitment follow-through
- `e8b0e78` Loosen exact target-name matching and add a 3rd feedback generation attempt
- `6b7de50` Surface the actual validation issue when feedback generation fails
- `92bb826` Fix Pro/admin accounts being incorrectly locked out of submissions
- `b62a5df` Temporary debug output on the writing-locked card to diagnose a plan/cap mismatch

## 2026-09-19

- `31cc098` Fix header/mobile banner still showing "Free Plan" for Pro accounts
- `8839da5` Add real Stripe billing for the Pro subscription
- `1936f1b` Add an admin email bypass for the monthly submission cap
- `9cc788b` Rebrand the whole site to the Trusted Advisor design system

## 2026-09-18

- `a06b473` Generate writing prompts with AI instead of one fixed prompt per tier
- `954686b` Generate reading passages with AI instead of a small fixed bank
- `0a61aa9` Wire up random passage selection; fix Pro upsell overclaims
- `152afd4` Expand reading passage bank from 1 to 3 passages per tier
- `2de5988` Add grade_label to the canonical Supabase schema file
- `61e1bd7` Map Canada, UAE/GCC, Singapore and Global ESL to real standards
- `fafd9fd` Add full per-year UK and US curriculum mapping; fix a UK citation error
- `fde0eef` Add full per-year Australian Curriculum mapping and per-grade mastery
- `2bb199b` Add real Australian Curriculum mapping and real per-skill mastery tracking
- `ae5bdb2` Switch AI provider back to OpenAI now that the account is funded
- `03860a1` Show friendly errors instead of raw provider text when AI calls fail
- `07b65d3` Switch AI provider from OpenAI to Google Gemini
- `b310d0f` Add deterministic QA validation for AI feedback with retry-and-correct
- `edc9a04` Switch AI provider from Anthropic to OpenAI
- `4207d30` Differentiate all 3 confidence levels, extend motivation to reading

## 2026-09-17

- `c85af10` Make interests age- and country-targeted instead of one static list
- `40a6bb0` Force first-time setup before workspace access
- `75dd8f6` Wire in Supabase project URL and anon key

## 2026-09-16

- `0573cb8` Add real backend: auth, database, usage-cap enforcement, and LLM feedback
- `e7c65ce` Split confidence by skill, add commitment prompt over satisfaction rating
- `79975f3` Fix stale copy left over from earlier renames and the reading-mode launch
- `efe9dc8` Add "not just a chatbot" section and map US to Common Core/AP
- `9cc2582` Map UK mastery targets to real DfE and AQA syllabus references
- `e7fffb8` Capture confidence and motivation, add reading comprehension mode
- `39d1156` Add 7-region curriculum coverage, Glows/Grows framework, and cost guardrails

## 2026-09-15

- `f0e183a` Fix hero line-break class and a stale internal FAQ link on the landing page
- `0a73788` Rebrand to Mastery Catalyst identity
- `b6bce5f` Rebrand to Trusted Catalyst identity; add Terms, Privacy, and FAQ
- `d1e040a` Add Linear-inspired marketing landing page
- `419c30a` Explain growth tip and micro-mission through the student's interest

## 2026-09-14

- `971e4df` Add LiteracyLab AI interactive prototype


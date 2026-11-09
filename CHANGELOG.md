# LiteracyLab AI — Change Log

Internal engineering changelog, not linked from the site. One entry per shipped commit, newest first, grouped by day. Generated from git history — run `git log --format="%ad|%h|%s" --date=short` in the repo to regenerate or extend.

## 2026-11-10

- `78e78fc` Homepage: fluid layout for every screen, device and browser

## 2026-11-08

- `6b4cb3a` Drop expected 4xx errors in Sentry beforeSend (expired-session noise)
- `f655e1e` Add Pinterest pin builder for parent articles
- `42b2ef2` Expand Story Mountain article, add reading-worksheets guide, refresh translated pages
- `c319a24` Fix tier switcher layout on mobile (2x2 grid, tighter panel)

## 2026-11-07

- `c6f2f41` Fix truncated Polish sentences, Polish tone, consistent Chinese plan wording
- `28d2a34` Translate app pop-ups, server messages and remaining UI messages in all app languages
- `e1099ee` Translate the remaining sign-in screen sentences in all app languages
- `cd61189` App translation: Arabic and Urdu, with right-to-left layout
- `455266f` Repair two small things the live quality check hit: text spelling total, third vocab word
- `48ab2ac` App translation: Punjabi and Bengali
- `24b1e49` Let the owner run the marking quality check from /admin
- `8750d73` App translation: Hindi and Chinese
- `f9f1ecb` Plainer feedback wording: no exam-speak at 8-10, interest comparisons optional, codes out of the glow
- `63b68a5` App translation: Portuguese and Romanian
- `3c41a75` App translation: Spanish
- `0af9b40` App translation: strings found in the real signed-in app, and an explicit prefix marker in the builder
- `e97efe1` Translate the app's own text: Polish first
- `9f29e92` Show each learner's parent Dashboard on the admin page
- `0b4b144` Redesign the admin pieces view to show what the learner saw
- `94590bf` Punjabi and Bengali homepages at /pa/ and /bn/
- `3ac5810` Make the activity report owner-only
- `c3259cb` Add usage-event logging and an owner activity page at /admin
- `7886ad8` Hindi and Chinese homepages at /hi/ and /zh/
- `96fe183` Arabic and Urdu homepages at /ar/ and /ur/, with right-to-left support
- `e38560b` Portuguese and Romanian homepages at /pt/ and /ro/
- `b898cbc` Spanish homepage at /es/
- `aa9fee9` Polish homepage at /pl/, built from the English page

## 2026-11-06

- `9ce7380` Home language: families can read feedback in 10 languages besides English

## 2026-11-04

- `ed082dc` Local currencies: NZ$, HK$, R and ₹ prices alongside the existing ones
- `9865a36` Tests: read pages with LF line endings so the mobile layout checks pass on Windows checkouts
- `5e5516c` Privacy policy: add India (DPDP Act), South Africa (POPIA) and Hong Kong (PDPO) sections
- `91913fa` Add India, South Africa and Hong Kong, and show every new region on the homepage
- `5478083` GCSE English Language article: sharpen title, description and lead around assessment objectives; add AO6 and per-paper FAQs
- `61f6769` Keep supabase schema and email templates out of the public deploy
- `6c155a3` Fix plan/learner claims in How it works, About, FAQ and llms.txt; expand How it works
- `1d94d7f` Test: privacy policy last-updated date is now 4 November 2026
- `2876107` Privacy policy: add New Zealand section (Privacy Act 2020)
- `e89a8bd` Add New Zealand and Ireland: curriculum targets, spelling, word limits, exam styles (NCEA, Junior Cycle, Leaving Cert), guide pages and homepage copy
- `a7f6a7e` Pricing: fill the page container and switch layout at the same width as the table
- `de2ad5f` Pricing: line the comparison table up under the plan cards
- `f3bc86f` Exam-style prompts for Canada (EQAO, OSSLT), Singapore (PSLE, O-Level), UAE and Gulf (Cambridge Checkpoint, IGCSE, AS/A Level) and English learners (CEFR tasks)
- `38de1ec` Pricing: equal-height cards, aligned buttons, centred badge, A$0 currency, table heading
- `8331be2` Responsive pass: wrap long words, scale guide headings on phones, stop CTA button overflowing at 320px

## 2026-11-03

- `00555e3` Results: sections always start closed; stop remembering open/closed per device
- `58d6ef4` Writing results: remove the "AI-written example" note under the model response
- `28a4601` Make support replies flexible: plain text, steps, bullets, bold, links and ordered blocks
- `0896719` Move every email to a wine header band and add a support-reply template
- `d703b44` Reword the history row to say past work can be reopened
- `3751aa0` Open past writing and reading from the dashboard activity history
- `bcc5a97` Save the reason a customer gives when cancelling into the feedback backlog

## 2026-11-02

- `362d8df` Tests: read app.html with plain line endings so they pass on Windows checkouts
- `7196c9c` Pick-a-prompt and pick-a-passage screens: choice cards
- `b189a37` Writing results: every section starts closed (spelling and model response too)
- `d35bf43` Test: reading result now starts with every section closed
- `67c95fc` Reading results: question review starts closed like every other section
- `b07ea38` Reading quiz: passage pinned under the header on laptops and desktops
- `0f189da` Reading results: passage across the page, feedback and question review underneath
- `baef194` Vocabulary cards: pin the I know this button to the bottom so each row lines up
- `6f660d9` Reading quiz: passage across the page with questions underneath; writing editor full width
- `01b3b9a` Vocabulary bank and every reading results state full width, in line with the header
- `3b2adbc` Pick-a-prompt/passage screens full width to line up with the header
- `76411e5` Add -webkit- prefix for the analysing overlay blur (older Safari)
- `ac29a99` Results and reading quiz: full width to line up with the page header
- `e0ee18a` Redesign results and reading quiz layouts for real content
- `9df92bf` Warn paying users that deleting the account cancels their subscription with no refund
- `d8b81cf` Refresh expired session on 401 and stop reporting it to Sentry (Fixes NODE-7, NODE-B)

## 2026-10-30

- `9977782` Results pages: use width on tablet/laptop, passage after review on phones

## 2026-10-29

- `0709d2c` Add 8 new UK reading worksheets (Years 3 to 6)
- `962e1c5` Compose screens to single column; plain reading headings

## 2026-10-28

- `f731477` Writing results: single-column layout, next step first
- `16bfdd6` BCC every user email to support@ (skip admin test sends)
- `0717b46` Check spelling fixes against whole words; add Report a mistake button

## 2026-10-27

- `fbc572a` New guides from Search Console searches: how to read NAPLAN results, kindergarten language arts at home

## 2026-10-18

- `bbd08c9` SEO: 11 plus English guide gets 'at a glance' section, '11 plus' wording and two FAQs
- `cf82145` SEO: GCSE assessment objectives at-a-glance and FAQs; worksheets hub title and heading for 'reading worksheets'
- `59613ba` Daily cache of Analytics and Search Console numbers in site_metrics, for the dashboard
- `b2ae500` Search Console feed: gsc action (searches, pages, countries, devices) using the existing read-only account

## 2026-10-17

- `f5dffe5` SEO and AI-search: short-answer boxes, visible last-updated dates, About page, home FAQ definition, llms-full.txt, IndexNow key

## 2026-10-11

- `168d13c` Ages 5-7: goal notes without grader/examiner words, plus plain-words instruction
- `82645d5` Share card: show a skill that suits the kind of piece (writing skill for writing, reading for reading)
- `7e5052d` Account pages: notebook look for the header, profile form and data links; readable prices on the plan card
- `82eafb3` Add basic browser-protection headers (nosniff, referrer policy, frame, permissions)
- `751c5de` Sign-in and set-up screens in the notebook look; larger phone tap targets; darker dark-mode button text
- `575e53c` Vocabulary tab: notebook look for bank, word of the day, flashcards and quiz
- `fed4f11` Dashboard: notebook look for stat tiles, card titles, target table; fix plan card in dark mode
- `c9c6789` Feedback screens: notebook look for Glow, Grow, score and section cards

## 2026-10-10

- `284ee29` Pin generator for the exam and parent guide pages
- `4ed00ed` SEO: six search pages (NAPLAN, KS2 SATs, 11+, IGCSE, Common Core, AI writing coach), new homepage title and description, llms.txt
- `b5217e8` Pricing table: full-strength text and stronger ticks (dark mode legibility)
- `8816a25` Dark mode: button text now follows the fill behind it (fixes unreadable pills and CTAs)
- `1a867a4` Progress chart: more values on the y axis
- `4906610` Spelling check also drives the spelling/grammar mastery target (Premium)
- `5555d4d` Two-text passages: stack Text A above Text B
- `c545ad4` Shorten the AI-written example note
- `a642fcf` Reject put-in-order questions whose key disagrees with the passage
- `552e5f3` Put-in-order questions: move items with arrows or tap to take one out

## 2026-10-09

- `c9fae8f` FAQ on guide, article and landing pages: open/close questions
- `786b840` Pricing table: sections open and close from their headings
- `27d455f` Hero demo: straight dashed underline for Grow
- `c88ef74` Schema tune-up: logo, sameAs, WebSite; fresh sitemap dates; llms.txt lists articles and worksheets
- `97318f5` Clearer blank-answer feedback; list missed points
- `61ffc0e` Align flag, dot and text on the workspace label line
- `de39ca5` Redesign plan comparison: show only differences, ticks, hairline rows
- `75c7926` Demo sentence: highlight the strength with a highlighter band instead of an outlined pill
- `4b918f3` Fix heading overlap at its cause (font-size-adjust), collapsible plan comparison, tighter highlight pill, no scroll control on the app tab row
- `33bb8a0` Higher contrast: darker ink and body text, deeper wine, lighter cards on a slightly darker page, stronger lines, brighter dark mode
- `e3e3074` App redesign, stage 1: top bar, underlined tabs, serif workspace title, flatter prompt and feedback cards
- `6bbef90` Headings: more room between lines so descenders never touch
- `9daf275` Fix heading overlap (looser lines, no negative letter-spacing) and draw the demo sentence's marks from the real word sizes
- `d952fb6` Site redesign, stage 1: the Notebook theme on every page (warm paper, serif headings, hairline rules, same logo) and a new home page with a parent/learner switch, a step-by-step feedback demo and a country chooser
- `e60f568` Privacy Policy and Terms: invites and shared result cards
- `1bd3db5` Share cards: never cache the public card so Stop sharing takes effect at once
- `a425ca3` Shareable result card: parent-made public card with a first name, year, skill and (reading) score; never any writing; can be switched off; carries the invite link
- `84b7d78` Design ideas: word of the day, written answers side by side with the model, weekly emails with progress bars

## 2026-10-08

- `d7dfaa0` Free plan: stricter standard in feedback and reading questions; vocabulary: I know this clears a word, bars explained
- `4a80844` Redeploy: the parent articles commit did not trigger a deployment
- `69647c2` Nine more parent articles: NAPLAN reading, inference, AFOREST, RACE and CER, vocabulary, True/False/Not Given, tables and graphs, two texts, poetry
- `4f61957` Refer-a-friend: personal link, signed-up + confirmed + finished-first-piece gates, 3 extra pieces each (max 5 friends a month)
- `0e00846` Credit-back: a prompt or passage request that was cut off and never delivered stops counting as a used piece
- `6c54ab8` GA feed: add tracked actions and key events
- `ddaa673` Google Analytics feed: read-only service account report endpoint (api/email?action=ga)

## 2026-10-07

- `c324ace` Email stats: read with a separate RESEND_READ_KEY, explain how to enable
- `875d711` Emails: subject-line A/B test, open/click stats endpoint, time budget for the daily run; hide framework spotlight when the at-work panel shows
- `d83f214` Alignment: spelling convention by country, last-8 mastery window with evidence, clearer year-anchoring note, full-width trend chart, pricing and package copy for new features
- `0dfed8f` Choose your focus: pick the kind of writing, or the kind of text and a reading skill; Premium exam-style prompts
- `44a514f` Marking: a score sent as clear text (6, 6/10) is read as the number instead of costing a retry
- `7f3b3fe` Phone layout: the Writing / Reading / Vocabulary tabs no longer push the page sideways
- `3e2c64c` Dashboard: 'Tell us what you think' feedback card, tied to the signed-in parent
- `34b03c9` Feedback: drop a highlight that is not the student's own words instead of failing; allow a length fact in the exam summary
- `4f781a6` Reading: data texts (table or bar chart), two-text comparison, and 'Show in passage' evidence highlighting
- `237a4ff` Results: open on what helps most, fold the rest with summaries, remember each learner's choice, add open-all button

## 2026-10-06

- `e4a9871` Tighten the framework-name test
- `73d3998` Fix 'built with undefined' on the marked written answer: name the framework from either form of the question
- `c2eb72b` Frameworks: AFOREST persuasive devices in writing, RACE and CER structure for written reading answers, Frayer word cards in vocabulary
- `92fc783` Premium writing: three parts at once (coaching, assessment, rewrites), each retried on its own; shapes built as valid JSON
- `c440513` Vocabulary progress saved to the account so it follows a learner between devices (newest change wins; works from the device copy if the account copy is unavailable)
- `0c3e749` Premium writing: ask for the marking and the long rewrites as two calls at once, retry only the part that failed; PREMIUM_SPLIT=0 switches it off

## 2026-10-05

- `f3243c2` Written answer marking: model names which key ideas were made, server works out the marks; one key idea per mark
- `3bdfd05` Vocabulary redesign: word grid with search and sort, flashcards with a remembered Leitner ladder, one-question-at-a-time quiz with summary; score ring on writing; Practise words call to action after results
- `4e8ef5a` Reading generator: looser quote matching, repair gap-fill with extra choice sets, Premium keeps written answer on the plain fallback, 60s limit for reading-passage
- `49b16f8` Reading short answer: fix review count cut to auto-marked questions; no marking prompt on plans without it; end-to-end and page/server parity tests
- `5da94ea` Premium copy: response rewrite, model response, written reading answers; reading results redesigned as a hero plus passage beside feedback
- `bfc2e24` Reading: one AI-marked short written answer for Premium (Elementary and up)
- `1889486` Writing feedback: two-column layout on wide screens
- `8fae656` Reading comprehension: true/false/not given, evidence, order, match, gap-fill styles and varied text types incl. poems
- `20f3d9a` Sentence-length check no longer fails feedback on the last attempt; give the grading function 60 seconds
- `7b5c78e` Ask for a fuller model response, part by part
- `41c5585` Age-appropriate writing frameworks, a named reading strategy per age band, and a word-building trick for vocabulary
- `0872c4e` Drop a suggested rewrite that restates the student's own wording instead of failing the whole feedback
- `8ea3c65` Fix ambiguous column names in the usage-counting function
- `634de8d` Count OpenAI usage per day and email the owner when a day's spend passes a level

## 2026-10-04

- `e4eb4c8` Lengthen the five exam articles (NAPLAN, SATs, 11+, GCSE, Common Core) with checked detail
- `d4ca610` Articles: shorter meta descriptions
- `6b2e51d` Articles: exact NAPLAN and SATs details from the published sources, US spelling
- `a71e833` Add twelve articles for parents and an articles hub
- `5a0db43` Redeploy to pick up OPENAI_MODEL=gpt-5.4-mini
- `1d5f8d2` Model response length: allow for models writing short, ask in sentences
- `121f4b2` Let a signed-in admin run the quality check by hand
- `6d0bf90` Quality check can run on another model (?model=) and list available models, without changing production
- `5a7e343` Response revised, model response with framework labels, exam bands on writing objectives only
- `d6bcf94` Add three landing pages; remove internal utm tags from guide and worksheet links
- `3a54ad7` Calibrate writing feedback to the real length: score/band caps, honest reason, faithful corrected story
- `a053482` Add eight Australian worksheets (Years 3 to 6) as a third country
- `dd6c99d` Send failed passage checks to Sentry (NODE-8)
- `2214718` Worksheets: stop multiple-choice answers being guessable by length, and mirror order steps in answer keys
- `5390bfc` Add eight US worksheets (Grades 3 to 6) and make worksheets country-aware

## 2026-10-03

- `fd214e4` Add the Pinterest website-claim tag to the homepage
- `f819a07` Publish nine more reading worksheets after a full review and fact-check
- `50f7115` Free printable reading worksheets for UK Years 3 to 6

## 2026-10-02

- `c1fa761` Guides: use small flag images instead of flag emoji (which show as GB/US letters on Windows)
- `2daecbe` Relax two length rules a little: sentence length may overshoot the age cap by 2 words, and a very short piece's corrected story may grow more
- `d5e72ad` Fix the quality check: patterns damaged by hidden control characters never matched, so pieces that a customer would receive were reported as failed
- `d218f75` Weekly quality check: a time budget so a run always finishes and saves before the host's 60-second limit
- `ec7d6e7` Add Guides to the main menu
- `89cbf3f` Add the Google Search Console verification tag to the homepage
- `e22b67f` Mobile best practice: comparison table as compact cards, slim header, 44px touch targets, no sideways scrolling
- `0333060` Prompt generator: keep personal and imaginary topics out of facts, opinions and formal letters; smoother wording
- `aeb2a9f` Add the free writing-prompt generator at /learn/prompts/
- `0359df6` Add /learn/ parent guides: a plain-English page for every year group in every region, built from the app's own curriculum data
- `71e8e18` Weekly quality check now retries like a real customer's piece and reports both numbers

## 2026-10-01

- `b798345` Fixes found by the first weekly quality run: worked example for the second step, and no false alarm on inflected words
- `5ac8aad` Update the vercel.json test for the weekly quality-check schedule
- `c686c76` Weekly marking-quality check: sample pieces through the real prompt and validator, one summary row a week
- `bc8e191` Give every plan the corrected story on writing feedback, not just Premium
- `45c9f28` Friendlier curriculum labels: country first, official name second
- `b49d0d1` In-app feedback comments flow into the backlog; dashboard shows three cards in a row
- `da6e314` Premium: full corrected rewrite of the student's story, and more highlights for longer pieces
- `2ad0791` Premium second step: must be specific, quote the student's own words, and never use an analogy

## 2026-09-30

- `35e263e` Add a full billing journey test: Free to Core to Premium, failed payment, recovery, cancel
- `eab0fc8` Add Forgot password, and a choose-a-new-password screen
- `53bce37` Redeploy so the email skip list change takes effect
- `3313528` Use the Tokyo PO box as the postal address in every email
- `f9fe3af` Add an email skip list, and switch customer emails on
- `8fe109e` Limit feedback to relevant emails, fix what broader testing found, and recover safely from failed payments
- `b9ae7e2` Set Premium to 15.99 a month
- `7f689f3` Build the Core, Premium and billing emails, and branded sign-in emails
- `7dab3c4` Name the week's focus skills in the Free weekly summary
- `c2152fe` Ask 'Was this email useful?' only on the welcome and weekly emails
- `8931621` Pace the daily email run and allow it 60 seconds
- `f7768d4` Add an owner-only action that sends test copies of every Free email
- `d4c6a69` Redeploy so the postal address setting takes effect
- `608f7da` Redeploy so the new email settings take effect
- `f06705e` Log each daily email run so a dry run can be checked from the deployment logs
- `c7b176c` Build the Free-plan emails, unsubscribe, and a feedback form that feeds the backlog
- `b1f6f9f` Add the branded email template every LiteracyLab AI email will use

## 2026-09-29

- `6839045` Add analytics to the legal pages, key conversion events, and a privacy section
- `b15a765` Fix the progress chart being a flat 50% line for everyone
- `fe1dfca` Stop the admin plan page saying it is billed via Stripe
- `7dc56db` Make the Premium second step a real next level, not a gimmick
- `d7e2ad1` Give a fresh set of words on every new vocabulary quiz
- `72a08aa` Stop reading exam scoring saying not attempted or giving writing advice
- `c2cc4e7` Explain reading answers through the learner's interest, and speak to them as you
- `0e89284` Fix 0-correct reading feedback failures and split passages into paragraphs
- `74cd2c2` Move the vocabulary bank into its own workspace tab, for Core and Premium
- `c65e9e5` Make reading passages and writing prompts harder for every age group
- `70e4c94` Refresh CHANGELOG.md with the latest commits
- `d29e92c` Fix plan dead ends in the app and guard the pricing copy against drift
- `d0e387a` Stop plan leaks on the server and add a full plan-by-plan test matrix
- `48bb238` Refresh CHANGELOG.md with the latest commits
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


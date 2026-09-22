# Sandbox test branch

This branch (`stripe-sandbox-test`) exists only to get a Vercel Preview
deployment for testing the 3-tier Stripe pricing flow against Stripe
Sandbox (test mode), isolated from the live production site and its
`sk_live_` key.

This file has no effect on the app - it exists purely so this branch has
a commit distinct from `main`, since Vercel deploys per-commit and a
branch pointing at an already-deployed commit doesn't trigger a new build.

Safe to delete once sandbox testing is done and this branch is no longer
needed.

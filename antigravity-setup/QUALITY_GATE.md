# Definition of done
- Every confirmed use case maps to actual implementation and a test or documented manual verification; no unexplained source omissions.
- Clean dependency install using committed lockfile(s); lint and production build pass; no missing imports, type/syntax errors or accidental secrets. Review dependency audit findings; do not blindly force upgrades.
- Real database persistence across restart, seed idempotence, health check, server/client startup; all required env documented.
- Auth success/failure, unauthorized requests, cross-role and cross-user access denial, validation, not-found and conflict responses tested.
- Booking happy path and all supported cancellation/approval/state changes tested; parallel conflicting bookings cannot both succeed; capacity remains consistent after failure/cancellation. Adapt to actual diagram states.
- Browser end-to-end tests for each confirmed role and main use case; check refresh, navigation, responsive widths, keyboard, loading/empty/error states, no unexpected console errors or failed API requests. No emojis in visible UI; verify rendered text and authored strings. Verify visual hierarchy and contrast.
- Buttons and links function, demo data is fictional, no fake payment success, no production secrets, no disabled tests to hide defects.
- README supports a fresh Windows checkout; traceability, API reference and test evidence complete. Include actual commands and exit codes, failures, screenshots when available, and remaining limitations.
Completion rule: if any mandatory check cannot run or fails, state NOT FULLY VERIFIED and list exact blocker plus recovery steps. Never report complete merely because files exist. Do not claim flawless or production-ready without evidence.

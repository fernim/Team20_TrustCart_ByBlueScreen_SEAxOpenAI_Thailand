# TrustCart — three-role demo

The core story is **seller evidence → AI readiness → deterministic checks → reviewer when uncertain → a product tick for the buyer**. A registration number alone does not prove a physical product is genuine. The registry and subscription are synthetic; this is an independent Shopee-style demonstration, not official Shopee or Thai FDA certification.

## Prepare

1. Install dependencies and start the app using README instructions. No password configuration is needed: select a demo role on the sign-in page. Anyone can select a role in this demo.
2. Open `/login` in separate browser profiles for `seller1`, `seller2` and `reviewer`. The public storefront needs no login; a `buyer` account is also available.
3. Use **Replay** for a deterministic offline presentation. **Live** sends submitted documents to OpenAI only when configured. A live outage must show `UNKNOWN`, never a replay approval.
4. Use a disposable demo database. Products and document history persist; there is no destructive reset button in this flow.

## Show a passing product

1. As seller1, open **TrustCart · ฿299/month** in the top-right header menu and activate the demo plan. The menu disappears while the plan is active. Explain that activation is simulated, unlimited for the month, and collects no payment.
2. In Synthetic demonstration examples, choose **Matching supplement** and **Load example listing**. Save the product. Its images, price and stock are already visible at **View product**, with no badge yet.
3. Choose **Verify this product**. The stepper stops at **Documents** and identifies missing evidence. Choose **Upload selected example documents**; this uploads the matching synthetic label, registration certificate and advertising permit and explicitly selects Replay.
4. Choose **Start check**. The result becomes `APPROVED`. Open View product; click its blue tick. Buyers see only a short status, not evidence or the audit trace.
5. Edit and save the title, price or stock. The same customer URL shows the new values and loses the tick. A new verification is needed; old submissions stay in history.

## Show human review and resubmission

1. Load **Unclear document**, save, request verification, upload its example documents and run Replay. The result is `PENDING` / **Reviewer required** because the label is unclear and extraction confidence is below 0.75.
2. As reviewer, open the **Agency** workspace at `/agency`. Choose **Shopee** and **To review**, then open the product report and choose **Start review**. Inspect the listing snapshot, private originals, AI fields/quotations, R-01–R-05 and expandable audit/revision history. Switch Thai/English in the header; returning to the queue preserves its filters.
3. Enter an actionable reason and choose **Request documents**. The seller chooses **Refresh products** (or **Refresh status**) to see **Seller action** with those instructions. No customer badge appears.
4. As seller, choose **Resubmit**, upload clearer or additional documents and run another assessment. Submission history preserves both revisions. Replay only accepts its original exact fixtures; altered evidence should use Live or be inspected by a reviewer after an unavailable/uncertain result.
5. To demonstrate human approval, inspect each required original, tick its inspection checkbox, enter the identity fields read from the documents, and provide a reason. Approve reruns deterministic rules. A prohibited claim, unsupported registry, stale hash or superseded listing cannot be approved.

## Show denial and separation

- Choose **Prohibited claim**, save and run its matching replay documents. It becomes `DENIED`; the report identifies the prohibited phrase. It remains a normal customer product without a tick.
- Sign in as seller2. Seller1's listings and documents are inaccessible. Publish a normal product without activating a plan: it is publicly visible without verification.
- Choose Live without configured provider access to demonstrate `UNKNOWN` and a retry/reviewer path. Do not describe this as a product failure or silently switch to Replay.

## Scope

Private evidence supports PDF, PNG, JPEG and WebP up to 2 MiB each, five active files, and ten unencrypted PDF pages. Text-PDF quotations are checked against document text. Image-only/scanned documents require visual reviewer confirmation. Supplements are the first automatic path; other categories require manual review. Checkout, real billing, OAuth, live government registries and live marketplace feeds are not part of this demo. The Agency workspace is local and shares persisted submissions and decisions with the storefront; Lazada has an empty state. Agency is a workspace name, using the existing reviewer account.

Run `.venv/bin/python -m pytest -q`, `npm test`, and `npm run test:browser` before presenting. On Windows use `.venv/Scripts/python`. This change does not deploy or validate a hosted environment.

The legacy judge run sheet remains at [docs/JUDGE_QA.md](docs/JUDGE_QA.md); its workspace scenarios are diagnostic references, while the role-session walkthrough above describes the connected product flow.

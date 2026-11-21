# From a listing flag to a decision

**TrustCart · Team BlueScreen · Sea × OpenAI Regional Codex Hackathon Thailand**

## Why this matters

Thailand already has marketplace screening. The Thai FDA reported exchanging product names, registration numbers, and authorization status by API with marketplace partners and sharing blacklists for screening. In May 2026 the Thai government reported blocking more than **121,494 illegal health-product ads** since 2023 and working with **10 online platforms** on AI and API screening. These are government enforcement figures, separate from TrustCart's results. [Thai FDA marketplace partnership](https://en.fda.moph.go.th/news/thai-fda-partners-with-leading-e-marketplace-platforms-to-expand-market-access-for-health-products-/) · [Thai government enforcement release](https://www.thaigov.go.th/th/news/163657)

A marketplace needs a disposition when screening cannot settle a case. The seller can provide evidence, a reviewer can record the reason for a decision, and the shopper sees a badge only for the eligible current listing revision. The pilot would integrate TrustCart through an API and give review teams the same case in Agency.

## Show the decision in the app

1. Choose **Seller 1** in the demo, open a supplied synthetic example, and submit its evidence in **Replay** mode. Use the uncertain documents example to demonstrate the staff handoff.
2. Choose **Reviewer**, open the case in **Agency**, and use **Decision replay** to select **Listing submitted**, **Evidence assessed**, and **Review started**. Each milestone comes from the saved audit trail.
3. Inspect the originals and record the supported decision. Reopen the report to see the decision milestone and follow **View product** to check the resulting shopper badge. The replay is withheld if the server cannot verify the audit.

Replay shows synthetic evidence and a mock registry. A recorded passing result covers the current demo revision and its applicable checks. The showcase uses demo roles, so the pilot would require verified user identities, authorized registry access, and appropriately protected evidence.

## Business case to test

The proposed buyer is a marketplace's trust and safety team. Pilot a prepublication API with a human review queue and compare it with the team's existing workflow on the same labelled cases. Measure **median time to decision**, **reviewer minutes per completed case**, **false approvals and denials**, and **the share of cases that can clear after seller correction**.

Illustrative unit economics: 10,000 listings per month × 30% sent to people × 3 minutes saved per reviewed listing = **150 reviewer hours per month**. These assumptions are a pilot target for measurement. Test a monthly API minimum plus usage pricing against measured review savings and operating cost.

## Show how Codex was used

Use the `[codex]` Decision replay commit and its checks as evidence. Codex wrote the failing interaction tests, built the bilingual replay, and exercised the role flow locally with the existing desktop and mobile browser suite. Team BlueScreen defined the product policy and demo scope. The replay reads existing decisions and keeps the rules and reviewers in control.

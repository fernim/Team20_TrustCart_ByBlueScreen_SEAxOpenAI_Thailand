# TrustCart — Hackathon Registration Statement

Submitted with Team BlueScreen's application to the Sea × OpenAI Regional Codex Hackathon Thailand (21 November 2026). The statement is kept word for word below; the table after it maps each commitment to where it is delivered.

## Registration statement

We want to build TrustCart, an AI-powered verification platform that helps shoppers buy products safely and helps legitimate sellers earn trust on e-commerce marketplaces in Thailand.

**The problem:** Health products and supplements are among the hardest items to trust online. Shoppers cannot tell whether a product is genuine, distinguish authentic, properly registered, and honestly described. Meanwhile, sellers face category-specific licenses, standards, advertising rules, documentation and regulatory requirements.

The Thai Food and Drug Administration (Thai FDA) has partnered with Shopee and other marketplace to detect and remove noncompliant health products online (Tilleke & Gibbins, 2025). Yet checking a product today means leaving the listing and searching a registry by hand, which confirms that a number exists but not that it belongs to this product or supports its claims. Sellers, meanwhile, get little guidance on what a compliant listing needs before they publish.

**Target user:** Thai online shoppers buying health products and supplements from unfamiliar sellers, especially when listings claim to treat, prevent, or reverse disease. Small - medium sellers who need to know what a compliant listing requires before they publish, and a way to prove it. Secondary users are regulators and marketplace reviewers, who get risk-ranked listings with traceable evidence.

During hackathon, we will build a focused web-based prototype using synthetic supplement listings and a mock product registry and predefined validation rules. Our end-to-end demonstration will show an AI agent detecting a registration mismatch, requesting additional evidence from a simulated seller, checking the information, and updating the shopper-facing report with a traceable explanation.

We will use Codex throughout development to accelerate frontend and backend implementation, build and integrate AI agent workflows, generate automated tests, and help debug and refine the prototype. This will allow us to focus on verification accuracy, agent reasoning, and delivering a functional end-to-end experience within the hackathon timeframe.

Our goal is to make online marketplaces safer, more transparent, and more trustworthy through proactive AI verification, with uncertain cases escalated for human review.

Reference: Tilleke & Gibbins, "Thai FDA Partners with E-commerce Platforms to Regulate Health Products Online", 2025.

## Commitments and where they are delivered

| Commitment in the registration | Delivered in the prototype |
|---|---|
| Helps shoppers buy safely | Trust Badge and report on every listing; verdict with reasons in Thai or English |
| Helps legitimate sellers earn trust | Pre-publication check, compliant copy suggestion, evidence upload, Approved badge after a fix |
| A number exists but may not belong to this product | Rule R-01 matches the number to the product name and licence holder (listing L1) |
| Claims to treat, prevent or reverse disease | Rules R-02 and R-03 in Thai and English, with AI extraction of euphemisms |
| Sellers get guidance before they publish | `POST /v1/verifications` pre-check and `POST /v1/listings/suggest-copy` |
| Regulators and reviewers get risk-ranked listings with traceable evidence | Review queue ranked by RISK-v1; per-rule results; hash-chained audit with tamper check |
| Synthetic supplement listings, mock registry, predefined rules | Seven synthetic listings; mock registry behind a Registry Adapter; rules R-01 to R-05 |
| Agent detects a mismatch, requests evidence, checks it, updates the report | Demo path L1: R-01 fails, evidence requested, R-05 checked, report and trace updated |
| Uncertain cases escalated for human review | Confidence below 0.75, conflicting data or registry outage goes to a reviewer; outage shows Unknown |
| Codex for implementation, agent workflows, tests and debugging | `AGENTS.md` safety rules, test-first workflow, 20 automated tests; `[codex]` commit count recorded at code freeze |

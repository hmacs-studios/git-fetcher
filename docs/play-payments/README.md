# Google Play payments preparation — Medmacs

Prepared 19 October 2026 from the local `git-fetcher` app and `medmacs-payments` service. This is a preparation pack, not a Play Console submission or a working Play Billing integration.

## Integration update — 3 November 2026

The Android app now uses the supplied RevenueCat public Google SDK key. The Capacitor purchases plugin is registered in the Android project. Purchases and restores identify the signed-in Supabase user. Package selection rejects missing plan/duration combinations instead of buying the first available package. Access resolution uses active Iconic/Premium entitlements and does not use a selected plan or a saved browser value as proof of purchase.

Validation: production web build and focused package/entitlement checks. Native Play purchase testing and console configuration have not been verified. The preparation findings below are historical, from 19 October.

Still required before declaring payments live:

- Revoke/rotate the RevenueCat secret previously embedded in the client, using RevenueCat project settings. Only the public SDK key belongs in the app.
- Confirm the Google Play service account connection, active subscriptions/base plans, and current RevenueCat offering. Use custom packages `iconic_monthly`, `iconic_yearly`, `premium_monthly`, `premium_yearly`; attach products to the corresponding `iconic` or `premium` entitlement.
- Verify the payment server independently checks RevenueCat purchase status for the authenticated user, stores genuine transaction identifiers idempotently, and processes renewal/expiration/refund notifications. The existing client confirmation uses a generated order ID and is not proof of purchase.
- Replace client-side profile plan writes with verified server fulfillment and restrict profile plan/expiry updates at the database. The payment server source is not included in this workspace; this security boundary has not been verified here.
- Build and upload an Android internal-test release, then test purchase, cancellation/pending, restore, account switching, expiration and refund using license testers on a Play-installed build.

## Current payment flow evidence

These are browser captures of the existing app at `localhost:8080`, at a narrow viewport. They show the real interface, with no payment initiated. They are **not** screenshots of Google Play's purchase sheet or a native Android build.

| Screen | Capture |
| --- | --- |
| Iconic monthly plan and price | [pricing-iconic-top.jpg](screenshots/pricing-iconic-top.jpg) |
| Iconic plan benefits and upgrade button | [pricing-iconic-benefits.jpg](screenshots/pricing-iconic-benefits.jpg) |
| Iconic yearly plan and price | [pricing-iconic-yearly.jpg](screenshots/pricing-iconic-yearly.jpg) |
| Checkout order summary and promo field | [checkout-order-summary.jpg](screenshots/checkout-order-summary.jpg) |
| Easypaisa/PayFast choices, wallet field, legal links, pay button | [checkout-methods.jpg](screenshots/checkout-methods.jpg) |

No success, failure, gateway, or receipt screenshot was captured because doing so would require a real or sandbox transaction. Do not present these existing checkout captures as Google Play Billing screens.

## Verified app facts

- Android package ID: `com.hmacs.medmacs` (`capacitor.config.ts`).
- The app sells digital learning access. Pricing is loaded from Supabase `pricing_plans` (`src/pages/Pricing.tsx`).
- Current public PKR prices shown in the app: Iconic 799 monthly / 9,499 yearly; Premium 1,599 monthly / 18,999 yearly. Confirm these in Play Console before activation because prices can change.
- Checkout currently opens Easypaisa or PayFast (`src/pages/Checkout.tsx`), backed by `medmacs-payments/src/index.ts`. PayFast appeared disabled in the captured session.
- Existing payments grant 30 or 365 days of access by setting `profiles.plan` and `profiles.plan_expiry_date`; the backend does not implement automatic renewal. Current "Cancel anytime" and renewal wording should be reconciled with the actual product model.
- `src/pages/RefundPolicy.tsx` refers to subscription renewals and reminder emails, which may not match today's fixed-duration flow.
- No Google Play Billing client, Play purchase verification, or Play Real-time Developer Notifications handler was found in the reviewed app/payment service.

## Proposed Play catalog — draft, not created

The current fixed-duration model most closely matches **prepaid subscription base plans**. This needs a product decision: Play's 1-month/1-year duration is calendar based, while today's backend grants exactly 30/365 days. If the business wants recurring charges instead, use auto-renewing base plans and update the app disclosures, cancellation path, and backend lifecycle first.

| Subscription ID (draft) | Base plan ID (draft) | Type | PKR price to confirm | Access |
| --- | --- | --- | ---: | --- |
| `medmacs_iconic` | `month-prepaid` | 1 month prepaid | 799 | Iconic |
| `medmacs_iconic` | `year-prepaid` | 1 year prepaid | 9,499 | Iconic |
| `medmacs_premium` | `month-prepaid` | 1 month prepaid | 1,599 | Premium |
| `medmacs_premium` | `year-prepaid` | 1 year prepaid | 18,999 | Premium |

`Free` is not a paid product. `Executive` uses a custom quote and should remain outside this initial Play subscription catalog until its exact in-app offering is defined. Treat these IDs as a proposal; activated Play base-plan IDs cannot be changed or reused.

## Prerequisites and current status

| Item | Status / action |
| --- | --- |
| Play Console app for `com.hmacs.medmacs` | Existing account/app access not verified. Owner must confirm the package in Play Console. |
| Google payments/merchant profile | Not verified. Owner must complete legal business name, physical address, contact, bank, tax and identity details directly in Google. Pakistan supports developer and merchant registration. |
| Business decision: prepaid or auto-renewing | Open. Prepaid is the closest fit to the current fixed-duration flow. Confirm duration and whether top-ups are allowed. |
| Subscription catalog | Draft above. Create/activate in Play Console only after billing-enabled Android bundle is uploaded and business terms are confirmed. |
| Android billing client | Missing. Add Google Play Billing to the native Android app (or a maintained Capacitor bridge) and use it for Play-installed Android purchases. |
| Play-specific purchase entry | Missing. A Play-distributed build must not direct users buying these digital plans to Easypaisa, PayFast, an external checkout, or a webview. Keep existing methods only in eligible non-Play channels. |
| Backend verification | Missing. Verify each purchase token with the Google Play Developer API before granting access; store token/order/product, acknowledge purchases, and make fulfilment idempotent. Do not trust the client price or success callback alone. |
| Lifecycle sync | Missing. Configure Play Real-time Developer Notifications through Cloud Pub/Sub; refresh status using the Developer API for renewals/top-ups, cancellation, expiration, refunds, revocations, and pending purchases. |
| Account/subscription page | No clear Play manage/cancel link found. Add the Play Subscription Center link or equivalent online cancellation method once Play subscriptions are sold. |
| Terms, pricing and refund copy | Needs review. State full charged price, duration, whether it renews, how to extend/cancel, and the Play refund route. Remove or qualify current "Cancel anytime" and renewal claims if prepaid is chosen. |
| Review access | Provide Google an active demo account and instructions to reach the plan page. Do not store credentials in this repository. |
| Internal billing QA | Pending after integration: Play internal test build, license testers, purchase, pending/cancelled purchase, restore, expiry/top-up and refund cases. |
| Final screenshots | Capture on an actual Play-installed Android build after integration, including plan selection, Google Play purchase sheet and entitlement screen. Browser captures above are only current-flow evidence. |

## Suggested implementation order

1. Confirm prepaid versus auto-renewing and the four prices.
2. Complete/verify Play Console payments profile and app identity.
3. Implement Play-only billing UI and native purchase client; keep web checkout separate.
4. Implement server verification, entitlement sync and RTDN before granting Play access.
5. Update plan/refund/cancellation copy, then upload a billing-enabled internal-test bundle.
6. Create and activate catalog, add license testers, capture native screenshots, then submit for review.

## Official references

- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Google Play subscriptions policy](https://support.google.com/googleplay/android-developer/answer/9900533)
- [Create and manage subscriptions/base plans](https://support.google.com/googleplay/android-developer/answer/140504)
- [Play Billing setup](https://developer.android.com/google/play/billing/getting-ready)
- [Play Billing backend integration](https://developer.android.com/google/play/billing/backend)
- [Merchant registration countries](https://support.google.com/googleplay/android-developer/answer/9306917)
- [Payments profile setup](https://support.google.com/googleplay/android-developer/answer/7161426)
- [Play review account requirements](https://support.google.com/googleplay/android-developer/answer/10788890)

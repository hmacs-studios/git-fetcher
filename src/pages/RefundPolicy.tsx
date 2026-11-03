import { ArrowLeft } from 'lucide-react';
import Seo from '@/components/Seo';
import { renderMarkdown } from '@/utils/format';

const RefundPolicy = () => {
  const refundPolicyContent = `
# Refund Policy

**Last updated:** June 12, 2025

Thank you for choosing Medmacs. We want to ensure you have a rewarding experience while you explore, evaluate, and purchase our MBBS learning tools.

As with any shopping experience, there are terms and conditions that apply to transactions at Medmacs. By placing an order or making a purchase at Medmacs, you agree to the terms set forth below along with our Privacy Policy and Terms and Conditions.

---

## Standard Refund Terms

We believe in the quality of our AI-integrated Medical platform. However, we understand that sometimes a service may not be the right fit for your specific study style.

* **Digital Products:** Since our Service provides digital content and AI-generated insights that are accessible immediately upon purchase, we generally offer a **7-day money-back guarantee** if you have not significantly utilized the premium features.
* **Usage Limits:** If more than 10% of the premium question bank has been accessed or more than 50 AI-generated tutor queries have been made, the service is considered "consumed," and a refund may not be issued.

---

## How to Request a Refund

To request a refund, please contact us within 7 days of your initial purchase.

* **Email:** Send your request to [hi@medmacs.app](mailto:hi@medmacs.app).
* **Information Needed:** Please include your account email address and the transaction ID from your receipt.

Once we receive your request, we will inspect your account usage and notify you of the approval or rejection of your refund.

---

## Processing Refunds

If your refund is approved, it will be processed, and a credit will automatically be applied to your original method of payment within 5-10 business days.

* **Late or Missing Refunds:** If you haven't received a refund yet, first check your bank account again. Then contact your credit card company; it may take some time before your refund is officially posted.
* **Sale Items:** Only regular priced items may be refunded. Unfortunately, sale items or promotional bundles may not be eligible for refunds unless otherwise stated.

---

## Exceptions

The following items are non-refundable:

* Subscription renewals that were not canceled before the billing date (reminder emails are sent 3 days prior).
* Individual tutoring sessions that have already been completed.
* Accounts that have been banned due to a violation of our Terms and Conditions (e.g., sharing accounts or attempting to scrape AI data).

---

## Contact Us

If you have any questions about our Refund Policy, you can contact us:

* By email: [hi@medmacs.app](mailto:hi@medmacs.app)

* By visiting this page on our website:
    [instagram.com/medmacs.app](https://instagram.com/medmacs.app)
`;

  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <Seo
        title="Refund Policy"
        description="Learn about the refund policy at Medmacs, including refund eligibility, request steps, and processing timelines."
        canonical="https://medmacs.app/refund-policy"
      />

      <div className="sticky top-0 z-50 border-b border-border/60 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto grid h-14 max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
          <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
          <h1 className="brand-wordmark text-xl text-foreground">Refund Policy</h1>
          <div aria-hidden="true" />
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:px-6 lg:py-12">
        <header className="mx-auto mb-8 max-w-3xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase text-primary">Legal</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Refund Policy
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Eligibility, timelines, and steps for requesting a refund from Medmacs.
          </p>
        </header>

        <article className="mx-auto max-w-3xl rounded-lg border border-border/70 bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8 lg:px-10">
          {renderMarkdown(refundPolicyContent, { skipFirstH1: true })}
        </article>
      </main>
    </div>
  );
};

export default RefundPolicy;

// Augment the Wrangler-generated Env type with the secret bindings that are
// injected via `wrangler secret put` (not present as vars in wrangler.jsonc).
// Kept in a module so it survives regenerating worker-configuration.d.ts.
declare global {
  interface Env {
    SUPABASE_SERVICE_ROLE_KEY: string;
    PAYFAST_MERCHANT_ID?: string;
    PAYFAST_SECURED_KEY?: string;
    EP_USERNAME: string;
    EP_PASSWORD: string;
    EP_STORE_ID: string;
    EP_ACCOUNT_NUM?: string;
    RESEND_API_KEY?: string;
    REVENUECAT_SDK_KEY: string;
    REVENUECAT_SECRET_KEY: string;
    REVENUECAT_WEBHOOK_AUTH: string;
    REVENUECAT_PROJECT_ID: string;
  }
}

export {};

import { Capacitor } from '@capacitor/core';
import {
  Purchases,
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
  type MakePurchaseResult,
} from '@revenuecat/purchases-capacitor';
import { supabase } from '@/integrations/supabase/client';

// Public Android SDK key; secret RevenueCat keys must stay on the server.
const PLAY_BILLING_API_KEY = 'goog_AkiiWNPcRyBeXBGPkMWSXgikWal';

let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

export const isPlayBillingSupported = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Initializes the Google Play Billing system via RevenueCat.
 * Safe to call on web/iOS — will simply no-op and return false.
 */
export const initPlayBilling = async (userId?: string): Promise<boolean> => {
  if (!isPlayBillingSupported()) {
    return false;
  }

  if (isInitialized) {
    return true;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const apiKey = PLAY_BILLING_API_KEY;
      if (!apiKey) {
        console.error('[PlayBilling] Android billing SDK key is missing.');
        return false;
      }

      if (import.meta.env.DEV) {
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      } else {
        await Purchases.setLogLevel({ level: LOG_LEVEL.INFO });
      }

      await Purchases.configure({
        apiKey,
        appUserID: userId || undefined,
      });

      // Listen for customer info updates (e.g. renewals, cancellations, grace periods)
      await Purchases.addCustomerInfoUpdateListener(async (info: CustomerInfo) => {
        // ONLY sync with server if there is an active, verified plan entitlement
        if (getActivePlanEntitlement(info)) {
          await confirmPlayBillingWithServer().catch((error) => {
            console.warn('[PlayBilling] Server entitlement sync failed:', error);
          });
        }
      });

      isInitialized = true;
      return true;
    } catch (error) {
      console.error('[PlayBilling] Failed to initialize RevenueCat:', error);
      return false;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
};

/**
 * Syncs user identity with RevenueCat when auth state changes.
 */
export const syncPlayBillingUser = async (userId: string | null): Promise<void> => {
  if (!isPlayBillingSupported() || !isInitialized) {
    return;
  }

  try {
    if (userId) {
      const loginResult = await Purchases.logIn({ appUserID: userId });
      // ONLY sync with server if user already has an active, verified plan entitlement
      if (getActivePlanEntitlement(loginResult.customerInfo)) {
        await confirmPlayBillingWithServer().catch((error) => {
          console.warn('[PlayBilling] Entitlement sync failed:', error);
        });
      }
    } else {
      await Purchases.logOut();
    }
  } catch (error) {
    console.warn('[PlayBilling] Failed to sync user ID:', error);
  }
};

/**
 * Retrieves the currently configured offerings/packages from Google Play.
 */
export type { PurchasesPackage, PurchasesOfferings };

/**
 * Finds the package matching a plan ID and duration from RevenueCat offerings.
 */
export const findPackageForPlan = (
  offerings: PurchasesOfferings | null,
  planId: string,
  billingPeriod: 'monthly' | 'yearly',
): PurchasesPackage | null => {
  if (!offerings?.current?.availablePackages || offerings.current.availablePackages.length === 0) {
    return null;
  }
  const packages = offerings.current.availablePackages;
  const targetSuffix = billingPeriod === 'monthly' ? 'monthly' : 'yearly';
  const targetType = billingPeriod === 'monthly' ? 'MONTHLY' : 'ANNUAL';

  // 1. Exact match e.g. "premium_monthly", "pro_yearly"
  const exactMatch = packages.find(
    (p) => p.identifier.toLowerCase() === `${planId.toLowerCase()}_${targetSuffix}`
  );
  if (exactMatch) return exactMatch;

  // 2. Identifier contains planId and suffix
  const idMatch = packages.find(
    (p) =>
      p.identifier.toLowerCase().includes(planId.toLowerCase()) &&
      p.identifier.toLowerCase().includes(targetSuffix)
  );
  if (idMatch) return idMatch;

  // 3. Product identifier match
  const prodMatch = packages.find(
    (p) =>
      p.product.identifier.toLowerCase().includes(planId.toLowerCase()) &&
      p.product.identifier.toLowerCase().includes(targetSuffix)
  );
  if (prodMatch) return prodMatch;

  // Standard package types are safe only when the product belongs to this plan.
  return packages.find(
    (p) => p.product.identifier.toLowerCase().split(/[^a-z0-9]+/).includes(planId.toLowerCase()) &&
      p.packageType === targetType
  ) || null;
};

/**
 * Retrieves the currently configured offerings/packages from Google Play.
 */
export const getPlayBillingOfferings = async (): Promise<PurchasesOfferings | null> => {
  if (!isPlayBillingSupported()) {
    return null;
  }

  if (!await initPlayBilling()) return null;

  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.error('[PlayBilling] Failed to load offerings:', error);
    return null;
  }
};

const confirmPlayBillingWithServer = async (): Promise<void> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Please sign in before syncing Google Play purchases.');

  let lastError = 'Google Play purchase verification failed.';
  for (const delay of [0, 600, 1600]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const response = await fetch('https://payments.medmacs.app/v1/play-billing/confirm', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (response.ok) return;
    const body = await response.json().catch(() => ({})) as { error?: string };
    lastError = body.error || lastError;
    if (response.status !== 409 && response.status < 500) break;
  }
  throw new Error(lastError);
};

/**
 * Initiates the Google Play purchase flow for a specific package.
 */
export const purchasePlayBillingPackage = async (
  pkg: PurchasesPackage,
  _targetPlanName?: string,
  _billingPeriod: 'monthly' | 'yearly' = 'monthly',
): Promise<{ success: boolean; customerInfo?: CustomerInfo; userCancelled?: boolean; error?: string }> => {
  if (!isPlayBillingSupported()) {
    return { success: false, error: 'Google Play Billing is only available on Android devices.' };
  }

  if (!await initPlayBilling()) {
    return { success: false, error: 'Google Play Billing could not initialize. Please try again.' };
  }

  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false, error: 'Please sign in before purchasing.' };
    await Purchases.logIn({ appUserID: auth.user.id });
    const result: MakePurchaseResult = await Purchases.purchasePackage({ aPackage: pkg });
    
    const entitlement = getActivePlanEntitlement(result.customerInfo);
    if (!entitlement) {
      return { success: false, error: 'Your purchase has no active plan yet. Please try Restore Purchases once Google Play confirms it.' };
    }
    await confirmPlayBillingWithServer();

    // 2. Clear stale cache so Dashboard and other views update immediately
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (user?.id) {
      localStorage.removeItem(`medmacs_profile_cache_${user.id}`);
      localStorage.removeItem(`medmacs:mcq-plan:${user.id}`);
    }

    return { success: true, customerInfo: result.customerInfo };
  } catch (error: unknown) {
    const purchaseError = error as { code?: unknown; userCancelled?: boolean; message?: string };
    // User cancelled code in RevenueCat is error code 1
    if (String(purchaseError.code) === '1' || purchaseError.userCancelled) {
      return { success: false, userCancelled: true };
    }
    console.error('[PlayBilling] Purchase failed:', error);
    return {
      success: false,
      error: purchaseError.message || 'An error occurred during Google Play checkout.',
    };
  }
};

/**
 * Restores previous Google Play purchases (e.g. after reinstalling or moving devices).
 */
export const restorePlayBillingPurchases = async (): Promise<{
  success: boolean;
  hasActiveSubscription: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> => {
  if (!isPlayBillingSupported()) {
    return {
      success: false,
      hasActiveSubscription: false,
      error: 'Google Play Billing is only available on Android devices.',
    };
  }

  if (!await initPlayBilling()) {
    return { success: false, hasActiveSubscription: false, error: 'Google Play Billing could not initialize. Please try again.' };
  }

  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false, hasActiveSubscription: false, error: 'Please sign in before restoring purchases.' };
    await Purchases.logIn({ appUserID: auth.user.id });
    const { customerInfo } = await Purchases.restorePurchases();
    const hasActiveSubscription = getActivePlanEntitlement(customerInfo) !== null;
    if (hasActiveSubscription) await confirmPlayBillingWithServer();
    return {
      success: true,
      hasActiveSubscription,
      customerInfo,
    };
  } catch (error: unknown) {
    const restoreError = error as { message?: string };
    console.error('[PlayBilling] Failed to restore purchases:', error);
    return {
      success: false,
      hasActiveSubscription: false,
      error: restoreError.message || 'Failed to restore Google Play purchases.',
    };
  }
};

/** Resolve access from active entitlements only, with Premium taking precedence. */
const getActivePlanEntitlement = (customerInfo: CustomerInfo | undefined | null) => {
  if (!customerInfo?.entitlements?.active) return null;
  const entries = Object.entries(customerInfo.entitlements.active);
  for (const plan of ['premium', 'iconic'] as const) {
    const match = entries.find(([id, entitlement]) => {
      const identifiers = `${id} ${entitlement.productIdentifier}`.toLowerCase().split(/[^a-z0-9]+/);
      return entitlement.isActive && identifiers.includes(plan);
    });
    if (match) return { plan, entitlement: match[1] };
  }
  return null;
};


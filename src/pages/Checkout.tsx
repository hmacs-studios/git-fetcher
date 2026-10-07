import LottiePlayer from '@/components/LottiePlayer';
import paymentProcessingAnim from '@/assets/animations/Bank.json';
import paymentSuccessAnim from '@/assets/animations/Payment Success.json';
import paymentFailAnim from '@/assets/animations/Close.json';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
    CheckCircle, XCircle, BadgePercent, ArrowLeft, Loader2, RefreshCw
} from 'lucide-react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { paymentApi, type PaymentOrder, type PayFastSession } from '@/services/paymentsApi';
import Seo from '@/components/Seo';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Browser } from '@capacitor/browser';
import { useConsent } from '@/components/consent/ConsentProvider';
import { trackMetaAddPaymentInfo, trackMetaInitiatedCheckout, trackMetaPurchase } from '@/utils/metaAppEvents';
import { trackGoogleAddPaymentInfo, trackGoogleBeginCheckout, trackGooglePurchase } from '@/utils/googleAnalytics';

const Checkout = () => {
    const { user } = useAuth();
    const { measurementAllowed } = useConsent();
    const location = useLocation();
    const lastScrollY = useRef(0);
    const [headerVisible, setHeaderVisible] = useState(true);

    const [isLoading, setIsLoading] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'easypaisa' | 'payfast'>('easypaisa');
    const [mobileNumber, setMobileNumber] = useState('');
    const [modalState, setModalState] = useState<'idle' | 'processing' | 'success' | 'failure'>('idle');
    const [promoCode, setPromoCode] = useState('');
    const [promoCodeError, setPromoCodeError] = useState<string | null>(null);
    const [discountedPrice, setDiscountedPrice] = useState<number | null>(null);
    const [isPromoApplied, setIsPromoApplied] = useState(false);
    const [promoDiscountDisplay, setPromoDiscountDisplay] = useState<string | null>(null);

    // WebView Specific States
    const [showPayFastModal, setShowPayFastModal] = useState(false);
    const [payFastHtml, setPayFastHtml] = useState<string | null>(null);
    const checkoutTracked = useRef(false);
    const googleCheckoutTracked = useRef(false);

    const { planName = 'Premium', price: basePriceStr, duration = 'Monthly', currency = 'PKR', validity = 'monthly', planId = planName.toLowerCase() } = location.state || {};
    const basePrice = basePriceStr ? parseFloat(String(basePriceStr).replace(/,/g, '')) : 0;
    const validityDisplay = validity?.toLowerCase() === 'yearly' ? 'Validity: 365 Days' : 'Validity: 30 Days';
    const priceAfterPromo = discountedPrice !== null ? discountedPrice : basePrice;

    // Internal Fee Calculations
    const processingFeeRate = paymentMethod === 'payfast' ? 0.025 : 0;
    const processingFee = Math.round(priceAfterPromo * processingFeeRate * 100) / 100;

    const gstRate = priceAfterPromo >= 50000 ? 0.18 : 0;
    const gstAmount = Math.round(priceAfterPromo * gstRate * 100) / 100;

    // Grand total rounded up to next whole number (e.g., 487.34 -> 488)
    const exactTotal = priceAfterPromo + processingFee + gstAmount;
    const grandTotal = Math.ceil(exactTotal);
    const isPayFastDisabled = grandTotal < 20;
    const commerceDetails: any = {
        planName,
        planId,
        validity,
        currency,
        basePrice,
        price: grandTotal,
        billingPeriod: validity || 'monthly',
        marketingConsent: true,
        finalPrice: grandTotal,
        discountApplied: isPromoApplied,
        promoCode: isPromoApplied ? promoCode : undefined,
    };

    useEffect(() => {
        if (!location.state || checkoutTracked.current || !measurementAllowed) return;
        checkoutTracked.current = true;
        void trackMetaInitiatedCheckout(commerceDetails);
    }, [measurementAllowed]);

    useEffect(() => {
        if (!location.state || googleCheckoutTracked.current || !measurementAllowed) return;
        googleCheckoutTracked.current = true;
        trackGoogleBeginCheckout({ ...commerceDetails, analyticsConsent: true });
    }, [measurementAllowed]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            setHeaderVisible(currentScrollY < lastScrollY.current || currentScrollY < 10);
            lastScrollY.current = currentScrollY;
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const checkPaymentStatus = async () => {
        if (!user) return false;
        try {
            const { data } = await supabase
                .from('pending_payments')
                .select('status, error_message')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                if (data.status === 'success') {
                    setModalState('success');
                    setIsLoading(false);
                    return true;
                } else if (data.status === 'failed') {
                    setError(data.error_message || "Transaction failed.");
                    setModalState('failure');
                    setIsLoading(false);
                    return true;
                }
            }
        } catch (e) {
            console.error("Status check failed", e);
        }
        return false;
    };

    useEffect(() => {
        if (modalState === 'success') {
            void trackMetaPurchase(commerceDetails);
            trackGooglePurchase({ ...commerceDetails, analyticsConsent: measurementAllowed });
        }
    }, [modalState, measurementAllowed]);

    useEffect(() => {
        if (!user) return;
        const channel = supabase
            .channel('payment-tracking')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pending_payments', filter: `user_id=eq.${user.id}` }, (payload) => {
                if (payload.new.status === 'success') {
                    setModalState('success');
                    setIsLoading(false);
                } else if (payload.new.status === 'failed') {
                    setError(payload.new.error_message || "Transaction failed.");
                    setModalState('failure');
                    setIsLoading(false);
                }
            })
            .subscribe();

        let pollInterval: NodeJS.Timeout;
        if (modalState === 'processing') {
            pollInterval = setInterval(() => {
                void checkPaymentStatus();
            }, 4000);
        }

        const browserListener = Browser.addListener('browserFinished', () => {
            if (modalState === 'processing') {
                void checkPaymentStatus();
            }
        });

        return () => {
            supabase.removeChannel(channel);
            if (pollInterval) clearInterval(pollInterval);
            browserListener.then(l => l.remove()).catch(() => {});
        };
    }, [user, modalState]);

    useEffect(() => {
        if (isPayFastDisabled && paymentMethod === 'payfast') setPaymentMethod('easypaisa');
    }, [isPayFastDisabled, paymentMethod]);

    if (!location.state) return <Navigate to="/pricing" replace />;

    const handleApplyPromoCode = async () => {
        setPromoCodeError(null);
        if (!promoCode) return;
        setIsLoading(true);
        try {
            const { data, error: rpcError } = await supabase.rpc('validate_promo_code', { p_code: promoCode, p_plan_name: planName, p_duration: duration, p_currency: currency, p_current_price: basePrice });
            if (rpcError) throw rpcError;
            const result = data[0];
            if (result.valid) { setDiscountedPrice(result.adjusted_price); setIsPromoApplied(true); setPromoDiscountDisplay(result.discount_type === 'percentage' ? `${result.discount_value}% OFF` : `Discount Applied`); }
            else { setPromoCodeError(result.error_message || 'Invalid code'); }
        } catch { setPromoCodeError('Failed to validate promo code.'); }
        finally { setIsLoading(false); }
    };

    const handleEasypaisaPayment = async () => {
        if (!mobileNumber || mobileNumber.length !== 11 || !mobileNumber.startsWith('03')) { setError("Please enter a valid 11-digit Easypaisa number starting with 03."); return; }
        void trackMetaAddPaymentInfo({ ...commerceDetails, paymentMethod: 'easypaisa' });
        trackGoogleAddPaymentInfo({ ...commerceDetails, paymentMethod: 'easypaisa', analyticsConsent: measurementAllowed });
        setError(null); setIsLoading(true); setModalState('processing');
        try {
            const order = await paymentApi<PaymentOrder>('/v1/orders', {
                method: 'POST',
                body: { provider: 'easypaisa', planId, validity, currency, promoCode: isPromoApplied ? promoCode : undefined, paymentContext: 'subscription' },
            });
            await paymentApi('/v1/easypaisa/initiate', { method: 'POST', body: { orderId: order.orderId, mobileNo: mobileNumber } });
        } catch (err: any) { 
            console.error("Easypaisa Error:", err);
            const isNetworkDrop = err?.name === 'AbortError' || 
                err?.message?.includes('Failed to fetch') || 
                err?.message?.includes('Unable to resolve host') ||
                err?.message?.includes('NetworkError');

            if (isNetworkDrop) {
                console.warn("Initiate call dropped or timed out; remaining in processing mode to poll for IPN completion.");
                return;
            }
            setError(err.message || "An unexpected error occurred."); 
            setModalState('failure'); 
            setIsLoading(false); 
        }
    };

    const handlePayFastPayment = async () => {
        void trackMetaAddPaymentInfo({ ...commerceDetails, paymentMethod: 'payfast' });
        trackGoogleAddPaymentInfo({ ...commerceDetails, paymentMethod: 'payfast', analyticsConsent: measurementAllowed });
        setIsLoading(true); setError(null);
        try {
            const { Capacitor } = await import('@capacitor/core');
            const isNative = Capacitor.isNativePlatform();

            const order = await paymentApi<PaymentOrder>('/v1/orders', {
                method: 'POST',
                body: {
                    provider: 'payfast',
                    planId,
                    validity,
                    currency,
                    promoCode: isPromoApplied ? promoCode : undefined,
                    paymentContext: 'subscription',
                    callbackOrigin: isNative ? 'https://com.hmacs.medmacs' : undefined,
                },
            });
            const session = await paymentApi<PayFastSession>('/v1/payfast/session', {
                method: 'POST',
                body: { orderId: order.orderId },
            });

            if (isNative) {
                const params = new URLSearchParams();
                Object.entries(session.fields).forEach(([key, value]) => params.append(key, value as string));
                const redirectUrl = `https://medmacs.app/payfast-redirect.html?${params.toString()}`;
                const { Browser } = await import('@capacitor/browser');
                await Browser.open({ url: redirectUrl });
                setIsLoading(false);
            } else {
                const form = document.createElement("form");
                form.method = "POST";
                form.action = session.gatewayUrl;
                Object.entries(session.fields).forEach(([key, value]) => {
                    const input = document.createElement("input");
                    input.type = "hidden"; input.name = key; input.value = value as string;
                    form.appendChild(input);
                });
                document.body.appendChild(form);
                form.submit();
                setIsLoading(false);
            }
        } catch (err: any) { setError(err.message || "An error occurred."); setIsLoading(false); }
    };

    const processPayment = () => {
        if (isLoading || isRedirecting) return;
        if (!user) { setError("Please sign in to continue."); return; }
        if (paymentMethod === 'easypaisa') {
            handleEasypaisaPayment();
        } else {
            handlePayFastPayment();
        }
    };

    return (
        <div className="min-h-screen w-full bg-background">
            <Seo title="Checkout - Medmacs" description="Complete your subscription purchase." canonical="https://medmacs.app/checkout" />
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border transition-transform duration-300">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <Link to="/pricing" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Plans
                    </Link>
                    <ProfileDropdown />
                </div>
            </header>

            <main className="container mx-auto px-4 lg:px-8 py-12 lg:py-16 max-w-4xl">
                <div className="text-center mb-12 mt-[var(--header-height)]">
                    <motion.h1 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="text-3xl md:text-5xl font-black tracking-tight text-foreground italic uppercase"
                    >
                        Complete <span className="text-primary">Payment</span>
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="text-muted-foreground text-xs uppercase tracking-[0.2em] mt-3"
                    >
                        Secure checkout
                    </motion.p>
                </div>

                {/* Animated Container for Staggered Children */}
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: { opacity: 0 },
                        visible: {
                            opacity: 1,
                            transition: {
                                staggerChildren: 0.15
                            }
                        }
                    }}
                >
                    {/* Order Summary Card */}
                    <motion.div 
                        variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } }}
                        className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl overflow-hidden mb-5 shadow-sm"
                    >
                        <div className="p-6">
                            <h2 className="text-sm font-black uppercase tracking-widest text-primary mb-4">Order Summary</h2>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="text-base font-bold text-foreground">{planName} Plan</p>
                                    <span className="text-[10px] mt-1 inline-block px-2.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold uppercase tracking-wider">{validityDisplay}</span>
                                </div>
                                <span className="font-bold text-foreground">PKR {basePrice.toFixed(2)}</span>
                            </div>

                            <div className="py-2.5 my-2.5 border-t border-border/40 text-xs text-muted-foreground">
                                <div className="flex justify-between items-center">
                                    <span>Processing Fees</span>
                                    <span className="font-medium text-foreground">PKR {processingFee.toFixed(2)}</span>
                                </div>
                            </div>

                            {isPromoApplied && (
                                <div className="flex justify-between text-emerald-500 text-sm font-medium mb-3">
                                    <span className="flex items-center"><BadgePercent className="mr-1.5 h-4 w-4" /> {promoDiscountDisplay}</span>
                                    <span>- PKR {(basePrice - priceAfterPromo).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="pt-4 border-t border-border/50 flex justify-between items-center">
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Grand Total</span>
                                <span className="text-3xl font-black text-foreground">PKR {grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Promo Code Card */}
                    <motion.div 
                        variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } }}
                        className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl overflow-hidden mb-5 shadow-sm"
                    >
                        <div className="p-5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Promo Code</p>
                            <div className="flex gap-2">
                                <Input placeholder="Enter code" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} disabled={isPromoApplied || isLoading} className="rounded-xl h-11" />
                                <Button onClick={handleApplyPromoCode} disabled={isLoading || isPromoApplied || !promoCode} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 px-5 font-bold text-xs uppercase">
                                    {isPromoApplied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : 'Apply'}
                                </Button>
                            </div>
                            {promoCodeError && <p className="text-destructive text-xs mt-2">{promoCodeError}</p>}
                        </div>
                    </motion.div>

                    {/* Payment Methods */}
                    <motion.div 
                        variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } }}
                        className="mb-5"
                    >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Payment Method</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                            <motion.div 
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => setPaymentMethod('easypaisa')}
                                className={`rounded-xl p-5 cursor-pointer transition-all duration-200 border flex flex-col ${paymentMethod === 'easypaisa' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border/60 bg-card/90 backdrop-blur-xl'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className={`w-5 h-5 shrink-0 ${paymentMethod === 'easypaisa' ? 'text-primary' : 'text-muted-foreground'}`} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path fill="none" stroke="currentColor" strokeLinejoin="round" d="M24.6025,4.5c8.516,0,15.42,5.7166,15.42,12.7693S33.12,28.6141,24.6025,28.6141Q12.4689,28.3687,7.4111,20.972A1.6469,1.6469,0,0,1,7.1663,19.73Q10.0575,5.2982,24.6025,4.5Zm-.5751,7.9439q-7.3449.7437-8.9894,6.9928,2.2406,1.9754,8.9894,2.1927c4.5207-.0711,7.2591-1.389,7.3129-4.4525C31.0589,13.7933,27.7687,12.3159,24.0274,12.4439Z"/>
                                        <path fill="none" stroke="currentColor" strokeLinejoin="round" d="M6.396,24.71C8.9221,31.9571,15.8885,35.99,23.05,35.99c5.9392,0,9.8755-2.5707,11.94-6.4492L41.6456,33.71c-2.32,5.6749-9.1977,9.79-17.3225,9.79-10.0289,0-18.617-6.7591-17.93-18.5113C6.393,24.8952,6.394,24.8017,6.396,24.71Z"/>
                                    </svg>
                                    <div>
                                        <span className={`font-black text-sm uppercase ${paymentMethod === 'easypaisa' ? 'text-foreground' : 'text-muted-foreground'}`}>Easypaisa</span>
                                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed">Pay using your mobile wallet</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div 
                                whileHover={{ scale: !isPayFastDisabled ? 1.01 : 1 }}
                                whileTap={{ scale: !isPayFastDisabled ? 0.99 : 1 }}
                                onClick={() => !isPayFastDisabled && setPaymentMethod('payfast')}
                                className={`rounded-xl p-5 transition-all duration-200 border flex flex-col ${isPayFastDisabled ? 'opacity-40 grayscale cursor-not-allowed border-border/40 bg-card/50' : 'cursor-pointer'} ${paymentMethod === 'payfast' ? 'border-primary bg-primary/5 ring-1 ring-primary' : (!isPayFastDisabled ? 'border-border/60 bg-card/90 backdrop-blur-xl' : '')}`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className={`w-5 h-5 shrink-0 ${paymentMethod === 'payfast' ? 'text-primary' : isPayFastDisabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} viewBox="0 0 244.683 244.683" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                        <path d="m244.054,118.587l-25.417-79.232c-1.073-3.344-3.384-6.07-6.508-7.676-3.123-1.605-6.685-1.898-10.029-0.827l-129.21,41.45c-6.904,2.215-10.718,9.633-8.504,16.537l5.171,16.12h-56.409c-7.25,0-13.148,5.898-13.148,13.148v83.209c0,7.25 5.898,13.148 13.148,13.148h144.695c7.25,0 13.148-5.898 13.148-13.148v-45.482l64.558-20.71c6.904-2.214 10.719-9.632 8.505-16.537zm-86.21,83.878h-144.696c-0.633,0-1.148-0.515-1.148-1.148v-83.209c0-0.633 0.515-1.148 1.148-1.148h144.695c0.633,0 1.148,0.515 1.148,1.148v83.209c0.001,0.633-0.514,1.148-1.147,1.148zm48.797-160.114c0.193,0.099 0.448,0.296 0.568,0.67l5.072,15.81-131.396,42.153-5.072-15.811c-0.194-0.603 0.14-1.251 0.743-1.444l129.209-41.45c0.126-0.041 0.245-0.057 0.354-0.057 0.215,7.10543e-15 0.394,0.063 0.522,0.129zm-48.797,62.608h-50.064l108.167-34.7 16.68,51.994c0.193,0.604-0.14,1.252-0.743,1.445l-60.892,19.534v-25.125c-2.84217e-14-7.25-5.898-13.148-13.148-13.148z"/>
                                        <path d="m56.54,134.712h-25.666c-3.313,0-6,2.687-6,6s2.687,6 6,6h25.666c3.313,0 6-2.687 6-6s-2.686-6-6-6z"/>
                                        <path d="m85.207,146.712c3.313,0 6-2.687 6-6s-2.687-6-6-6h-9.333c-3.313,0-6,2.687-6,6s2.687,6 6,6h9.333z"/>
                                        <path d="m149.207,160.712c0-3.313-2.687-6-6-6h-29.333c-3.313,0-6,2.687-6,6v26c0,3.313 2.687,6 6,6h29.333c3.313,0 6-2.687 6-6v-26zm-12,6v14h-17.333v-14h17.333z"/>
                                    </svg>
                                    <div>
                                        <span className={`font-black text-sm uppercase ${paymentMethod === 'payfast' ? 'text-foreground' : isPayFastDisabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>Cards / Bank (PayFast)</span>
                                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed">Pay via card or internet banking</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {paymentMethod === 'easypaisa' && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-4 rounded-xl border border-border/60 bg-card/90 backdrop-blur-xl p-5"
                            >
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mobile Account Number</label>
                                <Input placeholder="03XXXXXXXXX" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))} maxLength={11} className="rounded-xl h-11 mt-1" />
                            </motion.div>
                        )}

                        {paymentMethod === 'payfast' && !isPayFastDisabled && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-4 rounded-xl border border-border/60 bg-card/90 backdrop-blur-xl p-5"
                            >
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Your payment will be processed securely by our payment partner. You will be redirected to complete the transaction.
                                </p>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* Terms and Button */}
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } }}>
                        <div className="p-3 mb-4 rounded-xl hover:bg-muted/50 transition-colors">
                            <p className="text-xs leading-snug text-muted-foreground">
                                By continuing to pay to Medmacs/Hmacs Studios, you agree to our{' '}
                                <Link to="/terms" className="text-primary hover:underline font-medium transition-colors">Terms and Conditions</Link>,{' '}
                                <Link to="/privacypolicy" className="text-primary hover:underline font-medium transition-colors">Privacy Policy</Link>, and{' '}
                                <Link to="/refund-policy" className="text-primary hover:underline font-medium transition-colors">Refund Policy</Link>.
                            </p>
                        </div>

                        {error && (
                            <motion.p 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-destructive text-sm font-medium mb-4 text-center bg-destructive/10 py-2 rounded-lg"
                            >
                                {error}
                            </motion.p>
                        )}

                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                            <Button 
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-black uppercase tracking-widest shadow-md transition-all duration-200" 
                                onClick={processPayment} 
                                disabled={isLoading || isRedirecting}
                            >
                                <span className="flex items-center justify-center">
                                    {(isLoading || isRedirecting) ? <Loader2 className="animate-spin h-6 w-6" /> : `Pay PKR ${grandTotal.toFixed(2)}`}
                                </span>
                            </Button>
                        </motion.div>
                    </motion.div>
                </motion.div>
            </main>

            {/* PAYFAST WEBVIEW MODAL */}
            <Dialog open={showPayFastModal} onOpenChange={setShowPayFastModal}>
                <DialogContent className="sm:max-w-[500px] h-[85vh] p-0 overflow-hidden bg-white border-none rounded-t-3xl sm:rounded-3xl">
                    <DialogTitle className="sr-only">Secure Payment</DialogTitle>
                    {payFastHtml && (
                        <iframe
                            id="payfast-frame"
                            title="PayFast Gateway"
                            className="w-full h-full border-none"
                            srcDoc={payFastHtml}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={modalState !== 'idle' && !showPayFastModal} onOpenChange={(open) => !open && setModalState('idle')}>
                <DialogContent className={cn(
                    "sm:max-w-md bg-card border-t sm:border border-border transition-all duration-300 overflow-hidden shadow-2xl",
                    "fixed bottom-0 top-auto translate-y-0 rounded-t-3xl rounded-b-none max-w-full sm:max-w-md border-x-0 border-b-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                )}>
                    {/* Visual Sheet Handle Bar */}
                    <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mt-1 mb-2" />

                    <div className="flex flex-col items-center justify-center text-center px-4 pb-2">
                        {modalState === 'processing' && (
                            <div className="flex flex-col items-center justify-center space-y-3 animate-in fade-in zoom-in-95 duration-200 w-full">
                                <div className="w-36 h-36 flex items-center justify-center my-[-10px]">
                                    <LottiePlayer 
                                        animationData={paymentProcessingAnim} 
                                        loop={true} 
                                        autoplay={true} 
                                        style={{ width: 140, height: 140 }}
                                    />
                                </div>
                                <DialogTitle className="text-xl font-bold text-foreground">Authorizing Payment</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground px-2 leading-relaxed">
                                    Please approve the request on your mobile phone or enter your PIN in your Easypaisa app.
                                </DialogDescription>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="mt-3 text-xs border-border text-foreground hover:bg-accent rounded-full px-5 py-2 shadow-sm"
                                    onClick={checkPaymentStatus}
                                >
                                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Still waiting? Click to check status
                                </Button>
                            </div>
                        )}
                        {modalState === 'success' && (
                            <div className="flex flex-col items-center justify-center space-y-3 animate-in fade-in zoom-in-95 duration-300 w-full">
                                <div className="w-40 h-40 flex items-center justify-center my-[-15px]">
                                    <LottiePlayer 
                                        animationData={paymentSuccessAnim} 
                                        loop={true} 
                                        autoplay={true} 
                                        style={{ width: 160, height: 160 }}
                                    />
                                </div>
                                <DialogTitle className="text-2xl font-black text-foreground">Payment Successful!</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground max-w-xs">
                                    Your account has been upgraded successfully.
                                </DialogDescription>
                                <Button 
                                    className="mt-4 w-full bg-primary text-primary-foreground font-bold h-12 shadow-lg rounded-xl text-base" 
                                    onClick={() => window.location.href = '/dashboard'}
                                >
                                    Continue to Dashboard
                                </Button>
                            </div>
                        )}
                        {modalState === 'failure' && (
                            <div className="flex flex-col items-center justify-center space-y-3 animate-in fade-in zoom-in-95 duration-300 w-full py-2">
                                <div className="w-36 h-36 flex items-center justify-center my-[-10px]">
                                    <LottiePlayer 
                                        animationData={paymentFailAnim} 
                                        loop={false} 
                                        autoplay={true} 
                                        style={{ width: 140, height: 140 }}
                                    />
                                </div>
                                <DialogTitle className="text-xl font-bold text-foreground">Transaction Failed</DialogTitle>
                                <DialogDescription className="text-sm text-destructive px-4 font-medium text-center">{error || "Something went wrong."}</DialogDescription>
                                <div className="flex gap-3 w-full mt-4">
                                    <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setModalState('idle')}>Try Again</Button>
                                    <Button variant="secondary" className="flex-1 rounded-xl h-11" onClick={checkPaymentStatus}>Check Again</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Checkout;

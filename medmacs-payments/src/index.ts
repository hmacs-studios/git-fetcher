type PaymentProvider = 'payfast' | 'easypaisa';
type PaymentContext = 'subscription' | 'certificate_application';

type AuthenticatedUser = {
  id: string;
  email?: string;
};

type PendingPayment = {
  order_id: string;
  user_id: string;
  amount: number | string;
  original_amount?: number | string | null;
  discount_amount?: number | string | null;
  promo_code?: string | null;
  plan_name: string | null;
  validity: string | null;
  email: string | null;
  status: string;
  payment_context: string | null;
  certificate_application_id: string | null;
  transaction_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

type OrderRequest = {
  provider?: unknown;
  planId?: unknown;
  validity?: unknown;
  currency?: unknown;
  promoCode?: unknown;
  paymentContext?: unknown;
  certificateApplicationId?: unknown;
  returnTo?: unknown;
  callbackOrigin?: unknown;
  sandbox?: unknown;
};

type SandboxEnv = Env & {
  PAYFAST_MERCHANT_ID_UAT?: string;
  PAYFAST_SECURED_KEY_UAT?: string;
  PAYFAST_TOKEN_URL_UAT?: string;
  PAYFAST_GATEWAY_URL_UAT?: string;
};

const ALLOWED_ORIGINS = new Set([
  'https://medmacs.app',
  'https://www.medmacs.app',
  'https://certificate.medmacs.app',
  'https://certificates.medmacs.app',
  'https://com.hmacs.medmacs',
  'http://localhost:8080',
  'http://localhost:5173',
]);

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

const json = (body: unknown, status = 200, extraHeaders?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  });

const log = (level: 'info' | 'error', event: string, details: Record<string, unknown> = {}) => {
  const entry = JSON.stringify({ event, ...details, at: new Date().toISOString() });
  if (level === 'error') console.error(entry);
  else console.log(entry);
};

const corsHeadersFor = (request: Request) => {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
};

const withCors = (response: Response, request: Request) => {
  const headers = new Headers(response.headers);
  corsHeadersFor(request).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

const cleanString = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const parseMoney = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('invalid_amount');
  return Math.round(amount * 100) / 100;
};

const formatMoney = (value: number) => value.toFixed(2);

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const serviceHeaders = (env: Env, prefer?: string) => {
  const headers = new Headers({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  });
  if (prefer) headers.set('Prefer', prefer);
  return headers;
};

const userHeaders = (env: Env, token: string) => new Headers({
  apikey: env.SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const boundedJson = async <T>(response: Response): Promise<T> => {
  const contentLength = Number(response.headers.get('Content-Length') || 0);
  if (contentLength > 1_000_000) throw new Error('upstream_response_too_large');
  return response.json<T>();
};

const requireUser = async (request: Request, env: Env): Promise<{ user: AuthenticatedUser; token: string }> => {
  const token = getBearerToken(request);
  if (!token) throw new HttpError(401, 'authentication_required');

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: userHeaders(env, token),
  });
  if (!response.ok) throw new HttpError(401, 'invalid_session');
  const user = await boundedJson<AuthenticatedUser>(response);
  if (!user.id) throw new HttpError(401, 'invalid_session');
  return { user, token };
};

const supabaseSelect = async <T>(env: Env, path: string): Promise<T[]> => {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: serviceHeaders(env),
  });
  if (!response.ok) {
    log('error', 'supabase_select_failed', { path: path.split('?')[0], status: response.status });
    throw new HttpError(502, 'payment_database_unavailable');
  }
  return boundedJson<T[]>(response);
};

const supabaseInsert = async <T>(env: Env, table: string, body: unknown): Promise<T> => {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: serviceHeaders(env, 'return=representation'),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    log('error', 'supabase_insert_failed', { table, status: response.status });
    throw new HttpError(502, 'could_not_create_payment');
  }
  const rows = await boundedJson<T[]>(response);
  if (!rows[0]) throw new HttpError(502, 'could_not_create_payment');
  return rows[0];
};

const supabaseUpdate = async <T>(
  env: Env,
  table: string,
  query: string,
  body: unknown,
  returnRows = false,
): Promise<T[]> => {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: serviceHeaders(env, returnRows ? 'return=representation' : 'return=minimal'),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    log('error', 'supabase_update_failed', { table, status: response.status });
    throw new HttpError(502, 'payment_database_update_failed');
  }
  return returnRows ? boundedJson<T[]>(response) : [];
};

const getPayment = async (env: Env, orderId: string, userId?: string) => {
  const filters = [
    `order_id=eq.${encodeURIComponent(orderId)}`,
    userId ? `user_id=eq.${encodeURIComponent(userId)}` : '',
    'select=*',
    'limit=1',
  ].filter(Boolean).join('&');
  const rows = await supabaseSelect<PendingPayment>(env, `pending_payments?${filters}`);
  return rows[0] || null;
};

const getAuthoritativeOrderDetails = async (
  env: Env,
  token: string,
  user: AuthenticatedUser,
  input: OrderRequest,
) => {
  const provider = cleanString(input.provider, 20) as PaymentProvider;
  const paymentContext = (cleanString(input.paymentContext, 40) || 'subscription') as PaymentContext;
  const returnTo = cleanString(input.returnTo, 300);
  const rawCallbackOrigin = cleanString(input.callbackOrigin, 300);
  let callbackOrigin = '';
  if (rawCallbackOrigin) {
    let parsed: URL | null = null;
    try { parsed = new URL(rawCallbackOrigin); } catch { /* invalid */ }
    if (!parsed || parsed.origin !== parsed.href.replace(/\/$/, '') || !ALLOWED_ORIGINS.has(parsed.origin)) {
      throw new HttpError(400, 'invalid_callback_origin');
    }
    callbackOrigin = parsed.origin;
  }
  if (provider !== 'payfast' && provider !== 'easypaisa') throw new HttpError(400, 'invalid_payment_provider');
  if (paymentContext !== 'subscription' && paymentContext !== 'certificate_application') {
    throw new HttpError(400, 'invalid_payment_context');
  }

  let sandbox = false;
  if (input.sandbox === true) {
    const profiles = await supabaseSelect<{ role: string | null }>(env, `profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`);
    if (profiles[0]?.role !== 'admin') throw new HttpError(403, 'sandbox_admin_only');
    sandbox = true;
  }

  let amount: number;
  let planName: string;
  let validity: string;
  let certificateApplicationId: string | null = null;
  let discountAmount = 0;
  let appliedPromoCode: string | null = null;

  if (paymentContext === 'certificate_application') {
    certificateApplicationId = cleanString(input.certificateApplicationId, 80);
    if (!certificateApplicationId) throw new HttpError(400, 'certificate_application_required');
    const rows = await supabaseSelect<{
      id: string;
      user_id: string;
      event_name: string;
      amount: number | string;
      status: string;
      payment_status: string | null;
    }>(env, `certificate_applications?id=eq.${encodeURIComponent(certificateApplicationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,event_name,amount,status,payment_status&limit=1`);
    const application = rows[0];
    if (!application) throw new HttpError(404, 'certificate_application_not_found');
    if (application.payment_status === 'success') throw new HttpError(409, 'certificate_already_paid');
    amount = parseMoney(application.amount);
    planName = application.event_name || 'Certificate application';
    validity = 'certificate';
  } else {
    const planId = cleanString(input.planId, 50).toLowerCase();
    validity = cleanString(input.validity, 20).toLowerCase();
    const currency = cleanString(input.currency, 5).toUpperCase() || 'PKR';
    if (!planId || !['monthly', 'yearly'].includes(validity) || currency !== 'PKR') {
      throw new HttpError(400, 'invalid_plan_selection');
    }
    const planFilter = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(planId)
      ? `id=eq.${encodeURIComponent(planId)}`
      : `name=eq.${encodeURIComponent(planId)}`;
    const rows = await supabaseSelect<{
      name: string;
      display_name: string;
      price: number | string;
    }>(env, `pricing_plans?${planFilter}&type=eq.${encodeURIComponent(validity)}&currency=eq.PKR&select=name,display_name,price&limit=1`);
    const plan = rows[0];
    if (!plan || plan.name === 'free') throw new HttpError(404, 'paid_plan_not_found');
    amount = parseMoney(plan.price);
    planName = plan.display_name;

    const originalPrice = amount;
    discountAmount = 0;
    appliedPromoCode = null;

    const promoCode = cleanString(input.promoCode, 50);
    if (promoCode) {
      const promoResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/validate_promo_code`, {
        method: 'POST',
        headers: userHeaders(env, token),
        body: JSON.stringify({
          p_code: promoCode,
          p_plan_name: planName,
          p_duration: validity === 'yearly' ? 'Yearly' : 'Monthly',
          p_currency: 'PKR',
          p_current_price: amount,
        }),
      });
      if (!promoResponse.ok) throw new HttpError(400, 'invalid_promo_code');
      const promoRows = await boundedJson<Array<{ valid?: boolean; is_valid?: boolean; adjusted_price: number | string }>>(promoResponse);
      const promo = promoRows[0];
      if (!(promo?.valid ?? promo?.is_valid)) throw new HttpError(400, 'invalid_promo_code');
      const adjustedPrice = parseMoney(promo.adjusted_price);
      discountAmount = Math.max(0, originalPrice - adjustedPrice);
      amount = adjustedPrice;
      appliedPromoCode = promoCode.toUpperCase();
    }
  }

  const baseAmount = amount;
  const fee = provider === 'payfast' ? Math.round(baseAmount * 0.025 * 100) / 100 : 0;
  amount = Math.round((baseAmount + fee) * 100) / 100;
  return { provider, paymentContext, amount, baseAmount, fee, planName, validity, certificateApplicationId, returnTo, callbackOrigin, sandbox, appliedPromoCode, discountAmount };
};

const createOrder = async (request: Request, env: Env) => {
  const { user, token } = await requireUser(request, env);
  const input = await request.json<OrderRequest>().catch(() => ({}));
  const details = await getAuthoritativeOrderDetails(env, token, user, input);
  const prefix = details.provider === 'payfast' ? 'ORD' : 'EP';
  const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const orderId = `${prefix}-${Date.now()}${randomSuffix}`;
  const payment = await supabaseInsert<PendingPayment>(env, 'pending_payments', {
    user_id: user.id,
    amount: details.amount,
    original_amount: details.baseAmount + details.discountAmount,
    discount_amount: details.discountAmount,
    promo_code: details.appliedPromoCode,
    order_id: orderId,
    status: 'initiated',
    validity: details.validity,
    email: user.email || null,
    plan_name: details.planName,
    payment_context: details.paymentContext,
    certificate_application_id: details.certificateApplicationId,
    metadata: {
      provider: details.provider,
      base_amount: details.baseAmount,
      gateway_fee: details.fee,
      original_amount: details.baseAmount + details.discountAmount,
      discount_amount: details.discountAmount,
      promo_code: details.appliedPromoCode,
      return_to: details.returnTo,
      callback_origin: details.callbackOrigin || '',
      environment: details.sandbox ? 'sandbox' : 'production',
    },
  });
  log('info', 'payment_order_created', { orderId, userId: user.id, provider: details.provider });
  return json({
    orderId: payment.order_id,
    amount: formatMoney(details.amount),
    baseAmount: formatMoney(details.baseAmount),
    fee: formatMoney(details.fee),
    planName: details.planName,
    validity: details.validity,
    paymentContext: details.paymentContext,
  }, 201);
};

const createPayFastSession = async (request: Request, env: Env) => {
  const { user } = await requireUser(request, env);
  const body = await request.json<{ orderId?: unknown }>().catch((): { orderId?: unknown } => ({}));
  const orderId = cleanString(body.orderId, 100);
  const payment = orderId ? await getPayment(env, orderId, user.id) : null;
  if (!payment) throw new HttpError(404, 'payment_order_not_found');
  if (payment.status !== 'initiated') throw new HttpError(409, 'payment_order_not_payable');
  if (payment.metadata?.provider !== 'payfast') throw new HttpError(400, 'wrong_payment_provider');

  const sandbox = payment.metadata?.environment === 'sandbox';
  const sandboxEnv = env as SandboxEnv;
  const merchantId = sandbox ? sandboxEnv.PAYFAST_MERCHANT_ID_UAT : env.PAYFAST_MERCHANT_ID;
  const securedKey = sandbox ? sandboxEnv.PAYFAST_SECURED_KEY_UAT : env.PAYFAST_SECURED_KEY;
  const tokenUrl = sandbox
    ? (sandboxEnv.PAYFAST_TOKEN_URL_UAT || env.PAYFAST_TOKEN_URL)
    : env.PAYFAST_TOKEN_URL;
  const gatewayUrl = sandbox
    ? (sandboxEnv.PAYFAST_GATEWAY_URL_UAT || env.PAYFAST_GATEWAY_URL)
    : env.PAYFAST_GATEWAY_URL;
  if (!merchantId || !securedKey) throw new HttpError(503, sandbox ? 'payfast_sandbox_not_configured' : 'payfast_not_configured');
  const amount = formatMoney(parseMoney(payment.amount));
  const tokenRequest = new URLSearchParams({
    MERCHANT_ID: merchantId,
    SECURED_KEY: securedKey,
    BASKET_ID: orderId,
    TXNAMT: amount,
    CURRENCY_CODE: 'PKR',
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Medmacs Payments/1.0',
    },
    body: tokenRequest,
  });
  const data = await boundedJson<{ ACCESS_TOKEN?: string }>(response).catch((): { ACCESS_TOKEN?: string } => ({}));
  if (!response.ok || !data.ACCESS_TOKEN) {
    log('error', 'payfast_token_failed', { orderId, status: response.status });
    throw new HttpError(502, 'payfast_unavailable');
  }

  const callbackBase = (typeof payment.metadata?.callback_origin === 'string' && payment.metadata.callback_origin)
    ? payment.metadata.callback_origin
    : env.APP_URL;
  const successUrl = new URL('/payment-success', callbackBase);
  successUrl.searchParams.set('plan', payment.plan_name || 'Premium');
  successUrl.searchParams.set('validity', payment.validity || 'monthly');
  successUrl.searchParams.set('context', payment.payment_context || 'subscription');
  successUrl.searchParams.set('basket_id', orderId);
  return json({
    gatewayUrl,
    fields: {
      MERCHANT_ID: merchantId,
      Merchant_Name: 'MEDMACS Pakistan',
      TOKEN: data.ACCESS_TOKEN,
      PROCCODE: '00',
      TXNAMT: amount,
      CUSTOMER_MOBILE_NO: '03000000000',
      CUSTOMER_EMAIL_ADDRESS: payment.email || '',
      SUCCESS_URL: successUrl.toString(),
      FAILURE_URL: new URL('/payment-failure', callbackBase).toString(),
      CHECKOUT_URL: 'https://payments.medmacs.app/v1/webhooks/payfast',
      BASKET_ID: orderId,
      ORDER_DATE: new Date().toISOString().slice(0, 10),
      SIGNATURE: 'PAYMENT_REQ',
      VERSION: 'V1.2',
      TXNDESC: payment.payment_context === 'certificate_application'
        ? `Certificate application - ${payment.plan_name || 'Medmacs'}`
        : `Upgrade to ${payment.plan_name || 'Premium'}`,
      CURRENCY_CODE: 'PKR',
      P1: user.id,
      P2: payment.plan_name || 'Premium',
      P3: payment.validity || 'monthly',
    },
  });
};

const createEasypaisaPayment = async (request: Request, env: Env) => {
  const { user } = await requireUser(request, env);
  const body = await request.json<{ orderId?: unknown; mobileNo?: unknown }>()
    .catch((): { orderId?: unknown; mobileNo?: unknown } => ({}));
  const orderId = cleanString(body.orderId, 100);
  const mobileNo = cleanString(body.mobileNo, 20);
  if (!/^03\d{9}$/.test(mobileNo)) throw new HttpError(400, 'invalid_mobile_number');
  const payment = orderId ? await getPayment(env, orderId, user.id) : null;
  if (!payment) throw new HttpError(404, 'payment_order_not_found');
  if (payment.status !== 'initiated') throw new HttpError(409, 'payment_order_not_payable');
  if (payment.metadata?.provider !== 'easypaisa') throw new HttpError(400, 'wrong_payment_provider');

  const soapRequest = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dto="http://dto.transaction.partner.pg.systems.com/" xmlns:dto1="http://dto.common.pg.systems.com/">
  <soapenv:Header/>
  <soapenv:Body>
    <dto:initiateTransactionRequestType>
      <dto1:username>${escapeXml(env.EP_USERNAME)}</dto1:username>
      <dto1:password>${escapeXml(env.EP_PASSWORD)}</dto1:password>
      <channel>Internet</channel>
      <orderId>${escapeXml(orderId)}</orderId>
      <storeId>${escapeXml(env.EP_STORE_ID)}</storeId>
      <transactionAmount>${formatMoney(parseMoney(payment.amount))}</transactionAmount>
      <transactionType>MA</transactionType>
      <mobileAccountNo>${mobileNo}</mobileAccountNo>
      <emailAddress>${escapeXml(payment.email || '')}</emailAddress>
    </dto:initiateTransactionRequestType>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(env.EASYPAISA_SOAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'initiateTransaction' },
    body: soapRequest,
  });
  const xml = await response.text();
  if (xml.length > 1_000_000) throw new HttpError(502, 'easypaisa_invalid_response');
  const code = xml.match(/<(?:\w+:)?responseCode>(.*?)<\/(?:\w+:)?responseCode>/)?.[1];
  const description = xml.match(/<(?:\w+:)?responseDesc>(.*?)<\/(?:\w+:)?responseDesc>/)?.[1];
  if (!response.ok || code !== '0000') {
    await supabaseUpdate(env, 'pending_payments', `order_id=eq.${encodeURIComponent(orderId)}`, {
      status: 'failed',
      error_message: description || 'Easypaisa initiation failed',
    });
    throw new HttpError(502, 'easypaisa_rejected_payment');
  }
  log('info', 'easypaisa_payment_initiated', { orderId, userId: user.id });
  return json({ status: 'pending', orderId }, 202);
};

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const constantTimeEqual = async (left: string, right: string) => {
  const [leftHash, rightHash] = await Promise.all([sha256Hex(left.toLowerCase()), sha256Hex(right.toLowerCase())]);
  let mismatch = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    mismatch |= leftHash.charCodeAt(index) ^ rightHash.charCodeAt(index);
  }
  return mismatch === 0;
};

const constantTimeEqualExact = async (left: string, right: string) => {
  const [leftHash, rightHash] = await Promise.all([sha256Hex(left), sha256Hex(right)]);
  let mismatch = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    mismatch |= leftHash.charCodeAt(index) ^ rightHash.charCodeAt(index);
  }
  return mismatch === 0;
};

const parseCallbackData = async (request: Request) => {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  if (request.method === 'POST') {
    const contentType = request.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json<Record<string, unknown>>().catch(() => ({}));
      Object.entries(body).forEach(([key, value]) => params.set(key, String(value ?? '')));
    } else {
      const text = await request.text();
      if (text.length > 100_000) throw new HttpError(413, 'callback_too_large');
      new URLSearchParams(text).forEach((value, key) => params.set(key, value));
    }
  }
  return params;
};

const fulfillPayment = async (env: Env, payment: PendingPayment, transactionId: string | null) => {
  const claimed = await supabaseUpdate<PendingPayment>(
    env,
    'pending_payments',
    `order_id=eq.${encodeURIComponent(payment.order_id)}&status=neq.success`,
    { status: 'success', error_message: null },
    true,
  );
  if (!claimed[0]) return false;
  if (payment.metadata?.environment === 'sandbox') {
    log('info', 'sandbox_payment_confirmed', { orderId: payment.order_id });
    return true;
  }

  if (payment.payment_context === 'certificate_application' && payment.certificate_application_id) {
    await supabaseUpdate(env, 'certificate_applications', `id=eq.${encodeURIComponent(payment.certificate_application_id)}`, {
      status: 'pending',
      payment_status: 'success',
      payment_order_id: payment.order_id,
      updated_at: new Date().toISOString(),
    });
  } else {
    const days = payment.validity === 'yearly' ? 365 : Math.max(1, Number.parseInt(payment.validity || '30', 10) || 30);
    const expiryDate = new Date();
    expiryDate.setUTCDate(expiryDate.getUTCDate() + days);
    await supabaseUpdate(env, 'profiles', `id=eq.${encodeURIComponent(payment.user_id)}`, {
      plan: payment.plan_name || 'premium',
      plan_expiry_date: expiryDate.toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Record promo code usage & increment counter if a promo code was applied
  const promoCodeToLog = payment.promo_code || (payment.metadata?.promo_code as string | undefined);
  if (promoCodeToLog) {
    try {
      await supabaseInsert(env, 'promo_code_usages', {
        code: promoCodeToLog,
        user_id: payment.user_id,
        order_id: payment.order_id,
        transaction_id: transactionId || null,
        original_amount: payment.original_amount || payment.metadata?.original_amount || payment.amount,
        discount_amount: payment.discount_amount || payment.metadata?.discount_amount || 0,
        final_amount_paid: payment.amount,
        payment_provider: (payment.metadata?.provider as string) || 'easypaisa',
        plan_name: payment.plan_name,
        used_at: new Date().toISOString(),
      });

      await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/increment_promo_code_uses`, {
        method: 'POST',
        headers: serviceHeaders(env),
        body: JSON.stringify({ p_code: promoCodeToLog }),
      });
    } catch (promoErr) {
      log('error', 'promo_usage_log_failed', { orderId: payment.order_id, error: String(promoErr) });
    }
  }
  return true;
};

const MEDMACS_LOGO_URL = 'https://medmacs.app/email-logo.png';

const sendConfirmationEmail = async (env: Env, payment: PendingPayment, transactionId: string | null) => {
  if (!env.RESEND_API_KEY || !payment.email) return;
  const isCertificate = payment.payment_context === 'certificate_application';

  const days = payment.validity === 'yearly' ? 365 : Math.max(1, Number.parseInt(payment.validity || '30', 10) || 30);
  const expiryDate = new Date();
  expiryDate.setUTCDate(expiryDate.getUTCDate() + days);
  const formattedExpiry = expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const subject = isCertificate
    ? 'Certificate application received | Medmacs.app'
    : 'Thank you for trusting Medmacs.App';

  const html = isCertificate
    ? `
      <div style="background:#f0fdfa;padding:36px 18px;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #ccfbf1;border-radius:12px;overflow:hidden;">
          <div style="padding:22px 28px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;"><img src="${MEDMACS_LOGO_URL}" alt="Medmacs.app" width="42" height="42" border="0" style="display:block;width:42px;height:42px;outline:none;text-decoration:none;"></td>
                <td style="vertical-align:middle;">
                  <p style="margin:0;color:#0f172a;font-size:18px;font-weight:800;">Medmacs.app</p>
                  <p style="margin:2px 0 0;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Certificate Portal</p>
                </td>
              </tr>
            </table>
          </div>
          <div style="padding:26px 28px;border-bottom:1px solid #e2e8f0;">
            <h1 style="margin:0;color:#0f766e;font-size:24px;">Payment received</h1>
            <p style="margin:8px 0 0;color:#475569;">Your certificate application has been submitted for review.</p>
          </div>
          <div style="padding:26px 28px;line-height:1.6;">
            <p style="margin-top:0;">Hi there,</p>
            <p>We have received your payment for <strong>${payment.plan_name || 'certificate application'}</strong>.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:20px 0;">
              <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${payment.order_id}</p>
              <p style="margin:0 0 8px;"><strong>Transaction ID:</strong> ${transactionId || '-'}</p>
              <p style="margin:0;"><strong>Status:</strong> Submitted for approval</p>
            </div>
            <p>Once approved, your verified certificate will appear in your Medmacs certificate portal.</p>
            <p style="margin-bottom:0;">Warm regards,<br><strong>Team Medmacs</strong></p>
          </div>
        </div>
      </div>
    `
    : `
      <div style="background: linear-gradient(135deg, #008080 0%, #004d4d 100%); padding: 40px 20px; font-family: sans-serif;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="max-width:500px;width:100%;">
          <tr>
            <td style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 15px 35px rgba(0,0,0,0.2);">
              <div style="background:rgba(0,128,128,0.05);padding:30px;text-align:center;border-bottom:1px solid #eee;">
                <img src="${MEDMACS_LOGO_URL}" alt="Medmacs Logo" width="80" height="80" border="0" style="display:inline-block;width:80px;height:80px;outline:none;text-decoration:none;margin-bottom:15px;">
                <h2 style="color:#006666;margin:0;font-size:24px;letter-spacing:0.5px;">Payment Successful</h2>
              </div>
              <div style="padding: 30px; color: #333; line-height: 1.6;">
                <p>Hi there,</p>
                <p>Your subscription is now confirmed!</p>
                <div style="background: #f4fdfd; border-radius: 12px; padding: 20px; border: 1px solid #d1eded; margin: 20px 0;">
                  <p style="margin: 0; color: #666;">Active Plan:</p>
                  <p style="margin: 0 0 15px 0; font-size: 18px; color: #008080; font-weight: bold;">${payment.plan_name || 'Premium'}</p>
                  <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                    <tr><td style="padding: 4px 0; color: #555;">Order ID</td><td style="text-align: right; font-weight: bold;">${payment.order_id}</td></tr>
                    <tr><td style="padding: 4px 0; color: #555;">Transaction ID</td><td style="text-align: right;">${transactionId || '-'}</td></tr>
                    <tr><td style="padding: 4px 0; color: #555;">Valid Until</td><td style="text-align: right; font-weight: bold; color: #e67e22;">${formattedExpiry}</td></tr>
                  </table>
                </div>
                <p>Warm regards,<br><strong>Team Medmacs</strong></p>
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MedmacsApp <billing@medmacs.app>',
      to: [payment.email],
      cc: env.PAYMENT_CONFIRMATION_CC ? [env.PAYMENT_CONFIRMATION_CC] : undefined,
      subject,
      html,
    }),
  });
  if (!response.ok) log('error', 'payment_email_failed', { orderId: payment.order_id, status: response.status });
};

const handlePayFastWebhook = async (request: Request, env: Env, ctx: ExecutionContext) => {
  if (request.method !== 'POST' && request.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
  const data = await parseCallbackData(request);
  const basketId = cleanString(data.get('basket_id'), 100);
  const errorCode = cleanString(data.get('err_code'), 20);
  const receivedHash = cleanString(data.get('validation_hash'), 200);
  const transactionId = cleanString(data.get('transaction_id'), 150) || null;
  const reportedAmount = cleanString(data.get('amount') || data.get('TXNAMT'), 100);
  if (!basketId || !errorCode || !receivedHash) throw new HttpError(400, 'invalid_payfast_callback');

  const payment = await getPayment(env, basketId);
  if (!payment || payment.metadata?.provider !== 'payfast') return new Response('Order Not Found', { status: 404 });
  const sandbox = payment.metadata?.environment === 'sandbox';
  const sandboxEnv = env as SandboxEnv;
  const merchantId = sandbox ? sandboxEnv.PAYFAST_MERCHANT_ID_UAT : env.PAYFAST_MERCHANT_ID;
  const securedKey = sandbox ? sandboxEnv.PAYFAST_SECURED_KEY_UAT : env.PAYFAST_SECURED_KEY;
  if (!merchantId || !securedKey) throw new HttpError(503, 'payfast_not_configured');
  const expectedHash = await sha256Hex(`${basketId}|${securedKey}|${merchantId}|${errorCode}`);
  if (!(await constantTimeEqual(receivedHash, expectedHash))) {
    log('error', 'payfast_signature_rejected', { orderId: basketId });
    throw new HttpError(401, 'invalid_payfast_signature');
  }
  if (reportedAmount && formatMoney(parseMoney(reportedAmount)) !== formatMoney(parseMoney(payment.amount))) {
    log('error', 'payfast_amount_mismatch', { orderId: basketId, reportedAmount, storedAmount: payment.amount });
    throw new HttpError(409, 'payfast_amount_mismatch');
  }
  if (errorCode !== '000' && errorCode !== '00') {
    await supabaseUpdate(env, 'pending_payments', `order_id=eq.${encodeURIComponent(basketId)}&status=neq.success`, {
      status: 'failed', error_message: `PayFast Error: ${errorCode}`, transaction_id: transactionId,
    });
    return new Response('OK');
  }
  if (await fulfillPayment(env, payment, transactionId)) {
    ctx.waitUntil(sendConfirmationEmail(env, payment, transactionId));
    log('info', 'payfast_payment_fulfilled', { orderId: basketId });
  }
  return new Response('OK');
};

const validateEasypaisaStatusUrl = (rawUrl: string, env: Env) => {
  let statusUrl: URL;
  try {
    statusUrl = new URL(rawUrl);
  } catch {
    throw new HttpError(400, 'invalid_easypaisa_status_url');
  }
  const allowedOrigin = new URL(env.EASYPAISA_STATUS_ORIGIN);
  if (statusUrl.protocol !== 'https:' || statusUrl.origin !== allowedOrigin.origin) {
    throw new HttpError(400, 'invalid_easypaisa_status_url');
  }
  if (!/^\/easypay(?:-service|service)\/rest\/v\d+\/order-status\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\/?$/i.test(statusUrl.pathname)) {
    throw new HttpError(400, 'invalid_easypaisa_status_url');
  }
  return statusUrl;
};

const getParam = (data: URLSearchParams, ...keys: string[]) => {
  for (const key of keys) {
    const val = data.get(key);
    if (val !== null && val !== undefined && val.trim() !== '') return val.trim();
  }
  const normalizedKeys = new Set(keys.map((k) => k.toLowerCase().replace(/[\s_-]+/g, '')));
  for (const [k, v] of data.entries()) {
    const cleanK = k.toLowerCase().replace(/[\s_-]+/g, '');
    if (normalizedKeys.has(cleanK) && v !== null && v !== undefined && v.trim() !== '') {
      return v.trim();
    }
  }
  return '';
};

const handleEasypaisaWebhook = async (request: Request, env: Env, ctx: ExecutionContext) => {
  if (request.method !== 'GET' && request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
  const data = await parseCallbackData(request);

  // 1. Direct Merchant IPN Payload Path (parameters sent directly by Easypaisa IPN Handler)
  const directOrderId = cleanString(getParam(data, 'orderId', 'order_id', 'Order ID', 'dqrOrderId', 'dqr_order_id'), 100);
  const directStatus = cleanString(getParam(data, 'transactionStatus', 'transaction_status', 'Transaction Status', 'status'), 30).toUpperCase();
  const directResponseCode = cleanString(getParam(data, 'responseCode', 'response_code', 'Response Code', 'code'), 20);
  const directTransactionId = cleanString(getParam(data, 'transactionId', 'transaction_id', 'Transaction ID'), 150) || null;
  const directReturnedAmount = getParam(data, 'transactionAmount', 'transaction_amount', 'Transaction Amount', 'amount');
  const directDescription = cleanString(getParam(data, 'description', 'responseDesc', 'desc'), 200);

  if (directOrderId && (directStatus || directResponseCode)) {
    const payment = await getPayment(env, directOrderId);
    if (!payment || payment.metadata?.provider !== 'easypaisa') return new Response('Order Not Found', { status: 404 });

    if (directReturnedAmount) {
      try {
        if (formatMoney(parseMoney(directReturnedAmount)) !== formatMoney(parseMoney(payment.amount))) {
          log('error', 'easypaisa_amount_mismatch', { orderId: directOrderId });
          throw new HttpError(409, 'easypaisa_amount_mismatch');
        }
      } catch (err) {
        if (err instanceof HttpError) throw err;
      }
    }

    const isSuccess =
      (directResponseCode === '0000' || directResponseCode === '0' || !directResponseCode) &&
      (directStatus === 'PAID' || directStatus === 'SUCCESS' || directStatus === 'COMPLETED');

    if (isSuccess) {
      if (await fulfillPayment(env, payment, directTransactionId)) {
        ctx.waitUntil(sendConfirmationEmail(env, payment, directTransactionId));
        log('info', 'easypaisa_payment_fulfilled', { orderId: directOrderId });
      }
    } else if (['FAILED', 'BLOCKED', 'EXPIRED', 'REVERSED'].includes(directStatus)) {
      await supabaseUpdate(env, 'pending_payments', `order_id=eq.${encodeURIComponent(directOrderId)}&status=neq.success`, {
        status: 'failed', error_message: directDescription || `Easypaisa status: ${directStatus}`,
      });
    }
    return json({ status: 'acknowledged' });
  }

  // 2. Status URL Path (if 'url' parameter is passed)
  const rawStatusUrl = cleanString(data.get('url') || data.get('URL'), 1000);
  if (!rawStatusUrl) throw new HttpError(400, 'missing_easypaisa_status_url');
  const statusUrl = validateEasypaisaStatusUrl(rawStatusUrl, env);
  const credentials = btoa(`${env.EP_USERNAME}:${env.EP_PASSWORD}`);
  const response = await fetch(statusUrl, { headers: { Credentials: credentials } });
  if (!response.ok) throw new HttpError(502, 'easypaisa_status_unavailable');
  const result = await boundedJson<Record<string, unknown>>(response);
  const orderId = cleanString(result.order_id ?? result.orderId, 100);
  const responseCode = cleanString(result.response_code ?? result.responseCode, 20);
  const status = cleanString(result.transaction_status ?? result.transactionStatus, 30).toUpperCase();
  const description = cleanString(result.description ?? result.responseDesc, 200);
  const transactionId = cleanString(result.transaction_id ?? result.transactionId, 150) || null;
  if (!orderId) throw new HttpError(400, 'invalid_easypaisa_status');
  const payment = await getPayment(env, orderId);
  if (!payment || payment.metadata?.provider !== 'easypaisa') return new Response('Order Not Found', { status: 404 });
  const returnedAmount = result.transactionAmount ?? result.transaction_amount;
  if (returnedAmount !== undefined && formatMoney(parseMoney(returnedAmount)) !== formatMoney(parseMoney(payment.amount))) {
    log('error', 'easypaisa_amount_mismatch', { orderId });
    throw new HttpError(409, 'easypaisa_amount_mismatch');
  }
  if ((responseCode === '0000' || responseCode === '0') && (status === 'PAID' || status === 'SUCCESS')) {
    if (await fulfillPayment(env, payment, transactionId)) {
      ctx.waitUntil(sendConfirmationEmail(env, payment, transactionId));
      log('info', 'easypaisa_payment_fulfilled', { orderId });
    }
  } else if (['FAILED', 'BLOCKED', 'EXPIRED', 'REVERSED'].includes(status)) {
    await supabaseUpdate(env, 'pending_payments', `order_id=eq.${encodeURIComponent(orderId)}&status=neq.success`, {
      status: 'failed', error_message: description || `Easypaisa status: ${status}`,
    });
  }
  return json({ status: 'acknowledged' });
};

const getOrderStatus = async (request: Request, env: Env, orderId: string) => {
  const { user } = await requireUser(request, env);
  const payment = await getPayment(env, orderId, user.id);
  if (!payment) throw new HttpError(404, 'payment_order_not_found');
  return json({ orderId, status: payment.status, error: payment.status === 'failed' ? 'payment_failed' : null });
};

const getPlayBillingConfig = async (_request: Request, env: Env) => {
  return json({
    apiKey: env.REVENUECAT_SDK_KEY || '',
  });
};

type RevenueCatList<T> = { items?: T[] };
type RevenueCatActiveEntitlement = { entitlement_id: string; expires_at: number };
type RevenueCatSubscription = {
  entitlements?: RevenueCatList<{ id: string }>;
  environment?: string;
  gives_access?: boolean;
  product_id?: string;
  status?: string;
  store?: string;
  store_subscription_identifier?: string | null;
};
type RevenueCatCatalogEntitlement = { id: string; lookup_key: string };
type RevenueCatProduct = { id: string; store_identifier: string; display_name?: string | null };

type VerifiedPlayEntitlement = {
  plan: 'iconic' | 'premium';
  productId: string;
  transactionId: string | null;
  expiresAt: string;
  validity: 'monthly' | 'yearly';
};

const planFromIdentifiers = (...identifiers: Array<string | undefined>) => {
  const tokens = identifiers.join(' ').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.includes('premium')) return 'premium' as const;
  if (tokens.includes('iconic')) return 'iconic' as const;
  return null;
};

let revenueCatCatalogCache: {
  expiresAt: number;
  entitlementPlans: Map<string, 'iconic' | 'premium'>;
  products: Map<string, RevenueCatProduct>;
} | null = null;

const revenueCatHeaders = (env: Env) => ({
  Authorization: `Bearer ${env.REVENUECAT_SECRET_KEY}`,
  Accept: 'application/json',
});

const fetchRevenueCat = async <T>(env: Env, path: string): Promise<T> => {
  const response = await fetch(`https://api.revenuecat.com/v2/projects/${encodeURIComponent(env.REVENUECAT_PROJECT_ID)}/${path}`, {
    headers: revenueCatHeaders(env),
  });
  if (response.status === 404) throw new HttpError(404, 'revenuecat_customer_not_found');
  if (!response.ok) {
    log('error', 'revenuecat_verification_failed', { path: path.split('?')[0], status: response.status });
    throw new HttpError(502, 'play_billing_verification_unavailable');
  }
  return boundedJson<T>(response);
};

const getRevenueCatCatalog = async (env: Env) => {
  if (revenueCatCatalogCache && revenueCatCatalogCache.expiresAt > Date.now()) return revenueCatCatalogCache;
  const [entitlements, products] = await Promise.all([
    fetchRevenueCat<RevenueCatList<RevenueCatCatalogEntitlement>>(env, 'entitlements?limit=100'),
    fetchRevenueCat<RevenueCatList<RevenueCatProduct>>(env, 'products?limit=100'),
  ]);
  const entitlementPlans = new Map<string, 'iconic' | 'premium'>();
  for (const entitlement of entitlements.items || []) {
    const plan = planFromIdentifiers(entitlement.lookup_key);
    if (plan) entitlementPlans.set(entitlement.id, plan);
  }
  const catalog = {
    expiresAt: Date.now() + 300_000,
    entitlementPlans,
    products: new Map((products.items || []).map((product) => [product.id, product])),
  };
  revenueCatCatalogCache = catalog;
  return catalog;
};

const fetchVerifiedPlayEntitlement = async (env: Env, userId: string): Promise<VerifiedPlayEntitlement | null> => {
  if (!env.REVENUECAT_SECRET_KEY) throw new HttpError(503, 'play_billing_verification_not_configured');
  if (!env.REVENUECAT_PROJECT_ID) throw new HttpError(503, 'play_billing_project_not_configured');
  const customerId = encodeURIComponent(userId);
  const [activeEntitlements, subscriptions, catalog] = await Promise.all([
    fetchRevenueCat<RevenueCatList<RevenueCatActiveEntitlement>>(env, `customers/${customerId}/active_entitlements?limit=100`)
      .catch((error) => error instanceof HttpError && error.status === 404 ? { items: [] } : Promise.reject(error)),
    fetchRevenueCat<RevenueCatList<RevenueCatSubscription>>(env, `customers/${customerId}/subscriptions?limit=100`)
      .catch((error) => error instanceof HttpError && error.status === 404 ? { items: [] } : Promise.reject(error)),
    getRevenueCatCatalog(env),
  ]);
  const now = Date.now();
  const active = (activeEntitlements.items || [])
    .map((entitlement) => {
      const plan = catalog.entitlementPlans.get(entitlement.entitlement_id);
      if (!plan || !Number.isFinite(entitlement.expires_at) || entitlement.expires_at <= now) return null;
      const subscription = (subscriptions.items || []).find((candidate) =>
        candidate.gives_access && candidate.store === 'play_store' && candidate.status !== 'expired' &&
        candidate.entitlements?.items?.some((item) => item.id === entitlement.entitlement_id));
      if (!subscription?.product_id) return null;
      const product = catalog.products.get(subscription.product_id);
      if (!product || planFromIdentifiers(product.store_identifier, product.display_name || undefined) !== plan) return null;
      return {
        plan,
        productId: product.store_identifier,
        transactionId: subscription.store_subscription_identifier || null,
        expiresAt: new Date(entitlement.expires_at).toISOString(),
        validity: /year|annual/i.test(`${product.store_identifier} ${product.display_name || ''}`) ? 'yearly' as const : 'monthly' as const,
      };
    })
    .filter((value): value is VerifiedPlayEntitlement => value !== null)
    .sort((a, b) => {
      if (a.plan !== b.plan) return a.plan === 'premium' ? -1 : 1;
      return Date.parse(b.expiresAt) - Date.parse(a.expiresAt);
    });
  return active[0] || null;
};

const getPlanPrice = async (env: Env, entitlement: VerifiedPlayEntitlement) => {
  const rows = await supabaseSelect<{ price: number | string }>(
    env,
    `pricing_plans?name=eq.${entitlement.plan}&type=eq.${entitlement.validity}&currency=eq.PKR&select=price&limit=1`,
  );
  return rows[0] ? parseMoney(rows[0].price) : 0;
};

const syncVerifiedPlayEntitlement = async (
  env: Env,
  userId: string,
  email: string | null,
  eventId?: string,
) => {
  const entitlement = await fetchVerifiedPlayEntitlement(env, userId);
  if (!entitlement) {
    await supabaseUpdate(env, 'profiles', `id=eq.${encodeURIComponent(userId)}`, {
      plan: 'free', plan_expiry_date: null, updated_at: new Date().toISOString(),
    });
    return { entitlement: null, payment: null, created: false };
  }

  await supabaseUpdate(env, 'profiles', `id=eq.${encodeURIComponent(userId)}`, {
    plan: entitlement.plan,
    plan_expiry_date: entitlement.expiresAt,
    updated_at: new Date().toISOString(),
  });

  const stableId = entitlement.transactionId || eventId;
  if (!stableId) return { entitlement, payment: null, created: false };
  const orderId = `rc_${stableId}`.slice(0, 100);
  const existing = await getPayment(env, orderId, userId);
  if (existing) return { entitlement, payment: existing, created: false };
  const payment: PendingPayment = {
    order_id: orderId,
    user_id: userId,
    amount: await getPlanPrice(env, entitlement),
    status: 'success',
    plan_name: entitlement.plan === 'premium' ? 'Premium' : 'Iconic',
    validity: entitlement.validity,
    email,
    payment_context: 'subscription',
    certificate_application_id: null,
    transaction_id: entitlement.transactionId,
    metadata: { provider: 'google_play', product_id: entitlement.productId, verified_by: 'revenuecat' },
  };
  await supabaseInsert(env, 'pending_payments', payment);
  return { entitlement, payment, created: true };
};

const confirmPlayBillingPayment = async (request: Request, env: Env, ctx: ExecutionContext) => {
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
  const { user } = await requireUser(request, env);
  await request.json().catch(() => null);
  const result = await syncVerifiedPlayEntitlement(env, user.id, user.email || null);
  if (!result.entitlement) throw new HttpError(409, 'no_verified_play_entitlement');
  if (result.created && result.payment?.email) {
    ctx.waitUntil(sendConfirmationEmail(env, result.payment, result.entitlement.transactionId));
  }
  return json({ success: true, plan: result.entitlement.plan, expiryDate: result.entitlement.expiresAt });
};

const handleRevenueCatWebhook = async (request: Request, env: Env, ctx: ExecutionContext) => {
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
  const authorization = request.headers.get('Authorization') || '';
  if (!env.REVENUECAT_WEBHOOK_AUTH || !(await constantTimeEqualExact(authorization, env.REVENUECAT_WEBHOOK_AUTH))) {
    throw new HttpError(401, 'invalid_revenuecat_webhook_authorization');
  }
  const payload = await request.json<{
    event?: {
      id?: string;
      type?: string;
      app_user_id?: string;
    };
  }>().catch(() => null);

  const event = payload?.event;
  if (!event || !event.app_user_id) {
    return json({ error: 'invalid_event' }, 400);
  }

  const userId = event.app_user_id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    log('info', 'revenuecat_non_user_event_ignored', { eventId: event.id || null, eventType: event.type || null });
    return json({ status: 'ignored' });
  }
  const eventType = event.type || '';
  const profiles = await supabaseSelect<{ email: string | null }>(
    env, `profiles?id=eq.${encodeURIComponent(userId)}&select=email&limit=1`,
  );
  if (!profiles[0]) return json({ status: 'ignored' });
  const result = await syncVerifiedPlayEntitlement(env, userId, profiles[0].email, event.id);
  if (result.created && result.payment?.email && ['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE'].includes(eventType)) {
    ctx.waitUntil(sendConfirmationEmail(env, result.payment, result.entitlement?.transactionId || null));
  }
  log('info', 'revenuecat_event_processed', { userId, eventId: event.id || null, eventType, activePlan: result.entitlement?.plan || 'free' });
  return json({ status: 'acknowledged' });
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const route = async (request: Request, env: Env, ctx: ExecutionContext) => {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeadersFor(request) });
  if (url.pathname === '/' || url.pathname === '/health') {
    const configured = Boolean(
      env.SUPABASE_SERVICE_ROLE_KEY &&
        env.PAYFAST_MERCHANT_ID &&
        env.PAYFAST_SECURED_KEY &&
        env.EP_USERNAME &&
        env.EP_PASSWORD &&
        env.EP_STORE_ID &&
        env.RESEND_API_KEY &&
        env.REVENUECAT_SDK_KEY &&
        env.REVENUECAT_SECRET_KEY &&
        env.REVENUECAT_WEBHOOK_AUTH &&
        env.REVENUECAT_PROJECT_ID,
    );
    if (!configured) return json({ ok: false, service: 'medmacs-payments', configured: false }, 503);
    return json({ ok: true, service: 'medmacs-payments', configured: true });
  }
  if (url.pathname === '/v1/orders' && request.method === 'POST') return createOrder(request, env);
  if (url.pathname === '/v1/payfast/session' && request.method === 'POST') return createPayFastSession(request, env);
  if (url.pathname === '/v1/easypaisa/initiate' && request.method === 'POST') return createEasypaisaPayment(request, env);
  if (url.pathname === '/v1/play-billing/config' && request.method === 'GET') return getPlayBillingConfig(request, env);
  if (url.pathname === '/v1/play-billing/confirm' && request.method === 'POST') return confirmPlayBillingPayment(request, env, ctx);
  if (url.pathname === '/v1/webhooks/revenuecat' && request.method === 'POST') return handleRevenueCatWebhook(request, env, ctx);
  if (url.pathname === '/v1/webhooks/payfast') return handlePayFastWebhook(request, env, ctx);
  if (url.pathname === '/v1/webhooks/easypaisa') return handleEasypaisaWebhook(request, env, ctx);
  const orderMatch = url.pathname.match(/^\/v1\/orders\/([A-Za-z0-9-]+)$/);
  if (orderMatch?.[1] && request.method === 'GET') return getOrderStatus(request, env, orderMatch[1]);
  throw new HttpError(404, 'not_found');
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const origin = request.headers.get('Origin');
      if (origin && !ALLOWED_ORIGINS.has(origin) && !new URL(request.url).pathname.startsWith('/v1/webhooks/')) {
        return withCors(json({ error: 'origin_not_allowed' }, 403), request);
      }
      return withCors(await route(request, env, ctx), request);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : 'internal_error';
      log('error', 'request_failed', { path: new URL(request.url).pathname, status, message });
      return withCors(json({ error: message }, status), request);
    }
  },
} satisfies ExportedHandler<Env>;

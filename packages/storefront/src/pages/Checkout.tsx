import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.js';
import { useAuth } from '../context/AuthContext.js';
import ZonePreview from '../components/ZonePreview.js';

type OrderType = 'delivery' | 'pickup';
type PaymentMethod = 'cash' | 'stripe' | 'paypal';

const TAX_RATE = 0.08;

export default function Checkout() {
  const { t } = useTranslation();
  const { items, subtotal, clear } = useCart();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: '', zip: '' });
  const [scheduledAt, setScheduledAt] = useState('');
  const [comment, setComment] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Guest checkout fields
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // Dynamic delivery fee from zone check
  const [deliveryFee, setDeliveryFee] = useState(4.99);
  const [zoneError, setZoneError] = useState('');
  // Geocoded coordinates from the address — attached to the order body so the
  // server can pick the right zone.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Busy mode
  const [isBusy, setIsBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState('');

  // Next-day cutoff mode: when any active zone has a cutoffTime, the storefront
  // forces scheduled orders for the next available lunch slot.
  const [nextDayMode, setNextDayMode] = useState(false);

  // Loyalty points
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0);
  const loyaltyDiscount = loyaltyRedeem / 100;

  const tax = subtotal * TAX_RATE;
  const currentDeliveryFee = orderType === 'delivery' ? deliveryFee : 0;
  const total = subtotal + tax + currentDeliveryFee - loyaltyDiscount;

  // Check busy mode and next-day cutoff config on mount
  useEffect(() => {
    (async () => {
      try {
        const locRes = await fetch('/api/locations');
        const locJson = await locRes.json();
        const loc = locJson.data?.[0];
        if (!loc) return;
        if (loc.isBusy) {
          setIsBusy(true);
          setBusyMessage(loc.busyMessage || 'This location is currently not accepting orders.');
        }
        const zoneRes = await fetch(`/api/locations/${loc.id}/delivery-zones`);
        const zoneJson = await zoneRes.json();
        const hasCutoff = (zoneJson.data ?? []).some((z: { isActive: boolean; cutoffTime: string | null }) => z.isActive && z.cutoffTime);
        if (hasCutoff) {
          setNextDayMode(true);
          setScheduledAt(getNextLunchSlot());
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Fetch loyalty balance for logged-in users
  useEffect(() => {
    if (token) {
      fetch('/api/loyalty/balance', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setLoyaltyBalance(data.data.points);
        })
        .catch(() => {});
    }
  }, [token]);

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('checkout.emptyCart')}</h1>
        <Link
          to="/menu"
          className="inline-block bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          {t('checkout.browseMenu')}
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const orderItems = items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        comment: item.comment,
        options: item.options.map((o) => ({
          menuOptionValueId: o.valueId,
          name: o.optionName,
          value: o.valueName,
          priceModifier: o.priceModifier,
        })),
      }));

      const body: Record<string, unknown> = {
        orderType: orderType.toUpperCase(),
        paymentMethod,
        items: orderItems,
        comment: comment || undefined,
        scheduledAt: scheduledAt || undefined,
        couponCode: couponCode || undefined,
      };

      if (orderType === 'delivery') {
        body.address = coords
          ? { ...address, lat: coords.lat, lng: coords.lng }
          : address;
      }

      // Guest info
      if (!user) {
        body.guestName = guestName;
        body.guestEmail = guestEmail;
        body.guestPhone = guestPhone || undefined;
      }

      // Loyalty points
      if (loyaltyRedeem > 0) {
        body.loyaltyPointsRedeem = loyaltyRedeem;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');

      const orderId = data.data.id as string;

      // Stripe path: hand the user off to the hosted Checkout page. Stripe
      // brings them back to /order/:id?paid=true on success (the webhook
      // is what actually flips Order.status). Cancel falls back to /checkout.
      if (paymentMethod === 'stripe') {
        const sessRes = await fetch('/api/payments/create-checkout-session', {
          method: 'POST',
          headers,
          body: JSON.stringify({ orderId }),
        });
        const sessData = await sessRes.json();
        if (!sessRes.ok || !sessData.data?.url) {
          throw new Error(sessData.error || 'Failed to start Stripe checkout');
        }
        // Don't clear the cart yet — only after Stripe confirms. If the
        // user backs out of the hosted page, they return to a still-loaded
        // checkout and can retry without re-typing everything.
        window.location.href = sessData.data.url as string;
        return;
      }

      clear();
      navigate(`/order/${orderId}`, { state: { order: data.data } });
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      {/* Editorial masthead for the checkout */}
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <span className="block h-px w-10 bg-saffron" />
          <span className="eyebrow text-saffron">The Reservation</span>
        </div>
        <h1 className="font-display mt-4 text-4xl sm:text-5xl text-ink leading-tight tracking-tight-display">
          Pick your slot.
        </h1>
        <p className="font-editorial italic text-base text-ink-soft mt-2 max-w-xl">
          Each step takes the same care we'd give a printed menu. The kitchen
          locks the count at sundown.
        </p>
        <div className="rule-strong mt-6" />
      </header>

      {isBusy && (
        <div className="border border-saffron/40 bg-paper-100 text-ink p-4 mb-6">
          <p className="font-display text-lg text-saffron">Currently Unavailable</p>
          <p className="font-editorial italic text-sm mt-1 text-ink-soft">{busyMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8">
        {/* Left: Form */}
        <div className="flex-1 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{error}</div>
          )}

          {/* Order type — paired choice, like a printed ticket toggle */}
          <div className="relative border border-tobacco/40 bg-paper-50 p-6 lg:p-7">
            <span className="absolute -top-2.5 left-5 bg-paper-50 px-2 eyebrow">i · Order Type</span>
            <h2 className="font-display text-2xl text-ink mb-5 leading-tight">{t('checkout.orderType')}</h2>
            <div className="grid grid-cols-2 divide-x divide-tobacco/40 border border-tobacco/40">
              <button
                type="button"
                onClick={() => setOrderType('delivery')}
                className={`py-3 font-ui text-xs uppercase tracking-eyebrow transition-colors ${
                  orderType === 'delivery'
                    ? 'bg-ink text-paper'
                    : 'text-ink hover:bg-paper-100'
                }`}
              >
                {t('checkout.delivery')}
              </button>
              <button
                type="button"
                onClick={() => setOrderType('pickup')}
                className={`py-3 font-ui text-xs uppercase tracking-eyebrow transition-colors ${
                  orderType === 'pickup'
                    ? 'bg-ink text-paper'
                    : 'text-ink hover:bg-paper-100'
                }`}
              >
                {t('checkout.pickup')}
              </button>
            </div>
          </div>

          {/* Delivery address */}
          {orderType === 'delivery' && (
            <div className="relative border border-tobacco/40 bg-paper-50 p-6 lg:p-7">
              <h2 className="font-display text-2xl text-ink mb-5 leading-tight">{t('checkout.deliveryAddress')}</h2>
              {zoneError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-3">{zoneError}</div>
              )}
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder={t('checkout.addressLine1')}
                  value={address.line1}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
                />
                <input
                  type="text"
                  placeholder={t('checkout.addressLine2')}
                  value={address.line2}
                  onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                  className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
                />
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder={t('checkout.city')}
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    className="bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
                  />
                  <input
                    type="text"
                    required
                    placeholder={t('checkout.state')}
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    className="bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
                  />
                  <input
                    type="text"
                    required
                    placeholder={t('checkout.zipCode')}
                    value={address.zip}
                    onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                    className="bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
                  />
                </div>
              </div>
              <ZonePreview
                address={address}
                onLatLng={(lat, lng) => setCoords({ lat, lng })}
                onMatch={(zone) => setDeliveryFee(zone ? zone.charge : 4.99)}
              />
            </div>
          )}

          {/* Schedule — the reservation card. Day chips left, time hint right. */}
          <div className="relative border-2 border-ink bg-paper-50 p-6 lg:p-7">
            <span className="absolute -top-2.5 left-5 bg-paper-50 px-2 eyebrow text-saffron">ii · The Slot</span>
            <h2 className="font-display text-2xl text-ink mb-1 leading-tight">
              {nextDayMode
                ? 'Your Lunch Slot'
                : t('checkout.scheduling')}
            </h2>
            {nextDayMode && (
              <p className="font-editorial italic text-sm text-ink-soft mb-5">
                Lunch lands at noon. Choose any future weekday — we'll lock it in tonight.
              </p>
            )}

            {nextDayMode ? (
              <ReservationSlot value={scheduledAt} onChange={setScheduledAt} />
            ) : (
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="schedule"
                    checked={!scheduledAt}
                    onChange={() => setScheduledAt('')}
                    className="accent-saffron"
                  />
                  <span className="font-ui text-sm text-ink">{t('checkout.asap')}</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="schedule"
                    checked={!!scheduledAt}
                    onChange={() => setScheduledAt(getDefaultScheduleTime())}
                    className="accent-saffron"
                  />
                  <span className="font-ui text-sm text-ink">{t('checkout.scheduled')}</span>
                </label>
                {scheduledAt && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
                  />
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="relative border border-tobacco/40 bg-paper-50 p-6 lg:p-7">
            <h2 className="font-display text-2xl text-ink mb-5 leading-tight">{t('checkout.orderNotes')}</h2>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute resize-none"
            />
          </div>

          {/* Coupon */}
          <div className="relative border border-tobacco/40 bg-paper-50 p-6 lg:p-7">
            <h2 className="font-display text-2xl text-ink mb-5 leading-tight">{t('checkout.couponCode')}</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1 bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
              />
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('checkout.apply')}
              </button>
            </div>
          </div>

          {/* Loyalty Points Redemption */}
          {user && loyaltyBalance > 0 && (
            <div className="relative border border-tobacco/40 bg-paper-50 p-6 lg:p-7">
              <h2 className="font-display text-2xl text-ink mb-5 leading-tight">Loyalty Points</h2>
              <p className="text-sm text-gray-600 mb-3">
                You have <span className="font-bold text-primary-600">{loyaltyBalance}</span> points available
                (100 points = $1.00)
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={Math.min(loyaltyBalance, Math.floor(subtotal * 100))}
                  step={100}
                  value={loyaltyRedeem}
                  onChange={(e) => setLoyaltyRedeem(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-32 bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
                  placeholder="0"
                />
                <span className="text-sm text-gray-600">points to redeem</span>
                {loyaltyRedeem > 0 && (
                  <span className="text-sm font-medium text-green-600">
                    -${loyaltyDiscount.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Payment method */}
          <div className="relative border border-tobacco/40 bg-paper-50 p-6 lg:p-7">
            <h2 className="font-display text-2xl text-ink mb-5 leading-tight">{t('checkout.paymentMethod')}</h2>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${
                paymentMethod === 'cash'
                  ? 'border-ink bg-paper-100'
                  : 'border-tobacco/40 hover:border-ink'
              }`}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                  className="accent-saffron"
                />
                <span className="font-ui text-sm text-ink">{t('checkout.cashOnDelivery')}</span>
              </label>
              <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${
                paymentMethod === 'stripe'
                  ? 'border-ink bg-paper-100'
                  : 'border-tobacco/40 hover:border-ink'
              }`}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'stripe'}
                  onChange={() => setPaymentMethod('stripe')}
                  className="accent-saffron"
                />
                <span className="font-ui text-sm text-ink">{t('checkout.creditCard')}</span>
              </label>
              <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${
                paymentMethod === 'paypal'
                  ? 'border-ink bg-paper-100'
                  : 'border-tobacco/40 hover:border-ink'
              }`}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'paypal'}
                  onChange={() => setPaymentMethod('paypal')}
                  className="accent-saffron"
                />
                <span className="font-ui text-sm text-ink">PayPal</span>
              </label>
            </div>
          </div>

          {/* Guest info or login prompt */}
          {!user && (
            <div className="relative border border-tobacco/40 bg-paper-50 p-6 lg:p-7">
              <h2 className="font-display text-2xl text-ink mb-5 leading-tight">Contact Information</h2>
              <p className="text-sm text-gray-600 mb-3">
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium underline">
                  {t('nav.login')}
                </Link>{' '}
                for faster checkout, or continue as guest:
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Full name *"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
                />
                <input
                  type="email"
                  required
                  placeholder="Email address *"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
                />
                <input
                  type="tel"
                  placeholder="Phone number (optional)"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-ui text-sm placeholder:text-ink-mute"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: editorial order ledger */}
        <div className="lg:w-96 shrink-0">
          <div className="relative bg-ink text-paper p-7 lg:p-8 sticky top-24">
            <div className="flex items-center gap-3 mb-1">
              <span className="block h-px w-8" style={{ background: 'var(--saffron)' }} />
              <span className="eyebrow" style={{ color: 'var(--saffron)' }}>The Ledger</span>
            </div>
            <h2 className="font-display text-2xl text-paper mb-6 leading-tight">
              {t('checkout.orderSummary')}
            </h2>

            <ul className="space-y-3 mb-5">
              {items.map((item) => {
                const optionsTotal = item.options.reduce((s, o) => s + o.priceModifier, 0);
                return (
                  <li key={item.id} className="flex items-baseline gap-2">
                    <span className="font-mono-tabular text-xs text-paper/55 w-6">
                      {String(item.quantity).padStart(2, '0')}×
                    </span>
                    <span className="font-editorial text-sm text-paper flex-1 leading-snug">
                      {item.name}
                      {item.options.length > 0 && (
                        <span className="block text-xs italic text-paper/55 mt-0.5">
                          {item.options.map((o) => o.valueName).join(', ')}
                        </span>
                      )}
                    </span>
                    <span className="font-mono-tabular text-sm text-paper whitespace-nowrap">
                      €{((item.price + optionsTotal) * item.quantity).toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-paper/20 pt-4 space-y-2 font-mono-tabular text-xs uppercase tracking-wider">
              <Row label={t('checkout.subtotal')} value={`€${subtotal.toFixed(2)}`} />
              <Row label={t('checkout.tax')} value={`€${tax.toFixed(2)}`} />
              {orderType === 'delivery' && (
                <Row label={t('checkout.deliveryFee')} value={`€${currentDeliveryFee.toFixed(2)}`} />
              )}
              {loyaltyDiscount > 0 && (
                <Row label="Loyalty Discount" value={`-€${loyaltyDiscount.toFixed(2)}`} accent />
              )}
            </div>

            <div className="border-t border-paper/40 mt-4 pt-4 flex items-baseline justify-between">
              <span className="eyebrow text-paper/70">Total Due</span>
              <span className="font-display text-3xl text-paper">€{total.toFixed(2)}</span>
            </div>

            <button
              type="submit"
              disabled={loading || isBusy}
              className="group relative w-full mt-6 bg-paper text-ink py-4 font-ui text-sm font-medium tracking-wide hover:bg-saffron hover:text-paper transition-colors disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-3">
                {isBusy
                  ? 'Currently Unavailable'
                  : loading
                    ? t('checkout.processing')
                    : `${t('checkout.placeOrder')} — €${total.toFixed(2)}`}
                {!loading && !isBusy && <span className="transition-transform group-hover:translate-x-1">→</span>}
              </span>
            </button>
            <p className="font-editorial italic text-xs text-paper/55 mt-4 text-center">
              Cards processed by Stripe. Cash on delivery available.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

function getDefaultScheduleTime(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toDatetimeLocal(d);
}

interface SlotProps {
  value: string;
  onChange: (v: string) => void;
}

const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WD_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MO_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Day-chip selector for the next-day lunch slot. Renders the next 7 weekdays
 * (skipping weekends) as ticket-style chips. Selecting a chip sets the time
 * to noon on that day; the time can still be fine-tuned with the hidden
 * datetime-local field below.
 */
function ReservationSlot({ value, onChange }: SlotProps) {
  // Generate the next 7 weekdays from tomorrow.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidates: Date[] = [];
  let cursor = new Date(today);
  cursor.setDate(cursor.getDate() + 1);
  while (candidates.length < 7) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) candidates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const selected = value ? new Date(value) : null;
  const selectedKey = selected
    ? `${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}`
    : null;

  function pick(d: Date) {
    const next = new Date(d);
    next.setHours(12, 0, 0, 0);
    onChange(toDatetimeLocal(next));
  }

  const selectedTime = selected
    ? `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`
    : '12:00';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
        {candidates.map((d) => {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => pick(d)}
              className={`group relative flex flex-col items-center py-2.5 px-1 border transition-colors ${
                isSelected
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper-50 text-ink border-tobacco/40 hover:border-ink hover:bg-paper-100'
              }`}
            >
              <span className="font-mono-tabular text-[9px] tracking-eyebrow uppercase opacity-70">
                {WD_SHORT[d.getDay()]}
              </span>
              <span className="font-display text-2xl leading-none mt-0.5">
                {String(d.getDate()).padStart(2, '0')}
              </span>
              <span className="font-mono-tabular text-[9px] tracking-eyebrow uppercase opacity-70 mt-0.5">
                {MO_SHORT[d.getMonth()]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Reservation ticket — appears when a slot is picked */}
      {selected && (
        <div className="flex items-center justify-between border-t border-dashed border-ink/40 pt-4">
          <div>
            <span className="eyebrow">Confirmed for</span>
            <p className="font-display text-xl text-ink mt-1 leading-tight">
              {WD_LONG[selected.getDay()]}, {selected.getDate()} {MO_SHORT[selected.getMonth()]}
            </p>
          </div>
          <div className="text-right">
            <span className="eyebrow">Delivery</span>
            <p className="font-mono-tabular text-xl text-saffron mt-1">{selectedTime}</p>
          </div>
        </div>
      )}

      <details className="text-sm">
        <summary className="font-ui text-xs uppercase tracking-eyebrow text-ink-mute cursor-pointer hover:text-saffron">
          Fine-tune the time
        </summary>
        <input
          type="datetime-local"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-3 w-full bg-transparent border-0 border-b border-ink/30 focus:border-saffron outline-none px-0 py-2 font-mono-tabular text-sm"
        />
      </details>
    </div>
  );
}

function getNextLunchSlot(): string {
  const d = new Date();
  // If lunch is already underway today, jump to tomorrow.
  if (d.getHours() >= 11) {
    d.setDate(d.getDate() + 1);
  }
  // Skip past weekends — corporate lunch days are Mon–Fri.
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  d.setHours(12, 0, 0, 0);
  return toDatetimeLocal(d);
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-paper/55">{label}</span>
      <span className={accent ? 'text-saffron' : 'text-paper'}>{value}</span>
    </div>
  );
}

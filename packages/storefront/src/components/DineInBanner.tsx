import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.js';

// Persistent, site-wide indicator that the diner scanned a table QR and is
// ordering for that table. Renders nothing outside a dine-in session.
export default function DineInBanner() {
  const { dineIn, setDineIn } = useCart();
  const { t } = useTranslation();

  if (!dineIn) return null;

  return (
    <div className="bg-primary-600 text-white text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <span>
          {t('dineInBanner.ordering')} <span className="font-semibold">{dineIn.tableName}</span>
        </span>
        <button
          type="button"
          onClick={() => setDineIn(null)}
          className="underline underline-offset-2 hover:no-underline text-white/90 whitespace-nowrap"
        >
          {t('dineInBanner.leave')}
        </button>
      </div>
    </div>
  );
}

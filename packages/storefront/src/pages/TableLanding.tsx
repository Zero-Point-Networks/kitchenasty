import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.js';

// Entry point for a scanned table QR code (/t/:token). Resolves the token
// to its table + location, stores dine-in context, and forwards to the menu.
export default function TableLanding() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setDineIn } = useCart();
  const { t } = useTranslation();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetch(`/api/locations/tables/by-token/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Table not found');
        if (cancelled) return;
        setDineIn({
          token,
          locationId: data.data.locationId,
          tableId: data.data.tableId,
          tableName: data.data.tableName,
        });
        navigate('/menu', { replace: true });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Table not found');
      });

    return () => {
      cancelled = true;
    };
  }, [token, setDineIn, navigate]);

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{t('tableLanding.invalidTitle')}</h1>
        <p className="text-gray-600 mb-6">{t('tableLanding.invalidBody')}</p>
        <Link
          to="/menu"
          className="inline-block bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          {t('tableLanding.browseMenu')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <p className="text-gray-600">{t('tableLanding.loading')}</p>
    </div>
  );
}

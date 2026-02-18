import { Link, useLocation, useParams } from 'react-router-dom';

export default function OrderConfirmation() {
  const { id } = useParams();
  const location = useLocation();
  const order = location.state?.order;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Placed!</h1>
      <p className="text-gray-600 mb-2">Thank you for your order.</p>

      {(order?.orderNumber || id) && (
        <p className="text-sm text-gray-500 mb-6">
          Order {order?.orderNumber ? `#${order.orderNumber}` : `ID: ${id}`}
        </p>
      )}

      {order && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left mb-8">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Type</span>
              <p className="font-medium text-gray-900">{order.orderType}</p>
            </div>
            <div>
              <span className="text-gray-500">Status</span>
              <p className="font-medium text-gray-900">{order.status}</p>
            </div>
            <div>
              <span className="text-gray-500">Subtotal</span>
              <p className="font-medium text-gray-900">${order.subtotal?.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-gray-500">Total</span>
              <p className="font-bold text-primary-600">${order.total?.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4">
        <Link
          to="/menu"
          className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          Order More
        </Link>
        <Link
          to="/"
          className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

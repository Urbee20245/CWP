import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Phone } from 'lucide-react';

const ProSitesSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="bg-slate-50 min-h-screen py-16 px-4">
      <div className="max-w-2xl mx-auto text-center">

        {/* Checkmark */}
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-100 rounded-full p-5">
            <CheckCircle2 className="w-16 h-16 text-emerald-600" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3">
          You're All Set! 🎉
        </h1>
        <p className="text-slate-600 text-lg mb-8 leading-relaxed">
          Thank you! Your order is confirmed and payment has been received.
        </p>

        {/* What's Next Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 text-left mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-5">What happens next:</h2>
          <ol className="space-y-4">
            {[
              "You'll receive a confirmation email shortly.",
              'Our team will review your order and begin building your site.',
              "We'll reach out within 24 hours if we have any questions.",
              "Once your site is ready, we'll send you a link to review it.",
              'After your approval, your site goes live!',
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full text-xs font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-slate-600 text-sm leading-relaxed">{item}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Contact */}
        <div className="mb-8">
          <a
            href="tel:4702646256"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-medium transition-colors"
          >
            <Phone className="w-4 h-4" />
            Questions? Call us at (470) 264-6256
          </a>
        </div>

        {/* Home Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl transition-all active:scale-95 shadow-md shadow-indigo-200"
        >
          Back to Home
        </Link>

        {/* Session ID for debugging (hidden from view but present) */}
        {sessionId && (
          <p className="mt-6 text-xs text-slate-300">Session: {sessionId}</p>
        )}
      </div>
    </div>
  );
};

export default ProSitesSuccess;

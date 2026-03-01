import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Phone, Rocket } from 'lucide-react';

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
              "We'll reach out within 7 days if we have any questions.",
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

        {/* GEM CTA */}
        <div className="bg-indigo-600 rounded-2xl p-6 md:p-8 text-left mb-8 text-white">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 bg-white/20 rounded-xl p-3">
              <Rocket className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">Complete Your Setup Now</h2>
              <p className="text-indigo-100 text-sm mb-4 leading-relaxed">
                We're sending your personalized setup link to your email shortly. Use it to configure your phone number, business profile, and more — all in one guided flow.
              </p>
              <p className="text-indigo-200 text-xs">
                Check your inbox for an email with your setup link. It may take a few minutes to arrive.
              </p>
            </div>
          </div>
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
          className="inline-flex items-center gap-2 border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 font-semibold px-8 py-3 rounded-xl transition-all"
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

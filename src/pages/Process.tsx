import React from 'react';
import { Link } from 'react-router-dom';

const ProcessPage: React.FC = () => {
  return (
    <main className="bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <header className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">Our Process</h1>
          <p className="mt-6 text-slate-600 leading-relaxed">
            If your website feels outdated or isn’t bringing in steady leads, we help you modernize it and make it easier for
            customers to trust you and contact you.
          </p>
        </header>

        <section className="mt-14">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-8">
              <h2 className="text-lg font-bold text-slate-900">1. Visual Check (JetViz)</h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                We look at your site the way a new customer does. We check if it looks current, clear, and trustworthy at a
                glance.
              </p>
              <div className="mt-5">
                <Link to="/services/jetviz" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  View JetViz
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-8">
              <h2 className="text-lg font-bold text-slate-900">2. Website Audit (Jet Local Optimizer)</h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                We review what’s holding your site back. Then we give you a clear list of what to fix and what to improve.
              </p>
              <div className="mt-5">
                <Link to="/jet-local-optimizer" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  Run an audit
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-8">
              <h2 className="text-lg font-bold text-slate-900">3. Website Rebuild &amp; Optimization</h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                We rebuild your website so it’s clean, modern, and easy to use. We focus on clear messaging, simple
                navigation, and strong calls to action.
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-8">
              <h2 className="text-lg font-bold text-slate-900">4. Ongoing Improvements (optional)</h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                If you want, we can keep improving over time. This can include small updates, new pages, and ongoing
                refinements based on what customers respond to.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default ProcessPage;

"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { Frown, ArrowLeft } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center pt-20">
      <Frown className="w-16 h-16 text-indigo-600 mb-6" />
      <h1 className="text-4xl font-bold text-slate-900 mb-4">404 - Page Not Found</h1>
      <p className="text-lg text-slate-600 max-w-md mb-8">
        The page you are looking for does not exist. It might have been moved or deleted.
      </p>
      <Link
        to="/"
        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Go to Homepage
      </Link>
    </div>
  );
};

export default NotFoundPage;
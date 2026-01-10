"use client";

import React from 'react';
import { CheckCircle2, X, ArrowRight, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  ctaText?: string;
  ctaLink?: string;
}

const SuccessDialog: React.FC<SuccessDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  ctaText = 'Return to Homepage',
  ctaLink = '/',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-emerald-200 animate-scale-in">
        
        {/* Header */}
        <div className="flex justify-end">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="text-center -mt-4">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          
          <h3 className="text-3xl font-bold text-slate-900 mb-3">{title}</h3>
          <p className="text-slate-600 mb-8 leading-relaxed">{message}</p>
          
          {/* CTA Button */}
          <Link
            to={ctaLink}
            onClick={onClose}
            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20"
          >
            {ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {/* Footer Contact Info */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Need Immediate Help?</p>
            <div className="flex justify-center gap-6 text-sm">
                <a href="tel:8442130694" className="flex items-center gap-1 text-slate-700 hover:text-indigo-600 transition-colors">
                    <Phone className="w-4 h-4" /> (844) 213-0694
                </a>
                <a href="mailto:hello@customwebsitesplus.com" className="flex items-center gap-1 text-slate-700 hover:text-indigo-600 transition-colors">
                    <Mail className="w-4 h-4" /> Email
                </a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessDialog;
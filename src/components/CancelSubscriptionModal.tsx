"use client";

import React, { useState } from 'react';
import { X, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  planName: string;
  isProcessing: boolean;
  cancellationSuccess: boolean;
}

const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  planName,
  isProcessing,
  cancellationSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
          <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" /> Cancel Maintenance Service?
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900" disabled={isProcessing}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {cancellationSuccess ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-4" />
                <h4 className="font-bold text-emerald-800 mb-2">Cancellation Confirmed!</h4>
                <p className="text-sm text-emerald-700">
                    Your subscription for **{planName}** will be canceled at the end of the current billing period. 
                    Your client portal access remains active.
                </p>
                <button onClick={onClose} className="mt-4 text-indigo-600 text-sm font-medium hover:text-indigo-800">
                    Close
                </button>
            </div>
        ) : (
            <>
                <div className="p-3 mb-6 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    <p className="font-bold mb-2">Canceling this subscription will discontinue:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Ongoing website maintenance and security updates.</li>
                        <li>Dedicated support services.</li>
                        <li>Automatic hosting and domain management (if included).</li>
                    </ul>
                </div>
                
                <p className="text-slate-600 mb-6">
                    Your access to the client portal, including project history, files, and messages, will **remain available**.
                </p>

                <div className="flex gap-4">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        Keep Service Active
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Confirm Cancellation'
                        )}
                    </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default CancelSubscriptionModal;
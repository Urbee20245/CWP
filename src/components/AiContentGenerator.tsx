"use client";

import React, { useState } from 'react';
import { Bot, Sparkles, Loader2, X, AlertTriangle, HelpCircle } from 'lucide-react';
import { AdminService } from '../services/adminService';

interface AiContentGeneratorProps {
  entityType: string;
  entityName: string;
  initialContent: string;
  onGenerate: (content: string) => void;
  // Optional context fields
  entityCategory?: string;
  pricingType?: string;
  price?: number;
  keyFeatures?: string; // Features selected outside the modal
}

const TONES = ['Professional', 'Concise', 'Marketing-Friendly', 'Informational'];

const AiContentGenerator: React.FC<AiContentGeneratorProps> = ({
  entityType,
  entityName,
  initialContent,
  onGenerate,
  entityCategory,
  pricingType,
  price,
  keyFeatures,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Generator Form State
  const [tone, setTone] = useState(TONES[0]);
  const [keyFeaturesInput, setKeyFeaturesInput] = useState(''); // Internal state for additional features
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);
    
    // Combine features passed via prop (from main form) and features typed in the modal
    const combinedFeatures = [keyFeatures, keyFeaturesInput].filter(Boolean).join(', ');

    const context = {
      entity_type: entityType,
      entity_name: entityName,
      entity_category: entityCategory,
      pricing_type: pricingType,
      key_features: combinedFeatures,
      tone: tone,
      additional_notes: additionalNotes,
      price: price,
    };

    try {
      const result = await AdminService.generateAdminContent(context);
      onGenerate(result.content);
      setIsOpen(false);
    } catch (e: any) {
      setError(e.message || 'AI generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <button
            type="button"
            onClick={() => {
                setIsOpen(true);
            }}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
            <Sparkles className="w-3 h-3" /> Generate with AI
        </button>
        <button 
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                alert("The AI Content Generator uses Gemini to draft descriptions, emails, or documents based on the context you provide, saving you time on initial drafting.");
            }}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5"
            aria-label="Help"
        >
            <HelpCircle className="w-3 h-3" />
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-scale-in">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600" /> AI Content Draft
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Context Summary */}
            <div className="p-3 mb-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <p className="font-bold text-slate-700 mb-1">Target: {entityType} - {entityName}</p>
                <p className="text-slate-500">Current Content: {initialContent.substring(0, 50)}...</p>
                {keyFeatures && (
                    <p className="text-slate-500 mt-1">Pre-selected Features: <span className="font-semibold text-indigo-600">{keyFeatures}</span></p>
                )}
            </div>

            {error && (
              <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-4">
              
              {/* Tone Selector */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tone *</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  required
                  disabled={isGenerating}
                >
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              {/* Key Features (Internal Input) */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Additional Key Features / Selling Points (Optional)</label>
                <textarea 
                  value={keyFeaturesInput} 
                  onChange={(e) => setKeyFeaturesInput(e.target.value)} 
                  placeholder="e.g., 24/7 monitoring, weekly backups, priority support." 
                  rows={3} 
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none" 
                  disabled={isGenerating} 
                />
              </div>
              
              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Additional Instructions (Optional)</label>
                <textarea 
                  value={additionalNotes} 
                  onChange={(e) => setAdditionalNotes(e.target.value)} 
                  placeholder="e.g., Keep it under 100 characters." 
                  rows={2} 
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none" 
                  disabled={isGenerating} 
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Drafting Content...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Description
                  </>
                )}
              </button>
              
              <p className="text-xs text-red-500 text-center mt-3">
                AI-generated content should be reviewed before saving.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AiContentGenerator;
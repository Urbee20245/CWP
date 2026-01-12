"use client";

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpPopoverProps {
  content: string;
  title?: string;
  className?: string;
}

const HelpPopover: React.FC<HelpPopoverProps> = ({ content, title = "Information", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
        aria-label="Help"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-2 w-80 p-4 bg-white rounded-xl shadow-2xl border border-indigo-100 text-sm text-slate-700 animate-fade-in-up origin-top"
          style={{ animationDuration: '0.3s' }}
        >
          <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
            <h4 className="font-bold text-slate-900">{title}</h4>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p>{content}</p>
        </div>
      )}
    </div>
  );
};

export default HelpPopover;
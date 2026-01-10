"use client";

import React, { useRef } from 'react';
import { Bold, Italic, Link, List, Code, Type } from 'lucide-react';

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  disabled: boolean;
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ textareaRef, disabled }) => {
  
  const applyFormat = (prefix: string, suffix: string, placeholder: string) => {
    if (disabled || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    
    let selectedText = value.substring(start, end);
    
    // If nothing is selected, use a placeholder
    if (!selectedText) {
        selectedText = placeholder;
    }

    const newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
    
    // Update the value and trigger change event manually
    textarea.value = newText;
    
    // Manually set the cursor position after the inserted text
    const newCursorPos = start + prefix.length + selectedText.length;
    textarea.selectionStart = newCursorPos;
    textarea.selectionEnd = newCursorPos;
    
    // Trigger an input event to update React state in the parent component
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    textarea.focus();
  };

  const handleBold = () => applyFormat('**', '**', 'bold text');
  const handleItalic = () => applyFormat('*', '*', 'italic text');
  const handleLink = () => applyFormat('[', '](https://example.com)', 'Link Text');
  const handleList = () => applyFormat('* ', '', 'List Item');
  const handleHeading = () => applyFormat('## ', '', 'Heading');

  const buttonClass = "p-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex gap-1 p-2 bg-slate-100 border border-slate-200 rounded-lg mb-2">
      <button type="button" onClick={handleBold} className={buttonClass} disabled={disabled} title="Bold">
        <Bold className="w-4 h-4" />
      </button>
      <button type="button" onClick={handleItalic} className={buttonClass} disabled={disabled} title="Italic">
        <Italic className="w-4 h-4" />
      </button>
      <button type="button" onClick={handleLink} className={buttonClass} disabled={disabled} title="Link">
        <Link className="w-4 h-4" />
      </button>
      <button type="button" onClick={handleList} className={buttonClass} disabled={disabled} title="Unordered List">
        <List className="w-4 h-4" />
      </button>
      <button type="button" onClick={handleHeading} className={buttonClass} disabled={disabled} title="Heading (##)">
        <Type className="w-4 h-4" />
      </button>
    </div>
  );
};

export default MarkdownToolbar;
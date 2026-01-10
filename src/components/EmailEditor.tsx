"use client";

import React, { useState, useMemo, useRef } from 'react';
import { marked } from 'marked';
import { Edit, Eye, AlertTriangle } from 'lucide-react';
import MarkdownToolbar from './MarkdownToolbar'; // Import the new toolbar

interface EmailEditorProps {
  subject: string;
  body: string;
  isEditing: boolean;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  disabled: boolean;
}

const EmailEditor: React.FC<EmailEditorProps> = ({
  subject,
  body,
  isEditing,
  onSubjectChange,
  onBodyChange,
  disabled,
}) => {
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const htmlPreview = useMemo(() => {
    try {
      // Convert Markdown body to HTML
      return marked.parse(body);
    } catch (e) {
      console.error("Markdown parsing error:", e);
      return "<p style='color: red;'>Error rendering markdown preview.</p>";
    }
  }, [body]);

  return (
    <div className="space-y-4">
      
      {/* Subject Input */}
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="w-full p-2 border border-slate-300 rounded-lg text-sm font-semibold focus:border-indigo-500 outline-none"
          disabled={disabled || !isEditing}
        />
      </div>
      
      {/* Editor/Preview Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Markdown Input (Editor) */}
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1">
            <Edit className="w-4 h-4" /> Markdown Editor
            {!isEditing && <span className="text-xs text-red-500">(Locked)</span>}
          </div>
          
          <MarkdownToolbar 
            textareaRef={textareaRef} 
            disabled={disabled || !isEditing} 
          />
          
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={15}
            placeholder="Use Markdown for formatting (e.g., **bold**, new lines for paragraphs)."
            className="w-full p-3 border border-slate-300 rounded-lg text-sm font-mono resize-none focus:border-indigo-500 outline-none bg-white"
            disabled={disabled || !isEditing}
          />
          <p className="text-xs text-slate-500 mt-1">Use double line breaks for new paragraphs.</p>
        </div>
        
        {/* HTML Preview */}
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1">
            <Eye className="w-4 h-4" /> HTML Preview
          </div>
          <div className="w-full h-[300px] overflow-y-auto p-3 border border-slate-300 rounded-lg bg-slate-50 text-sm">
            {/* Render HTML content safely */}
            <div dangerouslySetInnerHTML={{ __html: htmlPreview }} />
          </div>
          <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Final email will be sent as HTML. Check formatting carefully.
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailEditor;
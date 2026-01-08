"use client";

import React, { useState } from 'react';
import { X, Loader2, Briefcase, Plus, AlertCircle, Users } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: () => void;
  clientId: string;
  clientName: string;
}

const AddProjectDialog: React.FC<AddProjectDialogProps> = ({ isOpen, onClose, onProjectAdded, clientId, clientName }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'active',
    progress_percent: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name === 'progress_percent' ? parseInt(value) : value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { title, description, status, progress_percent } = formData;

    if (!title) {
      setError('Project title is required.');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          client_id: clientId,
          title,
          description,
          status,
          progress_percent,
        });

      if (error) throw error;

      alert(`Project '${title}' created successfully for ${clientName}!`);
      onProjectAdded();
      onClose();
      setFormData({ title: '', description: '', status: 'active', progress_percent: 0 });

    } catch (e: any) {
      console.error('Project creation error:', e);
      setError(e.message || 'Failed to create project.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-xl w-full shadow-2xl animate-scale-in">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
          <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-emerald-600" /> Add New Project
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Client Info */}
        <div className="p-3 mb-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Adding project for: <span className="font-bold">{clientName}</span>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Project Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Project Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm resize-none"
                disabled={isLoading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                  disabled={isLoading}
                >
                  <option value="active">Active</option>
                  <option value="planning">Planning</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Initial Progress (%)</label>
                <input
                  type="number"
                  name="progress_percent"
                  value={formData.progress_percent}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Project...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Create Project
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddProjectDialog;
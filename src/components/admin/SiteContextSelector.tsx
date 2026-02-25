import React, { useState, useEffect, useRef } from 'react';
import { Settings, Globe, Layers, Search, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';

export interface SessionContext {
  type: 'cwp' | 'client' | 'all_clients';
  label: string;
  repo?: string;
  clientId?: string;
  clientSlug?: string;
}

interface Client {
  id: string;
  name: string;
  slug: string;
}

interface SiteContextSelectorProps {
  onSelect: (context: SessionContext) => void;
}

const OPTIONS = [
  {
    type: 'cwp' as const,
    icon: Settings,
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-100',
    label: 'CWP Admin Platform',
    subtitle: 'Work on the CWP codebase itself — add features, fix bugs, modify edge functions',
    borderHover: 'hover:border-indigo-400',
    selectedBorder: 'border-indigo-400 bg-indigo-50',
  },
  {
    type: 'client' as const,
    icon: Globe,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    label: "A Client's Website",
    subtitle: 'Build or modify features for one client\'s hosted site',
    borderHover: 'hover:border-emerald-400',
    selectedBorder: 'border-emerald-400 bg-emerald-50',
  },
  {
    type: 'all_clients' as const,
    icon: Layers,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
    label: 'All Client Sites',
    subtitle: 'Roll out a feature or fix across every client site simultaneously',
    borderHover: 'hover:border-purple-400',
    selectedBorder: 'border-purple-400 bg-purple-50',
  },
];

export const SiteContextSelector: React.FC<SiteContextSelectorProps> = ({ onSelect }) => {
  const [selected, setSelected] = useState<'cwp' | 'client' | 'all_clients' | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected === 'client') {
      setLoadingClients(true);
      supabase
        .from('clients')
        .select('id, name, slug')
        .order('name', { ascending: true })
        .then(({ data }) => {
          setClients(data ?? []);
          setLoadingClients(false);
        });
    }
  }, [selected]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleOptionClick = (type: 'cwp' | 'client' | 'all_clients') => {
    setSelected(type);
    if (type === 'cwp') {
      onSelect({ type: 'cwp', label: 'CWP Platform', repo: 'Urbee20245/CWP' });
    } else if (type === 'all_clients') {
      onSelect({ type: 'all_clients', label: 'All Client Sites' });
    }
    // For 'client', wait for user to pick a client
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setDropdownOpen(false);
    setSearch('');
    onSelect({
      type: 'client',
      label: client.name,
      clientId: client.id,
      clientSlug: client.slug,
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-8 pb-20 px-4">
      {/* Header */}
      <div>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
          <Settings className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">What are we working on?</h2>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Choose the scope for this session. The assistant will tailor its tools and suggestions accordingly.
        </p>
      </div>

      {/* Options */}
      <div className="grid gap-3 w-full max-w-lg">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.type;
          return (
            <button
              key={opt.type}
              onClick={() => handleOptionClick(opt.type)}
              className={`
                w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all
                ${isSelected ? opt.selectedBorder : 'border-slate-200 bg-white ' + opt.borderHover}
              `}
            >
              <div className={`w-10 h-10 rounded-xl ${opt.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${opt.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 text-sm mb-0.5">{opt.label}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{opt.subtitle}</div>
              </div>
              {isSelected && (
                <div className={`w-5 h-5 rounded-full ${opt.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${opt.iconColor.replace('text-', 'bg-')}`} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Client picker (shown only when 'client' is selected) */}
      {selected === 'client' && (
        <div className="w-full max-w-lg" ref={dropdownRef}>
          <p className="text-sm text-slate-600 mb-2 font-medium">Select a client:</p>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border-2 border-emerald-300 rounded-xl text-sm shadow-sm hover:border-emerald-400 transition-colors"
            >
              <span className={selectedClient ? 'text-slate-800' : 'text-slate-400'}>
                {selectedClient ? selectedClient.name : 'Search for a client…'}
              </span>
              {loadingClients ? (
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              ) : (
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {dropdownOpen && !loadingClients && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {/* Search input */}
                <div className="p-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search clients…"
                      className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Client list */}
                <div className="max-h-48 overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center">
                      {search ? 'No clients found' : 'No clients available'}
                    </div>
                  ) : (
                    filteredClients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => handleClientSelect(client)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-emerald-50 transition-colors"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-800">{client.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{client.slug}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteContextSelector;

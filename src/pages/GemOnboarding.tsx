"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingProduct {
  id: string;
  name: string;
  description: string;
  onboarding_description: string | null;
  billing_type: 'one_time' | 'subscription' | 'yearly';
  amount_cents: number | null;
  setup_fee_cents: number | null;
  monthly_price_cents: number | null;
  active: boolean;
  show_in_onboarding: boolean;
  onboarding_category: string | null;
}

interface Addon {
  id: string;
  name: string;
  description: string;
  price_cents: number | null;
  setup_fee_cents: number | null;
  monthly_price_cents: number | null;
  billing_type: string;
  is_active: boolean;
  show_in_onboarding: boolean;
  onboarding_category: string | null;
}

interface ClientInfo {
  firstName: string;
  lastName: string;
  businessName: string;
  businessType: string;
  phone: string;
  email: string;
  businessDescription: string;
}

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  timestamp: Date;
}

type Stage =
  | 'firstName' | 'lastName' | 'businessName' | 'businessType'
  | 'phone' | 'email' | 'businessDescription'
  | 'products' | 'addons' | 'proposal' | 'success';

const BUSINESS_TYPES = [
  'Healthcare / Medical',
  'Legal / Law',
  'Real Estate',
  'Contractor / Home Services',
  'Restaurant / Food',
  'Retail / E-commerce',
  'Professional Services',
  'Other',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number | null): string {
  if (cents == null) return '$0';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatProductPrice(p: BillingProduct): string {
  if (p.billing_type === 'yearly') {
    return `${formatCents(p.amount_cents)}/yr`;
  }
  if (p.billing_type === 'subscription') {
    return `${formatCents(p.monthly_price_cents)}/mo`;
  }
  if (p.billing_type === 'setup_plus_subscription') {
    const setup = p.setup_fee_cents ? `${formatCents(p.setup_fee_cents)} setup` : '';
    const monthly = p.monthly_price_cents ? `${formatCents(p.monthly_price_cents)}/mo` : '';
    return [setup, monthly].filter(Boolean).join(' + ');
  }
  // one_time or fallback
  return `${formatCents(p.amount_cents || p.setup_fee_cents)} one-time`;
}

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2 mb-4">
    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-white border border-slate-200 flex items-center justify-center">
      <img src="/CWPlogolight.png" alt="CWP Assistant" className="w-5 h-5 object-contain" />
    </div>
    <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-slate-100 border border-slate-200">
      <div className="flex gap-1.5 items-center h-4">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-slate-400"
            style={{ animation: `bounce-dot 1.2s ${i * 0.2}s ease-in-out infinite` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const CWPOnboarding: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get('session');

  const [stage, setStage] = useState<Stage>('firstName');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    firstName: '', lastName: '', businessName: '',
    businessType: '', phone: '', email: '', businessDescription: '',
  });

  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<BillingProduct[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [bundleSuggestion, setBundleSuggestion] = useState<BillingProduct | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingAddons, setIsLoadingAddons] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proposalVisible, setProposalVisible] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // ── Scroll to bottom ───────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Add an assistant message with typing delay ─────────────────────────────

  const addAssistantMessage = useCallback((text: string, delay = 800) => {
    return new Promise<void>(resolve => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text,
          timestamp: new Date(),
        }]);
        setTimeout(() => resolve(), 300);
      }, delay);
    });
  }, []);

  // ── Add user message ──────────────────────────────────────────────────────

  const addUserMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      sender: 'user',
      text,
      timestamp: new Date(),
    }]);
  }, []);

  // ── Load existing session if ?session= param present ─────────────────────

  useEffect(() => {
    if (!sessionToken || sessionLoaded) return;
    (async () => {
      const { data, error } = await supabase
        .from('onboarding_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .single();

      if (error || !data) {
        startNormalFlow();
        return;
      }

      const info: ClientInfo = {
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        businessName: data.business_name || '',
        businessType: data.business_type || '',
        phone: data.phone || '',
        email: data.email || '',
        businessDescription: data.business_description || '',
      };
      setClientInfo(info);
      setSessionLoaded(true);

      await addAssistantMessage(
        `Welcome back, ${info.firstName}! Let's pick up where we left off.`,
        600
      );
      await addAssistantMessage(
        `I've already got your details on file. Let's build your perfect package!`,
        1000
      );
      setStage('products');
      loadProducts();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  // ── Normal flow start ─────────────────────────────────────────────────────

  const startNormalFlow = useCallback(async () => {
    if (sessionLoaded) return;
    await addAssistantMessage(
      `Hi there! I'm the CWP Onboarding Assistant for Custom Websites Plus.`,
      600
    );
    await addAssistantMessage(
      `I'm here to help design the perfect digital package for your business. Let's start — what's your first name?`,
      1200
    );
  }, [addAssistantMessage, sessionLoaded]);

  useEffect(() => {
    if (!sessionToken) {
      startNormalFlow();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load products (core step: onboarding_type='core' from both tables) ────

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    const [productsRes, addonsRes] = await Promise.all([
      supabase
        .from('billing_products')
        .select('*')
        .eq('onboarding_type', 'core')
        .eq('show_in_onboarding', true)
        .eq('active', true),
      supabase
        .from('addon_catalog')
        .select('id, name, description, price_cents, setup_fee_cents, monthly_price_cents, billing_type, is_active, show_in_onboarding, onboarding_category, onboarding_type')
        .eq('onboarding_type', 'core')
        .eq('show_in_onboarding', true)
        .eq('is_active', true),
    ]);

    const billingProducts: BillingProduct[] = (productsRes.data || []) as BillingProduct[];
    // Map addon_catalog items classified as 'core' into BillingProduct shape
    const addonProducts: BillingProduct[] = (addonsRes.data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      onboarding_description: null,
      billing_type: a.billing_type,
      amount_cents: a.price_cents ?? null,
      setup_fee_cents: a.setup_fee_cents ?? null,
      monthly_price_cents: a.monthly_price_cents ?? null,
      active: a.is_active,
      show_in_onboarding: a.show_in_onboarding,
      onboarding_category: a.onboarding_category,
    }));

    setProducts([...billingProducts, ...addonProducts]);
    setIsLoadingProducts(false);
  }, []);

  // ── Load addons (addon step: onboarding_type='addon' from both tables) ────

  const loadAddons = useCallback(async () => {
    setIsLoadingAddons(true);
    const [addonsRes, productsRes] = await Promise.all([
      supabase
        .from('addon_catalog')
        .select('*')
        .eq('onboarding_type', 'addon')
        .eq('show_in_onboarding', true)
        .eq('is_active', true),
      supabase
        .from('billing_products')
        .select('id, name, description, onboarding_description, billing_type, amount_cents, setup_fee_cents, monthly_price_cents, active, show_in_onboarding, onboarding_category, onboarding_type')
        .eq('onboarding_type', 'addon')
        .eq('show_in_onboarding', true)
        .eq('active', true),
    ]);

    const catalogAddons: Addon[] = (addonsRes.data || []) as Addon[];
    // Map billing_products classified as 'addon' into Addon shape
    const productAddons: Addon[] = (productsRes.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.onboarding_description || p.description,
      price_cents: p.amount_cents ?? null,
      setup_fee_cents: p.setup_fee_cents ?? null,
      monthly_price_cents: p.monthly_price_cents ?? null,
      billing_type: p.billing_type,
      is_active: p.active,
      show_in_onboarding: p.show_in_onboarding,
      onboarding_category: p.onboarding_category,
    }));

    setAddons([...catalogAddons, ...productAddons]);
    setIsLoadingAddons(false);
  }, []);

  // ── Handle addon selection and bundle detection ────────────────────────────

  const handleAddonToggle = useCallback(async (addon: Addon) => {
    const isSelected = selectedAddons.some(a => a.id === addon.id);
    const next = isSelected
      ? selectedAddons.filter(a => a.id !== addon.id)
      : [...selectedAddons, addon];

    setSelectedAddons(next);

    const names = next.map(a => a.name.toLowerCase());
    const hasInbound = names.some(n => n.includes('inbound'));
    const hasOutbound = names.some(n => n.includes('outbound'));

    if (hasInbound && hasOutbound && !bundleSuggestion) {
      const { data } = await supabase
        .from('billing_products')
        .select('*')
        .ilike('name', '%receptionist bundle%')
        .eq('active', true)
        .maybeSingle();

      if (data) setBundleSuggestion(data as BillingProduct);
    } else if (!hasInbound || !hasOutbound) {
      setBundleSuggestion(null);
    }
  }, [selectedAddons, bundleSuggestion]);

  // ── Compute totals ────────────────────────────────────────────────────────

  const computeTotals = useCallback(() => {
    let oneTime = 0;
    let monthly = 0;

    for (const p of selectedProducts) {
      oneTime += p.amount_cents || p.setup_fee_cents || 0;
      monthly += p.monthly_price_cents || 0;
    }
    for (const a of selectedAddons) {
      oneTime += (a.setup_fee_cents || 0) + (a.billing_type === 'one_time' ? (a.price_cents || 0) : 0);
      monthly += a.monthly_price_cents || 0;
    }

    return { oneTime, monthly };
  }, [selectedProducts, selectedAddons]);

  // ── Handle text submit ────────────────────────────────────────────────────

  const handleTextSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInputValue('');

    addUserMessage(trimmed);

    switch (stage) {
      case 'firstName':
        setClientInfo(p => ({ ...p, firstName: trimmed }));
        await addAssistantMessage(`Great to meet you, ${trimmed}! What's your last name?`);
        setStage('lastName');
        break;

      case 'lastName':
        setClientInfo(p => ({ ...p, lastName: trimmed }));
        await addAssistantMessage(`Perfect. And what's the name of your business?`);
        setStage('businessName');
        break;

      case 'businessName':
        setClientInfo(p => ({ ...p, businessName: trimmed }));
        await addAssistantMessage(`Got it! What industry does ${trimmed} operate in? Pick the one that fits best:`);
        setStage('businessType');
        break;

      case 'phone':
        setClientInfo(p => ({ ...p, phone: trimmed }));
        await addAssistantMessage(`Got it. And what's the best email address for you?`);
        setStage('email');
        break;

      case 'email':
        setClientInfo(p => ({ ...p, email: trimmed }));
        await addAssistantMessage(
          `Almost there! Give me a quick description of what your business does — the more detail, the better I can tailor your package.`
        );
        setStage('businessDescription');
        break;

      case 'businessDescription':
        setClientInfo(p => ({ ...p, businessDescription: trimmed }));
        await addAssistantMessage(`Thank you! Building your profile now...`, 600);
        await addAssistantMessage(
          `Now let's build your package. Here are our core services — select everything that fits your needs.`,
          1400
        );
        setStage('products');
        loadProducts();
        break;

      default:
        break;
    }
  }, [stage, addAssistantMessage, addUserMessage, loadProducts]);

  // ── Handle business type pill select ──────────────────────────────────────

  const handleBusinessTypeSelect = useCallback(async (type: string) => {
    setClientInfo(p => ({ ...p, businessType: type }));
    addUserMessage(type);
    await addAssistantMessage(`${type} — noted. What's the best phone number to reach you?`);
    setStage('phone');
  }, [addAssistantMessage, addUserMessage]);

  // ── Proceed from products to addons ──────────────────────────────────────

  const handleProductsContinue = useCallback(async () => {
    if (selectedProducts.length === 0) {
      await addAssistantMessage(`Please select at least one core service to continue.`);
      return;
    }
    await addAssistantMessage(`Great selections. Now let's look at available add-ons to enhance your package.`);
    setStage('addons');
    loadAddons();
  }, [selectedProducts, addAssistantMessage, loadAddons]);

  // ── Proceed from addons to proposal ──────────────────────────────────────

  const handleAddonsContinue = useCallback(async () => {
    await addAssistantMessage(
      `Your personalized proposal is ready. Review the details below.`,
      800
    );
    setStage('proposal');
    setTimeout(() => setProposalVisible(true), 300);
  }, [addAssistantMessage]);

  // ── Submit proposal ───────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    const { oneTime, monthly } = computeTotals();
    const token = sessionToken || generateToken();

    try {
      const { error } = await supabase.from('onboarding_sessions').insert({
        session_token: token,
        first_name: clientInfo.firstName,
        last_name: clientInfo.lastName,
        business_name: clientInfo.businessName,
        business_type: clientInfo.businessType,
        phone: clientInfo.phone,
        email: clientInfo.email,
        business_description: clientInfo.businessDescription,
        selected_products: selectedProducts,
        selected_addons: selectedAddons,
        estimated_one_time_cents: oneTime,
        estimated_monthly_cents: monthly,
        status: 'proposal_submitted',
      });

      if (error) throw error;
      setStage('success');
    } catch (err) {
      console.error('Submission error:', err);
      await addAssistantMessage(`Something went wrong. Please try again in a moment.`);
    } finally {
      setIsSubmitting(false);
    }
  }, [clientInfo, selectedProducts, selectedAddons, computeTotals, sessionToken, addAssistantMessage]);

  const { oneTime, monthly } = computeTotals();

  // ─── Render ───────────────────────────────────────────────────────────────

  // Success screen
  if (stage === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#F8F9FA]">
        <style>{globalStyles}</style>
        <div className="text-center animate-fade-in max-w-md w-full">
          <img
            src="/CWPlogolight.png"
            alt="Custom Websites Plus"
            className="h-14 w-auto object-contain mx-auto mb-8"
          />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">Proposal Submitted!</h1>
            <p className="text-slate-600 text-sm leading-relaxed mb-5">
              Our team will review your proposal and reach out to confirm your final package and pricing.
            </p>
            <p className="text-slate-500 text-sm">
              We'll be in touch at{' '}
              <span className="text-blue-600 font-medium">{clientInfo.email}</span>
            </p>
            <div className="mt-6 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium">
              Welcome to Custom Websites Plus, {clientInfo.firstName}!
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
      <style>{globalStyles}</style>

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col items-center">
          <img
            src="/CWPlogolight.png"
            alt="Custom Websites Plus"
            className="h-10 w-auto object-contain mb-2"
          />
          <p className="text-slate-500 text-xs font-medium tracking-wide uppercase">
            CWP Onboarding Assistant
          </p>
        </div>
      </div>

      {/* Chat area */}
      {(stage === 'firstName' || stage === 'lastName' || stage === 'businessName' ||
        stage === 'businessType' || stage === 'phone' || stage === 'email' ||
        stage === 'businessDescription' ||
        (stage === 'products' && messages.length > 0) ||
        (stage === 'addons' && messages.length > 0) ||
        (stage === 'proposal' && messages.length > 0)
      ) && (
        <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 pb-4">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-4 space-y-1">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'items-end gap-2'} mb-3`}
                style={{ animation: `fade-up 0.4s ease both`, animationDelay: `${idx * 0.04}s` }}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-white border border-slate-200 flex items-center justify-center">
                    <img src="/CWPlogolight.png" alt="CWP" className="w-5 h-5 object-contain" />
                  </div>
                )}
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'assistant'
                      ? 'rounded-bl-sm bg-slate-100 text-slate-800 border border-slate-200'
                      : 'rounded-br-sm bg-[#2563EB] text-white'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {stage === 'businessType' ? (
            <div className="py-4">
              <div className="flex flex-wrap gap-2 justify-center">
                {BUSINESS_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => handleBusinessTypeSelect(type)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-all duration-150 active:scale-95"
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          ) : stage === 'businessDescription' ? (
            <div className="py-4">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleTextSubmit(inputValue);
                    }
                  }}
                  placeholder="Describe your business..."
                  rows={3}
                  className="flex-1 px-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 resize-none outline-none bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <button
                  onClick={() => handleTextSubmit(inputValue)}
                  disabled={!inputValue.trim()}
                  className="self-end px-5 py-3 rounded-xl font-semibold text-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  Send
                </button>
              </div>
            </div>
          ) : stage !== 'products' && stage !== 'addons' && stage !== 'proposal' ? (
            <div className="py-4">
              <div className="flex gap-2">
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type={stage === 'email' ? 'email' : stage === 'phone' ? 'tel' : 'text'}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTextSubmit(inputValue)}
                  placeholder={
                    stage === 'firstName' ? 'Your first name...'
                    : stage === 'lastName' ? 'Your last name...'
                    : stage === 'businessName' ? 'Business name...'
                    : stage === 'phone' ? 'Phone number...'
                    : stage === 'email' ? 'Email address...'
                    : 'Type here...'
                  }
                  className="flex-1 px-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <button
                  onClick={() => handleTextSubmit(inputValue)}
                  disabled={!inputValue.trim()}
                  className="px-5 py-3 rounded-xl font-semibold text-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  Send
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Products stage */}
      {stage === 'products' && (
        <div className="max-w-3xl w-full mx-auto px-4 pb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Core Services</h2>
            <p className="text-slate-500 text-sm mt-1">Select everything that fits your needs. Multi-select allowed.</p>
          </div>

          {isLoadingProducts ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {products.map((p, idx) => {
                const selected = selectedProducts.some(s => s.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProducts(prev =>
                      selected ? prev.filter(s => s.id !== p.id) : [...prev, p]
                    )}
                    className="text-left p-5 rounded-xl border transition-all duration-200 hover:shadow-md active:scale-[0.98] bg-white"
                    style={{
                      animationDelay: `${idx * 0.06}s`,
                      animation: 'fade-up 0.5s ease both',
                      borderColor: selected ? '#2563EB' : '#E2E8F0',
                      borderWidth: selected ? '2px' : '1px',
                      backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{p.name}</p>
                        <p className="text-slate-500 text-xs mt-1 leading-relaxed line-clamp-2">
                          {p.onboarding_description || p.description}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-all ${
                        selected ? 'bg-[#2563EB] border-[#2563EB]' : 'border-slate-300'
                      }`}>
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-3 text-xs">
                      <span className={p.billing_type === 'subscription' || p.billing_type === 'yearly' ? 'text-emerald-600 font-medium' : 'text-slate-700 font-medium'}>
                        {formatProductPrice(p)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={handleProductsContinue}
              disabled={selectedProducts.length === 0}
              className="px-10 py-3.5 rounded-xl font-bold text-white text-base bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Addons stage */}
      {stage === 'addons' && (
        <div className="max-w-3xl w-full mx-auto px-4 pb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Available Add-ons</h2>
            <p className="text-slate-500 text-sm mt-1">Optional extras to enhance your package.</p>
          </div>

          {/* Bundle suggestion */}
          {bundleSuggestion && (
            <div
              className="mb-6 p-4 rounded-xl border text-center bg-amber-50 border-amber-200"
              style={{ animation: 'fade-up 0.4s ease both' }}
            >
              <p className="text-amber-800 font-semibold text-sm">Bundle Deal Available</p>
              <p className="text-amber-700 text-xs mt-1">
                You selected both Inbound and Outbound Receptionist.{' '}
                <span className="font-semibold">{bundleSuggestion.name}</span> gives you both at a better rate:{' '}
                {formatCents(bundleSuggestion.monthly_price_cents)}/mo.
              </p>
              <button
                onClick={() => {
                  setSelectedAddons(prev =>
                    prev.filter(a =>
                      !a.name.toLowerCase().includes('inbound') &&
                      !a.name.toLowerCase().includes('outbound')
                    )
                  );
                  setSelectedProducts(prev =>
                    prev.some(p => p.id === bundleSuggestion!.id)
                      ? prev
                      : [...prev, bundleSuggestion!]
                  );
                  setBundleSuggestion(null);
                }}
                className="mt-3 px-6 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
              >
                Switch to Bundle
              </button>
            </div>
          )}

          {isLoadingAddons ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {addons
                .filter(a => {
                  const n = a.name.toLowerCase();
                  if (n.includes('social') || n.includes('posting')) {
                    return !n.includes('twitter') && !n.includes('linkedin') &&
                           !n.includes('tiktok') && !n.includes('pinterest');
                  }
                  return true;
                })
                .map((a, idx) => {
                  const selected = selectedAddons.some(s => s.id === a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => handleAddonToggle(a)}
                      className="text-left p-5 rounded-xl border transition-all duration-200 hover:shadow-md active:scale-[0.98] bg-white"
                      style={{
                        animationDelay: `${idx * 0.05}s`,
                        animation: 'fade-up 0.5s ease both',
                        borderColor: selected ? '#2563EB' : '#E2E8F0',
                        borderWidth: selected ? '2px' : '1px',
                        backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm">{a.name}</p>
                          <p className="text-slate-500 text-xs mt-1 leading-relaxed line-clamp-2">
                            {a.description}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-all ${
                          selected ? 'bg-[#2563EB] border-[#2563EB]' : 'border-slate-300'
                        }`}>
                          {selected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        {a.setup_fee_cents ? (
                          <span className="text-slate-700 font-medium">
                            {formatCents(a.setup_fee_cents)} setup
                          </span>
                        ) : null}
                        {a.monthly_price_cents ? (
                          <span className="text-emerald-600 font-medium">
                            {formatCents(a.monthly_price_cents)}/mo
                          </span>
                        ) : null}
                        {a.billing_type === 'one_time' && a.price_cents ? (
                          <span className="text-slate-700 font-medium">
                            {formatCents(a.price_cents)} one-time
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

          <div className="flex justify-center gap-4">
            <button
              onClick={() => setStage('products')}
              className="px-6 py-3 rounded-xl font-semibold text-sm text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleAddonsContinue}
              className="px-10 py-3.5 rounded-xl font-bold text-white text-base bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors active:scale-95"
            >
              View Proposal →
            </button>
          </div>
        </div>
      )}

      {/* Proposal stage */}
      {stage === 'proposal' && (
        <div
          className="max-w-2xl w-full mx-auto px-4 pb-12"
          style={{
            opacity: proposalVisible ? 1 : 0,
            transform: proposalVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          {/* Proposal document */}
          <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
            {/* Header */}
            <div className="px-8 py-7 bg-[#0F172A] text-center">
              <img
                src="https://www.customwebsitesplus.com/CWPlogodark.png"
                alt="Custom Websites Plus"
                className="h-8 w-auto object-contain mx-auto mb-4"
              />
              <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">
                Service Proposal · Custom Websites Plus
              </p>
              <h1 className="text-xl font-bold text-white">
                {clientInfo.firstName} {clientInfo.lastName}
              </h1>
              <p className="text-slate-300 mt-1 text-sm">{clientInfo.businessName}</p>
              <p className="text-slate-400 text-xs mt-0.5">{clientInfo.businessType}</p>
            </div>

            {/* Line items */}
            <div className="px-8 py-6 space-y-6">
              {/* Core Services */}
              {selectedProducts.length > 0 && (
                <div style={{ animation: 'fade-up 0.5s ease both' }}>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Core Services
                  </p>
                  <div className="space-y-0">
                    {selectedProducts.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-start justify-between gap-4 py-3"
                        style={{ borderBottom: i < selectedProducts.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      >
                        <div>
                          <p className="text-slate-900 font-medium text-sm">{p.name}</p>
                          <p className="text-slate-400 text-xs mt-0.5">
                            {p.billing_type === 'subscription' ? 'Monthly subscription' :
                             p.billing_type === 'yearly' ? 'Yearly subscription' :
                             p.billing_type === 'setup_plus_subscription' ? 'Setup + subscription' : 'One-time'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {p.billing_type === 'yearly' && p.amount_cents ? (
                            <p className="text-emerald-600 text-sm font-semibold">{formatCents(p.amount_cents)}/yr</p>
                          ) : p.billing_type === 'subscription' && p.monthly_price_cents ? (
                            <p className="text-emerald-600 text-sm font-semibold">{formatCents(p.monthly_price_cents)}/mo</p>
                          ) : p.billing_type === 'setup_plus_subscription' ? (
                            <>
                              {p.setup_fee_cents ? <p className="text-slate-800 text-sm font-semibold">{formatCents(p.setup_fee_cents)} setup</p> : null}
                              {p.monthly_price_cents ? <p className="text-emerald-600 text-xs font-medium">{formatCents(p.monthly_price_cents)}/mo</p> : null}
                            </>
                          ) : (
                            (p.amount_cents || p.setup_fee_cents) ? (
                              <p className="text-slate-800 text-sm font-semibold">
                                {formatCents(p.amount_cents || p.setup_fee_cents)}
                              </p>
                            ) : null
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons */}
              {selectedAddons.length > 0 && (
                <div style={{ animation: 'fade-up 0.5s 0.1s ease both' }}>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Add-ons
                  </p>
                  <div className="space-y-0">
                    {selectedAddons.map((a, i) => (
                      <div
                        key={a.id}
                        className="flex items-start justify-between gap-4 py-3"
                        style={{ borderBottom: i < selectedAddons.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      >
                        <div>
                          <p className="text-slate-900 font-medium text-sm">{a.name}</p>
                          <p className="text-slate-400 text-xs mt-0.5 capitalize">
                            {a.billing_type?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {a.setup_fee_cents ? (
                            <p className="text-slate-800 text-sm font-semibold">
                              {formatCents(a.setup_fee_cents)} setup
                            </p>
                          ) : null}
                          {a.monthly_price_cents ? (
                            <p className="text-emerald-600 text-xs font-medium">{formatCents(a.monthly_price_cents)}/mo</p>
                          ) : null}
                          {a.billing_type === 'one_time' && a.price_cents ? (
                            <p className="text-slate-800 text-sm font-semibold">
                              {formatCents(a.price_cents)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div
                className="rounded-xl p-4 bg-slate-50 border border-slate-200 space-y-2"
                style={{ animation: 'fade-up 0.5s 0.2s ease both' }}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Estimated One-Time</span>
                  <span className="text-slate-900 font-bold">{formatCents(oneTime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Estimated Monthly</span>
                  <span className="text-emerald-600 font-bold">{formatCents(monthly)}/mo</span>
                </div>
              </div>

              {/* Hosting & SSL notice */}
              {selectedProducts.length > 0 && (
                <div
                  className="rounded-xl p-4 border flex gap-3 items-start"
                  style={{
                    backgroundColor: '#EFF6FF',
                    borderColor: '#BFDBFE',
                    animation: 'fade-up 0.5s 0.25s ease both',
                  }}
                >
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#1E40AF' }} />
                  <p className="text-sm leading-relaxed" style={{ color: '#1E40AF' }}>
                    All core services include free website hosting and SSL certificate for the first year.
                  </p>
                </div>
              )}

              {/* Disclaimer */}
              <div
                className="rounded-xl p-4 bg-[#FEF3C7] border border-amber-200"
                style={{ animation: 'fade-up 0.5s 0.3s ease both' }}
              >
                <p className="text-[#92400E] text-sm font-semibold mb-1">⚠️ Important</p>
                <p className="text-[#92400E] text-xs leading-relaxed opacity-80">
                  This is an estimated proposal based on standard pricing. Final pricing will be confirmed by our team after reviewing your specific requirements. Approval of this proposal is not approval of the final price. A manager will contact you to confirm all costs before any work begins or charges are made.
                </p>
              </div>
            </div>

            {/* Submit button */}
            <div className="px-8 pb-8 text-center" style={{ animation: 'fade-up 0.5s 0.4s ease both' }}>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl font-bold text-white text-base bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors disabled:opacity-60 active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : 'Submit My Proposal'}
              </button>
              <button
                onClick={() => setStage('addons')}
                className="mt-3 text-slate-400 text-sm hover:text-slate-600 transition-colors"
              >
                ← Go back and edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Global CSS animations ────────────────────────────────────────────────────

const globalStyles = `
  @keyframes bounce-dot {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-up 0.6s ease both;
  }
`;

export default CWPOnboarding;

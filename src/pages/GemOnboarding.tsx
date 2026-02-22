"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  sender: 'gem' | 'user';
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

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Star field component ─────────────────────────────────────────────────────

const StarField: React.FC = () => {
  const stars = Array.from({ length: 120 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.7 + 0.2,
    duration: Math.random() * 4 + 2,
    delay: Math.random() * 6,
  }));

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {stars.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ${s.delay}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  );
};

// ─── Gem Orb component ────────────────────────────────────────────────────────

const GemOrb: React.FC<{ isSpeaking: boolean }> = ({ isSpeaking }) => {
  const particles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    angle: (i / 8) * 360,
    delay: i * 0.3,
  }));

  return (
    <div className="relative flex items-center justify-center w-28 h-28 select-none">
      {/* Outer glow rings */}
      <div
        className="absolute rounded-full border border-purple-500/20"
        style={{
          width: '140px',
          height: '140px',
          animation: `ping-slow ${isSpeaking ? '1.2s' : '3s'} ease-in-out infinite`,
        }}
      />
      <div
        className="absolute rounded-full border border-blue-400/15"
        style={{
          width: '170px',
          height: '170px',
          animation: `ping-slow ${isSpeaking ? '1.5s' : '4s'} ease-in-out infinite`,
          animationDelay: '0.5s',
        }}
      />
      <div
        className="absolute rounded-full border border-indigo-300/10"
        style={{
          width: '200px',
          height: '200px',
          animation: `ping-slow ${isSpeaking ? '1.8s' : '5s'} ease-in-out infinite`,
          animationDelay: '1s',
        }}
      />

      {/* Floating particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute w-1.5 h-1.5 rounded-full bg-purple-400/70"
          style={{
            animation: `orbit 6s ${p.delay}s linear infinite`,
            transformOrigin: '0 60px',
            transform: `rotate(${p.angle}deg) translateX(55px)`,
          }}
        />
      ))}

      {/* Core orb */}
      <div
        className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #a78bfa, #7c3aed 50%, #1e1b4b)',
          boxShadow: isSpeaking
            ? '0 0 40px #7c3aed, 0 0 80px #6d28d9, 0 0 20px #a78bfa'
            : '0 0 25px #7c3aed80, 0 0 50px #6d28d940',
          animation: `pulse-orb ${isSpeaking ? '0.8s' : '3s'} ease-in-out infinite`,
        }}
      >
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{ animation: 'shimmer 3s ease-in-out infinite' }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
            }}
          />
        </div>

        {/* G letter */}
        <span
          className="relative z-10 text-white font-bold text-2xl"
          style={{ textShadow: '0 0 12px rgba(196,181,253,0.9)', fontFamily: 'serif' }}
        >
          G
        </span>
      </div>
    </div>
  );
};

// ─── Typing indicator ─────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2 mb-4">
    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: 'radial-gradient(circle at 35% 35%, #a78bfa, #7c3aed)' }}>
      <span className="text-white text-xs font-bold" style={{ fontFamily: 'serif' }}>G</span>
    </div>
    <div className="px-4 py-3 rounded-2xl rounded-bl-sm"
      style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(167,139,250,0.3)' }}>
      <div className="flex gap-1.5 items-center h-4">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-purple-400"
            style={{ animation: `bounce-dot 1.2s ${i * 0.2}s ease-in-out infinite` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const GemOnboarding: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get('session');

  const [stage, setStage] = useState<Stage>('firstName');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
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

  // ── Add a Gem message with typing delay ───────────────────────────────────

  const addGemMessage = useCallback((text: string, delay = 800) => {
    return new Promise<void>(resolve => {
      setIsTyping(true);
      setIsSpeaking(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          sender: 'gem',
          text,
          timestamp: new Date(),
        }]);
        setTimeout(() => { setIsSpeaking(false); resolve(); }, 600);
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
        // Fall through to normal flow
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

      await addGemMessage(
        `Welcome back, ${info.firstName}! ✨ Let's pick up where we left off.`,
        600
      );
      await addGemMessage(
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
    await addGemMessage(
      `Hey there! ✨ I'm Gem, your personal onboarding guide for Custom Websites Plus.`,
      600
    );
    await addGemMessage(
      `I'm here to help design the perfect digital package for your business. Let's start simple — what's your first name?`,
      1200
    );
  }, [addGemMessage, sessionLoaded]);

  useEffect(() => {
    if (!sessionToken) {
      startNormalFlow();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load products ─────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    const { data, error } = await supabase
      .from('billing_products')
      .select('*')
      .eq('show_in_onboarding', true)
      .eq('active', true);

    if (!error && data) setProducts(data as BillingProduct[]);
    setIsLoadingProducts(false);
  }, []);

  // ── Load addons ───────────────────────────────────────────────────────────

  const loadAddons = useCallback(async () => {
    setIsLoadingAddons(true);
    const { data, error } = await supabase
      .from('addon_catalog')
      .select('*')
      .eq('show_in_onboarding', true)
      .eq('is_active', true);

    if (!error && data) setAddons(data as Addon[]);
    setIsLoadingAddons(false);
  }, []);

  // ── Handle addon selection and bundle detection ────────────────────────────

  const handleAddonToggle = useCallback(async (addon: Addon) => {
    const isSelected = selectedAddons.some(a => a.id === addon.id);
    const next = isSelected
      ? selectedAddons.filter(a => a.id !== addon.id)
      : [...selectedAddons, addon];

    setSelectedAddons(next);

    // Bundle detection: look for inbound + outbound receptionist
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
        await addGemMessage(`Great to meet you, ${trimmed}! 👋 What's your last name?`);
        setStage('lastName');
        break;

      case 'lastName':
        setClientInfo(p => ({ ...p, lastName: trimmed }));
        await addGemMessage(`Perfect. And what's the name of your business?`);
        setStage('businessName');
        break;

      case 'businessName':
        setClientInfo(p => ({ ...p, businessName: trimmed }));
        await addGemMessage(`Love it! What industry does ${trimmed} operate in? Pick the one that fits best:`);
        setStage('businessType');
        break;

      case 'phone':
        setClientInfo(p => ({ ...p, phone: trimmed }));
        await addGemMessage(`Got it! And what's the best email address for you?`);
        setStage('email');
        break;

      case 'email':
        setClientInfo(p => ({ ...p, email: trimmed }));
        await addGemMessage(
          `Almost there! Give me a quick description of what your business does — the more detail, the better I can help! 🚀`
        );
        setStage('businessDescription');
        break;

      case 'businessDescription':
        setClientInfo(p => ({ ...p, businessDescription: trimmed }));
        await addGemMessage(`This is so exciting! 🌟 I'm building your profile now...`, 600);
        await addGemMessage(
          `Now let's build your package! Here are our core services. Select everything that sounds right for you.`,
          1400
        );
        setStage('products');
        loadProducts();
        break;

      default:
        break;
    }
  }, [stage, addGemMessage, addUserMessage, loadProducts]);

  // ── Handle business type pill select ──────────────────────────────────────

  const handleBusinessTypeSelect = useCallback(async (type: string) => {
    setClientInfo(p => ({ ...p, businessType: type }));
    addUserMessage(type);
    await addGemMessage(`${type} — excellent! What's the best phone number to reach you?`);
    setStage('phone');
  }, [addGemMessage, addUserMessage]);

  // ── Proceed from products to addons ──────────────────────────────────────

  const handleProductsContinue = useCallback(async () => {
    if (selectedProducts.length === 0) {
      await addGemMessage(`Please select at least one core service to continue! 😊`);
      return;
    }
    await addGemMessage(`Great choices! Now let's supercharge your package with some powerful add-ons.`);
    setStage('addons');
    loadAddons();
  }, [selectedProducts, addGemMessage, loadAddons]);

  // ── Proceed from addons to proposal ──────────────────────────────────────

  const handleAddonsContinue = useCallback(async () => {
    await addGemMessage(
      `Perfect! I've put together your personalized proposal. Take a look below! 🎉`,
      800
    );
    setStage('proposal');
    setTimeout(() => setProposalVisible(true), 300);
  }, [addGemMessage]);

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
      await addGemMessage(`Hmm, something went wrong. Please try again in a moment.`);
    } finally {
      setIsSubmitting(false);
    }
  }, [clientInfo, selectedProducts, selectedAddons, computeTotals, sessionToken, addGemMessage]);

  const { oneTime, monthly } = computeTotals();

  // ─── Render ───────────────────────────────────────────────────────────────

  // Success screen
  if (stage === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: 'radial-gradient(ellipse at top, #1e0a3c 0%, #0a0015 60%, #000 100%)' }}>
        <style>{globalStyles}</style>
        <StarField />
        <div className="relative z-10 text-center animate-fade-in">
          <GemOrb isSpeaking={false} />
          <h1 className="mt-8 text-4xl font-bold text-white">You're all set! 🎉</h1>
          <p className="mt-4 text-purple-200 text-lg max-w-md mx-auto">
            Your proposal has been submitted. Our team will review it and reach out to
            confirm your final package and pricing.
          </p>
          <p className="mt-6 text-purple-400 text-sm">
            Check your email at <span className="text-purple-300 font-medium">{clientInfo.email}</span> for next steps.
          </p>
          <div className="mt-8 px-6 py-3 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-200 text-sm inline-block">
            ✨ Welcome to the Custom Websites Plus family, {clientInfo.firstName}!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'radial-gradient(ellipse at top, #1e0a3c 0%, #0a0015 60%, #000 100%)' }}
    >
      <style>{globalStyles}</style>
      <StarField />

      {/* Header orb */}
      <div className="relative z-10 flex flex-col items-center pt-8 pb-2 flex-shrink-0">
        <GemOrb isSpeaking={isSpeaking} />
        <div className="mt-3 text-center">
          <p className="text-purple-200 font-semibold text-lg tracking-wide">Gem</p>
          <p className="text-purple-400 text-xs">Your AI Onboarding Guide</p>
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
        <div className="relative z-10 flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 pb-4">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-4 space-y-1">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'items-end gap-2'} mb-3`}
                style={{ animation: `fade-up 0.4s ease both`, animationDelay: `${idx * 0.04}s` }}
              >
                {msg.sender === 'gem' && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'radial-gradient(circle at 35% 35%, #a78bfa, #7c3aed)' }}
                  >
                    <span className="text-white text-xs font-bold" style={{ fontFamily: 'serif' }}>G</span>
                  </div>
                )}
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'gem'
                      ? 'rounded-bl-sm text-purple-100'
                      : 'rounded-br-sm text-white'
                  }`}
                  style={msg.sender === 'gem'
                    ? { background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(167,139,250,0.3)' }
                    : { background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }
                  }
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
                    className="px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      background: 'rgba(124,58,237,0.2)',
                      border: '1px solid rgba(167,139,250,0.4)',
                      color: '#c4b5fd',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.5)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.2)';
                    }}
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
                  className="flex-1 px-4 py-3 rounded-2xl text-sm text-white placeholder-purple-400 resize-none outline-none"
                  style={{
                    background: 'rgba(124,58,237,0.15)',
                    border: '1px solid rgba(167,139,250,0.35)',
                  }}
                />
                <button
                  onClick={() => handleTextSubmit(inputValue)}
                  disabled={!inputValue.trim()}
                  className="self-end px-5 py-3 rounded-2xl font-semibold text-sm text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
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
                  className="flex-1 px-4 py-3 rounded-2xl text-sm text-white placeholder-purple-400 outline-none"
                  style={{
                    background: 'rgba(124,58,237,0.15)',
                    border: '1px solid rgba(167,139,250,0.35)',
                  }}
                />
                <button
                  onClick={() => handleTextSubmit(inputValue)}
                  disabled={!inputValue.trim()}
                  className="px-5 py-3 rounded-2xl font-semibold text-sm text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
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
        <div className="relative z-10 max-w-3xl w-full mx-auto px-4 pb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">Core Services</h2>
            <p className="text-purple-300 text-sm mt-1">Select everything that fits your needs. Multi-select allowed.</p>
          </div>

          {isLoadingProducts ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
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
                    className="text-left p-5 rounded-2xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      animationDelay: `${idx * 0.06}s`,
                      animation: 'fade-up 0.5s ease both',
                      background: selected
                        ? 'rgba(124,58,237,0.45)'
                        : 'rgba(255,255,255,0.04)',
                      border: selected
                        ? '2px solid rgba(167,139,250,0.8)'
                        : '1px solid rgba(167,139,250,0.2)',
                      boxShadow: selected ? '0 0 20px rgba(124,58,237,0.3)' : 'none',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm">{p.name}</p>
                        <p className="text-purple-300 text-xs mt-1 leading-relaxed line-clamp-2">
                          {p.onboarding_description || p.description}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-all ${
                        selected ? 'bg-purple-400 border-purple-300' : 'border-purple-500/50'
                      }`}>
                        {selected && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-3 text-xs">
                      {(p.amount_cents || p.setup_fee_cents) ? (
                        <span className="text-purple-200 font-medium">
                          {formatCents(p.amount_cents || p.setup_fee_cents)} one-time
                        </span>
                      ) : null}
                      {p.monthly_price_cents ? (
                        <span className="text-green-300 font-medium">
                          {formatCents(p.monthly_price_cents)}/mo
                        </span>
                      ) : null}
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
              className="px-10 py-3.5 rounded-full font-bold text-white text-base transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                boxShadow: '0 0 30px rgba(124,58,237,0.4)',
              }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Addons stage */}
      {stage === 'addons' && (
        <div className="relative z-10 max-w-3xl w-full mx-auto px-4 pb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">Power-Up Add-ons</h2>
            <p className="text-purple-300 text-sm mt-1">Optional extras to supercharge your package.</p>
          </div>

          {/* Bundle suggestion */}
          {bundleSuggestion && (
            <div
              className="mb-6 p-4 rounded-2xl border text-center"
              style={{
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.4)',
                animation: 'fade-up 0.4s ease both',
              }}
            >
              <p className="text-yellow-300 font-semibold text-sm">✨ Bundle Deal Detected!</p>
              <p className="text-yellow-200 text-xs mt-1">
                You selected both Inbound and Outbound Receptionist.{' '}
                <span className="font-semibold">{bundleSuggestion.name}</span> gives you both at a better rate:{' '}
                {formatCents(bundleSuggestion.monthly_price_cents)}/mo.
              </p>
              <button
                onClick={() => {
                  // Remove inbound/outbound addons, add bundle to products
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
                className="mt-3 px-6 py-2 rounded-full text-xs font-bold text-yellow-900 bg-yellow-400 hover:bg-yellow-300 transition-all hover:scale-105"
              >
                Switch to Bundle
              </button>
            </div>
          )}

          {isLoadingAddons ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {addons
                .filter(a => {
                  const n = a.name.toLowerCase();
                  // Filter social posting addons to only show IG/FB relevant ones
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
                      className="text-left p-5 rounded-2xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        animationDelay: `${idx * 0.05}s`,
                        animation: 'fade-up 0.5s ease both',
                        background: selected ? 'rgba(124,58,237,0.45)' : 'rgba(255,255,255,0.04)',
                        border: selected
                          ? '2px solid rgba(167,139,250,0.8)'
                          : '1px solid rgba(167,139,250,0.2)',
                        boxShadow: selected ? '0 0 20px rgba(124,58,237,0.3)' : 'none',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm">{a.name}</p>
                          <p className="text-purple-300 text-xs mt-1 leading-relaxed line-clamp-2">
                            {a.description}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-all ${
                          selected ? 'bg-purple-400 border-purple-300' : 'border-purple-500/50'
                        }`}>
                          {selected && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        {a.setup_fee_cents ? (
                          <span className="text-purple-200 font-medium">
                            {formatCents(a.setup_fee_cents)} setup
                          </span>
                        ) : null}
                        {a.monthly_price_cents ? (
                          <span className="text-green-300 font-medium">
                            {formatCents(a.monthly_price_cents)}/mo
                          </span>
                        ) : null}
                        {a.billing_type === 'one_time' && a.price_cents ? (
                          <span className="text-purple-200 font-medium">
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
              className="px-6 py-3 rounded-full font-semibold text-sm text-purple-300 border border-purple-500/40 hover:bg-purple-900/30 transition-all"
            >
              ← Back
            </button>
            <button
              onClick={handleAddonsContinue}
              className="px-10 py-3.5 rounded-full font-bold text-white text-base transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                boxShadow: '0 0 30px rgba(124,58,237,0.4)',
              }}
            >
              View Proposal →
            </button>
          </div>
        </div>
      )}

      {/* Proposal stage */}
      {stage === 'proposal' && (
        <div
          className="relative z-10 max-w-2xl w-full mx-auto px-4 pb-12"
          style={{
            opacity: proposalVisible ? 1 : 0,
            transform: proposalVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          {/* Proposal document */}
          <div
            className="rounded-3xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(167,139,250,0.3)' }}
          >
            {/* Header */}
            <div
              className="px-8 py-8 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.6), rgba(79,70,229,0.5))' }}
            >
              <p className="text-purple-300 text-xs uppercase tracking-widest mb-2">Prepared by Gem · Custom Websites Plus</p>
              <h1 className="text-2xl font-bold text-white">
                {clientInfo.firstName} {clientInfo.lastName}
              </h1>
              <p className="text-purple-200 mt-1">{clientInfo.businessName}</p>
              <p className="text-purple-400 text-sm mt-1">{clientInfo.businessType}</p>
            </div>

            {/* Line items */}
            <div className="px-8 py-6 space-y-6">
              {/* Core Services */}
              {selectedProducts.length > 0 && (
                <div style={{ animation: 'fade-up 0.5s ease both' }}>
                  <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">
                    Core Services
                  </p>
                  <div className="space-y-3">
                    {selectedProducts.map(p => (
                      <div
                        key={p.id}
                        className="flex items-start justify-between gap-4 py-3 border-b"
                        style={{ borderColor: 'rgba(167,139,250,0.15)' }}
                      >
                        <div>
                          <p className="text-white font-medium text-sm">{p.name}</p>
                          <p className="text-purple-400 text-xs mt-0.5">
                            {p.billing_type === 'subscription' ? 'Monthly subscription' :
                             p.billing_type === 'yearly' ? 'Yearly subscription' : 'One-time'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {(p.amount_cents || p.setup_fee_cents) ? (
                            <p className="text-purple-200 text-sm font-medium">
                              {formatCents(p.amount_cents || p.setup_fee_cents)}
                            </p>
                          ) : null}
                          {p.monthly_price_cents ? (
                            <p className="text-green-300 text-xs">{formatCents(p.monthly_price_cents)}/mo</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons */}
              {selectedAddons.length > 0 && (
                <div style={{ animation: 'fade-up 0.5s 0.1s ease both' }}>
                  <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">
                    Add-ons
                  </p>
                  <div className="space-y-3">
                    {selectedAddons.map(a => (
                      <div
                        key={a.id}
                        className="flex items-start justify-between gap-4 py-3 border-b"
                        style={{ borderColor: 'rgba(167,139,250,0.15)' }}
                      >
                        <div>
                          <p className="text-white font-medium text-sm">{a.name}</p>
                          <p className="text-purple-400 text-xs mt-0.5 capitalize">
                            {a.billing_type?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {a.setup_fee_cents ? (
                            <p className="text-purple-200 text-sm font-medium">
                              {formatCents(a.setup_fee_cents)} setup
                            </p>
                          ) : null}
                          {a.monthly_price_cents ? (
                            <p className="text-green-300 text-xs">{formatCents(a.monthly_price_cents)}/mo</p>
                          ) : null}
                          {a.billing_type === 'one_time' && a.price_cents ? (
                            <p className="text-purple-200 text-sm font-medium">
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
                className="rounded-2xl p-5 space-y-2"
                style={{
                  background: 'rgba(124,58,237,0.2)',
                  border: '1px solid rgba(167,139,250,0.3)',
                  animation: 'fade-up 0.5s 0.2s ease both',
                }}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-purple-300">Estimated One-Time</span>
                  <span className="text-white font-bold">{formatCents(oneTime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-purple-300">Estimated Monthly</span>
                  <span className="text-green-300 font-bold">{formatCents(monthly)}/mo</span>
                </div>
              </div>

              {/* Warning box */}
              <div
                className="rounded-2xl p-4"
                style={{
                  background: 'rgba(251,191,36,0.1)',
                  border: '1px solid rgba(251,191,36,0.35)',
                  animation: 'fade-up 0.5s 0.3s ease both',
                }}
              >
                <p className="text-yellow-300 text-sm font-semibold mb-1">⚠️ Estimated Proposal Only</p>
                <p className="text-yellow-200/80 text-xs leading-relaxed">
                  This is an estimated proposal only. Final pricing will be confirmed by our team before
                  any charges. Please speak with a manager for final confirmation.
                </p>
              </div>
            </div>

            {/* Submit button */}
            <div className="px-8 pb-8 text-center" style={{ animation: 'fade-up 0.5s 0.4s ease both' }}>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  boxShadow: '0 0 40px rgba(124,58,237,0.5), 0 0 80px rgba(124,58,237,0.2)',
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : '✨ Submit My Proposal'}
              </button>
              <button
                onClick={() => setStage('addons')}
                className="mt-3 text-purple-400 text-sm hover:text-purple-300 transition-colors"
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
  @keyframes twinkle {
    0% { opacity: 0.2; transform: scale(0.8); }
    100% { opacity: 0.9; transform: scale(1.2); }
  }
  @keyframes ping-slow {
    0% { transform: scale(0.95); opacity: 0.6; }
    50% { transform: scale(1.05); opacity: 0.3; }
    100% { transform: scale(0.95); opacity: 0.6; }
  }
  @keyframes pulse-orb {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }
  @keyframes orbit {
    0% { transform: rotate(0deg) translateX(55px) rotate(0deg); }
    100% { transform: rotate(360deg) translateX(55px) rotate(-360deg); }
  }
  @keyframes shimmer {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
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

export default GemOnboarding;

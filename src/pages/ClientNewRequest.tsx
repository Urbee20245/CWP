"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Info } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import ClientLayout from '../components/ClientLayout';

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
  required_maintenance_key?: string | null;
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

interface ClientProfile {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
  phone: string;
  address: string;
}

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
}

type Stage = 'loading' | 'greeting' | 'products' | 'addons' | 'proposal' | 'success';

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

function formatAddonPrice(a: Addon): string {
  const parts: string[] = [];
  if (a.setup_fee_cents) parts.push(`${formatCents(a.setup_fee_cents)} setup`);
  if (a.monthly_price_cents) parts.push(`${formatCents(a.monthly_price_cents)}/mo`);
  if (a.billing_type === 'one_time' && a.price_cents) parts.push(`${formatCents(a.price_cents)} one-time`);
  return parts.join(' + ') || '$0';
}

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function resolveMaintenancePlans(
  selectedProducts: BillingProduct[],
  addonsByKey: Record<string, Addon>
): Array<{ addon: Addon; requiredBy: string }> {
  const seen = new Set<string>();
  const result: Array<{ addon: Addon; requiredBy: string }> = [];
  for (const p of selectedProducts) {
    const key = p.required_maintenance_key;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const addon = addonsByKey[key];
    if (addon) result.push({ addon, requiredBy: p.name });
  }
  return result;
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2 mb-4">
    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-white border border-slate-200 flex items-center justify-center">
      <img src="/CWPlogolight.png" alt="CWP" className="w-5 h-5 object-contain" />
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

const ClientNewRequest: React.FC = () => {
  const { profile } = useAuth();

  const [stage, setStage] = useState<Stage>('loading');
  const [clientProfile, setClientProfile] = useState<ClientProfile>({
    firstName: '',
    lastName: '',
    email: '',
    businessName: '',
    phone: '',
    address: '',
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<BillingProduct[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [bundleSuggestion, setBundleSuggestion] = useState<BillingProduct | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingAddons, setIsLoadingAddons] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proposalVisible, setProposalVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [maintenanceAddonsByKey, setMaintenanceAddonsByKey] = useState<Record<string, Addon>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Scroll to bottom ───────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Add assistant message with typing delay ────────────────────────────────

  const addAssistantMessage = useCallback((text: string, delay = 700) => {
    return new Promise<void>(resolve => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text,
        }]);
        setTimeout(() => resolve(), 200);
      }, delay);
    });
  }, []);

  // ── Load profile and client data from Supabase ─────────────────────────────

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        const [profileResult, clientResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', profile.id)
            .single(),
          supabase
            .from('clients')
            .select('business_name, phone, address')
            .eq('owner_profile_id', profile.id)
            .single(),
        ]);

        const fullName: string = profileResult.data?.full_name || profile.full_name || '';
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const loaded: ClientProfile = {
          firstName,
          lastName,
          email: profileResult.data?.email || profile.email || '',
          businessName: clientResult.data?.business_name || '',
          phone: clientResult.data?.phone || '',
          address: clientResult.data?.address || '',
        };

        setClientProfile(loaded);

        // Start greeting flow
        await addAssistantMessage(
          `Welcome back, ${firstName || 'there'}! I'm the CWP Onboarding Assistant.`,
          500
        );
        await addAssistantMessage(
          `What can we build for you today? Browse our services below and select everything that fits your needs.`,
          1000
        );
        setStage('products');
        loadProducts();
      } catch (err) {
        console.error('Error loading client data:', err);
        setLoadError('Unable to load your profile. Please refresh and try again.');
        setStage('greeting');
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // ── Load products (core step: onboarding_type='core' from both tables) ────

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    const [productsRes, addonsRes] = await Promise.all([
      supabase
        .from('billing_products')
        .select('id, name, description, onboarding_description, billing_type, amount_cents, monthly_price_cents, setup_fee_cents, active, show_in_onboarding, onboarding_category, onboarding_type, required_maintenance_key')
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
      required_maintenance_key: null,
    }));

    setProducts([...billingProducts, ...addonProducts]);

    // Fetch the maintenance addon records for any required_maintenance_key values
    const maintenanceKeys = [
      ...new Set(
        billingProducts
          .map(p => p.required_maintenance_key)
          .filter((k): k is string => !!k)
      ),
    ];
    if (maintenanceKeys.length > 0) {
      const { data: maintData } = await supabase
        .from('addon_catalog')
        .select('id, name, description, price_cents, setup_fee_cents, monthly_price_cents, billing_type, is_active, show_in_onboarding, onboarding_category, key')
        .in('key', maintenanceKeys);
      const map: Record<string, Addon> = {};
      (maintData || []).forEach((a: any) => {
        if (a.key) {
          map[a.key] = {
            id: a.id,
            name: a.name,
            description: a.description,
            price_cents: a.price_cents ?? null,
            setup_fee_cents: a.setup_fee_cents ?? null,
            monthly_price_cents: a.monthly_price_cents ?? null,
            billing_type: a.billing_type,
            is_active: a.is_active,
            show_in_onboarding: a.show_in_onboarding,
            onboarding_category: a.onboarding_category,
          };
        }
      });
      setMaintenanceAddonsByKey(map);
    }

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

    // Auto-required maintenance plans (exclude any already manually selected as add-ons)
    const selectedAddonIds = new Set(selectedAddons.map(a => a.id));
    for (const { addon } of resolveMaintenancePlans(selectedProducts, maintenanceAddonsByKey)) {
      if (selectedAddonIds.has(addon.id)) continue;
      oneTime += (addon.setup_fee_cents || 0) + (addon.billing_type === 'one_time' ? (addon.price_cents || 0) : 0);
      monthly += addon.monthly_price_cents || 0;
    }

    for (const a of selectedAddons) {
      oneTime += (a.setup_fee_cents || 0) + (a.billing_type === 'one_time' ? (a.price_cents || 0) : 0);
      monthly += a.monthly_price_cents || 0;
    }

    return { oneTime, monthly };
  }, [selectedProducts, selectedAddons, maintenanceAddonsByKey]);

  // ── Proceed from products to addons ──────────────────────────────────────

  const handleProductsContinue = useCallback(async () => {
    if (selectedProducts.length === 0) {
      await addAssistantMessage(`Please select at least one service to continue.`);
      return;
    }
    await addAssistantMessage(`Great selections. Now let's look at available add-ons.`);
    setStage('addons');
    loadAddons();
  }, [selectedProducts, addAssistantMessage, loadAddons]);

  // ── Skip products step (go straight to add-ons) ───────────────────────────

  const handleProductsSkip = useCallback(async () => {
    setSelectedProducts([]);
    await addAssistantMessage(`No problem! Let's look at what we can add to your existing services.`);
    setStage('addons');
    loadAddons();
  }, [addAssistantMessage, loadAddons]);

  // ── Proceed from addons to proposal ──────────────────────────────────────

  const handleAddonsContinue = useCallback(async () => {
    if (selectedProducts.length === 0 && selectedAddons.length === 0) {
      await addAssistantMessage(`Please select at least one service or add-on to continue.`);
      return;
    }
    await addAssistantMessage(`Your proposal is ready. Review the details below.`, 700);
    setStage('proposal');
    setTimeout(() => setProposalVisible(true), 300);
  }, [selectedProducts, selectedAddons, addAssistantMessage]);

  // ── Skip add-ons step (go straight to proposal) ───────────────────────────

  const handleAddonsSkip = useCallback(async () => {
    if (selectedProducts.length === 0) {
      await addAssistantMessage(`Please select at least one service or add-on to continue.`);
      return;
    }
    setSelectedAddons([]);
    await addAssistantMessage(`Your proposal is ready. Review the details below.`, 700);
    setStage('proposal');
    setTimeout(() => setProposalVisible(true), 300);
  }, [selectedProducts, addAssistantMessage]);

  // ── Submit proposal ───────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    const { oneTime, monthly } = computeTotals();
    const token = generateToken();

    try {
      // Merge auto-required maintenance plans into selected_addons (dedup by id)
      const existingAddonIds = new Set(selectedAddons.map(a => a.id));
      const maintenancePlansToSave = resolveMaintenancePlans(selectedProducts, maintenanceAddonsByKey)
        .filter(({ addon }) => !existingAddonIds.has(addon.id))
        .map(({ addon }) => addon);
      const allAddons = [...selectedAddons, ...maintenancePlansToSave];

      const { error } = await supabase.from('onboarding_sessions').insert({
        session_token: token,
        first_name: clientProfile.firstName,
        last_name: clientProfile.lastName,
        business_name: clientProfile.businessName,
        phone: clientProfile.phone,
        email: clientProfile.email,
        selected_products: selectedProducts,
        selected_addons: allAddons,
        estimated_one_time_cents: oneTime,
        estimated_monthly_cents: monthly,
        status: 'proposal_submitted',
        prefilled: true,
      });

      if (error) throw error;

      // Fire-and-forget confirmation email
      const supabaseUrl = 'https://nvgumhlewbqynrhlkqhx.supabase.co';
      const maintenancePlansForEmail = resolveMaintenancePlans(selectedProducts, maintenanceAddonsByKey)
        .filter(({ addon }) => !existingAddonIds.has(addon.id));
      const coreServicesEmailHtml = selectedProducts.map(p =>
        `<div style="padding: 6px 0; border-bottom: 1px solid #e2e8f0; color: #334155;">
           ✓ ${p.name} — ${formatProductPrice(p)}
         </div>`
      ).join('');
      const maintenanceEmailHtml = maintenancePlansForEmail.length > 0
        ? `<p style="font-weight: 600; color: #0f172a; margin: 16px 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Monthly Maintenance (Required)</p>` +
          maintenancePlansForEmail.map(({ addon, requiredBy }) =>
            `<div style="padding: 6px 0; border-bottom: 1px solid #e2e8f0; color: #334155;">
               ✓ ${addon.name} — ${formatAddonPrice(addon)}<br>
               <span style="color: #94a3b8; font-size: 12px;">Required with ${requiredBy}</span>
             </div>`
          ).join('')
        : '';
      const addonsEmailHtml = selectedAddons.length > 0
        ? `<p style="font-weight: 600; color: #0f172a; margin: 16px 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Add-ons</p>` +
          selectedAddons.map(a =>
            `<div style="padding: 6px 0; border-bottom: 1px solid #e2e8f0; color: #334155;">
               ✓ ${a.name} — ${formatAddonPrice(a)}
             </div>`
          ).join('')
        : '';
      const selectedItemsHtml = [
        coreServicesEmailHtml
          ? `<p style="font-weight: 600; color: #0f172a; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Core Services</p>${coreServicesEmailHtml}`
          : '',
        maintenanceEmailHtml,
        addonsEmailHtml,
      ].filter(Boolean).join('');
      const emailHtml = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
    <img src="https://www.customwebsitesplus.com/CWPlogodark.png"
         alt="Custom Websites Plus"
         style="height: 50px; margin-bottom: 24px; display: block;" />

    <h2 style="color: #0f172a; margin-bottom: 8px;">
      Thank you, ${clientProfile.firstName}!
    </h2>
    <p style="color: #475569; line-height: 1.6;">
      We've received your service request for <strong>${clientProfile.businessName}</strong>
      and a member of our team will be in touch within 24 hours to review
      your proposal and confirm final pricing.
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="font-weight: 600; color: #0f172a; margin: 0 0 12px 0;">
        Your Selected Services:
      </p>
      ${selectedItemsHtml}
    </div>

    <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="color: #854d0e; font-size: 14px; margin: 0;">
        <strong>⚠️ Please Note:</strong> This is an estimated proposal only.
        Final pricing will be confirmed by our team. Approval of this proposal
        is not approval of the final price.
      </p>
    </div>

    <p style="color: #475569; line-height: 1.6;">
      If you have any immediate questions, feel free to reach us at
      <a href="mailto:hello@customwebsitesplus.com" style="color: #2563eb;">
        hello@customwebsitesplus.com
      </a>
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
      Custom Websites Plus · customwebsitesplus.com
    </p>
  </div>
  `;
      fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: clientProfile.email,
          subject: 'We received your proposal request — Custom Websites Plus',
          html_body: emailHtml,
        }),
      }).catch(console.error);

      setStage('success');
    } catch (err) {
      console.error('Submission error:', err);
      await addAssistantMessage(`Something went wrong. Please try again in a moment.`);
    } finally {
      setIsSubmitting(false);
    }
  }, [clientProfile, selectedProducts, selectedAddons, computeTotals, addAssistantMessage, maintenanceAddonsByKey]);

  const { oneTime, monthly } = computeTotals();

  const maintenancePlansForProposal = resolveMaintenancePlans(selectedProducts, maintenanceAddonsByKey)
    .filter(({ addon }) => !selectedAddons.some(a => a.id === addon.id));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ClientLayout>
      <style>{pageStyles}</style>
      <div className="min-h-screen bg-[#F8F9FA]">

        {/* Page Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-5">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-xl font-bold text-slate-900">Request New Services</h1>
            <p className="text-slate-500 text-sm mt-0.5">Start a new project or add services to your account.</p>
          </div>
        </div>

        {/* Loading screen */}
        {stage === 'loading' && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-slate-500 text-sm">Loading your profile...</p>
            </div>
          </div>
        )}

        {/* Error screen */}
        {loadError && (
          <div className="max-w-2xl mx-auto px-4 pt-8">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              {loadError}
            </div>
          </div>
        )}

        {/* Success screen */}
        {stage === 'success' && (
          <div className="max-w-lg mx-auto px-4 pt-12 pb-8">
            <div
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center"
              style={{ animation: 'fade-up 0.5s ease both' }}
            >
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Request Submitted!</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">
                Your request has been submitted. Our team will be in touch within 24 hours to confirm your final package and pricing.
              </p>
              <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium">
                We'll reach out at{' '}
                <span className="font-semibold">{clientProfile.email}</span>
              </div>
              <button
                onClick={() => window.location.href = '/client/dashboard'}
                className="mt-6 px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Main flow */}
        {stage !== 'loading' && stage !== 'success' && (
          <div className="max-w-3xl mx-auto px-4 pt-4 pb-12">

            {/* Chat messages */}
            {messages.length > 0 && (
              <div className="mb-6 space-y-2">
                {messages.map((msg, idx) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'items-end gap-2'} mb-3`}
                    style={{ animation: 'fade-up 0.4s ease both', animationDelay: `${idx * 0.04}s` }}
                  >
                    {msg.sender === 'assistant' && (
                      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-white border border-slate-200 flex items-center justify-center">
                        <img src="/CWPlogolight.png" alt="CWP" className="w-5 h-5 object-contain" />
                      </div>
                    )}
                    <div
                      className={`max-w-xs lg:max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed ${
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
            )}

            {/* Products stage */}
            {stage === 'products' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-900">Core Services</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Select everything that fits your needs. Multi-select allowed.</p>
                </div>

                {isLoadingProducts ? (
                  <div className="flex justify-center py-10">
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

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={handleProductsContinue}
                    disabled={selectedProducts.length === 0}
                    className="px-8 py-3 rounded-xl font-bold text-white text-sm bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    Continue →
                  </button>
                  <button
                    onClick={handleProductsSkip}
                    className="text-slate-400 text-xs hover:text-slate-600 hover:underline transition-colors"
                  >
                    Skip — I just need add-ons
                  </button>
                </div>
              </div>
            )}

            {/* Addons stage */}
            {stage === 'addons' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-900">Available Add-ons</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Optional extras to enhance your package.</p>
                </div>

                {/* Bundle suggestion */}
                {bundleSuggestion && (
                  <div
                    className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-center"
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
                      className="mt-3 px-5 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
                    >
                      Switch to Bundle
                    </button>
                  </div>
                )}

                {isLoadingAddons ? (
                  <div className="flex justify-center py-10">
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

                <div className="flex justify-between items-start">
                  <button
                    onClick={() => setStage('products')}
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
                  >
                    ← Back
                  </button>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={handleAddonsContinue}
                      className="px-8 py-3 rounded-xl font-bold text-white text-sm bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors active:scale-95"
                    >
                      View Proposal →
                    </button>
                    <button
                      onClick={handleAddonsSkip}
                      className="text-slate-400 text-xs hover:text-slate-600 hover:underline transition-colors"
                    >
                      Skip — I only need a core service
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Proposal stage */}
            {stage === 'proposal' && (
              <div
                style={{
                  opacity: proposalVisible ? 1 : 0,
                  transform: proposalVisible ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'opacity 0.6s ease, transform 0.6s ease',
                }}
              >
                <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                  {/* Header */}
                  <div className="px-8 py-7 bg-[#0F172A] text-center">
                    <img
                      src="https://www.customwebsitesplus.com/CWPlogodark.png"
                      alt="Custom Websites Plus"
                      className="h-8 w-auto object-contain mx-auto mb-4"
                    />
                    <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">
                      Service Request · Custom Websites Plus
                    </p>
                    <h1 className="text-xl font-bold text-white">
                      {clientProfile.firstName} {clientProfile.lastName}
                    </h1>
                    {clientProfile.businessName && (
                      <p className="text-slate-300 mt-1 text-sm">{clientProfile.businessName}</p>
                    )}
                  </div>

                  {/* Line items */}
                  <div className="px-8 py-6 space-y-6">
                    {/* Core Services */}
                    {selectedProducts.length > 0 && (
                      <div style={{ animation: 'fade-up 0.5s ease both' }}>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                          Core Services
                        </p>
                        <div>
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

                    {/* Monthly Maintenance (Required) */}
                    {maintenancePlansForProposal.length > 0 && (
                      <div style={{ animation: 'fade-up 0.5s 0.05s ease both' }}>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                          Monthly Maintenance{' '}
                          <span className="text-slate-300 font-normal normal-case tracking-normal">(Required)</span>
                        </p>
                        <div>
                          {maintenancePlansForProposal.map(({ addon, requiredBy }, i) => (
                            <div
                              key={addon.id}
                              className="flex items-start justify-between gap-4 py-3"
                              style={{ borderBottom: i < maintenancePlansForProposal.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                            >
                              <div>
                                <p className="text-slate-900 font-medium text-sm">{addon.name}</p>
                                <p className="text-slate-400 text-xs mt-0.5">Required with {requiredBy}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {addon.monthly_price_cents ? (
                                  <p className="text-emerald-600 text-sm font-semibold">{formatCents(addon.monthly_price_cents)}/mo</p>
                                ) : null}
                                {addon.setup_fee_cents ? (
                                  <p className="text-slate-800 text-xs font-medium">{formatCents(addon.setup_fee_cents)} setup</p>
                                ) : null}
                                {addon.billing_type === 'one_time' && addon.price_cents ? (
                                  <p className="text-slate-800 text-sm font-semibold">{formatCents(addon.price_cents)}</p>
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
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                          Add-ons
                        </p>
                        <div>
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
                  <div
                    className="px-8 pb-8 text-center"
                    style={{ animation: 'fade-up 0.5s 0.4s ease both' }}
                  >
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
                      ) : 'Submit Request'}
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
        )}

      </div>
    </ClientLayout>
  );
};

// ─── Page CSS ─────────────────────────────────────────────────────────────────

const pageStyles = `
  @keyframes bounce-dot {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export default ClientNewRequest;

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// ─── Constants ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://nvgumhlewbqynrhlkqhx.supabase.co';
const TOTAL_DISPLAY_STEPS = 12;

const STEP_DISPLAY_NUM: Partial<Record<GemStep, number>> = {
  auth_check: 1, login: 1, signup: 1,
  welcome: 2,
  domain: 3, domain_access: 3,
  phone: 4, phone_carrier: 5, phone_porting: 5, phone_provision: 5,
  cal_check: 6, cal_api_key: 7,
  a2p_intro: 8, a2p_form: 9,
  brand: 10,
  addon_suggest: 11, complete: 12,
};

const STEP_MESSAGES: Partial<Record<GemStep, string>> = {
  auth_check: "Welcome! 👋 I'm going to walk you through getting your site set up. First — do you already have a CWP client account?",
  login: "Great! Log in with your email and password below.",
  signup: "Let's create your account. Your email is already confirmed from your purchase. Just choose a password!",
  domain: "🌐 Does your business have a domain name? (e.g. yourbusiness.com)",
  domain_access: "Great! Please enter your domain name below, and then we'll ask for access to your DNS settings so we can connect everything automatically.",
  phone: "Now let's set up your business phone. Does your business have a dedicated phone number?",
  phone_carrier: "Which provider is your number currently with?",
  phone_porting: "Got it! We can port most numbers. Here's what you should know first:",
  phone_provision: "No problem at all! We'll get you a fresh business number. What area code would you like?",
  cal_check: "Your plan includes a Cal.com booking calendar. Do you already have a Cal.com account?",
  cal_api_key: "Perfect! Paste your Cal.com API key below and we'll connect your calendar automatically.",
  a2p_intro: "One important step before your SMS goes live:",
  a2p_form: "Almost done with compliance! Fill in your business details below. This takes about 3 minutes.",
  brand: "Now let's make your website look amazing. Upload your logo and tell us about your brand.",
  complete: "You're officially in! 🚀 Here's what happens next:",
};

// Tier-specific add-on suggestion keywords
const TIER_SUGGESTION_KEYWORDS: Record<string, string[]> = {
  starter: ['phone', 'missed call', 'email marketing'],
  growth: ['missed call', 'blog', 'email marketing'],
  pro: ['blog', 'email marketing', 'content'],
  elite: ['bos', 'email marketing'],
};

const BUSINESS_TYPES = ['LLC', 'S-Corp', 'C-Corp', 'Sole Proprietor', 'Non-Profit', 'Other'];

// ─── Types ─────────────────────────────────────────────────────────────────────

type GemStep =
  | 'loading' | 'invalid_token' | 'auth_check' | 'login' | 'signup'
  | 'welcome' | 'domain' | 'domain_access'
  | 'phone' | 'phone_carrier' | 'phone_porting' | 'phone_provision'
  | 'cal_check' | 'cal_api_key' | 'a2p_intro' | 'a2p_form'
  | 'brand' | 'addon_suggest' | 'complete';

interface CheckoutData {
  id: string;
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  phone: string | null;
  industry: string;
  tier: 'starter' | 'growth' | 'pro' | 'elite';
  selected_addons: string[];
  prefers_toll_free_number: boolean;
  status: string;
  client_id: string | null;
}

interface TierInfo {
  label: string;
  monthlyPrice: number;
  phone_type: 'none' | 'inbound' | 'inbound_outbound';
  phone_detail: string;
}

interface IncludedAddon {
  key: string;
  name: string;
  description: string | null;
  monthly_price_cents: number | null;
  billing_type: string;
}

interface GemProgress {
  id?: string;
  checkout_id: string;
  profile_id: string | null;
  account_linked: boolean;
  phone_setup_status: string;
  preferred_area_code: string | null;
  phone_carrier_name: string | null;
  phone_notes: string | null;
  cal_setup_status: string;
  a2p_submitted: boolean;
  a2p_data: Record<string, any>;
  brand_assets_uploaded: boolean;
  brand_notes: string | null;
  addon_requests: string[];
  current_step: string;
  completed_at: string | null;
}

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  timestamp: Date;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const globalStyles = `
  @keyframes bounce-dot {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-6px); opacity: 1; }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

function formatCents(cents: number | null): string {
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(0)}`;
}

// ─── Typing Indicator ──────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2 mb-3">
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

// ─── Main Component ────────────────────────────────────────────────────────────

const ProSitesGem: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  // ── Core state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<GemStep>('loading');
  const [stepHistory, setStepHistory] = useState<GemStep[]>([]);
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [includedAddons, setIncludedAddons] = useState<IncludedAddon[]>([]);
  const [progress, setProgress] = useState<Partial<GemProgress>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // ── Auth forms ──────────────────────────────────────────────────────────────
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupError, setSignupError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // ── Phone setup ─────────────────────────────────────────────────────────────
  const [phoneCarrierInput, setPhoneCarrierInput] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [wantsTollFree, setWantsTollFree] = useState(false);

  // ── Cal.com ─────────────────────────────────────────────────────────────────
  const [calApiKey, setCalApiKey] = useState('');
  const [calNeedCreate, setCalNeedCreate] = useState(false);

  // ── Domain ────────────────────────────────────────────────────────────────────
  const [domainName, setDomainName] = useState('');
  const [domainAccessMethod, setDomainAccessMethod] = useState('');
  const [domainNotes, setDomainNotes] = useState('');

  // ── A2P form ────────────────────────────────────────────────────────────────
  const [a2pForm, setA2pForm] = useState({
    legalName: '',
    businessType: '',
    ein: '',
    address: '',
    website: '',
    smsUseCase: '',
    sampleMessage1: '',
    sampleMessage2: '',
    optInMethod: '',
  });

  // ── Brand ───────────────────────────────────────────────────────────────────
  const [logoPreview, setLogoPreview] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [brandUploaded, setBrandUploaded] = useState(false);
  const [brandColor, setBrandColor] = useState('#4f46e5');
  const [brandNotes, setBrandNotes] = useState('');

  // ── Add-on suggestions ──────────────────────────────────────────────────────
  const [suggestedAddons, setSuggestedAddons] = useState<IncludedAddon[]>([]);
  const [selectedAddonRequests, setSelectedAddonRequests] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Pre-fill A2P business name when checkout loads ──────────────────────────
  useEffect(() => {
    if (checkout?.business_name && !a2pForm.legalName) {
      setA2pForm(prev => ({ ...prev, legalName: checkout.business_name }));
    }
  }, [checkout?.business_name]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Message helpers ─────────────────────────────────────────────────────────
  const addAssistantMessage = useCallback((text: string, delay = 700): Promise<void> => {
    return new Promise(resolve => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text,
          timestamp: new Date(),
        }]);
        setTimeout(resolve, 200);
      }, delay);
    });
  }, []);

  const addUserMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      sender: 'user',
      text,
      timestamp: new Date(),
    }]);
  }, []);

  // ── Progress save ───────────────────────────────────────────────────────────
  const saveProgress = useCallback(async (updates: Partial<GemProgress>) => {
    if (!checkout) return;
    setIsSaving(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const upsertData: Partial<GemProgress> = {
        checkout_id: checkout.id,
        profile_id: currentSession?.user?.id || null,
        account_linked: false,
        phone_setup_status: 'pending',
        cal_setup_status: 'pending',
        a2p_submitted: false,
        a2p_data: {},
        brand_assets_uploaded: false,
        addon_requests: [],
        current_step: step,
        completed_at: null,
        ...progress,
        ...updates,
      };
      const { data } = await supabase
        .from('pro_sites_gem_progress')
        .upsert(upsertData, { onConflict: 'checkout_id' })
        .select()
        .single();
      if (data) setProgress(data as GemProgress);
    } catch (err) {
      console.error('[ProSitesGem] saveProgress error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [checkout, step, progress]);

  // ── Navigate to step ────────────────────────────────────────────────────────
  const goToStep = useCallback(async (nextStep: GemStep, customMsg?: string) => {
    setStepHistory(prev => [...prev, step]);
    setStep(nextStep);
    const msg = customMsg ?? STEP_MESSAGES[nextStep];
    if (msg) await addAssistantMessage(msg);
  }, [step, addAssistantMessage]);

  // ── On mount: load checkout by token ────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setStep('invalid_token');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-pro-sites-checkout-by-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const result = await res.json();

        if (!result?.checkout) {
          setStep('invalid_token');
          return;
        }

        setCheckout(result.checkout);
        setTierInfo(result.tier_info || null);
        setIncludedAddons(result.included_addons || []);

        if (result.progress) {
          setProgress(result.progress);
          if (result.progress.completed_at) {
            setStep('complete');
            return;
          }
          const resumeStep = result.progress.current_step as GemStep;
          if (resumeStep && resumeStep !== 'loading') {
            setStep(resumeStep);
            await addAssistantMessage(
              `Welcome back, ${result.checkout.first_name}! Let's pick up where you left off.`,
              600
            );
            const msg = STEP_MESSAGES[resumeStep];
            if (msg) await addAssistantMessage(msg);
            return;
          }
        }

        // Fresh start
        setStep('auth_check');
        await addAssistantMessage(STEP_MESSAGES.auth_check!, 800);
      } catch (err) {
        console.error('[ProSitesGem] load error:', err);
        setStep('invalid_token');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Back ────────────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (stepHistory.length === 0) return;
    const prev = stepHistory[stepHistory.length - 1];
    setStepHistory(h => h.slice(0, -1));
    setStep(prev);
  };

  // ── AUTH: Login ─────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!checkout) return;
    setIsAuthLoading(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: checkout.email,
      password: loginPassword,
    });
    if (error) {
      setLoginError(error.message);
      setIsAuthLoading(false);
      return;
    }
    addUserMessage('Logged in successfully');
    await saveProgress({ current_step: 'welcome', account_linked: true });
    setIsAuthLoading(false);
    await goToStep('welcome', `🎉 Welcome back to your ${tierInfo?.label} plan, ${checkout.first_name}! Here's everything that's included with your subscription:`);
  };

  // ── AUTH: Signup ────────────────────────────────────────────────────────────
  const handleSignup = async () => {
    if (!checkout) return;
    setSignupError('');
    if (signupPassword.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }
    if (signupPassword !== signupConfirm) {
      setSignupError('Passwords do not match.');
      return;
    }
    setIsAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: checkout.email,
      password: signupPassword,
      options: {
        data: {
          full_name: `${checkout.first_name} ${checkout.last_name}`,
          role: 'client',
        },
      },
    });
    if (error) {
      setSignupError(error.message);
      setIsAuthLoading(false);
      return;
    }
    if (data.session) {
      fetch(`${SUPABASE_URL}/functions/v1/update-client-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ full_name: `${checkout.first_name} ${checkout.last_name}` }),
      }).catch(console.error);
    }
    addUserMessage('Account created!');
    await saveProgress({ current_step: 'welcome', account_linked: true });
    setIsAuthLoading(false);
    await goToStep('welcome', `🎉 Welcome to your ${tierInfo?.label} plan, ${checkout.first_name}! Here's everything that's included with your subscription:`);
  };

  // ── PHONE: handlers ─────────────────────────────────────────────────────────
  const handlePhoneYes = async () => {
    addUserMessage('Yes, I have a phone number');
    await goToStep('phone_carrier');
  };

  const handlePhoneNo = async () => {
    addUserMessage("No, I need a number");
    await goToStep('phone_provision');
  };

  const handlePhoneSkip = async () => {
    addUserMessage('Skip for now');
    setStepHistory(prev => [...prev, step]);
    setStep('cal_check');
    await saveProgress({ current_step: 'cal_check', phone_setup_status: 'skipped' });
    await addAssistantMessage(STEP_MESSAGES.cal_check!);
  };

  const handleCarrierSelect = async (carrier: 'Twilio' | 'Telnyx' | 'other') => {
    if (carrier === 'other') {
      addUserMessage('Other carrier');
      await goToStep('phone_porting');
      return;
    }
    addUserMessage(carrier);
    const status = carrier === 'Twilio' ? 'has_twilio' : 'has_telnyx';
    setStepHistory(prev => [...prev, step]);
    setStep('cal_check');
    await saveProgress({ current_step: 'cal_check', phone_setup_status: status, phone_carrier_name: carrier });
    const msg = carrier === 'Twilio'
      ? "Perfect! We'll configure your Twilio number during setup. Have your Account SID and Auth Token ready — our team will reach out to connect it."
      : "Got it! We support Telnyx natively. Our team will guide you through the connection during your onboarding call.";
    await addAssistantMessage(msg);
    await addAssistantMessage(STEP_MESSAGES.cal_check!);
  };

  const handlePortingSubmit = async () => {
    if (!phoneCarrierInput.trim()) return;
    addUserMessage(`My carrier is ${phoneCarrierInput}`);
    setStepHistory(prev => [...prev, step]);
    setStep('cal_check');
    await saveProgress({
      current_step: 'cal_check',
      phone_setup_status: 'needs_porting',
      phone_carrier_name: phoneCarrierInput,
    });
    await addAssistantMessage("We'll submit a porting request on your behalf. Our team will contact you with next steps.");
    await addAssistantMessage(STEP_MESSAGES.cal_check!);
  };

  const handleProvisionSubmit = async () => {
    const label = wantsTollFree ? 'Toll-free (800) number' : `Area code: ${areaCode || 'any'}`;
    addUserMessage(label);
    setStepHistory(prev => [...prev, step]);
    setStep('cal_check');
    await saveProgress({
      current_step: 'cal_check',
      phone_setup_status: 'needs_provision',
      preferred_area_code: wantsTollFree ? '800' : (areaCode || null),
    });
    await addAssistantMessage(`Got it! We'll set up a ${wantsTollFree ? 'toll-free (1-800)' : areaCode ? `(${areaCode})` : 'local'} number for you.`);
    await addAssistantMessage(STEP_MESSAGES.cal_check!);
  };

  // ── CAL.COM ─────────────────────────────────────────────────────────────────
  const handleCalConnected = async () => {
    addUserMessage('Yes, already connected');
    await saveProgress({ current_step: 'a2p_intro', cal_setup_status: 'connected' });
    await goToStep('a2p_intro');
  };

  const handleCalNeedConnect = async () => {
    addUserMessage('Yes, but I need to connect it');
    await goToStep('cal_api_key');
  };

  const handleCalNoAccount = () => {
    addUserMessage('No, I need to create one');
    setCalNeedCreate(true);
  };

  const handleCalApiKeySubmit = async () => {
    if (!calApiKey.trim()) return;
    addUserMessage('API key submitted');
    await saveProgress({
      current_step: 'a2p_intro',
      cal_setup_status: 'key_provided',
      a2p_data: { ...progress?.a2p_data, cal_api_key: calApiKey },
    });
    await goToStep('a2p_intro');
  };

  const handleCalApiKeySkip = async () => {
    addUserMessage("I'll set this up later");
    await saveProgress({ current_step: 'a2p_intro', cal_setup_status: 'skipped' });
    await goToStep('a2p_intro');
  };

  // ── DOMAIN: handlers ────────────────────────────────────────────────────────
  const handleHasDomain = async () => {
    addUserMessage('Yes, I have a domain');
    await goToStep('domain_access');
  };

  const handleNeedsDomain = async () => {
    addUserMessage("No, I need to purchase one");
    setStepHistory(prev => [...prev, step]);
    setStep('phone');
    await saveProgress({ current_step: 'phone' });
    await supabase
      .from('pro_sites_checkouts')
      .update({ domain_status: 'purchasing' })
      .eq('id', checkout!.id);
    await addAssistantMessage(
      "No problem! 🛒 We recommend Namecheap — it's easy to use and very affordable.\n\n" +
      "👉 Visit namecheap.com to search for and purchase your domain, then come back and complete your setup.\n\n" +
      "Once you have it, our team will help you connect it. Let's continue with the rest of your setup for now!"
    );
    await addAssistantMessage(STEP_MESSAGES.phone!);
  };

  const handleDomainAccessSubmit = async () => {
    if (!domainName.trim()) return;
    addUserMessage(`Domain: ${domainName}`);
    setStepHistory(prev => [...prev, step]);
    setStep('phone');
    await supabase
      .from('pro_sites_checkouts')
      .update({
        domain_name: domainName.trim(),
        domain_status: 'has_domain',
      })
      .eq('id', checkout!.id);
    await saveProgress({
      current_step: 'phone',
      a2p_data: {
        ...progress?.a2p_data,
        domain_name: domainName.trim(),
        domain_access_method: domainAccessMethod,
        domain_notes: domainNotes,
      },
    });
    await addAssistantMessage(
      `Perfect! We've noted your domain: ${domainName.trim()} ✅\n\nOur team will reach out with instructions to connect it once your site is ready.`
    );
    await addAssistantMessage(STEP_MESSAGES.phone!);
  };

  // ── A2P ─────────────────────────────────────────────────────────────────────
  const handleA2pSubmit = async () => {
    addUserMessage('Business info submitted');
    await saveProgress({
      current_step: 'brand',
      a2p_submitted: true,
      a2p_data: { ...progress?.a2p_data, ...a2pForm },
    });
    await goToStep('brand');
  };

  // ── BRAND ───────────────────────────────────────────────────────────────────
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !checkout) return;
    setLogoPreview(URL.createObjectURL(file));
    setLogoUploading(true);
    const { error } = await supabase.storage
      .from('client-assets')
      .upload(`pro-sites/${checkout.id}/logo-${file.name}`, file, { upsert: true });
    if (!error) setBrandUploaded(true);
    setLogoUploading(false);
  };

  const handleBrandContinue = async () => {
    addUserMessage('Brand info saved');
    await saveProgress({
      current_step: 'addon_suggest',
      brand_assets_uploaded: brandUploaded,
      brand_notes: `Color: ${brandColor}${brandNotes ? `\n${brandNotes}` : ''}`,
    });
    await loadAddonSuggestions();
    await goToStep('addon_suggest',
      `🚀 Almost done! Based on your ${tierInfo?.label} plan and ${checkout?.industry} business, here are add-ons that could take you to the next level:`
    );
  };

  // ── ADDON SUGGESTIONS ───────────────────────────────────────────────────────
  const loadAddonSuggestions = async () => {
    if (!checkout) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-pro-sites-addons`);
      const json = await res.json();
      const allAddons: IncludedAddon[] = json?.addons || [];
      const includedKeys = includedAddons.map(a => a.key);
      const keywords = TIER_SUGGESTION_KEYWORDS[checkout.tier] || [];
      const filtered = allAddons
        .filter(a => {
          if (includedKeys.includes(a.key)) return false;
          const nameLow = a.name.toLowerCase();
          const keyLow = a.key.toLowerCase();
          return keywords.some(kw => nameLow.includes(kw) || keyLow.includes(kw));
        })
        .slice(0, 4);
      setSuggestedAddons(filtered);
    } catch (err) {
      console.error('[ProSitesGem] addon suggestions error:', err);
    }
  };

  const toggleAddonRequest = (key: string) => {
    setSelectedAddonRequests(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleFinishSetup = async () => {
    addUserMessage(
      selectedAddonRequests.length > 0
        ? `Interested in ${selectedAddonRequests.length} add-on(s)`
        : 'No additional add-ons for now'
    );
    await saveProgress({
      current_step: 'complete',
      addon_requests: selectedAddonRequests,
      completed_at: new Date().toISOString(),
    });
    await goToStep('complete');
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const currentStepNum = STEP_DISPLAY_NUM[step] ?? null;
  const canGoBack = stepHistory.length > 0
    && !['loading', 'invalid_token', 'auth_check', 'login', 'signup', 'complete'].includes(step);

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <img src="/CWPlogolight.png" alt="CWP" className="h-12 mx-auto mb-6 object-contain" />
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
          <p className="text-slate-500 text-sm mt-3">Loading your setup...</p>
        </div>
      </div>
    );
  }

  // ── INVALID TOKEN ───────────────────────────────────────────────────────────
  if (step === 'invalid_token') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
        <div className="text-center max-w-md w-full">
          <img src="/CWPlogolight.png" alt="CWP" className="h-12 mx-auto mb-6 object-contain" />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <p className="text-4xl mb-3">🔗</p>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Invalid Setup Link</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-5">
              This setup link is invalid or has already been used. Check your email for the correct link, or contact us.
            </p>
            <a
              href="tel:4702646256"
              className="block w-full py-3 bg-indigo-600 text-white font-bold rounded-xl text-center text-sm hover:bg-indigo-700 transition-colors"
            >
              Call (470) 264-6256
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── COMPLETE ────────────────────────────────────────────────────────────────
  if (step === 'complete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#F8F9FA] py-12">
        <style>{globalStyles}</style>
        <div className="max-w-xl w-full">
          <img src="/CWPlogolight.png" alt="CWP" className="h-12 mx-auto mb-6 object-contain" />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="text-center mb-6">
              <p className="text-5xl mb-3">🎉</p>
              <h1 className="text-2xl font-bold text-slate-900">
                You're All Set, {checkout?.first_name}!
              </h1>
              <p className="text-slate-500 text-sm mt-2">
                Your setup is complete. Here's what happens next:
              </p>
            </div>
            <ol className="space-y-3 mb-6">
              {[
                '✅ Our team reviews your setup info (usually within 2 hours)',
                '🔨 We build your website using AI + our design team',
                '📱 Your phone number and integrations get configured',
                '👀 You review your site before it goes live',
                '🚀 Your site launches — typically within 7 days!',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center text-sm text-slate-600 mb-5">
              Questions? Call <strong>(470) 264-6256</strong> or email{' '}
              <a href="mailto:hello@customwebsitesplus.com" className="text-indigo-600 underline">
                hello@customwebsitesplus.com
              </a>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Go to Client Portal →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN CHAT UI ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
      <style>{globalStyles}</style>

      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <img src="/CWPlogolight.png" alt="CWP" className="h-8 w-auto object-contain" />
            <span className="text-slate-400 text-xs font-medium hidden sm:block">Pro Sites Setup</span>
          </div>
          <div className="text-right">
            {currentStepNum && (
              <>
                <p className="text-xs text-slate-500 font-medium">
                  Step {currentStepNum} of {TOTAL_DISPLAY_STEPS}
                </p>
                <div className="w-28 h-1.5 bg-slate-200 rounded-full mt-1 ml-auto">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${(currentStepNum / TOTAL_DISPLAY_STEPS) * 100}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Chat + step UI ── */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 flex flex-col">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-5 space-y-1">
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'items-end gap-2'} mb-3`}
              style={{ animation: 'fade-up 0.4s ease both', animationDelay: `${idx * 0.03}s` }}
            >
              {msg.sender === 'assistant' && (
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-white border border-slate-200 flex items-center justify-center">
                  <img src="/CWPlogolight.png" alt="CWP" className="w-5 h-5 object-contain" />
                </div>
              )}
              <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                msg.sender === 'assistant'
                  ? 'rounded-bl-sm bg-slate-100 text-slate-800 border border-slate-200'
                  : 'rounded-br-sm bg-[#2563EB] text-white'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Step-specific input UI ── */}
        <div className="pb-6 space-y-3">

          {/* ── auth_check ── */}
          {step === 'auth_check' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { addUserMessage('Yes, log me in'); goToStep('login'); }}
                className="py-4 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95"
              >
                Yes, log me in
              </button>
              <button
                onClick={() => { addUserMessage('No, create my account'); goToStep('signup'); }}
                className="py-4 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95"
              >
                No, create my account
              </button>
            </div>
          )}

          {/* ── login ── */}
          {step === 'login' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={checkout?.email || ''}
                  readOnly
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="Your password"
                    className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-2.5 text-slate-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginError && <p className="text-red-500 text-xs mt-1">{loginError}</p>}
              </div>
              <button
                onClick={handleLogin}
                disabled={isAuthLoading || !loginPassword}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAuthLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Log In
              </button>
              <p className="text-center text-xs text-slate-400">
                Forgot your password?{' '}
                <a href="/login" className="text-indigo-500 underline">Reset it here</a>
              </p>
            </div>
          )}

          {/* ── signup ── */}
          {step === 'signup' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email (from your purchase)</label>
                <input
                  type="email"
                  value={checkout?.email || ''}
                  readOnly
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password (min 8 characters)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-2.5 text-slate-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Confirm password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={signupConfirm}
                  onChange={e => setSignupConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignup()}
                  placeholder="Repeat your password"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none transition-all"
                />
                {signupError && <p className="text-red-500 text-xs mt-1">{signupError}</p>}
              </div>
              <button
                onClick={handleSignup}
                disabled={isAuthLoading || !signupPassword || !signupConfirm}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAuthLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create My Account
              </button>
            </div>
          )}

          {/* ── welcome ── */}
          {step === 'welcome' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              {/* Plan badge */}
              <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div className="text-2xl">🏆</div>
                <div>
                  <p className="font-bold text-indigo-900 text-sm">{tierInfo?.label} Plan — ${tierInfo?.monthlyPrice}/mo</p>
                  <p className="text-indigo-600 text-xs">Monthly hosting, maintenance & support</p>
                </div>
              </div>

              {/* Included add-ons */}
              {includedAddons.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Included with your plan:</p>
                  <ul className="space-y-1.5">
                    {includedAddons.map(a => (
                      <li key={a.key} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>{a.name}</strong>
                          {a.description && <span className="text-slate-500"> — {a.description}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Phone callout */}
              {tierInfo && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
                  tierInfo.phone_type === 'none'
                    ? 'bg-slate-50 border border-slate-200 text-slate-600'
                    : 'bg-blue-50 border border-blue-200 text-blue-800'
                }`}>
                  <span className="text-lg shrink-0">
                    {tierInfo.phone_type === 'none' ? 'ℹ️' : '📞'}
                  </span>
                  <p className="leading-snug">
                    {tierInfo.phone_type === 'none'
                      ? `Your ${tierInfo.label} plan includes AI Chat only. Upgrade to Growth for phone.`
                      : tierInfo.phone_detail}
                  </p>
                </div>
              )}

              <button
                onClick={() => { addUserMessage("Let's get started!"); goToStep('domain'); }}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors active:scale-95"
              >
                Continue Setup →
              </button>
            </div>
          )}

          {/* ── domain ── */}
          {step === 'domain' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={handleHasDomain}
                  className="py-4 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95"
                >
                  ✅ Yes, I have a domain name
                </button>
                <button
                  onClick={handleNeedsDomain}
                  className="py-4 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95"
                >
                  🛒 No, I need to purchase one
                </button>
              </div>
            </div>
          )}

          {/* ── domain_access ── */}
          {step === 'domain_access' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">

              {/* Domain name input */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Your Domain Name *
                </label>
                <input
                  type="text"
                  value={domainName}
                  onChange={e => setDomainName(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="yourbusiness.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none font-mono transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">Just the domain — no https:// needed</p>
              </div>

              {/* Domain registrar / access method */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Where is your domain registered?
                </label>
                <select
                  value={domainAccessMethod}
                  onChange={e => setDomainAccessMethod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none bg-white transition-all"
                >
                  <option value="">Select registrar...</option>
                  <option value="namecheap">Namecheap</option>
                  <option value="godaddy">GoDaddy</option>
                  <option value="google_domains">Google Domains / Squarespace</option>
                  <option value="cloudflare">Cloudflare</option>
                  <option value="network_solutions">Network Solutions</option>
                  <option value="other">Other</option>
                  <option value="not_sure">Not sure</option>
                </select>
              </div>

              {/* DNS access info card */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-bold mb-2">🔐 We'll need DNS access to connect your site</p>
                <p className="text-xs leading-relaxed text-blue-700">
                  Once your site is ready, our team will reach out with specific instructions
                  to update your nameservers or DNS records. We'll walk you through every step —
                  most registrars take just 2 minutes to update.
                </p>
              </div>

              {/* Optional notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Anything else about your domain? (optional)
                </label>
                <textarea
                  value={domainNotes}
                  onChange={e => setDomainNotes(e.target.value)}
                  placeholder="e.g. domain is expiring soon, I have existing email on it, it's pointing to another site..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none resize-none transition-all"
                />
              </div>

              <button
                onClick={handleDomainAccessSubmit}
                disabled={!domainName.trim() || isSaving}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save & Continue →
              </button>
            </div>
          )}

          {/* ── phone ── */}
          {step === 'phone' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePhoneYes}
                  className="py-4 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95"
                >
                  📱 Yes, I do
                </button>
                <button
                  onClick={handlePhoneNo}
                  className="py-4 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95"
                >
                  ➕ No, get me one
                </button>
              </div>
              <button
                onClick={handlePhoneSkip}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
              >
                Skip for now — I'll set this up later
              </button>
            </div>
          )}

          {/* ── phone_carrier ── */}
          {step === 'phone_carrier' && (
            <div className="grid grid-cols-3 gap-3">
              {(['Twilio', 'Telnyx', 'other'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => handleCarrierSelect(c)}
                  className="py-4 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95"
                >
                  {c === 'other' ? '📡 Other carrier' : c}
                </button>
              ))}
            </div>
          )}

          {/* ── phone_porting ── */}
          {step === 'phone_porting' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              {/* Warning card */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-bold mb-1">⚠️ Carrier Porting Notice</p>
                <p className="leading-relaxed text-xs">
                  Most carriers allow porting, but some do not. We'll verify your number is eligible before starting the process. Porting typically takes 3–7 business days.
                  Note: Not all carriers support porting. Google Voice, some VoIP providers, and certain prepaid numbers cannot be ported.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">What carrier is your number with?</label>
                <input
                  type="text"
                  value={phoneCarrierInput}
                  onChange={e => setPhoneCarrierInput(e.target.value)}
                  placeholder="e.g. AT&T, Verizon, Google Voice..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none transition-all"
                />
              </div>
              <p className="text-xs text-slate-500">We'll submit a porting request on your behalf. Our team will contact you with next steps.</p>
              <button
                onClick={handlePortingSubmit}
                disabled={!phoneCarrierInput.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                Submit Porting Request
              </button>
            </div>
          )}

          {/* ── phone_provision ── */}
          {step === 'phone_provision' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Preferred area code (optional)
                </label>
                <input
                  type="text"
                  value={areaCode}
                  onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder='e.g. "404" or leave blank for any'
                  maxLength={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none transition-all"
                  disabled={wantsTollFree}
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wantsTollFree}
                  onChange={e => { setWantsTollFree(e.target.checked); if (e.target.checked) setAreaCode(''); }}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">I'd prefer a toll-free 800/888 number</span>
              </label>
              <button
                onClick={handleProvisionSubmit}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors active:scale-95"
              >
                Request My Number →
              </button>
            </div>
          )}

          {/* ── cal_check ── */}
          {step === 'cal_check' && !calNeedCreate && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={handleCalConnected}
                  className="py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95"
                >
                  ✅ Yes, I already connected it
                </button>
                <button
                  onClick={handleCalNeedConnect}
                  className="py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95"
                >
                  🔑 Yes, but I need to connect it
                </button>
                <button
                  onClick={handleCalNoAccount}
                  className="py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all active:scale-95"
                >
                  ➕ No, I need to create one
                </button>
              </div>
            </div>
          )}

          {/* cal_check: no account → show signup instructions */}
          {step === 'cal_check' && calNeedCreate && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <p className="font-bold text-blue-800 text-sm mb-3">📅 Cal.com is free and powers your AI booking calendar.</p>
                <ol className="space-y-2 text-sm text-blue-700">
                  <li>1. Go to <a href="https://cal.com/signup" target="_blank" rel="noreferrer" className="underline font-semibold">cal.com/signup</a> to create your free account</li>
                  <li>2. Complete your account setup</li>
                  <li>3. Come back here and click the button below to add your API key</li>
                </ol>
              </div>
              <button
                onClick={handleCalNeedConnect}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors active:scale-95"
              >
                I have my API key →
              </button>
              <button
                onClick={handleCalApiKeySkip}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* ── cal_api_key ── */}
          {step === 'cal_api_key' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-700 mb-2">How to get your Cal.com API key:</p>
                <p>1. Log in to <a href="https://cal.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline">cal.com</a></p>
                <p>2. Go to <strong>Settings → API Keys</strong></p>
                <p>3. Click <strong>Create new key</strong></p>
                <p>4. Name it <strong>"CWP Integration"</strong> and copy the key</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Paste your Cal.com API Key</label>
                <input
                  type="text"
                  value={calApiKey}
                  onChange={e => setCalApiKey(e.target.value)}
                  placeholder="cal_live_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none font-mono transition-all"
                />
              </div>
              <button
                onClick={handleCalApiKeySubmit}
                disabled={!calApiKey.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                Save & Continue →
              </button>
              <button
                onClick={handleCalApiKeySkip}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
              >
                I'll do this later
              </button>
            </div>
          )}

          {/* ── a2p_intro ── */}
          {step === 'a2p_intro' && (
            <div className="space-y-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="font-bold text-slate-800 text-sm mb-3">📱 What is A2P 10DLC Registration?</p>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                  A2P (Application-to-Person) registration is required by US carriers to send business SMS messages and make automated calls.
                  Without it, your messages may be blocked.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  This is a one-time registration with your business info. It takes about 3–5 minutes and our team handles the submission.
                </p>
              </div>
              <button
                onClick={() => { addUserMessage("Let's register!"); goToStep('a2p_form'); }}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors active:scale-95"
              >
                Let's Register →
              </button>
            </div>
          )}

          {/* ── a2p_form ── */}
          {step === 'a2p_form' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              {[
                { label: 'Business Legal Name *', field: 'legalName', type: 'text', placeholder: checkout?.business_name },
                { label: 'EIN / Tax ID *', field: 'ein', type: 'text', placeholder: 'XX-XXXXXXX' },
                { label: 'Business Address *', field: 'address', type: 'textarea', placeholder: '123 Main St, Atlanta, GA 30301' },
                { label: 'Website URL (optional)', field: 'website', type: 'text', placeholder: 'https://yourbusiness.com' },
                { label: 'What will you use SMS for? *', field: 'smsUseCase', type: 'textarea', placeholder: 'Appointment confirmations, lead follow-up...' },
                { label: 'Sample SMS Message 1 * (max 160 chars)', field: 'sampleMessage1', type: 'textarea', placeholder: 'Hi {name}, your appointment is confirmed for {date}...' },
                { label: 'Sample SMS Message 2 (optional)', field: 'sampleMessage2', type: 'textarea', placeholder: '' },
                { label: 'Opt-in Method Description *', field: 'optInMethod', type: 'textarea', placeholder: 'Customers opt in via web form on our website...' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  {type === 'textarea' ? (
                    <textarea
                      value={(a2pForm as any)[field]}
                      onChange={e => setA2pForm(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={placeholder}
                      rows={field === 'sampleMessage1' || field === 'sampleMessage2' ? 2 : 3}
                      maxLength={field.startsWith('sampleMessage') ? 160 : undefined}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none resize-none transition-all"
                    />
                  ) : (
                    <input
                      type="text"
                      value={(a2pForm as any)[field]}
                      onChange={e => setA2pForm(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none transition-all"
                    />
                  )}
                </div>
              ))}

              {/* Business type */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Business Type *</label>
                <select
                  value={a2pForm.businessType}
                  onChange={e => setA2pForm(prev => ({ ...prev, businessType: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none transition-all bg-white"
                >
                  <option value="">Select type...</option>
                  {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <button
                onClick={handleA2pSubmit}
                disabled={isSaving || !a2pForm.legalName || !a2pForm.ein || !a2pForm.address || !a2pForm.businessType || !a2pForm.smsUseCase || !a2pForm.sampleMessage1 || !a2pForm.optInMethod}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit A2P Info →
              </button>
            </div>
          )}

          {/* ── brand ── */}
          {step === 'brand' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
              {/* Logo upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  🎨 Upload Your Logo
                </label>
                {logoPreview ? (
                  <div className="flex items-center gap-4">
                    <img src={logoPreview} alt="Logo preview" className="h-16 w-16 object-contain rounded-lg border border-slate-200 bg-slate-50" />
                    <div>
                      {brandUploaded
                        ? <p className="text-emerald-600 text-xs font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Uploaded successfully</p>
                        : logoUploading
                        ? <p className="text-slate-500 text-xs flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</p>
                        : <p className="text-amber-600 text-xs">Upload pending</p>
                      }
                      <label className="text-xs text-indigo-500 underline cursor-pointer mt-1 block">
                        Change logo
                        <input type="file" accept="image/*,.svg,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleLogoSelect} />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                    <p className="text-2xl mb-1">🖼️</p>
                    <p className="text-sm text-slate-500 font-medium">Click to upload your logo</p>
                    <p className="text-xs text-slate-400">PNG, SVG, JPG, WebP accepted</p>
                    <input type="file" accept="image/*,.svg,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleLogoSelect} />
                  </label>
                )}
              </div>

              {/* Brand color */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Primary Brand Color (optional)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={e => setBrandColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <span className="text-sm text-slate-600 font-mono">{brandColor}</span>
                </div>
              </div>

              {/* Brand notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Anything else about your brand? (optional)
                </label>
                <textarea
                  value={brandNotes}
                  onChange={e => setBrandNotes(e.target.value)}
                  placeholder="Style preferences, competitors you admire, things to avoid..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none resize-none transition-all"
                />
              </div>

              <button
                onClick={handleBrandContinue}
                disabled={isSaving}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue →
              </button>
            </div>
          )}

          {/* ── addon_suggest ── */}
          {step === 'addon_suggest' && (
            <div className="space-y-3">
              {suggestedAddons.length > 0 && (
                <div className="space-y-2">
                  {suggestedAddons.map(addon => {
                    const selected = selectedAddonRequests.includes(addon.key);
                    return (
                      <button
                        key={addon.key}
                        onClick={() => toggleAddonRequest(addon.key)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-98 ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm">{addon.name}</p>
                            {addon.description && (
                              <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{addon.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {addon.monthly_price_cents && (
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                                +{formatCents(addon.monthly_price_cents)}/mo
                              </span>
                            )}
                            <div className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                              selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                            }`}>
                              {selected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {suggestedAddons.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center text-slate-400 text-sm">
                  No additional recommendations right now.
                </div>
              )}

              <button
                onClick={handleFinishSetup}
                disabled={isSaving}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Finish Setup 🎉
              </button>
              <button
                onClick={handleFinishSetup}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
              >
                Skip for now
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ProSitesGem;

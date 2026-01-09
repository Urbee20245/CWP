import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Phone, 
  Mail, 
  Clock,
  FileText,
  Lightbulb,
  Calendar,
  AlertCircle,
  Rocket,
  Shield,
  Loader2
} from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';

// NOTE: This key must be set in .env.local or Vercel environment variables
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

interface FormData {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  websiteUrl: string;
  industry: string;
  services: string[];
  budget: string;
  timeline: string;
  projectDescription: string;
  preferredDate: string;
  preferredTime: string;
  alternateDate: string;
  alternateTime: string;
  referralSource: string;
  decisionMaker: string;
}

interface FormErrors {
  [key: string]: string;
}

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    businessName: '',
    email: '',
    phone: '',
    websiteUrl: '',
    industry: '',
    services: [],
    budget: '',
    timeline: '',
    projectDescription: '',
    preferredDate: '',
    preferredTime: '',
    alternateDate: '',
    alternateTime: '',
    referralSource: '',
    decisionMaker: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showBudgetMessage, setShowBudgetMessage] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const industries = [
    'Restaurant',
    'Retail',
    'Healthcare',
    'Legal',
    'Real Estate',
    'Home Services',
    'Professional Services',
    'E-commerce',
    'Other'
  ];

  const serviceOptions = [
    'Complete Website Rebuild',
    'Website Application',
    'Custom CRM Build',
    'SEO Optimization',
    'AI Chatbot Integration',
    'Mobile Optimization',
    'E-commerce Setup',
    'Ongoing Maintenance'
  ];

  const referralSources = [
    'Google Search',
    'Social Media',
    'Referral from friend/colleague',
    'Industry event',
    'Existing client',
    'Other'
  ];

  const timeSlots = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM', '6:00 PM'
  ];

  const saturdayTimeSlots = [
    '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
    '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM'
  ];

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePhone = (phone: string) => {
    const re = /^[\d\s\-\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    if (!formData.industry) newErrors.industry = 'Please select your industry';
    if (formData.services.length === 0) newErrors.services = 'Please select at least one service';
    if (!formData.budget) newErrors.budget = 'Please select your budget range';
    if (!formData.timeline) newErrors.timeline = 'Please select your project timeline';
    if (!formData.projectDescription.trim()) {
      newErrors.projectDescription = 'Project description is required';
    } else if (formData.projectDescription.trim().length < 50) {
      newErrors.projectDescription = 'Please provide at least 50 characters describing your project';
    }
    if (!formData.preferredDate) newErrors.preferredDate = 'Please select a preferred consultation date';
    if (!formData.preferredTime) newErrors.preferredTime = 'Please select a preferred time';
    if (!formData.referralSource) newErrors.referralSource = 'Please tell us how you heard about us';
    if (!formData.decisionMaker) newErrors.decisionMaker = 'Please indicate your decision-making authority';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Show message for low budget selection
    if (name === 'budget' && value === 'under-3000') {
      setShowBudgetMessage(true);
    } else if (name === 'budget') {
      setShowBudgetMessage(false);
    }
  };

  const handleCheckboxChange = (service: string) => {
    setFormData(prev => {
      const services = prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service];
      return { ...prev, services };
    });
    if (errors.services) {
      setErrors(prev => ({ ...prev, services: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);
    
    if (!validateForm()) {
      // Scroll to first error
      const firstError = Object.keys(errors)[0];
      const element = document.querySelector(`[name="${firstError}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);
    
    if (!RECAPTCHA_SITE_KEY) {
        setSubmissionError("reCAPTCHA is not configured. Please set VITE_RECAPTCHA_SITE_KEY.");
        setIsSubmitting(false);
        return;
    }

    try {
        const recaptchaToken = await recaptchaRef.current?.execute('request_consultation');
        if (!recaptchaToken) {
            throw new Error("reCAPTCHA verification failed. Please try again.");
        }
        
        // --- SIMULATED BACKEND SUBMISSION ---
        console.log("Consultation form submitted with reCAPTCHA token:", recaptchaToken);
        
        // Simulate API call delay and success
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setIsSubmitting(false);
        setIsSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error: any) {
        console.error("Form submission error:", error);
        setSubmissionError(error.message || "Submission failed due to a security check or network error.");
        setIsSubmitting(false);
        recaptchaRef.current?.reset();
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-12 border border-emerald-200">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Consultation Request Received!
            </h1>
            <p className="text-xl text-slate-600 mb-8">
              Thank you for your interest. We'll contact you within 24 hours to confirm your consultation time.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-8 text-left">
              <h3 className="font-bold text-slate-900 mb-4">What Happens Next:</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">We'll review your project details and confirm your consultation time</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">You'll receive a calendar invite with meeting details</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">We'll prepare a preliminary analysis of your current website</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">After the call, you'll receive a detailed proposal within 48 hours</span>
                </li>
              </ul>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-bold uppercase tracking-wide mb-6">
            <Shield className="w-4 h-4" />
            <span>Professional Consultation Request</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            Schedule Your Website<br />Transformation Consultation
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            <strong>Serious inquiries only.</strong> We work with businesses ready to invest in their digital presence.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
              
              {submissionError && (
                <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {submissionError}
                </div>
              )}
              
              {/* Basic Information */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6 pb-4 border-b border-slate-200">
                  1. Basic Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      placeholder="Your Full Name"
                      className={`w-full px-4 py-3 border ${errors.fullName ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all`}
                      disabled={isSubmitting}
                    />
                    {errors.fullName && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.fullName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
                      placeholder="Your Business Name"
                      className={`w-full px-4 py-3 border ${errors.businessName ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all`}
                      disabled={isSubmitting}
                    />
                    {errors.businessName && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.businessName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="your@email.com"
                      className={`w-full px-4 py-3 border ${errors.email ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all`}
                      disabled={isSubmitting}
                    />
                    {errors.email && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="(404) 555-1234"
                      className={`w-full px-4 py-3 border ${errors.phone ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all`}
                      disabled={isSubmitting}
                    />
                    {errors.phone && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.phone}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Current Website URL
                    </label>
                    <input
                      type="url"
                      name="websiteUrl"
                      value={formData.websiteUrl}
                      onChange={handleInputChange}
                      placeholder="https://yourbusiness.com"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                      disabled={isSubmitting}
                    />
                    <p className="mt-2 text-xs text-slate-500">If you don't have a website yet, leave blank</p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Business Industry <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="industry"
                      value={formData.industry}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border ${errors.industry ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all`}
                      disabled={isSubmitting}
                    >
                      <option value="">Select your industry...</option>
                      {industries.map(industry => (
                        <option key={industry} value={industry}>{industry}</option>
                      ))}
                    </select>
                    {errors.industry && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.industry}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Services & Project Details */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6 pb-4 border-b border-slate-200">
                  2. Project Details
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                      What services are you interested in? <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {serviceOptions.map(service => (
                        <label key={service} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all">
                          <input
                            type="checkbox"
                            checked={formData.services.includes(service)}
                            onChange={() => handleCheckboxChange(service)}
                            className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            disabled={isSubmitting}
                          />
                          <span className="text-sm text-slate-700">{service}</span>
                        </label>
                      ))}
                    </div>
                    {errors.services && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.services}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                      Project Budget Range <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {[
                        { value: 'under-3000', label: 'Under $3,000' },
                        { value: '5000-8000', label: '$5,000 - $8,000' },
                        { value: '8000-15000', label: '$8,000 - $15,000' },
                        { value: '15000-plus', label: '$15,000+' },
                        { value: 'need-guidance', label: 'I need guidance on budget' }
                      ].map(option => (
                        <label key={option.value} className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all">
                          <input
                            type="radio"
                            name="budget"
                            value={option.value}
                            checked={formData.budget === option.value}
                            onChange={handleInputChange}
                            className="w-5 h-5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            disabled={isSubmitting}
                          />
                          <span className="text-sm font-medium text-slate-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                    {showBudgetMessage && (
                      <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-sm text-amber-800">
                          <strong>Note:</strong> We occasionally offer discounts on services. We'll discuss options during your consultation.
                        </p>
                      </div>
                    )}
                    {errors.budget && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.budget}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                      Project Timeline <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {[
                        { value: 'urgent', label: 'Urgent (1-2 weeks)' },
                        { value: 'soon', label: 'Soon (1-2 months)' },
                        { value: 'planning', label: 'Planning ahead (3-6 months)' },
                        { value: 'exploring', label: 'Just exploring options' }
                      ].map(option => (
                        <label key={option.value} className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all">
                          <input
                            type="radio"
                            name="timeline"
                            value={option.value}
                            checked={formData.timeline === option.value}
                            onChange={handleInputChange}
                            className="w-5 h-5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            disabled={isSubmitting}
                          />
                          <span className="text-sm font-medium text-slate-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                    {errors.timeline && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.timeline}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Tell us about your project <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="projectDescription"
                      value={formData.projectDescription}
                      onChange={handleInputChange}
                      placeholder="What are your main goals? What problems are you trying to solve?"
                      rows={5}
                      className={`w-full px-4 py-3 border ${errors.projectDescription ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none`}
                      disabled={isSubmitting}
                    />
                    <div className="mt-2 flex justify-between items-center">
                      <p className="text-xs text-slate-500">Minimum 50 characters required</p>
                      <p className={`text-xs ${formData.projectDescription.length >= 50 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {formData.projectDescription.length}/50
                      </p>
                    </div>
                    {errors.projectDescription && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.projectDescription}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Scheduling */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6 pb-4 border-b border-slate-200">
                  3. Schedule Consultation
                </h3>
                <p className="text-sm text-slate-600 mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <strong>Business Hours:</strong> Monday-Friday: 9:00 AM - 6:00 PM ET | Saturday: 10:00 AM - 4:00 PM ET | Sunday: Closed
                  <br />
                  <em>All times shown in Eastern Time (ET)</em>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Preferred Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="preferredDate"
                      value={formData.preferredDate}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className={`w-full px-4 py-3 border ${errors.preferredDate ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all`}
                      disabled={isSubmitting}
                    />
                    {errors.preferredDate && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.preferredDate}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Preferred Time <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="preferredTime"
                      value={formData.preferredTime}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border ${errors.preferredTime ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all`}
                      disabled={isSubmitting}
                    >
                      <option value="">Select time...</option>
                      <optgroup label="Weekday Hours (Mon-Fri)">
                        {timeSlots.map(time => (
                          <option key={time} value={time}>{time} ET</option>
                        ))}
                      </optgroup>
                      <optgroup label="Saturday Hours">
                        {saturdayTimeSlots.map(time => (
                          <option key={time} value={time}>{time} ET</option>
                        ))}
                      </optgroup>
                    </select>
                    {errors.preferredTime && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.preferredTime}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Alternate Date (Optional)
                    </label>
                    <input
                      type="date"
                      name="alternateDate"
                      value={formData.alternateDate}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                      disabled={isSubmitting}
                    />
                    <p className="mt-2 text-xs text-slate-500">Backup option if first choice unavailable</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Alternate Time (Optional)
                    </label>
                    <select
                      name="alternateTime"
                      value={formData.alternateTime}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                      disabled={isSubmitting}
                    >
                      <option value="">Select time...</option>
                      <optgroup label="Weekday Hours (Mon-Fri)">
                        {timeSlots.map(time => (
                          <option key={time} value={time}>{time} ET</option>
                        ))}
                      </optgroup>
                      <optgroup label="Saturday Hours">
                        {saturdayTimeSlots.map(time => (
                          <option key={time} value={time}>{time} ET</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              </div>

              {/* Qualifying Questions */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6 pb-4 border-b border-slate-200">
                  4. Additional Information
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      How did you hear about us? <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="referralSource"
                      value={formData.referralSource}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border ${errors.referralSource ? 'border-red-500' : 'border-slate-300'} rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all`}
                      disabled={isSubmitting}
                    >
                      <option value="">Select an option...</option>
                      {referralSources.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                    {errors.referralSource && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.referralSource}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                      Are you the decision-maker for this project? <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {[
                        { value: 'yes', label: 'Yes, I make the final decision' },
                        { value: 'input', label: 'No, but I have input' },
                        { value: 'gathering', label: 'No, I\'m gathering information for someone else' }
                      ].map(option => (
                        <label key={option.value} className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all">
                          <input
                            type="radio"
                            name="decisionMaker"
                            value={option.value}
                            checked={formData.decisionMaker === option.value}
                            onChange={handleInputChange}
                            className="w-5 h-5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            disabled={isSubmitting}
                          />
                          <span className="text-sm font-medium text-slate-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                    {errors.decisionMaker && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {errors.decisionMaker}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Invisible ReCAPTCHA v3 Component */}
              {RECAPTCHA_SITE_KEY && (
                  <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={RECAPTCHA_SITE_KEY}
                      size="invisible"
                  />
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                  isSubmitting
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-2xl hover:shadow-indigo-200 hover:scale-[1.02]'
                } text-white`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin">
                    </Loader2>
                    Processing...
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    Request Consultation
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-32 space-y-6">
              
              {/* What to Expect */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                  What to Expect
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900">15-30 minute consultation call</p>
                      <p className="text-sm text-slate-600">Discuss your goals and challenges</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900">Free website analysis review</p>
                      <p className="text-sm text-slate-600">We'll assess your current site</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900">Custom recommendations</p>
                      <p className="text-sm text-slate-600">Tailored strategy for your business</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900">Detailed proposal within 48 hours</p>
                      <p className="text-sm text-slate-600">Clear scope, timeline, and investment</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Contact Information */}
              <div className="bg-slate-900 text-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold mb-6">Contact Information</h3>
                <ul className="space-y-4">
                  <li>
                    <a href="tel:4045329266" className="flex items-center gap-3 hover:text-indigo-400 transition-colors">
                      <Phone className="w-5 h-5" />
                      <span className="font-semibold">(404) 532-9266</span>
                    </a>
                  </li>
                  <li>
                    <a href="mailto:hello@customwebsitesplus.com" className="flex items-center gap-3 hover:text-indigo-400 transition-colors">
                      <Mail className="w-5 h-5" />
                      <span className="font-semibold">hello@customwebsitesplus.com</span>
                    </a>
                  </li>
                  <li className="pt-4 border-t border-slate-700">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold mb-2">Office Hours:</p>
                        <p className="text-slate-400">Mon-Fri: 9am-6pm ET</p>
                        <p className="text-slate-400">Sat: 10am-4pm ET</p>
                        <p className="text-slate-400">Sun: Closed</p>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Not Ready Yet */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-3">Not Ready Yet?</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Start with a free analysis of your current website to see where you stand.
                </p>
                <Link
                  to="/jetsuite"
                  className="block text-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                >
                  Try Free Website Analysis
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
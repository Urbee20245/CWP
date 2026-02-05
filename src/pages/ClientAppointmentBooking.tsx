"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ClientLayout from '../components/ClientLayout';
import { supabase } from '../integrations/supabase/client';
import {
  Loader2,
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Phone,
  Video,
  X,
  DollarSign,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isBefore,
  isAfter,
  addMinutes,
  setHours,
  setMinutes,
  getDay,
  startOfMonth,
  addMonths,
} from 'date-fns';
import { useAuth } from '../hooks/useAuth';

// Declare Cal as a global for the Cal.com embed
declare global {
  interface Window {
    Cal?: any;
  }
}

interface Availability {
  id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
}

interface Appointment {
  id: string;
  client_id: string;
  appointment_time: string; // ISO timestamp
  duration_minutes: number;
  appointment_type: 'phone' | 'video' | 'in_person';
  status: 'scheduled' | 'canceled' | 'completed';
  billing_type?: string;
  price_cents?: number;
  hosted_invoice_url?: string | null;
}

const FREE_DURATION_MINUTES = 15;
const PAID_BLOCK_MINUTES = 30;
const PRICE_PER_BLOCK_CENTS = 5000; // $50

const ClientAppointmentBooking: React.FC = () => {
  const { profile } = useAuth();

  const [clientId, setClientId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Cal.com embed state
  const [calBookingLink, setCalBookingLink] = useState<string | null>(null);
  const [calEmbedLoaded, setCalEmbedLoaded] = useState(false);
  const calContainerRef = useRef<HTMLDivElement>(null);

  // Pricing state
  const [isFreeEligibleThisMonth, setIsFreeEligibleThisMonth] = useState(false);
  const [bookingMode, setBookingMode] = useState<'free' | 'paid'>('free');
  const [paidDuration, setPaidDuration] = useState<number>(PAID_BLOCK_MINUTES);

  // Booking state
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [appointmentType, setAppointmentType] = useState<'phone' | 'video' | 'in_person'>('phone');

  const calculatedDuration = bookingMode === 'free' ? FREE_DURATION_MINUTES : paidDuration;
  const calculatedPriceCents = bookingMode === 'free' ? 0 : Math.round((paidDuration / PAID_BLOCK_MINUTES) * PRICE_PER_BLOCK_CENTS);

  const durationOptions = useMemo(() => {
    // Simple increments: 30, 60, 90
    return [30, 60, 90];
  }, []);

  const fetchClientData = useCallback(async () => {
    if (!profile) return;

    setIsLoading(true);

    // 1) Get Client ID
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_profile_id', profile.id)
      .single();

    if (clientError || !clientData) {
      console.error('Client record not found:', clientError);
      setIsLoading(false);
      return;
    }

    setClientId(clientData.id);

    // 2) Fetch Availability
    const { data: availData, error: availError } = await supabase.from('admin_availability').select('*');

    if (availError) {
      console.error('Error fetching availability:', availError);
    } else {
      setAvailability((availData as Availability[]) || []);
    }

    // 3) Fetch Existing Upcoming Appointments (for the next 60 days)
    const today = new Date();
    const sixtyDaysOut = addDays(today, 60);
    const { data: apptData, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('client_id', clientData.id)
      .gte('appointment_time', today.toISOString())
      .lte('appointment_time', sixtyDaysOut.toISOString())
      .in('status', ['scheduled']);

    if (apptError) {
      console.error('Error fetching existing appointments:', apptError);
    } else {
      setExistingAppointments((apptData as Appointment[]) || []);
    }

    // 4) Determine free eligibility (resets monthly)
    const monthStart = startOfMonth(new Date());
    const nextMonthStart = addMonths(monthStart, 1);

    const { count: monthCount, error: monthCountErr } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientData.id)
      .gte('appointment_time', monthStart.toISOString())
      .lt('appointment_time', nextMonthStart.toISOString())
      .neq('status', 'canceled');

    if (monthCountErr) {
      console.error('Error fetching monthly appointment usage:', monthCountErr);
      setIsFreeEligibleThisMonth(false);
      setBookingMode('paid');
    } else {
      const eligible = (monthCount || 0) === 0;
      setIsFreeEligibleThisMonth(eligible);
      setBookingMode(eligible ? 'free' : 'paid');
    }

    // 5) Check for Cal.com booking link (for admin's calendar)
    // We need to get the admin's Cal.com config to show their calendar to clients
    const { data: calData } = await supabase
      .from('client_cal_calendar')
      .select('cal_booking_link, connection_status')
      .eq('connection_status', 'connected')
      .not('cal_booking_link', 'is', null)
      .limit(1)
      .maybeSingle();

    if (calData?.cal_booking_link) {
      setCalBookingLink(calData.cal_booking_link);
    }

    setIsLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  // Load Cal.com embed when booking link is available
  useEffect(() => {
    if (!calBookingLink || calEmbedLoaded) return;

    // Load Cal.com embed script
    const loadCalEmbed = () => {
      // Check if script is already loaded
      if (window.Cal) {
        initializeCalEmbed();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://app.cal.com/embed/embed.js';
      script.async = true;
      script.onload = () => {
        initializeCalEmbed();
      };
      document.body.appendChild(script);
    };

    const initializeCalEmbed = () => {
      if (!window.Cal || !calContainerRef.current) return;

      // Initialize Cal.com
      (function (C: any, A: string, L: string) {
        const p = function (a: any, ar: any) {
          a.q.push(ar);
        };
        const d = C.document;
        C.Cal =
          C.Cal ||
          function () {
            const cal = C.Cal;
            const ar = arguments;
            if (!cal.loaded) {
              cal.ns = {};
              cal.q = cal.q || [];
              p(cal, ar);
              return;
            }
            if (ar[0] === L) {
              const api = function () {
                p(api, arguments);
              };
              const namespace = ar[1];
              api.q = api.q || [];
              if (typeof namespace === "string") {
                cal.ns[namespace] = cal.ns[namespace] || api;
                p(cal.ns[namespace], ar);
                p(cal, ["initNamespace", namespace]);
              } else p(cal, ar);
              return;
            }
            p(cal, ar);
          };
      })(window, "https://app.cal.com/embed/embed.js", "init");

      window.Cal("init", { origin: "https://cal.com" });

      // Create inline embed
      window.Cal("inline", {
        elementOrSelector: calContainerRef.current,
        calLink: calBookingLink,
        config: {
          layout: "month_view",
        },
      });

      window.Cal("ui", {
        theme: "light",
        styles: { branding: { brandColor: "#4f46e5" } },
        hideEventTypeDetails: false,
        layout: "month_view",
      });

      setCalEmbedLoaded(true);
    };

    loadCalEmbed();
  }, [calBookingLink, calEmbedLoaded]);

  const generateTimeSlots = (day: Date) => {
    const dayOfWeek = getDay(day);
    const slots = availability.filter((avail) => avail.day_of_week === dayOfWeek);
    const timeSlots: Date[] = [];

    slots.forEach((slot) => {
      const [startHour, startMinute] = slot.start_time.split(':').map(Number);
      const [endHour, endMinute] = slot.end_time.split(':').map(Number);

      let currentTime = setMinutes(setHours(day, startHour), startMinute);
      const endTime = setMinutes(setHours(day, endHour), endMinute);

      while (isBefore(currentTime, endTime)) {
        const slotEnd = addMinutes(currentTime, calculatedDuration);

        // Ensure the slot is fully within the availability window
        if (isAfter(slotEnd, endTime)) break;

        // Check if slot is in the past
        if (isBefore(currentTime, new Date())) {
          currentTime = addMinutes(currentTime, PAID_BLOCK_MINUTES);
          continue;
        }

        // Check for conflicts with existing appointments
        const isConflicting = existingAppointments.some((appt) => {
          const apptStart = parseISO(appt.appointment_time);
          const apptEnd = addMinutes(apptStart, appt.duration_minutes);
          return isBefore(currentTime, apptEnd) && isAfter(slotEnd, apptStart);
        });

        if (!isConflicting) {
          timeSlots.push(currentTime);
        }

        // Always step slots by 30 minutes to keep the calendar clean
        currentTime = addMinutes(currentTime, PAID_BLOCK_MINUTES);
      }
    });

    return timeSlots;
  };

  const createInvoiceForAppointment = async (durationMinutes: number, amountCents: number) => {
    if (!clientId) throw new Error('Missing client id.');

    const amountDollars = amountCents / 100;

    const { data, error } = await supabase.functions.invoke('stripe-api/create-invoice', {
      body: JSON.stringify({
        client_id: clientId,
        due_date: new Date().toISOString(),
        line_items: [
          {
            description: `Client Appointment (${durationMinutes} minutes)`,
            amount: amountDollars,
          },
        ],
      }),
    });

    if (error) {
      console.error('[ClientAppointmentBooking] create-invoice failed', error);
      throw new Error(error.message || 'Failed to create invoice.');
    }

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (parsed?.error) throw new Error(parsed.error);

    return parsed as { invoice_id: string; hosted_url: string; status: string };
  };

  const handleBookAppointment = async () => {
    if (!selectedSlot || !clientId || !profile) return;

    setIsBooking(true);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      const durationMinutes = calculatedDuration;
      const priceCents = calculatedPriceCents;

      // Enforce free-only eligibility
      if (bookingMode === 'free' && !isFreeEligibleThisMonth) {
        throw new Error('Your free monthly appointment has already been used.');
      }

      let stripeInvoiceId: string | null = null;
      let hostedInvoiceUrl: string | null = null;

      if (bookingMode === 'paid') {
        const invoice = await createInvoiceForAppointment(durationMinutes, priceCents);
        stripeInvoiceId = invoice.invoice_id;
        hostedInvoiceUrl = invoice.hosted_url;
        // Open invoice in a new tab so they can pay immediately.
        if (hostedInvoiceUrl) {
          window.open(hostedInvoiceUrl, '_blank', 'noopener,noreferrer');
        }
      }

      const { error } = await supabase.from('appointments').insert({
        client_id: clientId,
        appointment_time: selectedSlot.toISOString(),
        duration_minutes: durationMinutes,
        appointment_type: appointmentType,
        status: 'scheduled',
        booked_by_profile_id: profile.id,
        billing_type: bookingMode === 'free' ? 'free_monthly' : 'paid',
        price_cents: priceCents,
        stripe_invoice_id: stripeInvoiceId,
        hosted_invoice_url: hostedInvoiceUrl,
      });

      if (error) throw error;

      const priceLabel = bookingMode === 'free' ? 'FREE' : `$${(priceCents / 100).toFixed(2)}`;
      const extra = bookingMode === 'paid' ? ' An invoice was opened in a new tab.' : '';

      setBookingSuccess(
        `Appointment booked for ${format(selectedSlot, 'MMM d, h:mm a')} (${durationMinutes} min) — ${priceLabel}.${extra}`
      );

      setSelectedSlot(null);
      await fetchClientData();
    } catch (e: any) {
      setBookingError(e?.message || 'Failed to book appointment. The slot might have just been taken.');
    } finally {
      setIsBooking(false);
    }
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
    setSelectedSlot(null);
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
    setSelectedSlot(null);
  };

  const renderBookingModal = () => {
    if (!selectedSlot) return null;

    const priceLabel = bookingMode === 'free' ? 'FREE' : `$${(calculatedPriceCents / 100).toFixed(2)}`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
            <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <CalendarCheck className="w-6 h-6 text-indigo-600" /> Confirm Appointment
            </h3>
            <button onClick={() => setSelectedSlot(null)} className="text-slate-500 hover:text-slate-900">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <p className="text-sm font-bold text-indigo-800">Date: {format(selectedSlot, 'EEEE, MMM d, yyyy')}</p>
              <p className="text-xl font-bold text-indigo-900">
                {format(selectedSlot, 'h:mm a')} ({calculatedDuration} min)
              </p>
              <p className="text-sm font-semibold text-indigo-800 mt-1 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> {priceLabel}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-sm font-bold text-slate-900 mb-2">Appointment Type</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAppointmentType('phone')}
                  className={`flex-1 py-3 rounded-lg text-sm font-semibold border transition-colors ${
                    appointmentType === 'phone'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Phone className="w-4 h-4 inline mr-2" /> Phone Call
                </button>
                <button
                  type="button"
                  onClick={() => setAppointmentType('video')}
                  className={`flex-1 py-3 rounded-lg text-sm font-semibold border transition-colors ${
                    appointmentType === 'video'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Video className="w-4 h-4 inline mr-2" /> Video Call
                </button>
              </div>
              {bookingMode === 'paid' && (
                <p className="text-xs text-slate-500 mt-2">
                  Paid calls are billed at $50 per 30 minutes. An invoice will open in a new tab after you confirm.
                </p>
              )}
            </div>
          </div>

          {bookingError && (
            <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {bookingError}
            </div>
          )}

          <button
            onClick={handleBookAppointment}
            disabled={isBooking}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isBooking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Booking...
              </>
            ) : (
              'Confirm Booking'
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderWeeklySchedule = () => {
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));

    return (
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-4 min-w-[1000px]">
          {weekDays.map((day, dayIndex) => {
            const slots = generateTimeSlots(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div key={dayIndex} className="bg-white p-3 rounded-lg border border-slate-200">
                <h3
                  className={`font-bold text-sm mb-3 border-b border-slate-100 pb-2 ${
                    isToday ? 'text-indigo-600' : 'text-slate-900'
                  }`}
                >
                  {format(day, 'EEE, MMM d')}
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {slots.length > 0 ? (
                    slots.map((slot, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedSlot(slot)}
                        disabled={isBooking}
                        className="w-full py-2 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        {format(slot, 'h:mm a')}
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No available slots.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <CalendarCheck className="w-7 h-7 text-indigo-600" /> Book a Discussion
        </h1>

        {bookingSuccess && (
          <div className="p-4 mb-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {bookingSuccess}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Existing Appointments */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 h-fit">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <Clock className="w-5 h-5 text-purple-600" /> Your Scheduled Calls
              </h2>

              <div className="space-y-3">
                {existingAppointments.filter((a) => a.status === 'scheduled').length > 0 ? (
                  existingAppointments
                    .filter((a) => a.status === 'scheduled')
                    .map((appt) => (
                      <div key={appt.id} className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                        <p className="font-bold">{format(parseISO(appt.appointment_time), 'MMM d, h:mm a')}</p>
                        <p className="text-xs text-indigo-700 mt-1">Type: {appt.appointment_type.toUpperCase()}</p>
                        <p className="text-xs text-indigo-700">Duration: {appt.duration_minutes} minutes</p>
                        {typeof appt.price_cents === 'number' && (
                          <p className="text-xs text-indigo-700">
                            Price: {appt.price_cents > 0 ? `$${(appt.price_cents / 100).toFixed(2)}` : 'FREE'}
                          </p>
                        )}
                        {appt.hosted_invoice_url && (
                          <a
                            href={appt.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 underline mt-1 inline-block"
                          >
                            View Invoice
                          </a>
                        )}
                      </div>
                    ))
                ) : (
                  <p className="text-slate-500 text-sm">No upcoming appointments.</p>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <Users className="w-5 h-5 text-slate-600" /> Meeting Details
              </h2>
              <p className="text-sm text-slate-600 mb-4">All appointments are with the project lead or a senior strategist.</p>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600" /> Phone calls are initiated by us.
                </li>
                <li className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-indigo-600" /> Video calls use Google Meet (link sent via email).
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Booking Calendar */}
          <div className="lg:col-span-2 space-y-6">
            {calBookingLink ? (
              /* Cal.com Embed Calendar */
              <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Calendar className="w-5 h-5 text-indigo-600" /> Book an Appointment
                </h2>

                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <p className="text-sm text-indigo-800">
                    Select a time slot below to book directly. You'll receive a confirmation email with meeting details.
                  </p>
                </div>

                {/* Cal.com Embed Container */}
                <div
                  ref={calContainerRef}
                  className="cal-embed-container min-h-[600px] w-full"
                  style={{ minHeight: '600px' }}
                >
                  {!calEmbedLoaded && (
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                        <p className="text-slate-600">Loading calendar...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fallback link */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" />
                    Having trouble?
                    <a
                      href={`https://cal.com/${calBookingLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline font-semibold"
                    >
                      Open booking page in new tab
                    </a>
                  </p>
                </div>
              </div>
            ) : (
              /* Legacy Custom Calendar */
              <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <CalendarCheck className="w-5 h-5 text-emerald-600" /> Select Available Slot
                </h2>

                {/* Pricing / Mode selector */}
                <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Monthly policy</p>
                      <p className="text-xs text-slate-600">
                        First appointment each month is FREE ({FREE_DURATION_MINUTES} minutes). After that, calls are $50 per 30 minutes.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => setBookingMode('free')}
                        disabled={!isFreeEligibleThisMonth}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
                          bookingMode === 'free'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Free ({FREE_DURATION_MINUTES} min)
                      </button>

                      <button
                        type="button"
                        onClick={() => setBookingMode('paid')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          bookingMode === 'paid'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Paid
                      </button>
                    </div>
                  </div>

                  {bookingMode === 'paid' && (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="text-sm font-semibold text-slate-700">Duration</div>
                      <select
                        value={paidDuration}
                        onChange={(e) => setPaidDuration(parseInt(e.target.value, 10))}
                        className="p-2 border border-slate-300 rounded-lg text-sm"
                      >
                        {durationOptions.map((d) => (
                          <option key={d} value={d}>
                            {d} minutes — ${((d / PAID_BLOCK_MINUTES) * 50).toFixed(0)}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-500">An invoice opens after you confirm the time.</div>
                    </div>
                  )}

                  {!isFreeEligibleThisMonth && (
                    <div className="mt-3 text-xs text-slate-600">
                      Your free monthly appointment has already been used.
                    </div>
                  )}
                </div>

                {/* Week Navigation */}
                <div className="flex justify-between items-center mb-4">
                  <button onClick={handlePreviousWeek} className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm">
                    ← Prev Week
                  </button>
                  <span className="font-bold text-slate-900">
                    {format(currentWeekStart, 'MMM d')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
                  </span>
                  <button onClick={handleNextWeek} className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm">
                    Next Week →
                  </button>
                </div>

                {availability.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-3" />
                    <p className="text-slate-600">Admin availability has not been set yet. Please check back later.</p>
                  </div>
                ) : (
                  renderWeeklySchedule()
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {!calBookingLink && renderBookingModal()}
    </ClientLayout>
  );
};

export default ClientAppointmentBooking;

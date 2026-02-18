"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ClientLayout from '../components/ClientLayout';
import { supabase } from '../integrations/supabase/client';
import {
  Loader2, CalendarCheck, Clock, CheckCircle2, AlertTriangle,
  Users, Phone, Video, X, DollarSign, Calendar, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  format, parseISO, startOfWeek, endOfWeek, addDays, isSameDay,
  startOfMonth, addMonths,
} from 'date-fns';
import { useAuth } from '../hooks/useAuth';

interface CalSlot {
  date: string;
  dateFormatted: string;
  time: string;
  datetime: string;
}

interface Appointment {
  id: string;
  client_id: string;
  appointment_time: string;
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
  const [calSlots, setCalSlots] = useState<CalSlot[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [isFreeEligibleThisMonth, setIsFreeEligibleThisMonth] = useState(false);
  const [bookingMode, setBookingMode] = useState<'free' | 'paid'>('free');
  const [paidDuration, setPaidDuration] = useState<number>(PAID_BLOCK_MINUTES);

  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSlot, setSelectedSlot] = useState<CalSlot | null>(null);
  const [appointmentType, setAppointmentType] = useState<'phone' | 'video' | 'in_person'>('phone');

  const calculatedDuration = bookingMode === 'free' ? FREE_DURATION_MINUTES : paidDuration;
  const calculatedPriceCents = bookingMode === 'free' ? 0 : Math.round((paidDuration / PAID_BLOCK_MINUTES) * PRICE_PER_BLOCK_CENTS);

  const durationOptions = useMemo(() => [30, 60, 90], []);

  const fetchCalSlots = useCallback(async () => {
    setIsFetchingSlots(true);
    setSlotsError(null);
    try {
      const { data, error } = await supabase.functions.invoke('get-consultation-slots', {
        body: { days: 30, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });
      if (error) {
        setSlotsError('Unable to load available times. Please try again.');
        return;
      }
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed?.slots && Array.isArray(parsed.slots)) {
        setCalSlots(parsed.slots);
      } else if (parsed?.message) {
        setSlotsError(parsed.message);
      } else {
        setCalSlots([]);
      }
    } catch (e: any) {
      setSlotsError('Unable to load available times. Please try again.');
    } finally {
      setIsFetchingSlots(false);
    }
  }, []);

  const fetchClientData = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);

    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_profile_id', profile.id)
      .single();

    if (clientError || !clientData) {
      setIsLoading(false);
      return;
    }

    setClientId(clientData.id);

    const today = new Date();
    const sixtyDaysOut = addDays(today, 60);
    const { data: apptData } = await supabase
      .from('appointments')
      .select('*')
      .eq('client_id', clientData.id)
      .gte('appointment_time', today.toISOString())
      .lte('appointment_time', sixtyDaysOut.toISOString())
      .in('status', ['scheduled']);

    setExistingAppointments((apptData as Appointment[]) || []);

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
      setIsFreeEligibleThisMonth(false);
      setBookingMode('paid');
    } else {
      const eligible = (monthCount || 0) === 0;
      setIsFreeEligibleThisMonth(eligible);
      setBookingMode(eligible ? 'free' : 'paid');
    }

    await fetchCalSlots();
    setIsLoading(false);
  }, [profile, fetchCalSlots]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  const getSlotsForDay = useCallback((day: Date): CalSlot[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return calSlots.filter((slot) => slot.date === dayStr);
  }, [calSlots]);

  const createInvoiceForAppointment = async (durationMinutes: number, amountCents: number) => {
    if (!clientId) throw new Error('Missing client id.');
    const { data, error } = await supabase.functions.invoke('stripe-api/create-invoice', {
      body: JSON.stringify({
        client_id: clientId,
        due_date: new Date().toISOString(),
        line_items: [{ description: `Client Appointment (${durationMinutes} minutes)`, amount: amountCents / 100 }],
      }),
    });
    if (error) throw new Error(error.message || 'Failed to create invoice.');
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

      if (bookingMode === 'free' && !isFreeEligibleThisMonth) {
        throw new Error('Your free monthly appointment has already been used.');
      }

      let stripeInvoiceId: string | null = null;
      let hostedInvoiceUrl: string | null = null;

      if (bookingMode === 'paid') {
        const invoice = await createInvoiceForAppointment(durationMinutes, priceCents);
        stripeInvoiceId = invoice.invoice_id;
        hostedInvoiceUrl = invoice.hosted_url;
        if (hostedInvoiceUrl) window.open(hostedInvoiceUrl, '_blank', 'noopener,noreferrer');
      }

      const appointmentTime = new Date(selectedSlot.datetime);
      const { error } = await supabase.from('appointments').insert({
        client_id: clientId,
        appointment_time: appointmentTime.toISOString(),
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
        `Appointment booked for ${format(appointmentTime, 'MMM d, h:mm a')} (${durationMinutes} min) — ${priceLabel}.${extra}`
      );
      setSelectedSlot(null);
      await fetchClientData();
    } catch (e: any) {
      setBookingError(e?.message || 'Failed to book appointment. The slot might have just been taken.');
    } finally {
      setIsBooking(false);
    }
  };

  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));

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
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Book an Appointment</h1>
          <p className="text-slate-500 text-sm mt-1">Schedule a call or meeting with your project team.</p>
        </div>

        {bookingSuccess && (
          <div className="p-4 mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-medium text-emerald-800">{bookingSuccess}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Sidebar Info */}
          <div className="space-y-4">

            {/* Upcoming Appointments */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-900">Your Upcoming Calls</h2>
              </div>
              <div className="p-4 space-y-3">
                {existingAppointments.filter(a => a.status === 'scheduled').length > 0 ? (
                  existingAppointments
                    .filter(a => a.status === 'scheduled')
                    .map(appt => (
                      <div key={appt.id} className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <p className="text-sm font-bold text-slate-900">
                          {format(parseISO(appt.appointment_time), 'MMM d, h:mm a')}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-indigo-700 font-medium capitalize">
                            {appt.appointment_type.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-slate-500">{appt.duration_minutes} min</span>
                          {typeof appt.price_cents === 'number' && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                              appt.price_cents === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {appt.price_cents === 0 ? 'FREE' : `$${(appt.price_cents / 100).toFixed(2)}`}
                            </span>
                          )}
                        </div>
                        {appt.hosted_invoice_url && (
                          <a
                            href={appt.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline mt-2 inline-block font-medium"
                          >
                            View Invoice →
                          </a>
                        )}
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-slate-400 py-2 text-center">No upcoming appointments</p>
                )}
              </div>
            </div>

            {/* Meeting Details */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
                <Users className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">Meeting Details</h2>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-slate-600">All appointments are with your project lead or a senior strategist.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 text-xs text-slate-600">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    Phone calls are initiated by us.
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-600">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Video className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    Video calls use Google Meet (link sent via email).
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing Policy */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
                <DollarSign className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">Pricing Policy</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className={`p-3 rounded-xl border ${isFreeEligibleThisMonth ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <p className="text-xs font-semibold text-slate-700 mb-0.5">Free Monthly Call</p>
                  <p className="text-xs text-slate-500">
                    {isFreeEligibleThisMonth
                      ? `✓ You have 1 free ${FREE_DURATION_MINUTES}-min call available this month.`
                      : 'Your free monthly call has been used.'
                    }
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs font-semibold text-slate-700 mb-0.5">Paid Calls</p>
                  <p className="text-xs text-slate-500">$50 per 30 minutes. Invoice is created automatically.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Calendar Booking */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-900">Select a Time</h2>
              </div>
              <button
                onClick={fetchCalSlots}
                disabled={isFetchingSlots}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingSlots ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Booking Mode & Duration */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-700 mb-0.5">Session Type</p>
                  <p className="text-xs text-slate-500">First call each month is free ({FREE_DURATION_MINUTES} min)</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBookingMode('free')}
                    disabled={!isFreeEligibleThisMonth}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 ${
                      bookingMode === 'free'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Free ({FREE_DURATION_MINUTES}m)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingMode('paid')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors ${
                      bookingMode === 'paid'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Paid
                  </button>
                </div>
              </div>

              {bookingMode === 'paid' && (
                <div className="mt-4 flex items-center gap-3">
                  <p className="text-xs font-semibold text-slate-700">Duration</p>
                  <select
                    value={paidDuration}
                    onChange={(e) => setPaidDuration(parseInt(e.target.value, 10))}
                    className="flex-1 sm:flex-none px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {durationOptions.map((d) => (
                      <option key={d} value={d}>
                        {d} minutes — ${((d / PAID_BLOCK_MINUTES) * 50).toFixed(0)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 hidden sm:block">Invoice opens after confirmation</p>
                </div>
              )}
            </div>

            {/* Week Navigation */}
            <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
              <button
                onClick={() => { setCurrentWeekStart(addDays(currentWeekStart, -7)); setSelectedSlot(null); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-slate-900">
                {format(currentWeekStart, 'MMM d')} – {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
              </span>
              <button
                onClick={() => { setCurrentWeekStart(addDays(currentWeekStart, 7)); setSelectedSlot(null); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
              {slotsError ? (
                <div className="p-8 text-center bg-amber-50 rounded-xl border border-amber-200">
                  <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-3" />
                  <p className="text-sm text-amber-800 mb-3">{slotsError}</p>
                  <button
                    onClick={fetchCalSlots}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              ) : isFetchingSlots ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
              ) : calSlots.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No available slots. Please check back later.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-7 gap-2 min-w-[560px]">
                    {weekDays.map((day, dayIndex) => {
                      const slots = getSlotsForDay(day);
                      const isToday = isSameDay(day, new Date());
                      const isPast = day < new Date() && !isToday;
                      return (
                        <div key={dayIndex} className={`${isPast ? 'opacity-40' : ''}`}>
                          <div className={`text-center mb-2 py-1.5 px-1 rounded-lg ${isToday ? 'bg-indigo-600' : 'bg-slate-50'}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? 'text-white/70' : 'text-slate-400'}`}>
                              {format(day, 'EEE')}
                            </p>
                            <p className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-800'}`}>
                              {format(day, 'd')}
                            </p>
                          </div>
                          <div className="space-y-1.5 max-h-56 overflow-y-auto">
                            {slots.length > 0 ? slots.map((slot, i) => (
                              <button
                                key={i}
                                onClick={() => setSelectedSlot(slot)}
                                disabled={isPast || isBooking}
                                className="w-full py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors disabled:opacity-50"
                              >
                                {slot.time}
                              </button>
                            )) : (
                              <p className="text-center text-[10px] text-slate-400 py-2">{isPast ? '—' : 'No slots'}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Confirmation Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-indigo-600" /> Confirm Booking
              </h3>
              <button
                onClick={() => setSelectedSlot(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Appointment Summary */}
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl mb-4">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
                {format(new Date(selectedSlot.datetime), 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {format(new Date(selectedSlot.datetime), 'h:mm a')}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm text-indigo-700 font-medium">{calculatedDuration} min</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                  bookingMode === 'free' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {bookingMode === 'free' ? 'FREE' : `$${(calculatedPriceCents / 100).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Appointment Type */}
            <div className="mb-5">
              <p className="text-xs font-bold text-slate-700 mb-2">Meeting Type</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: 'phone' as const, icon: Phone, label: 'Phone Call', color: 'emerald' },
                  { type: 'video' as const, icon: Video, label: 'Video Call', color: 'blue' },
                ].map(opt => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setAppointmentType(opt.type)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                      appointmentType === opt.type
                        ? `bg-${opt.color}-600 text-white border-${opt.color}-600`
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <opt.icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
              {bookingMode === 'paid' && (
                <p className="text-xs text-slate-400 mt-2">An invoice will open in a new tab after confirmation.</p>
              )}
            </div>

            {bookingError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {bookingError}
              </div>
            )}

            <button
              onClick={handleBookAppointment}
              disabled={isBooking}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isBooking ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</>
              ) : (
                'Confirm Booking'
              )}
            </button>
          </div>
        </div>
      )}
    </ClientLayout>
  );
};

export default ClientAppointmentBooking;

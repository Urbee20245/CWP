"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ClientLayout from '../components/ClientLayout';
import { supabase } from '../integrations/supabase/client';
import { Loader2, CalendarCheck, Clock, CheckCircle2, AlertTriangle, Users, Phone, Video, MapPin, X } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, addDays, isSameDay, isBefore, isAfter, addMinutes, setHours, setMinutes, getDay } from 'date-fns';
import { useAuth } from '../hooks/useAuth';

interface Availability {
    id: string;
    day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
    start_time: string; // HH:mm:ss
    end_time: string;   // HH:mm:ss
}

interface Appointment {
    id: string;
    client_id: string;
    appointment_time: string; // ISO timestamp
    duration_minutes: number;
    appointment_type: 'phone' | 'video' | 'in_person';
    status: 'scheduled' | 'canceled' | 'completed';
}

const APPOINTMENT_DURATION = 30; // Must match admin setting

const ClientAppointmentBooking: React.FC = () => {
    const { profile } = useAuth();
    const [clientId, setClientId] = useState<string | null>(null);
    const [availability, setAvailability] = useState<Availability[]>([]);
    const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isBooking, setIsBooking] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
    const [bookingError, setBookingError] = useState<string | null>(null);
    
    // Booking State
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
    const [appointmentType, setAppointmentType] = useState<'phone' | 'video' | 'in_person'>('phone');

    const fetchClientData = useCallback(async () => {
        if (!profile) return;

        // 1. Get Client ID
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
        
        // 2. Fetch Availability
        const { data: availData, error: availError } = await supabase
            .from('admin_availability')
            .select('*');
        
        if (availError) {
            console.error('Error fetching availability:', availError);
        } else {
            setAvailability(availData as Availability[]);
        }
        
        // 3. Fetch Existing Appointments (for the next 60 days)
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
            setExistingAppointments(apptData as Appointment[]);
        }

        setIsLoading(false);
    }, [profile]);

    useEffect(() => {
        fetchClientData();
    }, [fetchClientData]);

    const generateTimeSlots = (day: Date) => {
        const dayOfWeek = getDay(day);
        const slots = availability.filter(avail => avail.day_of_week === dayOfWeek);
        const timeSlots: Date[] = [];

        slots.forEach(slot => {
            const [startHour, startMinute] = slot.start_time.split(':').map(Number);
            const [endHour, endMinute] = slot.end_time.split(':').map(Number);

            let currentTime = setMinutes(setHours(day, startHour), startMinute);
            const endTime = setMinutes(setHours(day, endHour), endMinute);

            while (isBefore(currentTime, endTime)) {
                const slotEnd = addMinutes(currentTime, APPOINTMENT_DURATION);
                
                // Check if the slot is fully within the availability window
                if (isAfter(slotEnd, endTime)) break;

                // Check if the slot is in the past
                if (isBefore(currentTime, new Date())) {
                    currentTime = addMinutes(currentTime, APPOINTMENT_DURATION);
                    continue;
                }

                // Check for conflicts with existing appointments
                const isConflicting = existingAppointments.some(appt => {
                    const apptStart = parseISO(appt.appointment_time);
                    const apptEnd = addMinutes(apptStart, appt.duration_minutes);
                    
                    // Check if the new slot overlaps with the existing appointment
                    return (
                        (isBefore(currentTime, apptEnd) && isAfter(slotEnd, apptStart)) ||
                        (isSameDay(currentTime, apptStart) && currentTime.getTime() === apptStart.getTime())
                    );
                });

                if (!isConflicting) {
                    timeSlots.push(currentTime);
                }

                currentTime = addMinutes(currentTime, APPOINTMENT_DURATION);
            }
        });

        return timeSlots;
    };

    const handleBookAppointment = async () => {
        if (!selectedSlot || !clientId || !profile) return;

        setIsBooking(true);
        setBookingError(null);
        setBookingSuccess(null);

        try {
            const { error } = await supabase
                .from('appointments')
                .insert({
                    client_id: clientId,
                    appointment_time: selectedSlot.toISOString(),
                    duration_minutes: APPOINTMENT_DURATION,
                    appointment_type: appointmentType,
                    status: 'scheduled',
                    booked_by_profile_id: profile.id,
                });

            if (error) throw error;

            setBookingSuccess(`Appointment booked for ${format(selectedSlot, 'MMM d, h:mm a')}.`);
            setSelectedSlot(null);
            fetchClientData(); // Refresh appointments
            
        } catch (e: any) {
            setBookingError(e.message || 'Failed to book appointment. The slot might have just been taken.');
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
                            <p className="text-xl font-bold text-indigo-900">{format(selectedSlot, 'h:mm a')} ({APPOINTMENT_DURATION} min)</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Appointment Type</label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAppointmentType('phone')}
                                    className={`flex-1 py-3 rounded-lg text-sm font-semibold border transition-colors ${appointmentType === 'phone' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                                >
                                    <Phone className="w-4 h-4 inline mr-2" /> Phone Call
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAppointmentType('video')}
                                    className={`flex-1 py-3 rounded-lg text-sm font-semibold border transition-colors ${appointmentType === 'video' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                                >
                                    <Video className="w-4 h-4 inline mr-2" /> Video Call
                                </button>
                            </div>
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
                                <h3 className={`font-bold text-sm mb-3 border-b border-slate-100 pb-2 ${isToday ? 'text-indigo-600' : 'text-slate-900'}`}>
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
                                {existingAppointments.filter(a => a.status === 'scheduled').length > 0 ? (
                                    existingAppointments.filter(a => a.status === 'scheduled').map(appt => (
                                        <div key={appt.id} className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                                            <p className="font-bold">{format(parseISO(appt.appointment_time), 'MMM d, h:mm a')}</p>
                                            <p className="text-xs text-indigo-700 mt-1">Type: {appt.appointment_type.toUpperCase()}</p>
                                            <p className="text-xs text-indigo-700">Duration: {appt.duration_minutes} minutes</p>
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
                            <p className="text-sm text-slate-600 mb-4">
                                All appointments are with the project lead or a senior strategist.
                            </p>
                            <ul className="space-y-3 text-sm text-slate-700">
                                <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-600" /> Phone calls are initiated by us.</li>
                                <li className="flex items-center gap-2"><Video className="w-4 h-4 text-indigo-600" /> Video calls use Google Meet (link sent via email).</li>
                            </ul>
                        </div>
                    </div>

                    {/* Right Column: Booking Calendar */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <CalendarCheck className="w-5 h-5 text-emerald-600" /> Select Available Slot
                            </h2>
                            
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
                    </div>
                </div>
            </div>
            {renderBookingModal()}
        </ClientLayout>
    );
};

export default ClientAppointmentBooking;
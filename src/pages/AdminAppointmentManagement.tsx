"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../integrations/supabase/client';
import { Loader2, CalendarCheck, Clock, Plus, Trash2, Save, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, addDays, isSameDay, isBefore, isAfter } from 'date-fns';
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
    clients: { business_name: string };
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const APPOINTMENT_DURATION = 30; // Fixed duration in minutes

const AdminAppointmentManagement: React.FC = () => {
    const { user } = useAuth();
    const [availability, setAvailability] = useState<Availability[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 })); // Start week on Monday

    const fetchAvailability = useCallback(async () => {
        const { data, error } = await supabase
            .from('admin_availability')
            .select('*')
            .order('day_of_week')
            .order('start_time');

        if (error) {
            console.error('Error fetching availability:', error);
            setSaveError('Failed to load availability.');
            return [];
        }
        return data as Availability[];
    }, []);

    const fetchAppointments = useCallback(async (start: Date, end: Date) => {
        const { data, error } = await supabase
            .from('appointments')
            .select(`
                id, client_id, appointment_time, duration_minutes, appointment_type, status,
                clients (business_name)
            `)
            .gte('appointment_time', start.toISOString())
            .lte('appointment_time', end.toISOString())
            .order('appointment_time');

        if (error) {
            console.error('Error fetching appointments:', error);
            setSaveError('Failed to load appointments.');
            return [];
        }
        return data as Appointment[];
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const [availData, apptData] = await Promise.all([
            fetchAvailability(),
            fetchAppointments(currentWeekStart, endOfWeek(currentWeekStart, { weekStartsOn: 1 }))
        ]);
        setAvailability(availData);
        setAppointments(apptData);
        setIsLoading(false);
    }, [fetchAvailability, fetchAppointments, currentWeekStart]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddSlot = (day: number) => {
        setAvailability(prev => [
            ...prev,
            { id: `new-${Date.now()}`, day_of_week: day, start_time: '09:00:00', end_time: '17:00:00' }
        ]);
    };

    const handleRemoveSlot = (id: string) => {
        setAvailability(prev => prev.filter(slot => slot.id !== id));
    };

    const handleSlotChange = (id: string, field: keyof Availability, value: string | number) => {
        setAvailability(prev => prev.map(slot => 
            slot.id === id ? { ...slot, [field]: value } : slot
        ));
    };

    const handleSaveAvailability = async () => {
        setIsSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        // 1. Validate slots
        const validSlots = availability.filter(slot => 
            slot.start_time && slot.end_time && slot.day_of_week !== undefined
        );

        if (validSlots.length === 0) {
            setSaveError('Please add at least one valid time slot.');
            setIsSaving(false);
            return;
        }

        // 2. Delete all existing availability
        const { error: deleteError } = await supabase
            .from('admin_availability')
            .delete()
            .neq('day_of_week', -1); // Delete all rows

        if (deleteError) {
            console.error('Error deleting old availability:', deleteError);
            setSaveError('Failed to clear old availability.');
            setIsSaving(false);
            return;
        }

        // 3. Insert new valid slots
        const slotsToInsert = validSlots.map(slot => ({
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            admin_profile_id: user?.id, // Link to current admin
        }));

        const { error: insertError } = await supabase
            .from('admin_availability')
            .insert(slotsToInsert);

        if (insertError) {
            console.error('Error inserting new availability:', insertError);
            setSaveError('Failed to save new availability.');
        } else {
            setSaveSuccess(true);
            fetchData(); // Re-fetch to update IDs
            setTimeout(() => setSaveSuccess(false), 3000);
        }
        setIsSaving(false);
    };

    const handleCancelAppointment = async (apptId: string) => {
        if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
        
        setIsSaving(true);
        const { error } = await supabase
            .from('appointments')
            .update({ status: 'canceled' })
            .eq('id', apptId);

        if (error) {
            alert('Failed to cancel appointment.');
        } else {
            alert('Appointment canceled.');
            fetchData();
        }
        setIsSaving(false);
    };

    const getAppointmentStatusColor = (status: Appointment['status']) => {
        switch (status) {
            case 'scheduled': return 'bg-indigo-100 text-indigo-800';
            case 'completed': return 'bg-emerald-100 text-emerald-800';
            case 'canceled': return 'bg-red-100 text-red-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    const handlePreviousWeek = () => {
        setCurrentWeekStart(addDays(currentWeekStart, -7));
    };

    const handleNextWeek = () => {
        setCurrentWeekStart(addDays(currentWeekStart, 7));
    };

    const renderWeeklySchedule = () => {
        const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
        
        return (
            <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-4 min-w-[1000px]">
                    {weekDays.map((day, dayIndex) => {
                        const dayAppointments = appointments.filter(appt => isSameDay(parseISO(appt.appointment_time), day));
                        
                        return (
                            <div key={dayIndex} className="bg-white p-3 rounded-lg border border-slate-200">
                                <h3 className="font-bold text-sm mb-3 border-b border-slate-100 pb-2">
                                    {format(day, 'EEE, MMM d')}
                                </h3>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {dayAppointments.length > 0 ? (
                                        dayAppointments.map(appt => (
                                            <div key={appt.id} className={`p-2 rounded-lg text-xs ${getAppointmentStatusColor(appt.status)}`}>
                                                <p className="font-bold">{format(parseISO(appt.appointment_time), 'h:mm a')}</p>
                                                <p className="truncate">{appt.clients.business_name}</p>
                                                <p className="text-[10px] uppercase">{appt.appointment_type}</p>
                                                {appt.status === 'scheduled' && (
                                                    <button 
                                                        onClick={() => handleCancelAppointment(appt.id)}
                                                        disabled={isSaving}
                                                        className="mt-1 text-red-600 hover:text-red-800 font-semibold"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-500">No appointments.</p>
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
            <AdminLayout>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <CalendarCheck className="w-7 h-7 text-indigo-600" /> Appointment Management
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: Availability Settings */}
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-slate-100 h-fit">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                            <Clock className="w-5 h-5 text-emerald-600" /> Recurring Availability
                        </h2>
                        
                        {saveError && (
                            <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {saveError}
                            </div>
                        )}
                        {saveSuccess && (
                            <div className="p-3 mb-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Availability saved successfully!
                            </div>
                        )}

                        <div className="space-y-6">
                            {DAYS_OF_WEEK.map((dayName, dayIndex) => (
                                <div key={dayIndex} className="border border-slate-100 p-3 rounded-lg bg-slate-50">
                                    <h3 className="font-bold text-sm text-slate-900 mb-2">{dayName}</h3>
                                    
                                    {availability.filter(slot => slot.day_of_week === dayIndex).map(slot => (
                                        <div key={slot.id} className="flex gap-2 items-center mb-2">
                                            <input
                                                type="time"
                                                value={slot.start_time.substring(0, 5)}
                                                onChange={(e) => handleSlotChange(slot.id, 'start_time', e.target.value + ':00')}
                                                className="w-full p-1 border border-slate-300 rounded-lg text-xs"
                                                disabled={isSaving}
                                            />
                                            <span className="text-xs text-slate-500">-</span>
                                            <input
                                                type="time"
                                                value={slot.end_time.substring(0, 5)}
                                                onChange={(e) => handleSlotChange(slot.id, 'end_time', e.target.value + ':00')}
                                                className="w-full p-1 border border-slate-300 rounded-lg text-xs"
                                                disabled={isSaving}
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => handleRemoveSlot(slot.id)}
                                                className="text-red-500 hover:text-red-700 flex-shrink-0"
                                                disabled={isSaving}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        type="button"
                                        onClick={() => handleAddSlot(dayIndex)}
                                        className="mt-2 w-full py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                        disabled={isSaving}
                                    >
                                        <Plus className="w-3 h-3" /> Add Slot
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleSaveAvailability}
                            disabled={isSaving}
                            className="w-full py-3 mt-6 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {isSaving ? 'Saving...' : 'Save All Availability'}
                        </button>
                        <p className="text-xs text-slate-500 mt-3 text-center">
                            Note: Appointments are scheduled in {APPOINTMENT_DURATION} minute blocks.
                        </p>
                    </div>

                    {/* Right Column: Weekly Schedule View */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <Users className="w-5 h-5 text-purple-600" /> Scheduled Appointments
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

                            {renderWeeklySchedule()}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminAppointmentManagement;
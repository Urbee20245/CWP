import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../src/integrations/supabase/client';

interface TimeSlot {
  date: string;
  dateFormatted: string;
  time: string;
  datetime: string;
}

interface CalendarSlotPickerProps {
  onSlotSelect: (slot: { datetime: string; date: string; time: string } | null) => void;
  selectedSlot: { datetime: string; date: string; time: string } | null;
  disabled?: boolean;
  error?: string;
}

const CalendarSlotPicker: React.FC<CalendarSlotPickerProps> = ({
  onSlotSelect,
  selectedSlot,
  disabled = false,
  error,
}) => {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) {
      acc[slot.date] = {
        dateFormatted: slot.dateFormatted,
        slots: [],
      };
    }
    acc[slot.date].slots.push(slot);
    return acc;
  }, {} as Record<string, { dateFormatted: string; slots: TimeSlot[] }>);

  const sortedDates = Object.keys(slotsByDate).sort();

  const fetchSlots = async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const { data, error } = await supabase.functions.invoke('get-consultation-slots', {
        body: JSON.stringify({ days: 14, timezone: 'America/New_York' }),
      });

      if (error) {
        console.error('Error fetching slots:', error);
        setFetchError('Unable to load available times. Please try again.');
        return;
      }

      if (data?.slots && Array.isArray(data.slots)) {
        setSlots(data.slots);
        // Auto-select first date if available
        if (data.slots.length > 0 && !selectedDate) {
          setSelectedDate(data.slots[0].date);
        }
      } else if (data?.message) {
        setFetchError(data.message);
      } else {
        setSlots([]);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setFetchError('Unable to load available times. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    // Clear selected slot when changing date
    if (selectedSlot && selectedSlot.date !== slotsByDate[date]?.dateFormatted) {
      onSlotSelect(null);
    }
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    onSlotSelect({
      datetime: slot.datetime,
      date: slot.dateFormatted,
      time: slot.time,
    });
  };

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-slate-600">Loading available times...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-amber-800 font-medium">{fetchError}</p>
            <p className="text-amber-700 text-sm mt-1">
              You can still submit your preferred times below and we'll confirm availability.
            </p>
            <button
              type="button"
              onClick={fetchSlots}
              className="mt-3 inline-flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900 font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-slate-700 font-medium">No available times in the next 2 weeks</p>
            <p className="text-slate-600 text-sm mt-1">
              Please call us at <a href="tel:+14044271-4451" className="text-indigo-600 hover:underline">(404) 427-1451</a> to schedule your consultation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Selection */}
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-3">
          <Calendar className="w-4 h-4 inline-block mr-2 -mt-0.5" />
          Select a Date <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {sortedDates.map((date) => {
            const isSelected = selectedDate === date;
            const dateInfo = slotsByDate[date];
            // Extract day name and date
            const [dayName, ...rest] = dateInfo.dateFormatted.split(', ');
            const shortDate = rest.join(', ');

            return (
              <button
                key={date}
                type="button"
                onClick={() => handleDateSelect(date)}
                disabled={disabled}
                className={`px-4 py-3 rounded-xl border-2 transition-all text-left min-w-[140px] ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="font-semibold text-sm">{dayName}</div>
                <div className="text-xs text-slate-500">{shortDate}</div>
                <div className="text-xs text-indigo-600 mt-1">
                  {dateInfo.slots.length} slot{dateInfo.slots.length !== 1 ? 's' : ''}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Selection */}
      {selectedDate && slotsByDate[selectedDate] && (
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-3">
            <Clock className="w-4 h-4 inline-block mr-2 -mt-0.5" />
            Select a Time <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {slotsByDate[selectedDate].slots.map((slot) => {
              const isSelected = selectedSlot?.datetime === slot.datetime;

              return (
                <button
                  key={slot.datetime}
                  type="button"
                  onClick={() => handleTimeSelect(slot)}
                  disabled={disabled}
                  className={`px-3 py-2.5 rounded-lg border-2 transition-all text-center ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 text-slate-700'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="font-medium text-sm">{slot.time}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Slot Confirmation */}
      {selectedSlot && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-emerald-800 font-medium">
              Selected: {selectedSlot.date} at {selectedSlot.time} ET
            </p>
            <p className="text-emerald-700 text-sm">This time is available for your consultation.</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {/* Timezone Note */}
      <p className="text-xs text-slate-500">
        All times shown in Eastern Time (ET). Your consultation will be confirmed via email.
      </p>
    </div>
  );
};

export default CalendarSlotPicker;

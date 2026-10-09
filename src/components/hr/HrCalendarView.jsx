import { useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, Video
} from 'lucide-react';

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfCalendarGrid(month) {
  const first = startOfMonth(month);
  const day = first.getDay();
  const result = new Date(first);
  result.setDate(first.getDate() - day);
  return result;
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function sameDay(a, b) {
  return dayKey(a) === dayKey(b);
}

export function HrCalendarView({ jobs, applications, selectedJobId, onSelectJobId }) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const events = useMemo(() => {
    return applications
      .filter(app => selectedJobId === 'all' || app.jobId === selectedJobId)
      .filter(app => app.interview?.scheduledAt)
      .map(app => ({
        id: `${app.id}-interview`,
        applicationId: app.id,
        candidate: app.name,
        role: app.job?.title || app.role || 'Interview',
        scheduledAt: new Date(app.interview.scheduledAt),
        interviewer: app.interview.interviewer || 'Recruiting Team',
        type: app.interview.type || 'Interview',
        meetingLink: app.interview.meetingLink,
        notes: app.interview.notes || ''
      }))
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
  }, [applications, selectedJobId]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    events.forEach(event => {
      const key = dayKey(event.scheduledAt);
      const current = map.get(key) || [];
      current.push(event);
      map.set(key, current);
    });
    return map;
  }, [events]);

  const gridDays = useMemo(() => {
    const first = startOfCalendarGrid(visibleMonth);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(first);
      day.setDate(first.getDate() + index);
      return day;
    });
  }, [visibleMonth]);

  const selectedDayEvents = eventsByDay.get(dayKey(selectedDate)) || [];
  const today = new Date();

  const goToMonth = (amount) => {
    const next = addMonths(visibleMonth, amount);
    setVisibleMonth(next);
    setSelectedDate(next);
  };

  const monthLabel = visibleMonth.toLocaleDateString([], {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <CalendarDays size={19} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Recruiting Calendar</h2>
              <p className="text-xs text-slate-400 mt-1">View and track scheduled candidate interviews from the HR pipeline.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedJobId}
            onChange={(e) => onSelectJobId(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[280px]"
          >
            <option value="all">All Jobs</option>
            {jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setVisibleMonth(startOfMonth(now));
              setSelectedDate(now);
            }}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
        {/* Month Calendar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-100">{monthLabel}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{events.length} scheduled interview{events.length === 1 ? '' : 's'}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="recruiting-calendar-month">Jump to month</label>
              <input
                id="recruiting-calendar-month"
                type="month"
                value={`${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [year, month] = e.target.value.split('-').map(Number);
                  const nextMonth = new Date(year, month - 1, 1);
                  setVisibleMonth(nextMonth);
                  setSelectedDate(nextMonth);
                }}
                aria-label="Choose calendar month and year"
                className="min-w-0 w-[145px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
              <button type="button" onClick={() => goToMonth(-1)} aria-label="Previous month" className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => goToMonth(1)} aria-label="Next month" className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(label => (
              <div key={label} className="py-2 text-center text-[10px] uppercase tracking-wider font-bold text-slate-600">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {gridDays.map(day => {
              const key = dayKey(day);
              const dayEvents = eventsByDay.get(key) || [];
              const inMonth = day.getMonth() === visibleMonth.getMonth();
              const selected = sameDay(day, selectedDate);
              const isToday = sameDay(day, today);

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-28 p-2 border-r border-b border-slate-800/70 text-left align-top transition-colors ${
                    selected ? 'bg-indigo-500/10' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold ${
                      !inMonth ? 'text-slate-700' : isToday ? 'text-indigo-300' : 'text-slate-400'
                    }`}>
                      {day.getDate()}
                    </span>
                    {isToday && <span className="text-[9px] font-bold text-indigo-400 uppercase">Today</span>}
                  </div>

                  <div className="mt-2 space-y-1">
                    {dayEvents.slice(0, 3).map(event => (
                      <div key={event.id} className="rounded-md bg-indigo-500/10 border border-indigo-500/15 px-1.5 py-1">
                        <div className="text-[9px] font-bold text-indigo-200 truncate">{event.candidate}</div>
                        <div className="text-[8px] text-slate-500 mt-0.5">
                          {event.scheduledAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-slate-500 pl-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 h-fit xl:sticky xl:top-2">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Selected Day</p>
              <h3 className="text-base font-bold text-slate-100 mt-1">
                {selectedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </h3>
            </div>
            <CalendarDays size={17} className="text-indigo-400" />
          </div>

          <div className="pt-4 space-y-3">
            {selectedDayEvents.length === 0 ? (
              <div className="p-5 rounded-xl border border-dashed border-slate-800 text-center">
                <p className="text-xs font-semibold text-slate-400">No interviews scheduled</p>
                <p className="text-[10px] text-slate-600 mt-1">Scheduled interviews will appear here automatically.</p>
              </div>
            ) : (
              selectedDayEvents.map(event => (
                <div key={event.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-100 truncate">{event.candidate}</h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{event.role}</p>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg">
                      {event.type}
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-slate-600" />
                      <span>{event.scheduledAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays size={13} className="text-slate-600" />
                      <span>Interviewer: {event.interviewer}</span>
                    </div>
                  </div>

                  {event.notes && (
                    <p className="text-[10px] leading-relaxed text-slate-500 bg-slate-900 rounded-lg p-2.5 border border-slate-800">
                      {event.notes}
                    </p>
                  )}

                  {event.meetingLink && (
                    <a
                      href={event.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-indigo-300 hover:text-indigo-200"
                    >
                      <Video size={12} /> Join meeting <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

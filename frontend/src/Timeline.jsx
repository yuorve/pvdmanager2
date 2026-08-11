import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Timeline({ assignedSlot, currentHour }) {
    const [schedule, setSchedule] = useState({ load: [], hour: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSchedule();
        const interval = setInterval(fetchSchedule, 30000); // Update every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchSchedule = async () => {
        try {
            const res = await axios.get('/pvd/schedule');
            setSchedule(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch PVD schedule", err);
            setLoading(false);
        }
    };

    if (loading || !schedule.load || schedule.load.length === 0) {
        return <div className="text-center text-xs text-slate-400 animate-pulse">Cargando disponibilidad...</div>;
    }

    // Find max load to normalize height (or use fixed max if capacity is known)
    // For now, auto-scale.
    const maxLoad = Math.max(...schedule.load, 1);

    return (
        <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm mt-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="material-icons text-base">bar_chart</span>
                    Ocupación de Pausas (Hora {currentHour}:00)
                </h3>
                {assignedSlot !== null && (
                    <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                        Tu turno: Minuto {assignedSlot}
                    </div>
                )}
            </div>

            <div className="flex items-end h-24 gap-[1px] md:gap-1">
                {schedule.load.map((load, minute) => {
                    const isAssigned = assignedSlot === minute;
                    // Height percentage
                    // If load is 0, show minimal height (e.g. 4px) just as a track, but distinct color
                    const isOccupied = load > 0;
                    const height = isOccupied ? Math.max((load / maxLoad) * 100, 15) : 5; // 5% for empty, 15% min for occupied

                    // Colors
                    let barColor = 'bg-slate-100 dark:bg-slate-800'; // Default empty

                    if (isOccupied) {
                        barColor = 'bg-emerald-400 dark:bg-emerald-600';
                        if (load > 2) barColor = 'bg-amber-400 dark:bg-amber-600';
                        if (load > 4) barColor = 'bg-rose-400 dark:bg-rose-600';
                    }

                    if (isAssigned) {
                        barColor = 'bg-primary animate-pulse ring-2 ring-primary ring-offset-1 dark:ring-offset-slate-900';
                        // Ensure assigned slot is visible even if load calculation hasn't updated yet (optimistic UI)
                        if (!isOccupied) {
                            // This handles the edge case where we just assigned it but the schedule fetch hasn't returned the new load yet
                            barColor = 'bg-primary/50 animate-pulse';
                        }
                    }

                    return (
                        <div key={minute} className="flex-1 flex flex-col justify-end group relative group h-full">
                            <div
                                className={`w-full rounded-t-sm transition-all duration-500 ${barColor}`}
                                style={{ height: `${height}%` }}
                            ></div>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                                    Min {minute}: {load} personas
                                </div>
                            </div>

                            {/* X Axis Labels (every 5 mins) */}
                            {minute % 5 === 0 && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[8px] text-slate-400 font-mono">
                                    {minute}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex justify-between mt-6 text-[10px] text-slate-400">
                <span>00</span>
                <span>15</span>
                <span>30</span>
                <span>45</span>
                <span>59</span>
            </div>
        </div>
    );
}

export default Timeline;

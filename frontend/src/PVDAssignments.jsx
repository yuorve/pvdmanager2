import React, { useState, useEffect } from 'react';
import axios from 'axios';

function PVDAssignments({ onBack }) {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/assignments', { params: { date } });
            setAssignments(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssignments();
    }, [date]);

    // Helper to format minute 0 -> 00
    const formatMinute = (m) => m.toString().padStart(2, '0');

    return (
        <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-icons text-slate-500">arrow_back</span>
                    </button>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <span className="material-icons text-indigo-500">event_note</span>
                        Asignaciones PVD
                    </h2>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold">Listado de Asignaciones</h3>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-500">Fecha:</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <p className="text-slate-400 text-center py-8">Cargando...</p>
                    ) : assignments.length === 0 ? (
                        <p className="text-slate-400 text-center py-8">No hay asignaciones para esta fecha.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="p-3 text-sm font-semibold text-slate-500">Operador</th>
                                        <th className="p-3 text-sm font-semibold text-slate-500">Hora Ventana</th>
                                        <th className="p-3 text-sm font-semibold text-slate-500">Inicio PVD</th>
                                        <th className="p-3 text-sm font-semibold text-slate-500">Fin PVD</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignments.map((a) => (
                                        <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950">
                                            <td className="p-3 font-medium text-slate-700 dark:text-slate-300">{a.operator_id}</td>
                                            <td className="p-3 text-slate-600 dark:text-slate-400">{a.window_hour}:00</td>
                                            <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400">
                                                {a.window_hour}:{formatMinute(a.start_minute)}
                                            </td>
                                            <td className="p-3 font-mono text-slate-500">
                                                {a.window_hour}:{formatMinute(a.start_minute + 7)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PVDAssignments;

import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ActivityLog({ onBack }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterOperator, setFilterOperator] = useState('');

    useEffect(() => {
        fetchActivity();
    }, [filterDate]); // Fetch on date change

    const fetchActivity = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/activity', {
                params: {
                    date: filterDate,
                    operator: filterOperator
                }
            });
            setActivities(res.data);
        } catch (err) {
            console.error("Error fetching activity:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchActivity();
    };

    const formatState = (stateID) => {
        switch (Number(stateID)) {
            case 0: return 'Deslogado';
            case 1: return 'Activo';
            case 2: return 'PVD';
            case 3: return 'Descanso';
            case 4: return 'Formación';
            case 5: return 'Gerencia';
            case 6: return 'Suplencia';
            default: return 'Desconocido';
        }
    };

    const getTypeColor = (type) => {
        if (type === 'LOGIN') return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30';
        if (type === 'LOGOUT') return 'text-rose-500 bg-rose-100 dark:bg-rose-900/30';
        return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
    };

    return (
        <div className="p-6 bg-white dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                        <span className="material-icons">arrow_back</span>
                    </button>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <span className="material-icons text-slate-400">history</span>
                        Registro de Actividad
                    </h1>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha</label>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Operador</label>
                    <input
                        type="text"
                        value={filterOperator}
                        onChange={(e) => setFilterOperator(e.target.value)}
                        placeholder="Buscar ID..."
                        className="px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    className="px-6 py-2 bg-primary hover:bg-sky-600 text-white font-bold rounded-lg transition-colors"
                >
                    Buscar
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                            <th className="p-4">Hora</th>
                            <th className="p-4">Operador</th>
                            <th className="p-4">Evento</th>
                            <th className="p-4">Detalle (Estados)</th>
                            <th className="p-4">Info Extra</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400">Cargando datos...</td></tr>
                        ) : activities.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400">No hay actividad registrada para esta fecha.</td></tr>
                        ) : (
                            activities.map((act) => (
                                <tr key={act.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4 font-mono text-slate-500">
                                        {new Date(act.created_at).toLocaleTimeString('es-ES')}
                                    </td>
                                    <td className="p-4 font-bold">{act.operator_id}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${getTypeColor(act.activity_type)}`}>
                                            {act.activity_type}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {act.activity_type === 'STATE_CHANGE' ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">{formatState(act.state_from)}</span>
                                                <span className="material-icons text-xs text-slate-300">arrow_forward</span>
                                                <span className="font-semibold text-primary">{formatState(act.state_to)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-500">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-slate-500 truncate max-w-xs" title={act.details}>
                                        {act.details}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ActivityLog;

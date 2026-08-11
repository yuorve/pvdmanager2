import React, { useState, useEffect } from 'react';
import axios from 'axios';

function StationManagement({ onBack }) {
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ip, setIp] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const fetchStations = async () => {
        try {
            const res = await axios.get('/stations');
            setStations(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStations();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!ip) {
            setError('La IP es obligatoria');
            return;
        }

        try {
            await axios.post('/stations', { ip });
            setSuccess('Estación creada exitosamente');
            setIp('');
            fetchStations();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            if (err.response && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError('Error al crear estación');
            }
        }
    };

    const handleDelete = async (stationId, stationIp) => {
        if (!window.confirm(`¿Estás seguro de que quieres eliminar la estación ${stationIp}?`)) return;

        try {
            await axios.delete(`/stations/${stationId}`);
            setSuccess(`Estación ${stationIp} eliminada`);
            fetchStations();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error(err);
            setError('Error al eliminar estación');
        }
    };

    return (
        <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-icons text-slate-500">arrow_back</span>
                    </button>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <span className="material-icons text-indigo-500">router</span>
                        Gestión de Estaciones
                    </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Create Station Form */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-fit">
                        <h3 className="text-lg font-bold mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Nueva Estación</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
                            {success && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg">{success}</div>}

                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Dirección IP</label>
                                <input
                                    type="text"
                                    value={ip}
                                    onChange={(e) => setIp(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Ej: 10.207.201.121"
                                />
                                <p className="text-xs text-slate-400 mt-1">Formato: IP completa (ej. 10.207.201.1XX)</p>
                            </div>

                            <button type="submit" className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg transition-colors">
                                Añadir Estación
                            </button>
                        </form>
                    </div>

                    {/* Station List */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Estaciones Existentes</h3>
                        {loading ? (
                            <p className="text-slate-400 text-center py-4">Cargando...</p>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                {stations.map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                                <span className="material-icons">desktop_windows</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{s.ip}</p>
                                                <p className="text-xs text-slate-400">ID: {s.id}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-1 rounded-full ${s.stateID === 0 ? 'bg-slate-200 text-slate-600' : 'bg-green-100 text-green-600'}`}>
                                                {s.stateID === 0 ? 'Inactivo' : 'Activo'}
                                            </span>
                                            <button
                                                onClick={() => handleDelete(s.id, s.ip)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                title="Eliminar estación"
                                            >
                                                <span className="material-icons text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StationManagement;

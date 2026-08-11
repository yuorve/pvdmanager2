import React, { useState, useEffect } from 'react';
import axios from 'axios';

function UserManagement({ onBack }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ username: '', password: '', role: 'OPERATOR' });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/users');
            setUsers(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        if (!form.username || !form.password) {
            setError('Todos los campos son obligatorios');
            return;
        }

        try {
            await axios.post('/users', form);
            setSuccess('Usuario creado exitosamente');
            setForm({ username: '', password: '', role: 'OPERATOR' });
            fetchUsers();
            // Clear success msg after 3s
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            if (err.response && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError('Error al crear usuario');
            }
        }
    };

    const handleDelete = async (userId, username) => {
        if (username === 'admin') return;
        if (!window.confirm(`¿Estás seguro de que quieres eliminar al usuario ${username}?`)) return;

        try {
            await axios.delete(`/users/${userId}`);
            setSuccess(`Usuario ${username} eliminado`);
            fetchUsers();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error(err);
            setError('Error al eliminar usuario');
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
                        <span className="material-icons text-indigo-500">manage_accounts</span>
                        Gestión de Usuarios
                    </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Create User Form */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-fit">
                        <h3 className="text-lg font-bold mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Nuevo Usuario</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
                            {success && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg">{success}</div>}

                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Nombre de Usuario</label>
                                <input
                                    type="text"
                                    name="username"
                                    value={form.username}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Ej: OPERADOR1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Contraseña</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Rol</label>
                                <select
                                    name="role"
                                    value={form.role}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="OPERATOR">OPERADOR</option>
                                    <option value="SUPERVISOR">SUPERVISOR</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg transition-colors">
                                Crear Usuario
                            </button>
                        </form>
                    </div>

                    {/* User List */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Usuarios Existentes</h3>
                        {loading ? (
                            <p className="text-slate-400 text-center py-4">Cargando...</p>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                {users.map(u => (
                                    <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 group">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${u.role === 'SUPERVISOR' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                                <span className="material-icons">{u.role === 'SUPERVISOR' ? 'admin_panel_settings' : 'person'}</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{u.username}</p>
                                                <p className="text-xs text-slate-400">{u.role}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-xs text-slate-400 hidden sm:block">
                                                {new Date(u.created_at).toLocaleDateString()}
                                            </div>
                                            {u.username !== 'admin' && (
                                                <button
                                                    onClick={() => handleDelete(u.id, u.username)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Eliminar usuario"
                                                >
                                                    <span className="material-icons text-sm">delete</span>
                                                </button>
                                            )}
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

export default UserManagement;

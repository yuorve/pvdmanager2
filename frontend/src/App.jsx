import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Timeline from './Timeline';
import ActivityLog from './ActivityLog';
import UserManagement from './UserManagement';
import StationManagement from './StationManagement';
import PVDAssignments from './PVDAssignments';
import ChangePassword from './ChangePassword';

axios.defaults.baseURL = '/api';

function App() {
    const [station, setStation] = useState(null); // Current user station
    const [allStations, setAllStations] = useState([]); // All stations for dashboard
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [loginInput, setLoginInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [userRole, setUserRole] = useState(localStorage.getItem('user_role') || '');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedStationIP, setSelectedStationIP] = useState(localStorage.getItem('station_ip') || '');
    const [pvdAssignment, setPvdAssignment] = useState(null);
    const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'activity'
    const [showChangePassword, setShowChangePassword] = useState(false);

    // Sync Axios Header & Storage
    useEffect(() => {
        // IP Header (Legacy/Station ID)
        if (selectedStationIP) {
            axios.defaults.headers.common['x-station-ip'] = selectedStationIP;
            localStorage.setItem('station_ip', selectedStationIP);
        }

        // Auth Header (JWT)
        const token = localStorage.getItem('auth_token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
    }, [selectedStationIP]);

    // Global Error Handler (401 -> Logout)
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    // Token expired or invalid
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_role');
                    setStation(null);
                    window.location.reload();
                }
                return Promise.reject(error);
            }
        );
        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    // TV Mode
    const searchParams = new URL(window.location.href).searchParams;
    const isTVMode = searchParams.get('tv') || window.location.pathname === '/tv';
    const isWindows = navigator.userAgent.indexOf('Windows') !== -1;

    // Clock Logic
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formattedTime = currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Init Dark Mode
    useEffect(() => {
        document.documentElement.classList.add('dark');
    }, []);

    const toggleDarkMode = () => {
        document.documentElement.classList.toggle('dark');
    };

    const fetchData = async () => {
        try {
            // Parallel fetch: current station status AND all stations
            const [myStationRes, allStationsRes] = await Promise.allSettled([
                axios.get('/station'),
                axios.get('/stations')
            ]);

            if (myStationRes.status === 'fulfilled') {
                setStation(myStationRes.value.data);
                // Sync PVD Assignment from server state
                setPvdAssignment(myStationRes.value.data.pvdAssignment || null);
            } else {
                setStation(null); // Not logged in or unauthorized
                setPvdAssignment(null);
            }

            if (allStationsRes.status === 'fulfilled') {
                setAllStations(allStationsRes.value.data);
            }

            setError(null);
        } catch (err) {
            console.error(err);
            setError('Error al conectar con el servidor. Verifique que la base de datos esté iniciada.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Sync with server every 10s
        return () => clearInterval(interval);
    }, []);

    // Audio Logic
    const audioRef = React.useRef(new Audio(ALARM_SOUND));
    const [audioUnlocked, setAudioUnlocked] = useState(false);

    // 1. Unlock Audio Context on first user interaction
    useEffect(() => {
        const unlockAudio = () => {
            if (audioUnlocked) return;

            const audio = audioRef.current;

            // Try playing
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Audio successfully played, we can pause it immediately
                    audio.pause();
                    audio.currentTime = 0;
                    setAudioUnlocked(true);

                    document.removeEventListener('click', unlockAudio);
                    document.removeEventListener('touchstart', unlockAudio);
                    document.removeEventListener('keydown', unlockAudio);
                    console.log("Audio contexts unlocked successfully.");
                }).catch(error => {
                    // Auto-play was prevented
                    console.log("Audio unlock failed (waiting for interaction):", error);
                });
            }
        };

        document.addEventListener('click', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);
        document.addEventListener('keydown', unlockAudio);

        return () => {
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        }
    }, [audioUnlocked]);

    // Keep a ref of allStations for the alarm interval to avoid resetting it
    const allStationsRef = React.useRef(allStations);
    useEffect(() => {
        allStationsRef.current = allStations;
    }, [allStations]);

    // 2. Periodic Alarm Check
    useEffect(() => {
        const checkAlarm = () => {
            const hasCritical = allStationsRef.current.some(st => {
                // Must be limit state (>1) and timer <= 0 (or negative string)
                if (st.stateID > 1 && st.timer) {
                    const isNegative = st.timer.startsWith('-');
                    if (isNegative) return true; // Already negative
                    if (st.timer === '00:00:00') return true;
                }
                return false;
            });

            if (hasCritical) {
                const audio = audioRef.current;
                // Only play if unlocked (or try anyway, catch error)                
                audio.volume = 1.0;
                audio.currentTime = 0; // restart audio
                audio.play().catch(e => console.log("Alarm play blocked:", e));
            }
        };

        const interval = setInterval(checkAlarm, 5000); // Check every 5s
        return () => clearInterval(interval);
    }, []);

    // Timer Increment Logic
    useEffect(() => {
        const interval = setInterval(() => {
            setAllStations(prevStations => {
                return prevStations.map(st => {
                    if (!st.timer) return st;

                    const isNegative = st.timer.startsWith('-');
                    const cleanTime = isNegative ? st.timer.substring(1) : st.timer;
                    const [h, m, s] = cleanTime.split(':').map(Number);
                    let totalSeconds = (h * 3600 + m * 60 + s);
                    if (isNegative) totalSeconds = -totalSeconds;

                    if (st.stateID == 1) {
                        totalSeconds++;
                    } else {
                        totalSeconds--; // Always decrement for limits, even into negative
                    }

                    const absSeconds = Math.abs(totalSeconds);
                    const hours = Math.floor(absSeconds / 3600).toString().padStart(2, '0');
                    const minutes = Math.floor((absSeconds % 3600) / 60).toString().padStart(2, '0');
                    const seconds = (absSeconds % 60).toString().padStart(2, '0');
                    const sign = totalSeconds < 0 ? '-' : '';

                    return { ...st, timer: `${sign}${hours}:${minutes}:${seconds}` };
                });
            });

            if (station && station.timer) {
                setStation(prev => {
                    if (!prev) return null;

                    const isNegative = prev.timer.startsWith('-');
                    const cleanTime = isNegative ? prev.timer.substring(1) : prev.timer;
                    const [h, m, s] = cleanTime.split(':').map(Number);
                    let totalSeconds = (h * 3600 + m * 60 + s);
                    if (isNegative) totalSeconds = -totalSeconds;

                    if (prev.stateID == 1) {
                        totalSeconds++;
                    } else {
                        totalSeconds--;
                    }

                    const absSeconds = Math.abs(totalSeconds);
                    const hours = Math.floor(absSeconds / 3600).toString().padStart(2, '0');
                    const minutes = Math.floor((absSeconds % 3600) / 60).toString().padStart(2, '0');
                    const seconds = (absSeconds % 60).toString().padStart(2, '0');
                    const sign = totalSeconds < 0 ? '-' : '';

                    return { ...prev, timer: `${sign}${hours}:${minutes}:${seconds}` };
                });
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [station?.stateID]); // Reset if state changes (re-fech will fix it, but local increment needs care)

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!selectedStationIP) {
            alert('Por favor, selecciona una estación.');
            return;
        }
        try {
            const res = await axios.post('/login', {
                login: loginInput.toUpperCase(),
                password: passwordInput
            });

            if (res.data.token) {
                localStorage.setItem('auth_token', res.data.token);
                localStorage.setItem('user_role', res.data.role);
                setUserRole(res.data.role);
                axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
            }

            if (res.data.pvd) {
                setPvdAssignment(res.data.pvd);
                // Alert removed to prevent UI blocking
            }
            fetchData();
        } catch (err) {
            alert('Error al iniciar sesión: Credenciales incorrectas');
        }
    };

    const handleLogout = async () => {
        try {
            // Optional: Call logout endpoint if needed, but mostly client-side now
            await axios.post('/logout');
        } catch (err) {
            // Check if it's 403/401, ignore
        } finally {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_role');
            delete axios.defaults.headers.common['Authorization'];
            setStation(null);
            setPvdAssignment(null);
            setUserRole('');
            setPasswordInput('');
        }
    };

    const handleCommand = async (cmd, time = null) => {
        try {
            await axios.post('/command', { c: cmd, t: time });
            fetchData();
        } catch (err) {
            alert('Error al ejecutar comando');
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">Cargando sistema...</div>;

    const isLogged = station?.usuario;

    // Stats calculation
    const activeCount = allStations.filter(s => s.stateID == 1).length;
    const breakCount = allStations.filter(s => s.stateID == 2 || s.stateID == 3).length; // PVD or Pause
    const idleCount = allStations.filter(s => s.stateID == 0).length;

    return (
        <div className="min-h-screen flex flex-col transition-colors duration-200">
            {showChangePassword && <ChangePassword onClose={() => setShowChangePassword(false)} />}

            {/* Header */}
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-primary p-2 rounded-lg">
                        <span className="material-icons text-white">emergency</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">PVD Manager</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Dashboard v2.0</p>
                    </div>
                    {/* Supervisor Toggle - Restricted to SUPERVISOR role */}
                    {userRole === 'SUPERVISOR' && (
                        <div className="flex gap-2 ml-4">
                            <button
                                onClick={() => setViewMode('activity')}
                                className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border ${viewMode === 'activity'
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                            >
                                Actividad
                            </button>
                            <button
                                onClick={() => setViewMode('users')}
                                className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border ${viewMode === 'users'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                            >
                                Usuarios
                            </button>
                            <button
                                onClick={() => setViewMode('stations')}
                                className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border ${viewMode === 'stations'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                            >
                                Estaciones
                            </button>
                            <button
                                onClick={() => setViewMode('assignments')}
                                className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border ${viewMode === 'assignments'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                            >
                                Asignaciones
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-8">
                    <div className="text-center hidden sm:block">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Hora Actual</p>
                        <p className="text-2xl font-mono font-bold text-primary">{formattedTime}</p>
                    </div>

                    {/* PVD Display in Header */}
                    {pvdAssignment && (
                        <div className="text-center hidden sm:block">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Tu PVD</p>
                            <p className="text-2xl font-mono font-bold text-amber-500">
                                {(() => {
                                    // Convert UTC hour/slot to Local Time for display
                                    const d = new Date();
                                    d.setUTCHours(pvdAssignment.hour);
                                    d.setUTCMinutes(pvdAssignment.slot);
                                    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                                })()}
                            </p>
                        </div>
                    )}

                    <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-8">
                        <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" onClick={toggleDarkMode}>
                            <span className="material-icons">dark_mode</span>
                        </button>
                        {isLogged && (
                            <div
                                className="flex items-center gap-3 ml-2 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setShowChangePassword(true)}
                                title="Cambiar Contraseña"
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                    <span className="material-icons text-slate-400">person</span>
                                </div>
                                <div className="hidden lg:block text-right">
                                    <p className="text-sm font-bold">{station.usuario}</p>
                                    <p className="text-xs text-slate-500">ID: {station.userID || 'USER'}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Body */}
            {viewMode === 'activity' ? (
                <ActivityLog onBack={() => setViewMode('dashboard')} />
            ) : viewMode === 'users' ? (
                <UserManagement onBack={() => setViewMode('dashboard')} />
            ) : viewMode === 'stations' ? (
                <StationManagement onBack={() => setViewMode('dashboard')} />
            ) : viewMode === 'assignments' ? (
                <PVDAssignments onBack={() => setViewMode('dashboard')} />
            ) : (
                <main className="flex flex-1 relative bg-slate-50 dark:bg-slate-950">

                    {/* Sidebar */}
                    {isLogged && !isTVMode && isWindows && (
                        <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col gap-6 sticky top-[81px] self-start h-auto max-h-[calc(100vh-81px)] overflow-y-auto hidden md:flex">
                            <div>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Acciones Rápidas</h2>
                                <nav className="space-y-2">
                                    <SidebarButton
                                        onClick={() => handleCommand('activo')}
                                        label="Activo"
                                        icon="headset_mic"
                                        active={station.stateID == 1}
                                        colorClass="text-status-active bg-status-active/10 border-status-active/20"
                                    />
                                    <SidebarButton
                                        onClick={() => handleCommand('pvd')}
                                        label="PVD"
                                        icon="desktop_windows"
                                        active={station.stateID == 2}
                                        colorClass="text-yellow-500 bg-yellow-500/10 border-yellow-500/20"
                                        disabled={station.stateID != 1 && station.stateID != 2}
                                    />
                                    <SidebarButton
                                        onClick={() => handleCommand('pause')}
                                        label="Descanso"
                                        icon="coffee"
                                        active={station.stateID == 3}
                                        colorClass="text-status-break bg-status-break/10 border-status-break/20"
                                        disabled={station.stateID != 1 && station.stateID != 3}
                                    />
                                    <SidebarButton
                                        onClick={() => handleCommand('formacion')}
                                        label="Formación"
                                        icon="school"
                                        active={station.stateID == 4}
                                        colorClass="text-status-training bg-status-training/10 border-status-training/20"
                                        disabled={station.stateID != 1 && station.stateID != 4}
                                    />
                                    <SidebarButton
                                        onClick={() => handleCommand('suplencia')}
                                        label="Suplencia"
                                        icon="sync_alt"
                                        active={station.stateID == 6}
                                        colorClass="text-pink-500 bg-pink-500/10 border-pink-500/20"
                                        disabled={station.stateID != 1 && station.stateID != 6}
                                    />
                                    <SidebarButton
                                        onClick={() => handleCommand('gerencia')}
                                        label="Gerencia"
                                        icon="admin_panel_settings"
                                        active={station.stateID == 5}
                                        colorClass="text-indigo-500 bg-indigo-500/10 border-indigo-500/20"
                                        disabled={station.stateID != 1 && station.stateID != 5}
                                    />
                                </nav>
                            </div>
                            <div className="mt-auto border-t border-slate-200 dark:border-slate-800 pt-6">
                                <button
                                    onClick={handleLogout}
                                    disabled={station.stateID !== 1}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-semibold ${station.stateID === 1
                                        ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                                        : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                        }`}
                                >
                                    <span className="material-icons">logout</span> Salir
                                </button>
                            </div>
                        </aside>
                    )}

                    {/* Content Area */}
                    <section className="flex-1 p-6">
                        <div className="max-w-full mx-auto">

                            {!isLogged && !isTVMode && isWindows ? (
                                <div className="w-full max-w-md mt-20 mx-auto">
                                    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
                                        <div className="text-center mb-8">
                                            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                                                <span className="material-icons text-3xl">lock</span>
                                            </div>
                                            <h2 className="text-2xl font-bold">Bienvenido</h2>
                                            <p className="text-slate-500 dark:text-slate-400">Ingresa tu usuario para comenzar</p>
                                        </div>
                                        <form onSubmit={handleLogin} className="space-y-6">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Seleccionar Estación</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-3 text-slate-400 material-icons text-lg">desktop_windows</span>
                                                    <select
                                                        value={selectedStationIP}
                                                        onChange={(e) => setSelectedStationIP(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
                                                        required
                                                    >
                                                        <option value="" disabled>Selecciona tu puesto...</option>
                                                        {allStations.filter(st => !st.login).map((st, i) => (
                                                            <option key={i} value={st.ip}>
                                                                {st.ip.split('.').pop()} ({st.pvd ? `PVD ${st.pvd}` : 'Disponible'})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <span className="absolute right-3 top-3 text-slate-400 material-icons text-lg pointer-events-none">expand_more</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Usuario (Login)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-3 text-slate-400 material-icons text-lg">person</span>
                                                    <input
                                                        type="text"
                                                        value={loginInput}
                                                        onChange={(e) => setLoginInput(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                                        placeholder="EJ: YUORVE"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Contraseña</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-3 text-slate-400 material-icons text-lg">key</span>
                                                    <input
                                                        type="password"
                                                        value={passwordInput}
                                                        onChange={(e) => setPasswordInput(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                                        placeholder="••••••••"
                                                    />
                                                </div>
                                            </div>
                                            <button type="submit" className="w-full py-3 bg-primary hover:bg-sky-600 text-white rounded-lg font-bold shadow-lg shadow-sky-500/30 transition-all transform active:scale-95">
                                                ENTRAR
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Header Stats */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                                        <h2 className="text-2xl font-bold flex items-center gap-2">
                                            <span className="material-icons text-slate-400">group</span>
                                            Panel de Control
                                        </h2>

                                        {/* Mobile Logout */}
                                        {isWindows && (
                                            <div className="md:hidden absolute top-4 right-20">
                                                <button
                                                    onClick={handleLogout}
                                                    disabled={station.stateID !== 1}
                                                    className={`p-2 ${station.stateID === 1 ? 'text-rose-500' : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}
                                                >
                                                    <span className="material-icons">logout</span>
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 text-xs font-semibold px-4 py-2 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-200 dark:border-slate-800">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-active"></span> Activos: {activeCount}</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-break"></span> Pausados: {breakCount}</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-inactive"></span> Disponibles: {idleCount}</span>
                                        </div>
                                    </div>

                                    {/* Timeline View */}
                                    <Timeline
                                        assignedSlot={pvdAssignment?.slot ?? null}
                                        currentHour={currentTime.getHours()}
                                    />

                                    {/* Grid View - isMyStation ? 'contents' : 'hidden md:contents'*/}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
                                        {allStations.map((st, i) => {
                                            const isMyStation = station && st.ip === station.ip;
                                            return (
                                                <div key={i} className='contents'>
                                                    <StationCard data={st} index={i} />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Mobile Controls 
                                <div className="md:hidden grid grid-cols-2 gap-4 mt-8">
                                    <CommandButtonMobile onClick={() => handleCommand('activo')} label="Activo" icon="headset_mic" color="green" active={station.stateID == 1} />
                                    <CommandButtonMobile onClick={() => handleCommand('pvd')} label="PVD" icon="desktop_windows" color="yellow" active={station.stateID == 2} disabled={station.stateID != 1 && station.stateID != 2} />
                                    <CommandButtonMobile onClick={() => handleCommand('pause')} label="Descanso" icon="coffee" color="blue" active={station.stateID == 3} disabled={station.stateID != 1 && station.stateID != 3} />
                                    <CommandButtonMobile onClick={() => handleCommand('formacion')} label="Formación" icon="school" color="amber" active={station.stateID == 4} disabled={station.stateID != 1 && station.stateID != 4} />
                                    <CommandButtonMobile onClick={() => handleCommand('suplencia')} label="Suplencia" icon="sync_alt" color="pink" active={station.stateID == 6} disabled={station.stateID != 1 && station.stateID != 6} />
                                    <CommandButtonMobile onClick={() => handleCommand('gerencia')} label="Gerencia" icon="admin_panel_settings" color="indigo" active={station.stateID == 5} disabled={station.stateID != 1 && station.stateID != 5} />
                                </div>*/}
                                </>
                            )}
                        </div>
                    </section>
                </main>
            )}
        </div>
    );
}

// Base64 Beep Sound (Short Alert)
const ALARM_SOUND = 'data:audio/mp3;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAbXA0MgBUWFZYAAAAEQAAA21pbm9yX3ZlcnNpb24AMABUWFZYAAAAHAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzb21tcDQyAFRTU0UAAAAPAAADTGF2ZjU4LjQ1LjEwMAAAAAAAAAAAAAAA//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWgAAAA0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAJAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAAAAAA0gAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function StationCard({ data, index }) {
    const { login, stateID, timer, ip } = data;
    const isInactive = stateID == 0;

    // Timer Parsing for Alarms
    let isWarning = false;
    let isCritical = false;

    if (stateID > 1 && timer) { // Only for Limit States
        const isNegative = timer.startsWith('-');
        const cleanTime = isNegative ? timer.substring(1) : timer;
        const [h, m, s] = cleanTime.split(':').map(Number);
        let totalSeconds = (h * 3600 + m * 60 + s);
        if (isNegative) totalSeconds = -totalSeconds;

        // Critical: <= 0 (Time up !)
        if (totalSeconds <= 0) {
            isCritical = true;
        }
        // Warning: 0 < t <= 60 (Less than 1 min left)
        else if (totalSeconds <= 60) {
            isWarning = true;
        }
    }

    // Station ID from IP (10.207.201.101 -> 01)
    const stationId = ip.split('.').pop().slice(-2);

    if (isInactive) {
        return (
            <div className="bg-slate-100/50 dark:bg-slate-800/30 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 relative">
                <span className="absolute top-2 left-3 text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase">ESTACIÓN {stationId}</span>
                <div className="flex flex-col items-center py-4 opacity-40">
                    <div className="mb-3 text-slate-400">
                        <div className="w-16 h-16 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center">
                            <span className="material-icons text-4xl">desktop_windows</span>
                        </div>
                    </div>
                    <h3 className="font-medium text-sm italic">Disponible</h3>
                    <p className="text-xs font-mono mt-1">--:--:--</p>
                </div>
            </div>
        )
    }

    let borderClass = 'border-slate-500';
    let icon = 'help_outline';
    let iconContainerClass = 'bg-slate-100 dark:bg-slate-800 text-slate-500';
    let badgeClass = 'bg-slate-400';
    let textClass = 'text-slate-500';
    let cardBgClass = 'bg-white dark:bg-slate-900';
    let animationClass = '';

    if (stateID == 1) { // Active
        borderClass = 'border-status-active';
        icon = 'support_agent';
        iconContainerClass = 'bg-green-50 dark:bg-green-900/20 text-status-active';
        badgeClass = 'bg-status-active';
        textClass = 'text-status-active';
    } else if (stateID == 2) { // PVD
        borderClass = 'border-yellow-500';
        icon = 'desktop_windows';
        iconContainerClass = 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600';
        badgeClass = 'bg-yellow-500';
        textClass = 'text-yellow-600';
    } else if (stateID == 3) { // Break
        borderClass = 'border-status-break';
        icon = 'coffee';
        iconContainerClass = 'bg-blue-50 dark:bg-blue-900/20 text-status-break';
        badgeClass = 'bg-status-break';
        textClass = 'text-status-break';
    } else if (stateID == 4) { // Training
        borderClass = 'border-status-training';
        icon = 'school';
        iconContainerClass = 'bg-amber-50 dark:bg-amber-900/20 text-status-training';
        badgeClass = 'bg-status-training';
        textClass = 'text-status-training';
    } else if (stateID == 5) { // Gerencia
        borderClass = 'border-indigo-500';
        icon = 'admin_panel_settings';
        iconContainerClass = 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500';
        badgeClass = 'bg-indigo-500';
        textClass = 'text-indigo-500';
    } else if (stateID == 6) { // Suplencia
        borderClass = 'border-pink-500';
        icon = 'sync_alt';
        iconContainerClass = 'bg-pink-50 dark:bg-pink-900/20 text-pink-500';
        badgeClass = 'bg-pink-500';
        textClass = 'text-pink-500';
    }

    // Alarm Overrides
    if (isCritical) {
        borderClass = 'border-red-600';
        cardBgClass = 'bg-red-50 dark:bg-red-900/30';
        textClass = 'text-red-600 dark:text-red-400 font-bold';
        animationClass = 'animate-pulse';
        iconContainerClass = 'bg-red-200 dark:bg-red-800 text-red-700';
        badgeClass = 'bg-red-600 animate-ping';
    } else if (isWarning) {
        borderClass = 'border-orange-500';
        cardBgClass = 'bg-orange-50 dark:bg-orange-900/20';
        textClass = 'text-orange-600 dark:text-orange-400 font-bold';
    }

    return (
        <div className={`${cardBgClass} p-4 rounded-xl shadow-sm border-b-4 ${borderClass} hover:shadow-md transition-all relative group ${animationClass}`}>
            <span className="absolute top-2 left-3 text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase">ESTACIÓN {stationId}</span>
            <div className="flex flex-col items-center py-4">
                <div className="relative mb-3">
                    <div className={`w-16 h-16 rounded-full ${iconContainerClass} flex items-center justify-center`}>
                        <span className="material-icons text-4xl">{icon}</span>
                    </div>
                    <div className={`absolute bottom-0 right-0 w-4 h-4 ${badgeClass} border-2 border-white dark:border-slate-900 rounded-full`}></div>
                </div>
                <h3 className="font-bold text-sm tracking-tight uppercase truncate w-full text-center">{login}</h3>
                <div className={`flex items-center gap-1 mt-1 ${textClass}`}>
                    <span className="material-icons text-xs">timer</span>
                    <span className="text-xs font-mono font-bold">{timer || '00:00:00'}</span>
                </div>
            </div>
        </div>
    )
}

function SidebarButton({ onClick, label, icon, active, colorClass, disabled }) {
    if (disabled) {
        return (
            <button disabled className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-transparent text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50">
                <span className="material-icons">{icon}</span> {label}
            </button>
        )
    }
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-semibold
            ${active
                    ? `${colorClass} border`
                    : 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
        >
            <span className={`material-icons ${active ? '' : 'text-slate-400'}`}>{icon}</span> {label}
        </button>
    );
}

function CommandButtonMobile({ onClick, label, icon, color, active, disabled }) {
    if (disabled) return null;
    const colors = {
        green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-600',
        pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
        indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    };
    return (
        <button onClick={onClick} className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 font-bold ${active ? 'ring-2 ring-offset-2 ring-primary' : ''} ${colors[color]}`}>
            <span className="material-icons text-2xl">{icon}</span>
            <span className="text-sm">{label}</span>
        </button>
    )
}

export default App;

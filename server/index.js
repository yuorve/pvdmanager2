import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import * as bcrypt from 'bcryptjs';
import { assignPVD, calculateLoad } from './pvd.js';
import { getZonedParts } from './dateUtils.js';

const app = new Hono();

// Global Generic Error Handler (never leaks stack trace or database internals)
app.onError((err, c) => {
    console.error("Internal Server Error:", err);
    return c.json({ error: 'Internal Server Error', message: 'Ha ocurrido un error en el servidor.' }, 500);
});

app.use('*', cors());

// Rate Limiting Store for Login Attempts
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

function checkLoginRateLimit(key) {
    const now = Date.now();
    const entry = loginAttempts.get(key);
    if (!entry) return { allowed: true };

    if (now > entry.resetAt) {
        loginAttempts.delete(key);
        return { allowed: true };
    }

    if (entry.count >= MAX_LOGIN_ATTEMPTS) {
        const remainingMinutes = Math.ceil((entry.resetAt - now) / 60000);
        return { allowed: false, remainingMinutes };
    }

    return { allowed: true };
}

function recordFailedLogin(key) {
    const now = Date.now();
    const entry = loginAttempts.get(key);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_LOCKOUT_MS });
    } else {
        entry.count++;
    }
}

function clearLoginRateLimit(key) {
    loginAttempts.delete(key);
}

// Password Policy: Min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit
function validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') return false;
    if (password.length < 8) return false;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasUpper && hasLower && hasNumber;
}

// Authentication Middleware
async function authMiddleware(c, next) {
    const authHeader = c.req.header('authorization');
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return c.json({ error: 'Unauthorized', message: 'Token de autenticación requerido.' }, 401);
    
    try {
        const secret = c.env.JWT_SECRET || 'default_secret_for_development';
        const decodedPayload = await verify(token, secret, "HS256");
        c.set('user', decodedPayload);
        await next();
    } catch (err) {
        return c.json({ error: 'Forbidden', message: 'Token inválido o expirado.' }, 403);
    }
}

// Global IP middleware
app.use(async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || '127.0.0.1';
    c.set('clientIp', ip);
    
    try {
        await c.env.DB.prepare(
            'UPDATE stations SET KeepAlive = CURRENT_TIMESTAMP WHERE addressIP = ?'
        ).bind(ip).run();
    } catch (err) {
        console.error('Database Error in Middleware:', err);
    }
    await next();
});

function getStationIP(c) {
    return c.req.header('x-station-ip') || c.get('clientIp');
}

// Helpers
async function logActivity(db, operatorId, type, stateFrom, stateTo, details = '') {
    try {
        if (!operatorId) return;
        await db.prepare(
            'INSERT INTO operator_activity (operator_id, activity_type, state_from, state_to, details) VALUES (?, ?, ?, ?, ?)'
        ).bind(operatorId, type, stateFrom, stateTo, details).run();
    } catch (err) {
        console.error("Activity Log Error:", err);
    }
}

function formatTime(totalSeconds) {
    const isNegative = totalSeconds < 0;
    const absSeconds = Math.abs(totalSeconds);
    const hours = Math.floor(absSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((absSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (absSeconds % 60).toString().padStart(2, '0');
    return `${isNegative ? '-' : ''}${hours}:${minutes}:${seconds}`;
}

function parseSeconds(timeString) {
    if (!timeString) return 0;
    const isNegative = timeString.startsWith('-');
    const cleanTime = isNegative ? timeString.substring(1) : timeString;
    const [h, m, s] = cleanTime.split(':').map(Number);
    const total = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    return isNegative ? -total : total;
}

function calculateRealTimer(row) {
    const elapsed = parseInt(row.elapsed, 10) || 0;
    if (row.stateID == 0) return '00:00:00';
    if (row.stateID == 1) {
        return formatTime(elapsed);
    } else {
        const initialDuration = parseSeconds(row.timer);
        const remaining = initialDuration - elapsed;
        return formatTime(remaining);
    }
}

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// GET /api/station
app.get('/api/station', async (c) => {
    try {
        const stationIP = getStationIP(c);
        const { results: rows } = await c.env.DB.prepare(
            `SELECT *, CAST(strftime('%s', 'now') - strftime('%s', timeSTAMP) AS INTEGER) as elapsed 
             FROM stations WHERE addressIP = ?`
        ).bind(stationIP).all();

        if (rows.length === 0) {
            return c.json({ error: 'Station not found', ip: stationIP }, 404);
        }
        
        const station = rows[0];
        const currentTimer = calculateRealTimer(station);

        let pvdAssignment = null;
        if (station.userID) {
            // Unify timezone across hour, minute, and date
            const zoned = getZonedParts(new Date());
            const currentHour = zoned.hour;
            const currentMinute = zoned.minute;
            const currentTotalMinutes = currentHour * 60 + currentMinute;
            const dateStr = zoned.dateStr;

            const { results: pvdRows } = await c.env.DB.prepare(
                `SELECT window_hour, start_minute FROM pvd_assignments 
                 WHERE operator_id = ? AND date = ? AND (window_hour = ? OR window_hour = ?) 
                 ORDER BY window_hour ASC, start_minute ASC LIMIT 5`
            ).bind(station.userID, dateStr, currentHour, (currentHour + 1) % 24).all();

            for (const row of pvdRows) {
                const slotTotalMinutes = row.window_hour * 60 + row.start_minute;
                const endTotalMinutes = slotTotalMinutes + 7;

                if (station.stateID !== 2) {
                    if (endTotalMinutes > currentTotalMinutes) {
                        pvdAssignment = { hour: row.window_hour, slot: row.start_minute };
                        break;
                    }
                } else {
                    const diff = currentTotalMinutes - slotTotalMinutes;
                    if (diff > -10 && diff < 20) {
                        pvdAssignment = { hour: row.window_hour, slot: row.start_minute };
                        break;
                    }
                    if (endTotalMinutes > currentTotalMinutes) {
                        pvdAssignment = { hour: row.window_hour, slot: row.start_minute };
                        break;
                    }
                }
            }
        }

        return c.json({
            usuario: station.userID,
            pvdAssignment: pvdAssignment,
            stateID: station.stateID,
            timer: currentTimer,
            ip: station.addressIP,
            data: station
        });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al consultar la estación.' }, 500);
    }
});

// POST /api/login
app.post('/api/login', async (c) => {
    let { login, password } = await c.req.json();
    if (!login || !password) return c.json({ error: 'Missing credentials', message: 'Credenciales incompletas.' }, 400);

    login = login.toLowerCase();

    // Check rate limit by IP + login identifier
    const clientIP = c.get('clientIp') || 'unknown';
    const rateLimitKey = `${clientIP}:${login}`;
    const rateCheck = checkLoginRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
        return c.json({
            error: 'TOO_MANY_ATTEMPTS',
            message: `Demasiados intentos de acceso fallidos. Por favor, espere ${rateCheck.remainingMinutes} minuto(s).`
        }, 429);
    }

    try {
        console.log('[AUTH] Processing authentication request');

        const { results: users } = await c.env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(login).all();

        if (users.length === 0) {
            recordFailedLogin(rateLimitKey);
            console.warn('[AUTH] Authentication failed: user not found');
            return c.json({ error: 'Invalid credentials.', message: 'Credenciales inválidas.' }, 401);
        }

        const user = users[0];
        const validPass = await bcrypt.compare(password, user.password_hash);

        if (!validPass) {
            recordFailedLogin(rateLimitKey);
            console.warn('[AUTH] Authentication failed: invalid credentials');
            return c.json({ error: 'Invalid credentials', message: 'Credenciales inválidas.' }, 401);
        }

        // Clear failed attempts counter upon successful login
        clearLoginRateLimit(rateLimitKey);
        console.log('[AUTH] Authentication successful');

        const secret = c.env.JWT_SECRET || 'default_secret_for_development';
        const token = await sign({ username: user.username, role: user.role, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60 }, secret);

        const stationIP = getStationIP(c);

        const { results: activeStations } = await c.env.DB.prepare(
            "SELECT addressIP FROM stations WHERE userID = ? COLLATE NOCASE"
        ).bind(login).all();

        if (activeStations.length > 0) {
            return c.json({ error: 'ALREADY_LOGGED_IN', message: 'El usuario ya está conectado en otra estación.' }, 409);
        }
        
        await c.env.DB.prepare(
            'UPDATE stations SET userID = ?, stateID = 1, timer = "00:00:00", timeSTAMP = CURRENT_TIMESTAMP WHERE addressIP = ?'
        ).bind(login, stationIP).run();

        let pvdResult = null;
        if (user.role === 'OPERATOR') {
            pvdResult = await assignPVD(c.env.DB, login, new Date());
        }

        await logActivity(c.env.DB, login, 'LOGIN', null, 1, 'User logged in');

        return c.json({ status: 'OK', token, role: user.role, pvd: pvdResult });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno durante el inicio de sesión.' }, 500);
    }
});

// GET /api/pvd/schedule
app.get('/api/pvd/schedule', async (c) => {
    try {
        const zoned = getZonedParts(new Date());
        const hour = zoned.hour;
        const dateStr = zoned.dateStr;

        const prevHour = (hour - 1 + 24) % 24;
        let prevDateStr = dateStr;
        if (hour === 0) {
            const prevZoned = getZonedParts(new Date(Date.now() - 24 * 3600 * 1000));
            prevDateStr = prevZoned.dateStr;
        }

        const { results: rows } = await c.env.DB.prepare(
            `SELECT window_hour, start_minute 
             FROM pvd_assignments 
             WHERE (date = ? AND window_hour = ?) OR (date = ? AND window_hour = ?)`
        ).bind(dateStr, hour, prevDateStr, prevHour).all();

        const currentAssignments = rows.filter(r => r.window_hour === hour);
        const prevAssignments = rows.filter(r => r.window_hour === prevHour);

        const load = calculateLoad(currentAssignments, prevAssignments);
        return c.json({ hour, load, assignments: currentAssignments.length });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error al consultar la planificación de descansos.' }, 500);
    }
});

// POST /api/logout
app.post('/api/logout', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const username = user.username;
        const stationIP = getStationIP(c);

        const { results: rows } = await c.env.DB.prepare('SELECT userID, stateID FROM stations WHERE addressIP = ?').bind(stationIP).all();

        if (rows.length === 0) {
            return c.json({ error: 'Station not found', message: 'Estación no encontrada.' }, 404);
        }

        const station = rows[0];

        // Ensure caller is the owner of the station (or supervisor)
        if (station.userID && station.userID.toLowerCase() !== username.toLowerCase() && user.role !== 'SUPERVISOR') {
            return c.json({ error: 'Forbidden', message: 'No tienes permiso para cerrar la sesión de esta estación.' }, 403);
        }

        if (station.userID) {
            const userID = station.userID;
            const currentState = station.stateID;
            
            const { results: assignments } = await c.env.DB.prepare(
                `SELECT id, date, window_hour, start_minute 
                 FROM pvd_assignments 
                 WHERE operator_id = ? 
                 ORDER BY date ASC, window_hour ASC, start_minute ASC`
            ).bind(userID).all();

            let keepId = null;
            const now = new Date();

            for (const r of assignments) {
                const assignDate = new Date(r.date);
                assignDate.setHours(r.window_hour, r.start_minute + 7, 0, 0);

                if (assignDate > now) {
                    keepId = r.id;
                    break;
                }
            }

            if (keepId) {
                await c.env.DB.prepare(
                    'DELETE FROM pvd_assignments WHERE operator_id = ? AND id != ?'
                ).bind(userID, keepId).run();
            } else {
                await c.env.DB.prepare(
                    'DELETE FROM pvd_assignments WHERE operator_id = ?'
                ).bind(userID).run();
            }

            await logActivity(c.env.DB, userID, 'LOGOUT', currentState, 0, 'User logged out');
        }

        await c.env.DB.prepare(
            'UPDATE stations SET userID = NULL, stateID = 0, timer = "00:00:00", timeSTAMP = CURRENT_TIMESTAMP WHERE addressIP = ?'
        ).bind(stationIP).run();
        
        return c.json({ status: 'OK' });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al cerrar la sesión.' }, 500);
    }
});

// POST /api/command
app.post('/api/command', authMiddleware, async (c) => {
    const { c: cmd, t } = await c.req.json();
    if (!cmd) return c.json({ error: 'Missing command', message: 'Comando requerido.' }, 400);

    // Whitelist valid command types
    const ALLOWED_COMMANDS = ['activo', 'pvd', 'pause', 'formacion', 'gerencia', 'suplencia'];
    if (!ALLOWED_COMMANDS.includes(cmd)) {
        return c.json({ error: 'Invalid command', message: 'Comando no reconocido.' }, 400);
    }

    const user = c.get('user');
    const username = user.username;

    try {
        const stationIP = getStationIP(c);
        const { results: rows } = await c.env.DB.prepare(
            `SELECT userID, stateID, CAST(strftime('%s', 'now') - strftime('%s', timeSTAMP) AS INTEGER) as elapsed FROM stations WHERE addressIP = ?`
        ).bind(stationIP).all();
        
        if (rows.length === 0) return c.json({ error: 'Station not found', message: 'Estación no encontrada.' }, 404);
        
        const station = rows[0];
        const isOwner = station.userID && station.userID.toLowerCase() === username.toLowerCase();
        if (!isOwner) {
            return c.json({ error: 'Forbidden', message: 'No tienes permiso para modificar esta estación.' }, 403);
        }

        const currentState = station.stateID;
        const elapsedSeconds = station.elapsed;

        let newState = null;
        let newTimer = null;
        let shouldSave = false;

        if (cmd === 'activo') {
            if (currentState > 1) {
                newState = 1;
                newTimer = '00:00:00';
                shouldSave = true;
            }
        } else if (cmd === 'pvd' && currentState === 1) {
            newState = 2;
            newTimer = '00:07:00';
            shouldSave = true;
        } else if (cmd === 'pause' && currentState === 1) {
            newState = 3;
            // Strict input validation: duration must be integer between 1 and 60 minutes
            let pauseMinutes = 5;
            if (t !== undefined && t !== null && t !== '') {
                const parsed = parseInt(t, 10);
                if (isNaN(parsed) || parsed < 1 || parsed > 60) {
                    return c.json({
                        error: 'Invalid duration',
                        message: 'La duración del descanso debe ser un número entero entre 1 y 60 minutos.'
                    }, 400);
                }
                pauseMinutes = parsed;
            }
            newTimer = `00:${String(pauseMinutes).padStart(2, '0')}:00`;
            shouldSave = true;
        } else if (cmd === 'formacion' && currentState === 1) {
            newState = 4;
            newTimer = '00:15:00';
            shouldSave = true;
        } else if (cmd === 'gerencia' && currentState === 1) {
            newState = 5;
            newTimer = '00:30:00';
            shouldSave = true;
        } else if (cmd === 'suplencia' && currentState === 1) {
            newState = 6;
            newTimer = '00:55:00';
            shouldSave = true;
        }

        if (shouldSave) {
            await c.env.DB.prepare(
                'UPDATE stations SET stateID = ?, timer = ?, timeSTAMP = CURRENT_TIMESTAMP WHERE addressIP = ?'
            ).bind(newState, newTimer, stationIP).run();

            let logDetails = `Command: ${cmd}`;

            if (newState === 1 && currentState > 1) {
                const durationStr = formatTime(elapsedSeconds);
                logDetails += ` | Duration: ${durationStr}`;
            }

            await logActivity(c.env.DB, station.userID, 'STATE_CHANGE', currentState, newState, logDetails);
        }

        return c.json({ status: 'OK', state: newState });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al procesar el comando.' }, 500);
    }
});

// GET /api/stations
app.get('/api/stations', async (c) => {
    try {
        const { results: rows } = await c.env.DB.prepare(
            `SELECT *, CAST(strftime('%s', 'now') - strftime('%s', timeSTAMP) AS INTEGER) as elapsed FROM stations`
        ).all();

        const response = rows.map(row => ({
            id: row.id,
            login: row.userID,
            stateID: row.stateID,
            timer: calculateRealTimer(row),
            ip: row.addressIP
        }));

        return c.json(response);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al consultar las estaciones.' }, 500);
    }
});

// GET /api/activity
app.get('/api/activity', authMiddleware, async (c) => {
    const user = c.get('user');
    if (user.role !== 'SUPERVISOR') return c.json({ error: 'Forbidden', message: 'Acceso denegado.' }, 403);

    try {
        const date = c.req.query('date');
        const operator = c.req.query('operator');
        
        let query = 'SELECT * FROM operator_activity WHERE 1=1';
        const params = [];

        if (date) {
            query += ' AND date(created_at) = ?';
            params.push(date);
        } else {
            query += " AND date(created_at) = date('now')";
        }

        if (operator) {
            query += ' AND operator_id LIKE ?';
            params.push(`%${operator}%`);
        }

        query += ' ORDER BY created_at DESC';

        const { results: rows } = await c.env.DB.prepare(query).bind(...params).all();
        return c.json(rows);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al consultar la actividad.' }, 500);
    }
});

// GET /api/users
app.get('/api/users', authMiddleware, async (c) => {
    const user = c.get('user');
    if (user.role !== 'SUPERVISOR') return c.json({ error: 'Forbidden', message: 'Acceso denegado.' }, 403);
    
    try {
        const { results: rows } = await c.env.DB.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC').all();
        return c.json(rows);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al consultar los usuarios.' }, 500);
    }
});

// POST /api/users
app.post('/api/users', authMiddleware, async (c) => {
    const userContext = c.get('user');
    if (userContext.role !== 'SUPERVISOR') return c.json({ error: 'Forbidden', message: 'Acceso denegado.' }, 403);
    
    const { username, password, role } = await c.req.json();
    if (!username || !password) return c.json({ error: 'Missing fields', message: 'Todos los campos son obligatorios.' }, 400);

    // Enforce robust password policy
    if (!validatePasswordStrength(password)) {
        return c.json({
            error: 'Weak password',
            message: 'La contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas y números.'
        }, 400);
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const finalRole = role === 'SUPERVISOR' ? 'SUPERVISOR' : 'OPERATOR';
        
        await c.env.DB.prepare(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
        ).bind(username, hash, finalRole).run();
        
        return c.json({ status: 'OK' });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return c.json({ error: 'User already exists', message: 'El usuario ya existe.' }, 409);
        }
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al crear el usuario.' }, 500);
    }
});

// POST /api/change-password
app.post('/api/change-password', authMiddleware, async (c) => {
    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword) return c.json({ error: 'Missing fields', message: 'Todos los campos son obligatorios.' }, 400);

    // Enforce robust password policy
    if (!validatePasswordStrength(newPassword)) {
        return c.json({
            error: 'Weak password',
            message: 'La nueva contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas y números.'
        }, 400);
    }

    try {
        const userContext = c.get('user');
        const username = userContext.username;
        
        const { results: users } = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).all();
        if (users.length === 0) return c.json({ error: 'User not found', message: 'Usuario no encontrado.' }, 404);

        const user = users[0];
        const validPass = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPass) return c.json({ error: 'Invalid current password', message: 'La contraseña actual es incorrecta.' }, 400);

        const newHash = await bcrypt.hash(newPassword, 10);
        await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, user.id).run();

        return c.json({ status: 'OK' });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al cambiar la contraseña.' }, 500);
    }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', authMiddleware, async (c) => {
    const userContext = c.get('user');
    if (userContext.role !== 'SUPERVISOR') return c.json({ error: 'Forbidden', message: 'Acceso denegado.' }, 403);
    
    const userId = c.req.param('id');

    try {
        const { results: users } = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).all();
        if (users.length === 0) return c.json({ error: 'User not found', message: 'Usuario no encontrado.' }, 404);

        if (users[0].username === 'admin') {
            return c.json({ error: 'Forbidden', message: 'No se puede eliminar el usuario administrador.' }, 403);
        }

        await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
        return c.json({ status: 'OK' });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al eliminar el usuario.' }, 500);
    }
});

// POST /api/stations
app.post('/api/stations', authMiddleware, async (c) => {
    const userContext = c.get('user');
    if (userContext.role !== 'SUPERVISOR') return c.json({ error: 'Forbidden', message: 'Acceso denegado.' }, 403);
    
    const { ip } = await c.req.json();
    if (!ip) return c.json({ error: 'Missing IP', message: 'La dirección IP es obligatoria.' }, 400);

    try {
        await c.env.DB.prepare('INSERT INTO stations (addressIP, stateID) VALUES (?, 0)').bind(ip).run();
        return c.json({ status: 'OK' });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return c.json({ error: 'Station IP already exists', message: 'La IP de la estación ya existe.' }, 409);
        }
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al crear la estación.' }, 500);
    }
});

// DELETE /api/stations/:id
app.delete('/api/stations/:id', authMiddleware, async (c) => {
    const userContext = c.get('user');
    if (userContext.role !== 'SUPERVISOR') return c.json({ error: 'Forbidden', message: 'Acceso denegado.' }, 403);
    
    const stationId = c.req.param('id');

    try {
        await c.env.DB.prepare('DELETE FROM stations WHERE id = ?').bind(stationId).run();
        return c.json({ status: 'OK' });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al eliminar la estación.' }, 500);
    }
});

// GET /api/assignments
app.get('/api/assignments', authMiddleware, async (c) => {
    const userContext = c.get('user');
    if (userContext.role !== 'SUPERVISOR') return c.json({ error: 'Forbidden', message: 'Acceso denegado.' }, 403);
    
    const dateParam = c.req.query('date');

    try {
        const zoned = getZonedParts(new Date());
        const currentDateStr = zoned.dateStr;
        const targetDateStr = dateParam || currentDateStr;

        const { results: rows } = await c.env.DB.prepare(
            'SELECT * FROM pvd_assignments WHERE date = ? ORDER BY window_hour ASC, start_minute ASC'
        ).bind(targetDateStr).all();

        const isToday = targetDateStr === currentDateStr;
        const currentMinutes = zoned.hour * 60 + zoned.minute;

        const userMap = new Map();

        for (const row of rows) {
            if (userMap.has(row.operator_id)) continue;

            if (isToday) {
                const rowMinutes = row.window_hour * 60 + row.start_minute;
                if (rowMinutes < currentMinutes) continue;
            }

            userMap.set(row.operator_id, row);
        }

        return c.json(Array.from(userMap.values()));
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Database error', message: 'Error interno al consultar las asignaciones.' }, 500);
    }
});

// SPA Fallback
app.get('*', async (c) => {
    if (c.req.path.startsWith('/api/')) {
        return c.json({ error: 'Not Found', message: 'Ruta no encontrada.' }, 404);
    }
    return await c.env.ASSETS.fetch(c.req.raw);
});

export default app;

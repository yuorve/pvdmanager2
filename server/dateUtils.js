/**
 * Unified Date and Time utilities for PVD Manager.
 * Ensures consistent timezone handling across date strings (YYYY-MM-DD),
 * hours (0-23), minutes (0-59), and calculations.
 */

const APP_TIMEZONE = 'Europe/Madrid';

export function getZonedParts(date = new Date(), timeZone = APP_TIMEZONE) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(date);
    const map = {};
    for (const p of parts) {
        map[p.type] = p.value;
    }

    const year = map.year;
    const month = map.month;
    const day = map.day;
    const hour = parseInt(map.hour, 10) % 24;
    const minute = parseInt(map.minute, 10);
    const second = parseInt(map.second, 10);
    const dateStr = `${year}-${month}-${day}`;

    return {
        dateStr,
        hour,
        minute,
        second,
        year: parseInt(year, 10),
        month: parseInt(month, 10),
        day: parseInt(day, 10)
    };
}

export function getShiftDate(date = new Date(), timeZone = APP_TIMEZONE) {
    return getZonedParts(date, timeZone).dateStr;
}

export function getShiftHour(date = new Date(), timeZone = APP_TIMEZONE) {
    return getZonedParts(date, timeZone).hour;
}

export { APP_TIMEZONE };

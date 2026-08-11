-- Migration number: 0002 	 2026-08-11T12:00:00.000Z
UPDATE users SET password_hash = '$2b$10$sld9c31jQMt/ZX47CUrH9eM8kw9G5K9qTG0rfJlpUcIJM5wQTj1vS' WHERE username = 'admin';

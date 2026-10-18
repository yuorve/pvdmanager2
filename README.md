# PVD Manager - Dashboard v2.0

**PVD Manager** is a real-time monitoring and workstation management platform designed for operations centers, contact centers, and data-entry environments. It enables real-time tracking of operator workstation states, automated management of visual display terminal pauses (PVD - *Pantallas de Visualización de Datos*), and seamless mobile monitoring via dynamic QR codes.

---

## 🚀 Key Features

### 1. Real-Time Station Monitoring
* Live dashboard displaying every workstation, operator name, current state, and elapsed or countdown timers.
* Immediate color-coded status badges with visual/audio alerts when pause thresholds are exceeded.
* Real-time timer calculation synced across clients and the backend.

### 2. Workstation States
| State ID | Name | Description |
|---|---|---|
| **0** | **Disponible / Inactivo** | Workstation is unassigned and open for login (`--:--:--`). |
| **1** | **Activo** | Operator actively working at the station. |
| **2** | **PVD** | Scheduled Visual Display Pause (7-minute interval with countdown timer). |
| **3** | **Descanso** | Standard break / coffee pause. |
| **4** | **Formación** | Training / coaching session. |
| **5** | **Gerencia** | Management meeting or administrative tasks. |
| **6** | **Suplencia** | Temporary station substitution / coverage. |

### 3. Dedicated TV Mode (`/tv` or `?tv=true`)
* Streamlined, distraction-free view designed specifically for large operational overhead displays and wall monitors.
* Automatically conceals the control header counters and pause timelines, dedicating 100% of the screen real-estate to the workstation grid.

### 4. Dynamic QR Code & Large Mobile View (`?mobile=<station_ip>`)
* **Instant Operator Sync**: When an operator logs into their workstation on desktop, a QR code is rendered directly in the sidebar beneath quick actions.
* **Scan & Go**: Scanning the QR code with any smartphone opens a lightweight, dedicated mobile view for that specific workstation without requiring menu navigation.
* **High-Visibility Mobile Card**: Features an extra-large typography layout, prominent status badge, enlarged timer display, and alert animations designed for effortless at-a-glance readability on phones.
* **Privacy & Auto-Reset**: When the operator logs out from their workstation, the mobile view automatically refreshes to display the station as "Disponible" (Available), safeguarding user privacy.

### 5. PVD Slot Assignment & Timeline
* Visual schedule timeline highlighting assigned 7-minute PVD intervals across the current shift hour.
* Operator turn alerts displaying upcoming minute slots (e.g. `Tu turno: Minuto XX`).

### 6. Supervisor Administration
* **Activity Log**: Full audit trail recording state transitions, timestamps, and operator actions.
* **User Management**: Create, view, update, and manage operator and supervisor credentials.
* **Station Management**: Provision workstation IPs, define station aliases, and manage station status.
* **PVD Schedule Assignment**: Assign and balance PVD break slots across operators for each hour window.

### 7. Security & Conflict Guard
* **Single Active Session Enforcement**: Detects if an operator is already logged in at another workstation, returning an HTTP `409 Conflict` to prevent split sessions while retaining clear UI feedback.
* **JWT-Based Authentication**: Secure stateless token issuance with role-based access control (`OPERATOR` vs `SUPERVISOR`).
* **Self-Service Password Changes**: Secure in-app password update modal for operators.

---

## 🛠️ Technology Stack

### Frontend
* **[React 18](https://react.dev/)**: Reactive UI architecture with hooks and modular components.
* **[Vite](https://vitejs.dev/)**: Rapid bundler and local development server.
* **[Tailwind CSS](https://tailwindcss.com/)**: Dark-mode enabled utility-first responsive styling.
* **[qrcode.react](https://github.com/zpao/qrcode.react)**: SVG QR code generation for workstation pairing.
* **[Axios](https://axios-http.com/)**: REST API communication with intelligent error interception.

### Backend & Cloud Infrastructure
* **[Hono](https://hono.dev/)**: Ultra-fast, lightweight web framework designed for edge runtimes.
* **[Cloudflare Workers / Wrangler](https://developers.cloudflare.com/workers/)**: Serverless runtime and CLI for local development and edge deployment.
* **[Cloudflare D1](https://developers.cloudflare.com/d1/)**: Serverless SQL database storing stations, users, logs, and PVD assignments.
* **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)**: Strong cryptographic password hashing.
* **[jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)**: JWT generation and verification.

---

## 📂 Project Structure

```
.
├── frontend/                     # React + Vite client source code
│   ├── src/
│   │   ├── App.jsx               # Main dashboard, TV mode & MobileStationCard
│   │   ├── Timeline.jsx          # PVD slot occupancy visual timeline
│   │   ├── ActivityLog.jsx       # Supervisor audit trail & historical logs
│   │   ├── UserManagement.jsx    # User CRUD & password administration
│   │   ├── StationManagement.jsx # Workstation assignment & IP management
│   │   ├── PVDAssignments.jsx    # Shift slot allocation grid
│   │   ├── ChangePassword.jsx    # User self-service password update
│   │   └── main.jsx              # React application entry point
│   ├── package.json
│   └── vite.config.js
├── server/
│   └── index.js                  # Hono REST API & Cloudflare D1 integration
├── migrations/                   # D1 SQL database schema migrations
│   ├── 0000_initial.sql          # Base tables (stations, users, pvd, activity)
│   ├── 0001_seed.sql             # Default workstations & seed records
│   └── 0002_fix_admin_password.sql
├── package.json                  # Root workspace definition & build scripts
├── wrangler.jsonc                # Cloudflare Workers & D1 database bindings
├── .dev.vars                     # Local environment secrets (JWT_SECRET)
└── README.md                     # Documentation
```

---

## ⚙️ Getting Started & Local Development

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### 1. Install Dependencies
Install all project dependencies across the root and workspace packages:
```bash
npm install
```

### 2. Configure Environment Variables
Create or verify `.dev.vars` in the project root:
```env
JWT_SECRET=super_secret_jwt_key_here
```

### 3. Run D1 Database Migrations (Local)
Apply the database migrations to your local Cloudflare D1 instance:
```bash
npx wrangler d1 migrations apply pvd-manager --local
```

### 4. Start Development Server
Run the unified build and development server (starts on port `3000`):
```bash
npm run dev
```

The application is now accessible at:
* **Dashboard**: `http://localhost:3000`
* **TV Mode**: `http://localhost:3000/tv` (or `http://localhost:3000/?tv=true`)
* **Mobile Station View**: `http://localhost:3000/?mobile=<STATION_IP>`

---

## 🧪 Production Build

To compile the frontend client for production deployment:
```bash
npm run build
```
This builds static assets into `frontend/dist`, which are automatically served by the Cloudflare Worker static assets binding specified in `wrangler.jsonc`.

---

## 📄 License
Copyright (c) 2026 Yury Leonardo Oropeza Veracierto.  
All rights reserved.

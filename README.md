# PVD Manager - Dashboard v2.0

**PVD Manager** is a real-time monitoring system designed to manage and visualize the status of workstations and user PVD (Data Visualization Pauses) assignments. It provides a comprehensive dashboard for supervisors and agents, ensuring compliance with break times and optimizing activity distribution.

## Key Features

* **Real-Time Monitoring**: View the status of all workstations (Active, PVD, Break, Training, Management, Substitution) live.
* **PVD Management**: Time control with support for countdown timers and visual/audio alerts.
* **Audio and Visual Alerts**: Automatic critical notifications when break or activity time limits are reached (via `.mp3` audio).
* **Supervisor Dashboard**: Exclusive tools for the supervisor role, including:
  * Activity Log.
  * User Management.
  * Workstation Management.
  * PVD Schedule Assignments.
* **TV Interface (Screen Mode)**: Special view optimized for room monitors or TVs with no login required (`/tv`).
* **Dark Theme Support**: Transition and persistence of light/dark UI for better visual ergonomics.

## Technologies Used

### Frontend
* **[React 18](https://reactjs.org/)**: Library for building the user interface.
* **[Vite](https://vitejs.dev/)**: Fast and optimized development environment for the modern web.
* **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework for rapid and responsive design.
* **Axios**: HTTP client for API requests.

### Backend
* **[Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)**: Fast and minimalist RESTful API server.
* **[MySQL 8.0](https://www.mysql.com/)**: Relational database to save history and metrics.
* **JWT (JSON Web Tokens)**: Secure token-based authentication system.
* **Bcrypt.js**: User password encryption.

### Infrastructure / Deployment
* **[Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)**: Containerization of services (API, Web Frontend, Database, Nginx Proxy, and Adminer).
* **Nginx**: Reverse proxy to unify port 80 to the Frontend and API transparently.

## Project Structure

```
pvd/
├── frontend/       # React + Vite + Tailwind CSS client source code
├── server/         # Node.js + Express backend API source code
├── db/             # Database initialization scripts (init.sql)
├── nginx/          # Nginx configuration files (default.conf)
├── docker-compose.yml # Docker services composition for development/production
└── README.md       # This document
```

## Installation and Setup (Docker)

The easiest way to run this application is using Docker Compose.

1. **Clone the project:**
   ```bash
   git clone <repository-url>
   cd pvd
   ```

2. **Configure Environment Variables:**
   Make sure to configure or review the `.env` file in the project root for general configuration, and in the `./frontend` or `./server` folder if they have specific variables. The main variables used by Docker are:
   * `DB_NAME`
   * `DB_USER`
   * `DB_PASS`
   * `DB_ROOT_PASSWORD`
   * `PORT_ADMINER`

3. **Build and Run the Containers:**
   Run the following command to build the local images and start all containers in the background:
   ```bash
   docker-compose up -d --build
   ```

4. **Access the Application:**
   * **Dashboard and Application (Frontend + API router)**: [http://localhost](http://localhost)
   * **Database (Adminer)**: `http://localhost:<PORT_ADMINER>`

## Local Development (Without Docker)

If you want to keep the Database running in a container but start the Frontend and Backend locally and isolated from Docker:

1. Start the Database:
   ```bash
   docker-compose up -d db
   ```
2. Install dependencies and run the Backend:
   ```bash
   cd server
   npm install
   npm run dev
   ```
3. Install dependencies and start the Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## License
Copyright (c) 2026 Yury Leonardo Oropeza Veracierto
All rights reserved.
The reproduction, distribution, modification or use of this software or any part of it, without the prior written authorization of the copyright owner, is strictly prohibited.
THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.

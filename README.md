# EcoLoop - Smart Solid Waste Management with Incentives

A comprehensive waste management system combining technology, incentives, and community engagement to improve waste segregation, collection efficiency, and environmental sustainability.

## 🌍 Overview

EcoLoop is an integrated platform that connects residents, waste collectors, and administrators through a modern web application. The system tracks waste submissions, coordinates collection routes, manages rewards, and provides real-time analytics.

**Key Features:**
- ✅ Waste submission with eco-point calculation
- ✅ Real-time collection coordination with notifications
- ✅ Points-based reward redemption system
- ✅ Smart bin IoT integration with fill-level monitoring
- ✅ ACID-compliant transaction management
- ✅ Role-based access control (Admin, Collector, Resident)
- ✅ Comprehensive analytics and reporting

## 🏗️ System Architecture

### Three-Tier Architecture

```
Frontend Layer       Backend Layer       Data Layer
┌────────────────┐   ┌──────────────┐   ┌──────────────┐
│  Angular 21    │──▶│ Node.js/Exp. │──▶│   MySQL +    │
│  TypeScript    │   │    REST API  │   │ JSON fallback│
└────────────────┘   └──────────────┘   └──────────────┘
     Port 5050           Port 5050
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.19+ (Node 24 recommended)
- **Angular CLI** 21+
- **MySQL** Server 8.0+ (or use JSON fallback)
- **npm** or **yarn** package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/vin938/Smart-Solid-Waste-Management-With-Incentives.git
   cd miles
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm --prefix frontend-angular install
   npm --prefix backend install
   ```

3. **Configure environment**
   ```bash
   # Create backend/.env file
   cp backend/.env.example backend/.env
   
   # Edit backend/.env with your database credentials
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=ecoloop
   ```

4. **Start the application**
   
   **Option A: Development with automatic frontend build**
   ```bash
   npm start
   ```
   
   **Option B: Run separately for development**
   ```bash
   # Terminal 1 - Start backend
   cd backend && node server.js
   
   # Terminal 2 - Start frontend dev server
   cd frontend-angular && ng serve
   ```

5. **Access the application**
   - Open browser: `http://localhost:5050`
   - New accounts require a password of at least 12 characters.
   - Existing account passwords are upgraded to hashes on first startup.
   - Development-only seed users: `admin / admin123`, `collector / route123`, and `resident / eco123`. Never use these accounts in production.

### Local MySQL and Workbench

The local EcoLoop database is `ecoloop` on MySQL 8 at `127.0.0.1:3306`. The application uses the `ecoloop_app` account, restricted to this schema; its password and the session secret are stored in the ignored `backend/.env` file. Do not copy these values into frontend files or commit the `.env` file.

To connect with MySQL Workbench:

1. Create a **Standard (TCP/IP)** connection named `EcoLoop Local`.
2. Set **Hostname** to `127.0.0.1`, **Port** to `3306`, and **Username** to `ecoloop_app`.
3. Use the password value from `DB_PASSWORD` in `backend/.env` when Workbench prompts you. You can save it in Workbench's local vault if this is a trusted computer.
4. Select **Test Connection**, then connect. In the **Schemas** panel, refresh and expand `ecoloop` to see the application tables.
5. To create a visual schema diagram, use **Database → Reverse Engineer**, select the `EcoLoop Local` connection and `ecoloop` schema, then finish the wizard.

The backend creates and maintains the application tables when it starts. Avoid renaming or dropping tables through Workbench, since the API depends on their existing names and columns.

## 📁 Project Structure

```
miles/
├── frontend-angular/           # Angular 21 PWA application
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/     # Main dashboard component
│   │   │   ├── login/         # Login and registration
│   │   │   └── api.ts         # API service
│   │   └── main.ts
│   ├── angular.json
│   └── package.json
├── backend/                    # Node.js Express API server
│   ├── server.js              # Express server and routes
│   ├── db.js                  # Database abstraction with ACID support
│   ├── data/
│   │   ├── store.json         # JSON fallback storage
│   │   └── backups/           # Automatic backups
│   ├── models/
│   │   └── Waste.js           # Data models
│   ├── routes/
│   │   └── wasteRoutes.js     # API route definitions
│   ├── .env                   # Environment configuration
│   └── package.json
├── frontend/                   # Legacy frontend (optional)
├── .gitignore
├── package.json
└── README.md
```

## 🔐 User Roles & Permissions

### Administrator
- Monitor all accounts and system metrics
- Review waste submissions and verify quality
- Manage collection routes and pickup status
- View analytics, leaderboards, and ACID health
- Manage user roles and permissions

### Collector
- View assigned pickup routes
- Notify residents when collection arriving
- Mark waste submissions as collected
- Track collection performance and efficiency
- View assigned submissions only

### Resident
- Submit waste with details (type, weight, location, segregation)
- Earn eco-points automatically
- Receive real-time notifications
- View submission history and status
- Redeem points for rewards
- View barangay leaderboard

## 💰 Points System

### Earning Points
- Formula: `Points = Weight(kg) × 10 + Segregation Score / 10`
- Example: 5kg waste with 85% segregation = 50 + 8.5 = **58.5 points**
- Points awarded when collector marks waste as collected

### Redeeming Points
- Browse available rewards by partners
- Redeem points if sufficient balance and stock available
- Points deducted atomically with redemption record creation
- Redemption history maintained permanently

## 🔄 ACID Compliance

EcoLoop implements full ACID compliance for data integrity:

### Atomicity
- All database operations complete fully or rollback completely
- Transaction queue ensures sequential processing
- No partial updates or data corruption

### Consistency
- Data validation before commits
- Referential integrity checks
- Balance and rule validation
- Invalid states impossible

### Isolation
- Sequential transaction processing
- No concurrent conflicts or dirty reads
- Safe simultaneous user operations
- Locked file-based operations in JSON mode

### Durability
- Persistent storage (MySQL or JSON file)
- Automatic backups after each transaction
- Recovery mechanisms for system failures
- Data survives system crashes

### Health Check
```bash
curl http://localhost:5050/api/health
```

Response includes ACID compliance status and recovery capabilities.

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Bootstrap & System
- `GET /api/bootstrap` - Load all system data
- `GET /api/health` - System health and ACID status

### Waste Submissions
- `POST /api/submissions` - Create waste submission
- `PATCH /api/submissions/:id/status` - Update submission status
- `POST /api/submissions/:id/arrival` - Notify resident of collector arrival

### Collection Routes
- `POST /api/pickups` - Create pickup route
- `PATCH /api/pickups/:id/status` - Update pickup status

### Notifications & Rewards
- `GET /api/notifications/:userId` - Fetch user notifications
- `PATCH /api/notifications/:id/read` - Mark notification as read
- `POST /api/redemptions` - Redeem reward with points

### Smart Bins
- `POST /api/bins` - Register new smart bin
- `PATCH /api/bins/:id/fill` - Update bin fill level

## 🛠️ Technology Stack

### Frontend
- **Angular** 21 with standalone components and lazy-loaded login/dashboard routes
- **TypeScript** for type safety
- **RxJS** for reactive programming
- **HTML5 & CSS3** for responsive design
- **Bundle Size:** 1.75 MB (optimized)

### Backend
- **Node.js** v24.14.1
- **Express** 5.2.1 framework
- **mysql2** 3.15.3 for database
- **dotenv** for environment configuration
- **CORS** enabled for cross-origin requests
- **Bundle Size:** 2.67 MB

### Database
- **MySQL** 8.0+ for primary storage
- **JSON file-based** fallback storage
- **Connection Pool:** 10 concurrent connections
- **Automatic Backups:** After each transaction

## 📈 Features in Detail

### Waste Submission Workflow
1. Resident submits waste with type, weight, location, segregation score
2. System calculates eco-points instantly
3. Submission stored with "Pending" status
4. Collector assigned to route containing submission
5. Collector notifies resident of arrival
6. Collector marks waste as collected
7. Resident awarded eco-points automatically
8. Submission status changes to "Collected"

### Collection Coordination
1. Administrator creates pickup routes
2. Collectors view assigned routes with submission details
3. Collectors click "Notify Arriving" for each stop
4. Residents receive real-time notifications
5. Collectors verify and mark items collected
6. Route status updated in real-time
7. Analytics reflect completed collections

### Reward Redemption
1. Resident accumulates eco-points over time
2. Views available rewards (never expire)
3. Checks balance and selects reward
4. Clicks "Redeem" if sufficient points and stock
5. System executes atomic redemption transaction
6. Points deducted, stock decremented, record created
7. Redemption confirmation sent
8. Reward partner notified for fulfillment

### Analytics Dashboard
- Real-time metrics: Users, waste collected, points issued, pending pickups
- Waste type distribution pie chart
- Barangay leaderboard (residents ranked by points)
- Collection completion rates
- Segregation quality averages
- ACID compliance health status
- Activity logs and audit trails

## 🔧 Development

### Build Frontend
```bash
npm --prefix frontend-angular run build
```

### Run Backend Tests
```bash
cd backend && npm test
```

### Generate Documentation PDFs
```bash
# UML Diagrams
node generate-uml-diagrams-pdf.js

# Presentation Script
node generate-presentation-script.js
```

## 📲 Progressive Web App

The active Angular app is configured as an installable PWA. Its service worker caches the application shell and static assets only; API requests and private account data are not cached. The manifest, theme color, EcoLoop icons, standalone display mode, and offline status notice are included.

The integrated Express service serves both the Angular app and `/api` on the same origin. By default, `frontend-angular/public/runtime-config.js` sets the API base to `/api`. The cookie-authenticated setup is intended for same-origin hosting; a separate frontend should use a same-site subdomain and set `window.__ECOLOOP_API_BASE_URL__` to the HTTPS API URL and allow the exact frontend origin in `CORS_ORIGINS`. Hosting the app and API on unrelated sites requires additional cookie and CSRF configuration.

### Add to a phone's home screen

- **Android (Chrome):** open the HTTPS app URL, open the browser menu, and choose **Install app** or **Add to Home screen**.
- **iPhone/iPad (Safari):** open the HTTPS app URL, tap **Share**, then **Add to Home Screen**.

## 📦 Production deployment

The repository includes [render.yaml](./render.yaml) for a single-origin Render web service. It builds the Angular production app and runs the existing Express API. Render provides HTTPS; configure an external managed MySQL service (for example, Aiven MySQL) because this app requires MySQL and Render's local filesystem is not persistent.

1. Provision a managed MySQL database and obtain its host, port, database name, user, password, and CA certificate.
2. Push this project to a Git provider and create a Render Blueprint from the repository.
3. Set the prompted `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_SSL_CA` values in Render. Keep `DB_SSL=true` and `DB_STRICT=true`.
4. Set `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_NAME`, and a unique `INITIAL_ADMIN_PASSWORD` (12+ characters) before starting with an empty database. The one-time admin setup runs only when the users table is empty.
5. Render generates `SESSION_SECRET`. Keep it private and do not reuse development or demo passwords.
6. Deploy; check `/api/health`, then test sign-in, registration, role-specific actions, refreshes, the manifest, and installation on real browsers/devices.

The production server fails to start if MySQL is unavailable and refuses to serve the legacy frontend. It does not silently fall back to the JSON file. JSON storage is for local development/testing only and is not suitable for ephemeral production hosts.

### Production environment variables

See [backend/.env.example](./backend/.env.example) for the full list. Production requires `NODE_ENV=production`, `DB_STRICT=true`, `DB_SSL=true`, MySQL connection values, a strong `SESSION_SECRET`, and initial admin values only for an empty database. `CORS_ORIGINS` is only needed if the frontend is hosted on another origin. Never commit `.env` files or paste secrets into Angular source.

To redeploy later, push changes to the connected branch or trigger a Render deploy. Angular's service worker checks for new asset versions and does not cache API responses.

**Deployment status:** deployment files are prepared, but this workspace has no hosting account, Git remote, or managed database credentials. No public deployment has been performed or verified.

## 📚 Documentation

- **UML Diagrams PDF:** `EcoLoop-UML-Diagrams.pdf`
  - System architecture
  - Class diagrams
  - Use cases and workflows for each role
  - Sequence diagrams
  - Activity diagrams
  - Flowcharts

- **Presentation Script PDF:** `EcoLoop-Presentation-Script.pdf`
  - 17-slide presentation with speaker notes
  - Feature explanations
  - ACID compliance details
  - Expected impact metrics
  - Deployment information

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'Add YourFeature'`)
4. Push to branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Team

- **Project Lead:** Delord Pajo (Administrator)
- **Contributors:** Development Team

## 🐛 Known Issues & Limitations

- Development uses JSON storage when MySQL is unavailable; production requires MySQL and fails closed.
- The JSON fallback is not persistent on ephemeral hosting and must not be used for production data.
- Maximum 10 concurrent database connections (configurable in db.js)
- File-based JSON storage limited to ~50MB (sufficient for municipal-scale data)
- Smart bin integration requires IoT device support

## 🚀 Future Enhancements

- **Phase 2:** Mobile apps (iOS/Android), SMS notifications, ML-based route optimization
- **Phase 3:** WebSocket real-time updates, geolocation tracking, AI quality verification
- **Phase 4:** Blockchain rewards, multi-municipality support, government integrations

## 📞 Support & Contact

For issues, questions, or contributions:
- GitHub Issues: [Create an issue](https://github.com/vin938/Smart-Solid-Waste-Management-With-Incentives/issues)
- Email: info@ecoloop.gov
- Phone: +63 (XXX) XXX-XXXX

## 🎯 Project Metrics

- **Build Time:** ~14.5 seconds
- **Bundle Sizes:** Frontend 1.75MB, Backend 2.67MB
- **Response Time:** <100ms average
- **Uptime Target:** 99.9% (with ACID guarantees)
- **Data Consistency:** 100% (ACID-compliant transactions)

---

**EcoLoop: Smart Waste Management for a Sustainable Future** 🌱

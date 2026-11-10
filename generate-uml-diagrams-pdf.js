const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ size: 'A4', margin: 40 });
const outputPath = path.join(__dirname, 'EcoLoop-UML-Diagrams.pdf');
const stream = fs.createWriteStream(outputPath);

doc.pipe(stream);

// Helper function to add title
function addTitle(text, size = 24) {
  doc.fontSize(size).font('Helvetica-Bold').text(text, { align: 'center' });
  doc.moveDown(0.5);
}

// Helper function to add subtitle
function addSubtitle(text) {
  doc.fontSize(14).font('Helvetica-Bold').text(text);
  doc.moveDown(0.3);
}

// Helper function to add section
function addSection(text) {
  doc.fontSize(12).font('Helvetica-Bold').text(text);
  doc.moveDown(0.2);
}

// Helper function to add text
function addText(text, size = 10) {
  doc.fontSize(size).font('Helvetica').text(text, { align: 'left' });
}

// Helper function to add diagram description
function addDiagramDescription(title, description) {
  doc.fontSize(11).font('Helvetica-Bold').text(title);
  doc.fontSize(9).font('Helvetica').text(description, { align: 'left' });
  doc.moveDown(0.5);
}

// Title Page
addTitle('EcoLoop Smart Waste Management System', 28);
doc.moveDown(1);
addTitle('UML Diagrams and Documentation', 18);
doc.moveDown(1);
addText('System Architecture & Role-Based Workflows', 12);
doc.moveDown(2);
addText('Date: May 2026', 10);
addText('Version: 1.0', 10);

doc.addPage();

// ==================== SYSTEM ARCHITECTURE ====================
addTitle('1. System Architecture Diagram', 18);
doc.moveDown(0.3);
addDiagramDescription(
  'System Architecture Overview',
  `The EcoLoop system is built on a three-tier architecture:\n\n` +
  `• Frontend Layer: Angular 16+ standalone components with TypeScript\n` +
  `• Backend Layer: Node.js Express server with ACID-compliant transaction support\n` +
  `• Data Layer: MySQL database with JSON file-based fallback storage\n\n` +
  `Key Components:\n` +
  `- Frontend: Serves from port 5050, handles UI for all roles\n` +
  `- Backend: Express API on port 5050, provides REST endpoints\n` +
  `- Database: MySQL at 127.0.0.1:3306 with transaction queue management\n` +
  `- Storage: File-based JSON fallback at backend/data/store.json\n` +
  `- ACID Layer: Transaction queue, consistency checks, durability backups`
);

doc.addPage();

// ==================== CLASS DIAGRAM ====================
addTitle('2. Class Diagram', 18);
doc.moveDown(0.3);
addDiagramDescription(
  'Data Model Classes',
  `Core Entities:\n\n` +
  `User (id, username, password, name, age, address, phoneNumber, role, barangay, points)\n` +
  `├─ Administrator: Manages all accounts, reviews submissions, inspects analytics\n` +
  `├─ Collector: Manages pickup routes, notifies residents, marks collections\n` +
  `└─ Resident: Submits waste, receives notifications, claims rewards\n\n` +
  `Submission (id, residentId, residentName, wasteType, weightKg, location, segregationScore, status, pointsEarned, submittedAt, notes)\n` +
  `Pickup (id, routeName, collectorId, collectorName, scheduledDate, truck, zone, loadKg, stops, status)\n` +
  `Reward (id, title, pointsCost, stock, partner, description)\n` +
  `Redemption (id, rewardId, rewardTitle, userId, userName, pointsSpent, redeemedAt, status)\n` +
  `Notification (id, userId, title, message, type, read, createdAt)\n` +
  `Activity (id, type, actor, detail, createdAt)\n` +
  `SmartBin (id, name, location, fillLevel, status, lastCollectedAt, sensorHealth, wasteType)`
);

doc.addPage();

// ==================== ADMINISTRATOR DIAGRAMS ====================
addTitle('3. Administrator Workflows', 18);
doc.moveDown(0.5);

// Admin Use Case
addSubtitle('3.1 Administrator Use Case Diagram');
addDiagramDescription(
  'Admin Use Cases',
  `Administrator Actions:\n\n` +
  `1. User Management\n` +
  `   - View all resident, collector, and administrator profiles\n` +
  `   - Manage user roles and permissions\n\n` +
  `2. Submission Review\n` +
  `   - Review all waste submissions\n` +
  `   - Verify segregation scores\n` +
  `   - Award/deduct eco points\n\n` +
  `3. Collection Management\n` +
  `   - Monitor collection routes\n` +
  `   - Manage pickup status\n` +
  `   - View pickup completion rates\n\n` +
  `4. Analytics & Reporting\n` +
  `   - View barangay leaderboard (residents only)\n` +
  `   - Inspect waste type distributions\n` +
  `   - Monitor system ACID compliance\n` +
  `   - Access activity logs`
);
doc.moveDown(0.5);

// Admin Flowchart
addSubtitle('3.2 Administrator Flowchart');
addDiagramDescription(
  'Admin Workflow Process',
  `START → Login (Admin Credentials)\n` +
  `  ↓\n` +
  `SELECT ACTION:\n` +
  `  ├─ View Dashboard → View metrics (Users: 3, Waste: X kg, Points: Y, Pickups: Z)\n` +
  `  ├─ User Management → Select user → View profile → Update role/info\n` +
  `  ├─ Review Submissions → Filter by status → Verify segregation → Award points\n` +
  `  ├─ Monitor Pickups → View routes → Check status → Update completion\n` +
  `  ├─ Analytics → View leaderboard → Inspect waste data → Check ACID status\n` +
  `  └─ Profile → View account → Logout\n` +
  `  ↓\n` +
  `END`
);
doc.moveDown(0.5);

// Admin Activity Diagram
addSubtitle('3.3 Administrator Activity Diagram');
addDiagramDescription(
  'Admin Activities',
  `Activity Flow:\n\n` +
  `[Login] → [Authentication] → [Dashboard]\n` +
  `  ↓\n` +
  `Decision: Task Type?\n` +
  `  ├─ [User Management] → [Query Users] → [Update Profile] → [Log Activity]\n` +
  `  ├─ [Review Waste] → [Fetch Submissions] → [Verify Segregation] → [Award Points] → [Update Analytics]\n` +
  `  ├─ [Monitor Routes] → [View Pickups] → [Track Status] → [Generate Report]\n` +
  `  └─ [Analytics] → [Calculate Totals] → [Process Leaderboard] → [Display Charts]\n` +
  `  ↓\n` +
  `[Transaction Commit] → [Update Database] → [Refresh Dashboard] → [Logout]`
);
doc.moveDown(0.5);

// Admin Sequence Diagram
addSubtitle('3.4 Administrator Sequence Diagram');
addDiagramDescription(
  'Admin API Sequence',
  `Admin → Frontend → Backend → Database\n\n` +
  `Scenario: Review and Award Points\n` +
  `1. Admin clicks "Review Submissions"\n` +
  `2. Frontend sends GET /api/bootstrap\n` +
  `3. Backend queries database for submissions\n` +
  `4. Database returns filtered submissions with status="Pending"\n` +
  `5. Frontend displays submissions list\n` +
  `6. Admin selects submission, verifies segregation score\n` +
  `7. Admin clicks "Award Points"\n` +
  `8. Frontend sends PATCH /api/submissions/:id/status with status="Approved"\n` +
  `9. Backend executes transaction: update submission + update user points\n` +
  `10. Transaction commits to database\n` +
  `11. Backend returns updated submission and user data\n` +
  `12. Frontend updates UI, logs activity`
);

doc.addPage();

// ==================== COLLECTOR DIAGRAMS ====================
addTitle('4. Collector Workflows', 18);
doc.moveDown(0.5);

// Collector Use Case
addSubtitle('4.1 Collector Use Case Diagram');
addDiagramDescription(
  'Collector Use Cases',
  `Collector Actions:\n\n` +
  `1. Route Management\n` +
  `   - View assigned pickup routes\n` +
  `   - Plan collection stops\n` +
  `   - Update route status\n\n` +
  `2. Resident Notification\n` +
  `   - Notify residents when arriving\n` +
  `   - Send collection confirmations\n` +
  `   - Update collection status\n\n` +
  `3. Submission Verification\n` +
  `   - Mark waste submissions as collected\n` +
  `   - Record actual collection details\n` +
  `   - Confirm waste weight\n\n` +
  `4. Performance Tracking\n` +
  `   - View pickup statistics\n` +
  `   - Monitor route efficiency\n` +
  `   - Track completion rates`
);
doc.moveDown(0.5);

// Collector Flowchart
addSubtitle('4.2 Collector Flowchart');
addDiagramDescription(
  'Collector Workflow Process',
  `START → Login (Collector Credentials)\n` +
  `  ↓\n` +
  `SELECT ACTION:\n` +
  `  ├─ View Routes → See assigned pickups → Select route\n` +
  `  ├─ Route Detail → View stops → Plan sequence → Mark ready\n` +
  `  ├─ Notify Arriving → Select resident → Send notification → Resident receives alert\n` +
  `  ├─ Mark Collected → Select submission → Confirm weight → Submit collection\n` +
  `  ├─ Performance → View statistics → Check completion rates → View earnings\n` +
  `  └─ Profile → View account → Logout\n` +
  `  ↓\n` +
  `END`
);
doc.moveDown(0.5);

// Collector Activity Diagram
addSubtitle('4.3 Collector Activity Diagram');
addDiagramDescription(
  'Collector Activities',
  `Activity Flow:\n\n` +
  `[Login] → [Authentication] → [Dashboard]\n` +
  `  ↓\n` +
  `[View Routes] → [Select Pickup]\n` +
  `  ↓\n` +
  `Decision: Action?\n` +
  `  ├─ [Notify Arriving] → [Create Notification] → [Send to Resident] → [Update Status]\n` +
  `  ├─ [Collect Waste] → [Verify Submission] → [Confirm Details] → [Mark Collected] → [Award Resident Points]\n` +
  `  └─ [View Stats] → [Calculate Performance] → [Display Metrics]\n` +
  `  ↓\n` +
  `[Transaction Commit] → [Update Database] → [Refresh Dashboard] → [Logout]`
);
doc.moveDown(0.5);

// Collector Sequence Diagram
addSubtitle('4.4 Collector Sequence Diagram');
addDiagramDescription(
  'Collector API Sequence',
  `Collector → Frontend → Backend → Database\n\n` +
  `Scenario: Mark Waste as Collected\n` +
  `1. Collector selects waste submission from route\n` +
  `2. Frontend sends GET /api/bootstrap to refresh data\n` +
  `3. Backend returns latest submissions\n` +
  `4. Collector verifies weight and clicks "Mark Collected"\n` +
  `5. Frontend sends PATCH /api/submissions/:id/status with status="Collected"\n` +
  `6. Backend executes transaction:\n` +
  `   - Update submission status\n` +
  `   - Calculate and award resident points\n` +
  `   - Update user points balance\n` +
  `   - Create activity log\n` +
  `7. Transaction commits atomically\n` +
  `8. Backend returns updated submission and analytics\n` +
  `9. Frontend notifies resident via notification\n` +
  `10. Dashboard updates in real-time`
);

doc.addPage();

// ==================== RESIDENT DIAGRAMS ====================
addTitle('5. Resident Workflows', 18);
doc.moveDown(0.5);

// Resident Use Case
addSubtitle('5.1 Resident Use Case Diagram');
addDiagramDescription(
  'Resident Use Cases',
  `Resident Actions:\n\n` +
  `1. Waste Submission\n` +
  `   - Submit waste with type and weight\n` +
  `   - Indicate location\n` +
  `   - Rate segregation quality\n\n` +
  `2. Collection Notifications\n` +
  `   - Receive arrival notifications\n` +
  `   - Get collection confirmations\n` +
  `   - Track submission status\n\n` +
  `3. Reward Redemption\n` +
  `   - Earn eco points from submissions\n` +
  `   - View available rewards\n` +
  `   - Redeem points for rewards\n\n` +
  `4. Leaderboard & Analytics\n` +
  `   - View barangay leaderboard (residents only)\n` +
  `   - Check personal waste statistics\n` +
  `   - Track points earned over time`
);
doc.moveDown(0.5);

// Resident Flowchart
addSubtitle('5.2 Resident Flowchart');
addDiagramDescription(
  'Resident Workflow Process',
  `START → Login (Resident Credentials)\n` +
  `  ↓\n` +
  `SELECT ACTION:\n` +
  `  ├─ Submit Waste → Fill form (type, weight, location, segregation) → Submit\n` +
  `  │  └─ Backend calculates points → Points awarded\n` +
  `  ├─ Submissions → View history → Check status → See collected items\n` +
  `  ├─ Notifications → View alerts → Check collection arrival → Mark read\n` +
  `  ├─ Rewards → View available rewards → Check point cost → Click redeem\n` +
  `  │  └─ Check balance → Redeem if sufficient → Reward claimed\n` +
  `  ├─ Leaderboard → View rankings → Check personal position → See barangay stats\n` +
  `  └─ Profile → View account → Check total points → Logout\n` +
  `  ↓\n` +
  `END`
);
doc.moveDown(0.5);

// Resident Activity Diagram
addSubtitle('5.3 Resident Activity Diagram');
addDiagramDescription(
  'Resident Activities',
  `Activity Flow:\n\n` +
  `[Login] → [Authentication] → [Dashboard]\n` +
  `  ↓\n` +
  `Decision: Task Type?\n` +
  `  ├─ [Submit Waste] → [Fill Details] → [Calculate Points] → [Store Submission] → [Update Points]\n` +
  `  ├─ [View Notifications] → [Filter Messages] → [Mark as Read] → [Update Inbox]\n` +
  `  ├─ [Redeem Reward] → [Check Balance] → [Deduct Points] → [Create Redemption] → [Update Stock]\n` +
  `  └─ [View Leaderboard] → [Fetch Rankings] → [Display Positions] → [Highlight Self]\n` +
  `  ↓\n` +
  `[Update Analytics] → [Calculate Totals] → [Refresh Dashboard] → [Logout]`
);
doc.moveDown(0.5);

// Resident Sequence Diagram
addSubtitle('5.4 Resident Sequence Diagram');
addDiagramDescription(
  'Resident API Sequence',
  `Resident → Frontend → Backend → Database\n\n` +
  `Scenario: Submit Waste and Earn Points\n` +
  `1. Resident fills waste submission form (type: organic, weight: 5.2kg, location: barangay, segregation: 85)\n` +
  `2. Frontend validates form\n` +
  `3. Resident clicks "Submit"\n` +
  `4. Frontend sends POST /api/submissions with submission data\n` +
  `5. Backend executes transaction:\n` +
  `   - Validate submission data\n` +
  `   - Calculate points: 5.2kg * 10 points/kg = 52 points\n` +
  `   - Create submission record\n` +
  `   - Update resident user points\n` +
  `   - Create activity log\n` +
  `   - Update analytics\n` +
  `6. Transaction commits atomically\n` +
  `7. Backend returns submission + updated user data\n` +
  `8. Frontend displays confirmation\n` +
  `9. Dashboard updates showing +52 points earned\n` +
  `10. Resident waits for collector notification`
);

doc.addPage();

// ==================== DATABASE OPERATIONS ====================
addTitle('6. Database Transaction Model', 18);
doc.moveDown(0.3);
addDiagramDescription(
  'ACID Transaction Flow',
  `All database operations follow ACID principles:\n\n` +
  `Atomicity:\n` +
  `- Transaction queue prevents concurrent conflicts\n` +
  `- All-or-nothing: either complete or rollback\n\n` +
  `Consistency:\n` +
  `- Data validation before writes\n` +
  `- Referential integrity checks\n` +
  `- Balance validation (e.g., sufficient points)\n\n` +
  `Isolation:\n` +
  `- Transaction queue ensures sequential processing\n` +
  `- No dirty reads or lost updates\n\n` +
  `Durability:\n` +
  `- File-based backup system (backend/data/backups/)\n` +
  `- Automatic recovery mechanisms\n` +
  `- JSON fallback for MySQL unavailability\n\n` +
  `Example Critical Operations:\n` +
  `- Award points with submission creation\n` +
  `- Redeem reward with balance deduction\n` +
  `- Mark collection with points transfer`
);

doc.addPage();

// ==================== API ENDPOINTS ====================
addTitle('7. API Endpoints Reference', 18);
doc.moveDown(0.3);

addSubtitle('Authentication Endpoints');
addText('POST /api/auth/login - User login');
addText('POST /api/auth/register - User registration');
doc.moveDown(0.3);

addSubtitle('Bootstrap & Data Endpoints');
addText('GET /api/bootstrap - Load all system data');
addText('GET /api/health - System health check (ACID status)');
doc.moveDown(0.3);

addSubtitle('Submission Endpoints');
addText('POST /api/submissions - Create waste submission');
addText('PATCH /api/submissions/:id/status - Update submission status');
addText('POST /api/submissions/:id/arrival - Notify resident of arrival');
doc.moveDown(0.3);

addSubtitle('Pickup Endpoints');
addText('POST /api/pickups - Create pickup route');
addText('PATCH /api/pickups/:id/status - Update pickup status');
doc.moveDown(0.3);

addSubtitle('Notification & Reward Endpoints');
addText('GET /api/notifications/:userId - Fetch user notifications');
addText('PATCH /api/notifications/:id/read - Mark notification as read');
addText('POST /api/redemptions - Redeem reward with points');
doc.moveDown(0.3);

addSubtitle('Smart Bin Endpoints');
addText('POST /api/bins - Register new smart bin');
addText('PATCH /api/bins/:id/fill - Update bin fill level');

doc.addPage();

// ==================== SUMMARY ====================
addTitle('8. System Summary', 18);
doc.moveDown(0.3);

addSubtitle('Key Features');
addText('✓ Role-based access control (Administrator, Collector, Resident)');
addText('✓ ACID-compliant transaction management');
addText('✓ Waste submission and point earning system');
addText('✓ Collection route and notification system');
addText('✓ Reward redemption with inventory management');
addText('✓ Real-time analytics and leaderboards');
addText('✓ Smart bin integration with fill level tracking');
addText('✓ Activity logging and audit trail');
doc.moveDown(0.5);

addSubtitle('Technology Stack');
addText('Frontend: Angular 16+, TypeScript, RxJS, Standalone Components');
addText('Backend: Node.js v24, Express 5, mysql2');
addText('Database: MySQL with JSON file-based fallback');
addText('Deployment: Unified port (5050) for frontend and backend');
doc.moveDown(0.5);

addSubtitle('Performance Metrics');
addText('Frontend Bundle: 1.75 MB (browser)');
addText('Backend Bundle: 2.67 MB (server)');
addText('Database Connection Pool: 10 concurrent connections');
addText('Transaction Queue: FIFO with consistency validation');
addText('Build Time: ~14.5 seconds');

doc.end();

stream.on('finish', () => {
  console.log(`✓ UML Diagrams PDF generated: ${outputPath}`);
  console.log(`✓ File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
});

stream.on('error', (err) => {
  console.error('✗ Error generating PDF:', err);
  process.exit(1);
});

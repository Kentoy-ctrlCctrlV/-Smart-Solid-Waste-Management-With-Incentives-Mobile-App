const PDFDocument = require('pdfkit');
const fs = require('fs');

const outputPath = 'presentation-script.pdf';
const doc = new PDFDocument({ margin: 48, size: 'A4' });
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

doc.fillColor('#1f3a2a');

function addTitle(text) {
  doc.fontSize(30).font('Helvetica-Bold').text(text, { align: 'center' });
  doc.moveDown(1.2);
}

function addSlideTitle(text) {
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#1f3a2a').text(text);
  doc.moveDown(0.8);
}

function addBody(text) {
  doc.fontSize(12).font('Helvetica').fillColor('#2b4e3a').text(text, { lineGap: 4 });
  doc.moveDown(1);
}

function addBullets(items) {
  items.forEach(item => {
    doc.fontSize(12).font('Helvetica').fillColor('#2b4e3a').text(`• ${item}`, { indent: 12, lineGap: 5 });
  });
  doc.moveDown(1);
}

function addNotes(notes) {
  if (notes) {
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#4f6f57').text(`Notes: ${notes}`, { lineGap: 4 });
    doc.moveDown(1);
  }
}

function addSlide(title, bullets, notes) {
  addSlideTitle(title);
  addBullets(bullets);
  addNotes(notes);
  doc.addPage();
}

addTitle('EcoLoop Presentation Script');
addBody('Use this document as your speaker notes during the demonstration. Each page is one slide with main points and talking prompts.');

addSlide('Slide 1: Introduction', [
  'Project name: EcoLoop',
  'Purpose: a smart waste management dashboard with incentives',
  'Roles supported: Administrator, Collector, Resident',
], 'Briefly introduce the team and the system goal: structured waste collection, better coordination, and rewards for users.');

addSlide('Slide 2: Problem Statement', [
  'Waste segregation is poorly tracked in many communities',
  'Collectors and residents lack a shared operational dashboard',
  'Incentives are not linked to actual waste behavior',
], 'Describe the real-world problem and why this project is needed.');

addSlide('Slide 3: Objectives', [
  'Create a role-based system for waste reporting and collection',
  'Make data visible through dashboards and analytics',
  'Provide incentives for users who practice proper segregation',
], 'Explain the general and specific goals of EcoLoop.');

addSlide('Slide 4: Core Features', [
  'Secure login for residents, collectors, and administrators',
  'Waste submission and pickup scheduling workflows',
  'Points, rewards, notifications, and reporting',
], 'Highlight the primary functionality available in the application.');

addSlide('Slide 5: Role-Based Features', [
  'Administrator: user management, analytics, notifications',
  'Collector: route assignments, pickup status updates',
  'Resident: submit waste entries, view points and rewards',
], 'Show how each user type gets a tailored dashboard experience.');

addSlide('Slide 6: System Architecture', [
  'Angular frontend handles the user interface and navigation',
  'Node.js + Express backend processes API requests',
  'MySQL database stores users, submissions, pickups, and rewards',
], 'Explain the flow: frontend → backend → database.');

addSlide('Slide 7: ACID and Data Integrity', [
  'Transactions ensure atomic operations for critical changes',
  'Consistency checks validate data before each update',
  'Isolation and locks prevent concurrent write conflicts',
  'Durability is supported through backups and DB persistence',
], 'Mention that the backend is designed for reliable data handling.');

addSlide('Slide 8: Demo Plan', [
  'Open the login page and enter credentials',
  'Show the administrator and resident dashboard views',
  'Demonstrate submitting a waste entry and checking analytics',
], 'Keep the demo focused, step-by-step, and use real screens.');

addSlide('Slide 9: Tools & Technologies', [
  'Frontend: Angular, TypeScript, HTML, CSS',
  'Backend: Node.js, Express, mysql2, MySQL',
  'Development environment: VS Code, Git, npm',
], 'List the technologies used to build the project.');

addSlide('Slide 10: Challenges Faced', [
  'Startup error handling and dependency alignment',
  'Ensuring backend MySQL connection and database schema',
  'Creating a polished, responsive interface for multiple roles',
], 'Talk briefly about the main development challenges and how they were solved.');

addSlide('Slide 11: Results', [
  'Functional waste management dashboard with role-specific views',
  'Live data operations including submissions, pickups, and rewards',
  'Working backend with MySQL integration and ACID support',
], 'Summarize what was accomplished in the project.');

addSlide('Slide 12: Future Enhancements', [
  'Add map-based pickup routing and live tracking',
  'Implement mobile-first design for field workers',
  'Add reporting exports and advanced analytics',
], 'Close the presentation with possible next steps for EcoLoop.');

addBody('Thank you for listening. We are ready to answer questions.');

doc.end();

stream.on('finish', () => {
  console.log(`PDF generated: ${outputPath}`);
});

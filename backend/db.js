const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const dataDir = process.env.JSON_DATA_DIR
  ? path.resolve(process.env.JSON_DATA_DIR)
  : path.join(__dirname, "data");
const dataFile = path.join(dataDir, "store.json");
const backupDir = path.join(dataDir, "backups");
const lockFile = path.join(dataDir, "db.lock");

// ACID Properties Implementation
class ACIDTransaction {
  constructor(storageMode, pool = null) {
    this.storageMode = storageMode;
    this.pool = pool;
    this.connection = null;
    this.backupData = null;
    this.operations = [];
    this.isActive = false;
  }

  async begin() {
    if (this.isActive) {
      throw new Error("Transaction already active");
    }

    this.isActive = true;
    this.operations = [];

    if (this.storageMode === "mysql") {
      this.connection = await this.pool.getConnection();
      await this.connection.beginTransaction();
    } else {
      // For JSON storage, acquire file lock and create backup
      await this.acquireLock();
      this.backupData = await this.readCurrentData();
    }
  }

  async commit() {
    if (!this.isActive) {
      throw new Error("No active transaction");
    }

    try {
      if (this.storageMode === "mysql") {
        await this.connection.commit();
      } else {
        // For JSON storage, write changes atomically
        await this.atomicWrite(this.backupData);
      }

      this.isActive = false;
      this.operations = [];
    } catch (error) {
      await this.rollback();
      throw error;
    } finally {
      if (this.connection) {
        this.connection.release();
        this.connection = null;
      }
      await this.releaseLock();
    }
  }

  async rollback() {
    if (!this.isActive) {
      throw new Error("No active transaction");
    }

    try {
      if (this.storageMode === "mysql") {
        await this.connection.rollback();
      } else {
        // For JSON storage, restore from backup
        if (this.backupData) {
          await this.atomicWrite(this.backupData);
        }
      }
    } finally {
      this.isActive = false;
      this.operations = [];
      if (this.connection) {
        this.connection.release();
        this.connection = null;
      }
      await this.releaseLock();
    }
  }

  async execute(operation, useConnection = false) {
    if (!this.isActive) {
      throw new Error("No active transaction");
    }

    this.operations.push(operation);

    try {
      if (this.storageMode === "mysql") {
        if (useConnection) {
          return await operation(this.connection);
        }

        const transactionData = await readStoreFromConnection(this.connection);
        const result = await operation(transactionData);
        await persistStore(this.connection, transactionData);
        return result;
      } else {
        return await operation(this.backupData);
      }
    } catch (error) {
      throw error;
    }
  }

  async acquireLock() {
    const maxRetries = 10;
    const retryDelay = 100;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Try to create lock file exclusively
        fs.writeFileSync(lockFile, process.pid.toString(), { flag: 'wx' });
        return;
      } catch (error) {
        if (error.code === 'EEXIST') {
          // Lock file exists, wait and retry
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        throw error;
      }
    }
    throw new Error("Could not acquire database lock");
  }

  async releaseLock() {
    try {
      if (fs.existsSync(lockFile)) {
        const pid = fs.readFileSync(lockFile, 'utf8');
        if (pid === process.pid.toString()) {
          fs.unlinkSync(lockFile);
        }
      }
    } catch (error) {
      // Ignore errors when releasing lock
    }
  }

  async readCurrentData() {
    ensureJsonSeedExists();
    const raw = fs.readFileSync(dataFile, "utf8").replace(/^\uFEFF/, "");
    return normalizeStore(JSON.parse(raw));
  }

  async atomicWrite(data) {
    const tempFile = `${dataFile}.tmp`;
    const backupFile = path.join(backupDir, `backup-${Date.now()}.json`);

    try {
      // Ensure backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Create backup of current state
      if (fs.existsSync(dataFile)) {
        fs.copyFileSync(dataFile, backupFile);
      }

      // Write to temporary file first
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));

      // Atomic move (rename) to final location
      fs.renameSync(tempFile, dataFile);

      // Clean up old backups (keep last 5)
      this.cleanupOldBackups();

    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      throw error;
    }
  }

  cleanupOldBackups() {
    try {
      const files = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('backup-'))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          timestamp: parseInt(file.replace('backup-', '').replace('.json', ''))
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // Keep only last 5 backups
      if (files.length > 5) {
        files.slice(5).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Global transaction manager
let currentTransaction = null;
let transactionQueue = [];

async function executeInTransaction(operation, useConnection = false) {
  return new Promise((resolve, reject) => {
    transactionQueue.push({ operation, useConnection, resolve, reject });
    processTransactionQueue();
  });
}

async function processTransactionQueue() {
  if (currentTransaction || transactionQueue.length === 0) {
    return;
  }

  const { operation, useConnection, resolve, reject } = transactionQueue.shift();
  currentTransaction = new ACIDTransaction(storageMode, pool);

  try {
    await currentTransaction.begin();
    const result = await currentTransaction.execute(operation, useConnection);
    await currentTransaction.commit();
    resolve(result);
  } catch (error) {
    if (currentTransaction.isActive) {
      try {
        await currentTransaction.rollback();
      } catch (rollbackError) {
        console.error("Transaction rollback failed:", rollbackError);
      }
    }
    reject(error);
  } finally {
    currentTransaction = null;
    // Process next transaction in queue
    setImmediate(processTransactionQueue);
  }
}

// Data Validation and Consistency Checks
function validateUser(user) {
  if (!user.id || typeof user.id !== 'string') {
    throw new Error('User ID is required and must be a string');
  }
  if (!user.username || typeof user.username !== 'string' || user.username.trim().length === 0) {
    throw new Error('Username is required and must be a non-empty string');
  }
  if (!user.password || typeof user.password !== 'string' || user.password.length === 0) {
    throw new Error('Password is required');
  }
  if (!user.name || typeof user.name !== 'string' || user.name.trim().length === 0) {
    throw new Error('Name is required and must be a non-empty string');
  }
  if (user.age !== undefined && (typeof user.age !== 'number' || user.age < 0 || user.age > 150)) {
    throw new Error('Age must be a number between 0 and 150');
  }
  if (!user.role || !['Administrator', 'Collector', 'Resident'].includes(user.role)) {
    throw new Error('Role must be Administrator, Collector, or Resident');
  }
  if (user.points !== undefined && (typeof user.points !== 'number' || user.points < 0)) {
    throw new Error('Points must be a non-negative number');
  }
}

function validateSubmission(submission) {
  if (!submission.id || typeof submission.id !== 'string') {
    throw new Error('Submission ID is required');
  }
  if (!submission.residentId || typeof submission.residentId !== 'string') {
    throw new Error('Resident ID is required');
  }
  if (!submission.wasteType || !['biodegradable', 'recyclable', 'residual', 'hazardous', 'electronic'].includes(submission.wasteType)) {
    throw new Error('Valid waste type is required');
  }
  if (!submission.weightKg || typeof submission.weightKg !== 'number' || submission.weightKg <= 0) {
    throw new Error('Weight must be a positive number');
  }
  if (!submission.location || typeof submission.location !== 'string') {
    throw new Error('Location is required');
  }
  if (submission.segregationScore === undefined || typeof submission.segregationScore !== 'number' ||
      submission.segregationScore < 0 || submission.segregationScore > 100) {
    throw new Error('Segregation score must be between 0 and 100');
  }
  if (!submission.status || !['Pending pickup', 'Verified', 'Collected', 'Rejected'].includes(submission.status)) {
    throw new Error('Invalid submission status');
  }
  if (submission.pointsEarned !== undefined && (typeof submission.pointsEarned !== 'number' || submission.pointsEarned < 0)) {
    throw new Error('Points earned must be a non-negative number');
  }
}

function validatePickup(pickup) {
  if (!pickup.id || typeof pickup.id !== 'string') {
    throw new Error('Pickup ID is required');
  }
  if (!pickup.collectorId || typeof pickup.collectorId !== 'string') {
    throw new Error('Collector ID is required');
  }
  if (!pickup.routeName || typeof pickup.routeName !== 'string') {
    throw new Error('Route name is required');
  }
  if (!pickup.scheduledDate || typeof pickup.scheduledDate !== 'string') {
    throw new Error('Scheduled date is required');
  }
  if (!pickup.status || !['Scheduled', 'In progress', 'Completed', 'Cancelled'].includes(pickup.status)) {
    throw new Error('Invalid pickup status');
  }
  if (pickup.loadKg !== undefined && (typeof pickup.loadKg !== 'number' || pickup.loadKg < 0)) {
    throw new Error('Load weight must be a non-negative number');
  }
  if (pickup.stops !== undefined && (typeof pickup.stops !== 'number' || pickup.stops < 0)) {
    throw new Error('Stops must be a non-negative number');
  }
}

function validateRewardRedemption(data, redemption) {
  const user = data.users.find(u => u.id === redemption.userId);
  const reward = data.rewards.find(r => r.id === redemption.rewardId);

  if (!user) {
    throw new Error('User not found for redemption');
  }
  if (!reward) {
    throw new Error('Reward not found for redemption');
  }
}

function checkDataConsistency(data) {
  const store = normalizeStore(data);

  // Check for duplicate IDs
  const userIds = new Set();
  const submissionIds = new Set();
  const pickupIds = new Set();
  const rewardIds = new Set();
  const redemptionIds = new Set();
  const notificationIds = new Set();
  const activityIds = new Set();

  for (const user of store.users) {
    if (userIds.has(user.id)) {
      throw new Error(`Duplicate user ID: ${user.id}`);
    }
    userIds.add(user.id);
    validateUser(user);
  }

  for (const submission of store.submissions) {
    if (submissionIds.has(submission.id)) {
      throw new Error(`Duplicate submission ID: ${submission.id}`);
    }
    submissionIds.add(submission.id);
    validateSubmission(submission);

    // Check that resident exists
    if (!store.users.some(u => u.id === submission.residentId)) {
      throw new Error(`Submission references non-existent resident: ${submission.residentId}`);
    }
  }

  for (const pickup of store.pickups) {
    if (pickupIds.has(pickup.id)) {
      throw new Error(`Duplicate pickup ID: ${pickup.id}`);
    }
    pickupIds.add(pickup.id);
    validatePickup(pickup);

    // Check that collector exists
    if (!store.users.some(u => u.id === pickup.collectorId)) {
      throw new Error(`Pickup references non-existent collector: ${pickup.collectorId}`);
    }
  }

  for (const reward of store.rewards) {
    if (rewardIds.has(reward.id)) {
      throw new Error(`Duplicate reward ID: ${reward.id}`);
    }
    rewardIds.add(reward.id);
  }

  for (const redemption of store.redemptions) {
    if (redemptionIds.has(redemption.id)) {
      throw new Error(`Duplicate redemption ID: ${redemption.id}`);
    }
    redemptionIds.add(redemption.id);
    validateRewardRedemption(store, redemption);
  }

  for (const notification of store.notifications) {
    if (notificationIds.has(notification.id)) {
      throw new Error(`Duplicate notification ID: ${notification.id}`);
    }
    notificationIds.add(notification.id);
  }

  for (const activity of store.activities) {
    if (activityIds.has(activity.id)) {
      throw new Error(`Duplicate activity ID: ${activity.id}`);
    }
    activityIds.add(activity.id);
  }

  return store;
}

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ecoloop",
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function isPasswordHash(value) {
  return String(value || "").startsWith("scrypt$");
}

function verifyPassword(password, storedHash) {
  const [algorithm, saltHex, hashHex, extra] = String(storedHash || "").split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex || extra) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (salt.length !== 16 || expected.length !== 64) {
      return false;
    }
    const actual = crypto.scryptSync(String(password), salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function migrateLegacyPasswords() {
  if (storageMode === "mysql") {
    const [users] = await getPool().query("SELECT id, password FROM users");
    for (const user of users) {
      if (!isPasswordHash(user.password)) {
        await getPool().query("UPDATE users SET password = ? WHERE id = ?", [
          hashPassword(user.password),
          user.id,
        ]);
      }
    }
    return;
  }

  const store = await readStore();
  if (store.users.some((user) => !isPasswordHash(user.password))) {
    await executeInTransaction(async (data) => {
      for (const user of data.users) {
        if (!isPasswordHash(user.password)) {
          user.password = hashPassword(user.password);
        }
      }
    });
  }

  if (fs.existsSync(backupDir)) {
    for (const file of fs.readdirSync(backupDir).filter((name) => name.startsWith("backup-") && name.endsWith(".json"))) {
      const backupPath = path.join(backupDir, file);
      const backupStore = normalizeStore(JSON.parse(fs.readFileSync(backupPath, "utf8")));
      let changed = false;
      for (const user of backupStore.users) {
        if (!isPasswordHash(user.password)) {
          user.password = hashPassword(user.password);
          changed = true;
        }
      }
      if (changed) {
        const tempPath = `${backupPath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(backupStore, null, 2));
        fs.renameSync(tempPath, backupPath);
      }
    }
  }
}

let pool;
let storageMode = "mysql";

const initialData = {
  users: [
    {
      id: "user-admin",
      username: "admin",
      password: "admin123",
      name: "Delord Pajo",
      role: "Administrator",
      barangay: "Katipunan, Villanueva, Misamis Oriental",
      points: 420,
    },
    {
      id: "user-resident",
      username: "resident",
      password: "eco123",
      name: "Mia Santos",
      role: "Resident",
      barangay: "Katipunan, Villanueva, Misamis Oriental",
      points: 185,
    },
    {
      id: "user-collector",
      username: "collector",
      password: "route123",
      name: "Noel Reyes",
      role: "Collector",
      barangay: "Katipunan, Villanueva, Misamis Oriental",
      points: 96,
    },
  ],
  bins: [
    {
      id: "bin-1",
      name: "Katipunan Smart Bin",
      location: "Katipunan, Villanueva, Misamis Oriental",
      fillLevel: 82,
      status: "Needs pickup",
      lastCollectedAt: "2026-04-01T03:30:00.000Z",
      sensorHealth: "Healthy",
      wasteType: "Mixed recyclables",
    },
    {
      id: "bin-2",
      name: "Villanueva Organics Bin",
      location: "Katipunan, Villanueva, Misamis Oriental",
      fillLevel: 43,
      status: "Normal",
      lastCollectedAt: "2026-04-02T08:15:00.000Z",
      sensorHealth: "Healthy",
      wasteType: "Biodegradable",
    },
    {
      id: "bin-3",
      name: "Misamis Oriental E-Waste Hub",
      location: "Katipunan, Villanueva, Misamis Oriental",
      fillLevel: 67,
      status: "Monitor",
      lastCollectedAt: "2026-03-30T10:45:00.000Z",
      sensorHealth: "Battery low",
      wasteType: "Electronic",
    },
  ],
  submissions: [
    {
      id: "sub-1",
      residentId: "user-resident",
      residentName: "Mia Santos",
      wasteType: "recyclable",
      weightKg: 4.5,
      location: "Katipunan, Villanueva, Misamis Oriental",
      segregationScore: 96,
      status: "Verified",
      pointsEarned: 23,
      submittedAt: "2026-04-02T02:15:00.000Z",
      notes: "Sorted PET bottles and paper.",
    },
    {
      id: "sub-2",
      residentId: "user-resident",
      residentName: "Mia Santos",
      wasteType: "biodegradable",
      weightKg: 3.2,
      location: "Katipunan, Villanueva, Misamis Oriental",
      segregationScore: 88,
      status: "Pending pickup",
      pointsEarned: 6,
      submittedAt: "2026-04-03T00:40:00.000Z",
      notes: "Kitchen scraps for composting.",
    },
  ],
  pickups: [
    {
      id: "pick-1",
      routeName: "Katipunan Collection Route",
      collectorId: "user-collector",
      collectorName: "Noel Reyes",
      scheduledDate: "2026-04-03",
      truck: "Truck 02",
      zone: "Katipunan, Villanueva, Misamis Oriental",
      status: "In progress",
      loadKg: 128,
      stops: 6,
    },
    {
      id: "pick-2",
      routeName: "Villanueva Eco Route",
      collectorId: "user-collector",
      collectorName: "Noel Reyes",
      scheduledDate: "2026-04-04",
      truck: "E-Trike 01",
      zone: "Katipunan, Villanueva, Misamis Oriental",
      status: "Scheduled",
      loadKg: 54,
      stops: 4,
    },
  ],
  rewards: [
    {
      id: "reward-1",
      title: "Rice Voucher",
      pointsCost: 120,
      stock: 15,
      partner: "Villanueva Community Coop",
      description: "Redeemable for a 2kg rice voucher.",
    },
    {
      id: "reward-2",
      title: "Utility Bill Credit",
      pointsCost: 200,
      stock: 7,
      partner: "Barangay Office",
      description: "Applies to community utility support credits.",
    },
    {
      id: "reward-3",
      title: "Eco Kit",
      pointsCost: 90,
      stock: 11,
      partner: "Green Youth Club",
      description: "Reusable bag, tumbler, and sorting labels.",
    },
  ],
  redemptions: [
    {
      id: "red-1",
      rewardId: "reward-3",
      rewardTitle: "Eco Kit",
      userId: "user-resident",
      userName: "Mia Santos",
      pointsSpent: 90,
      redeemedAt: "2026-04-01T05:00:00.000Z",
      status: "Claimed",
    },
  ],
  notifications: [
    {
      id: "note-1",
      userId: "user-resident",
      title: "Collector is on the way",
      message: "The assigned collector is heading to Katipunan, Villanueva, Misamis Oriental for today's waste pickup.",
      type: "Arrival",
      read: false,
      createdAt: "2026-04-03T00:55:00.000Z",
    },
    {
      id: "note-2",
      userId: "user-resident",
      title: "Waste collected successfully",
      message: "Your recyclable waste submission was marked as collected. Thank you for segregating properly.",
      type: "Collection",
      read: true,
      createdAt: "2026-04-03T03:00:00.000Z",
    },
  ],
  activities: [
    {
      id: "act-1",
      type: "Submission",
      actor: "Mia Santos",
      detail: "Submitted 3.2kg of biodegradable waste.",
      createdAt: "2026-04-03T00:40:00.000Z",
    },
    {
      id: "act-2",
      type: "Pickup",
      actor: "Noel Reyes",
      detail: "Started Morning North Route with Truck 02.",
      createdAt: "2026-04-03T01:00:00.000Z",
    },
  ],
};

const tableDefinitions = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(150) NOT NULL,
      age INT NOT NULL,
      address VARCHAR(255) NOT NULL,
      phone_number VARCHAR(50) NOT NULL,
      role VARCHAR(50) NOT NULL,
      barangay VARCHAR(255) NOT NULL,
      points INT NOT NULL DEFAULT 0
    )
  `,
  bins: `
    CREATE TABLE IF NOT EXISTS bins (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      location VARCHAR(255) NOT NULL,
      fill_level DECIMAL(10,2) NOT NULL,
      status VARCHAR(80) NOT NULL,
      last_collected_at VARCHAR(50),
      sensor_health VARCHAR(80),
      waste_type VARCHAR(100)
    )
  `,
  submissions: `
    CREATE TABLE IF NOT EXISTS submissions (
      id VARCHAR(50) PRIMARY KEY,
      resident_id VARCHAR(50) NOT NULL,
      resident_name VARCHAR(150) NOT NULL,
      waste_type VARCHAR(80) NOT NULL,
      weight_kg DECIMAL(10,2) NOT NULL,
      location VARCHAR(255) NOT NULL,
      segregation_score INT NOT NULL,
      status VARCHAR(80) NOT NULL,
      points_earned INT NOT NULL,
      submitted_at VARCHAR(50) NOT NULL,
      notes TEXT,
      CONSTRAINT fk_submissions_resident FOREIGN KEY (resident_id) REFERENCES users(id)
    )
  `,
  pickups: `
    CREATE TABLE IF NOT EXISTS pickups (
      id VARCHAR(50) PRIMARY KEY,
      route_name VARCHAR(150) NOT NULL,
      collector_id VARCHAR(50) NOT NULL,
      collector_name VARCHAR(150) NOT NULL,
      scheduled_date VARCHAR(20) NOT NULL,
      truck VARCHAR(120) NOT NULL,
      zone VARCHAR(255) NOT NULL,
      status VARCHAR(80) NOT NULL,
      load_kg DECIMAL(10,2) NOT NULL,
      stops INT NOT NULL,
      CONSTRAINT fk_pickups_collector FOREIGN KEY (collector_id) REFERENCES users(id)
    )
  `,
  rewards: `
    CREATE TABLE IF NOT EXISTS rewards (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(150) NOT NULL,
      points_cost INT NOT NULL,
      stock INT NOT NULL,
      partner VARCHAR(150) NOT NULL,
      description TEXT
    )
  `,
  redemptions: `
    CREATE TABLE IF NOT EXISTS redemptions (
      id VARCHAR(50) PRIMARY KEY,
      reward_id VARCHAR(50) NOT NULL,
      reward_title VARCHAR(150) NOT NULL,
      user_id VARCHAR(50) NOT NULL,
      user_name VARCHAR(150) NOT NULL,
      points_spent INT NOT NULL,
      redeemed_at VARCHAR(50) NOT NULL,
      status VARCHAR(80) NOT NULL,
      CONSTRAINT fk_redemptions_reward FOREIGN KEY (reward_id) REFERENCES rewards(id),
      CONSTRAINT fk_redemptions_user FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,
  notifications: `
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      title VARCHAR(150) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(80) NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at VARCHAR(50) NOT NULL,
      CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,
  activities: `
    CREATE TABLE IF NOT EXISTS activities (
      id VARCHAR(50) PRIMARY KEY,
      type VARCHAR(80) NOT NULL,
      actor VARCHAR(150) NOT NULL,
      detail TEXT NOT NULL,
      created_at VARCHAR(50) NOT NULL
    )
  `,
  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      expires_at BIGINT NOT NULL,
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,
};

const foreignKeys = [
  ["submissions", "fk_submissions_resident", "resident_id", "users", "id"],
  ["pickups", "fk_pickups_collector", "collector_id", "users", "id"],
  ["redemptions", "fk_redemptions_reward", "reward_id", "rewards", "id"],
  ["redemptions", "fk_redemptions_user", "user_id", "users", "id"],
  ["notifications", "fk_notifications_user", "user_id", "users", "id"],
  ["sessions", "fk_sessions_user", "user_id", "users", "id"],
];

const deleteOrder = [
  "sessions",
  "activities",
  "notifications",
  "redemptions",
  "rewards",
  "pickups",
  "submissions",
  "bins",
  "users",
];

function ensureJsonSeedExists() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2));
  }
}

function normalizeStore(data) {
  return {
    users: Array.isArray(data.users) ? data.users : [],
    bins: Array.isArray(data.bins) ? data.bins : [],
    submissions: Array.isArray(data.submissions) ? data.submissions : [],
    pickups: Array.isArray(data.pickups) ? data.pickups : [],
    rewards: Array.isArray(data.rewards) ? data.rewards : [],
    redemptions: Array.isArray(data.redemptions) ? data.redemptions : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    activities: Array.isArray(data.activities) ? data.activities : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
  };
}

function loadSeedData() {
  ensureJsonSeedExists();

  try {
    const raw = fs.readFileSync(dataFile, "utf8").replace(/^\uFEFF/, "");
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    return normalizeStore(initialData);
  }
}

async function initializeDatabase() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const bootstrapConnection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: process.env.DB_SSL === "true"
          ? {
            rejectUnauthorized: true,
            ca: process.env.DB_SSL_CA || undefined,
          }
          : undefined,
      });
      await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
      await bootstrapConnection.end();
    }

    pool = mysql.createPool({
      ...dbConfig,
      ssl: process.env.DB_SSL === "true"
        ? {
          rejectUnauthorized: true,
          ca: process.env.DB_SSL_CA || undefined,
        }
        : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    for (const definition of Object.values(tableDefinitions)) {
      await pool.query(definition);
    }

    const [existingForeignKeys] = await pool.query(
      "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
    );
    const existingForeignKeyNames = new Set(existingForeignKeys.map((row) => row.CONSTRAINT_NAME));
    for (const [table, constraint, column, referencedTable, referencedColumn] of foreignKeys) {
      if (!existingForeignKeyNames.has(constraint)) {
        await pool.query(
          `ALTER TABLE ${table} ADD CONSTRAINT ${constraint} FOREIGN KEY (${column}) REFERENCES ${referencedTable}(${referencedColumn})`,
        );
      }
    }

    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM users");
    if (rows[0].total === 0) {
      if (process.env.NODE_ENV === "production") {
        const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
        const password = process.env.INITIAL_ADMIN_PASSWORD;
        const name = process.env.INITIAL_ADMIN_NAME?.trim();
        if (
          !username || !/^[a-zA-Z0-9_.-]{3,100}$/.test(username) ||
          !name || name.length > 150 || !password || password.length < 12 || password.length > 256
        ) {
          throw new Error("Configure INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_NAME, and a 12+ character INITIAL_ADMIN_PASSWORD for an empty production database.");
        }
        await writeStore({
          ...normalizeStore(initialData),
          users: [{
            id: createId("user"),
            username,
            password: hashPassword(password),
            name,
            age: 0,
            address: "",
            phoneNumber: "",
            role: "Administrator",
            barangay: "",
            points: 0,
          }],
          submissions: [],
          pickups: [],
          redemptions: [],
          notifications: [],
          activities: [],
        });
      } else {
        await writeStore(loadSeedData());
      }
    }

    storageMode = "mysql";
    await migrateLegacyPasswords();
    return storageMode;
  } catch (error) {
    if (process.env.DB_STRICT === "true" || process.env.NODE_ENV === "production") {
      throw error;
    }

    ensureJsonSeedExists();
    storageMode = "json";
    pool = null;
    await migrateLegacyPasswords();
    return storageMode;
  }
}

function getPool() {
  if (!pool) {
    throw new Error("Database is not initialized.");
  }

  return pool;
}

async function readStore() {
  if (storageMode === "json") {
    ensureJsonSeedExists();
    const raw = fs.readFileSync(dataFile, "utf8").replace(/^\uFEFF/, "");
    return normalizeStore(JSON.parse(raw));
  }

  return readStoreFromConnection(getPool());
}

async function readStoreFromConnection(connection) {
  const [users] = await connection.query("SELECT * FROM users ORDER BY name ASC");
  const [bins] = await connection.query("SELECT * FROM bins ORDER BY name ASC");
  const [submissions] = await connection.query("SELECT * FROM submissions ORDER BY submitted_at DESC");
  const [pickups] = await connection.query("SELECT * FROM pickups ORDER BY scheduled_date DESC, route_name ASC");
  const [rewards] = await connection.query("SELECT * FROM rewards ORDER BY title ASC");
  const [redemptions] = await connection.query("SELECT * FROM redemptions ORDER BY redeemed_at DESC");
  const [notifications] = await connection.query("SELECT * FROM notifications ORDER BY created_at DESC");
  const [activities] = await connection.query("SELECT * FROM activities ORDER BY created_at DESC");
  const [sessions] = await connection.query("SELECT * FROM sessions");

  return {
    users: users.map((row) => ({
      id: row.id,
      username: row.username,
      password: row.password,
      name: row.name,
      age: Number(row.age || 0),
      address: row.address,
      phoneNumber: row.phone_number,
      role: row.role,
      barangay: row.barangay,
      points: Number(row.points || 0),
    })),
    bins: bins.map((row) => ({

      id: row.id,
      name: row.name,
      location: row.location,
      fillLevel: Number(row.fill_level || 0),
      status: row.status,
      lastCollectedAt: row.last_collected_at,
      sensorHealth: row.sensor_health,
      wasteType: row.waste_type,
    })),
    submissions: submissions.map((row) => ({
      id: row.id,
      residentId: row.resident_id,
      residentName: row.resident_name,
      wasteType: row.waste_type,
      weightKg: Number(row.weight_kg || 0),
      location: row.location,
      segregationScore: Number(row.segregation_score || 0),
      status: row.status,
      pointsEarned: Number(row.points_earned || 0),
      submittedAt: row.submitted_at,
      notes: row.notes || "",
    })),
    pickups: pickups.map((row) => ({
      id: row.id,
      routeName: row.route_name,
      collectorId: row.collector_id,
      collectorName: row.collector_name,
      scheduledDate: row.scheduled_date,
      truck: row.truck,
      zone: row.zone,
      status: row.status,
      loadKg: Number(row.load_kg || 0),
      stops: Number(row.stops || 0),
    })),
    rewards: rewards.map((row) => ({
      id: row.id,
      title: row.title,
      pointsCost: Number(row.points_cost || 0),
      stock: Number(row.stock || 0),
      partner: row.partner,
      description: row.description || "",
    })),
    redemptions: redemptions.map((row) => ({
      id: row.id,
      rewardId: row.reward_id,
      rewardTitle: row.reward_title,
      userId: row.user_id,
      userName: row.user_name,
      pointsSpent: Number(row.points_spent || 0),
      redeemedAt: row.redeemed_at,
      status: row.status,
    })),
    notifications: notifications.map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      message: row.message,
      type: row.type,
      read: Boolean(row.is_read),
      createdAt: row.created_at,
    })),
    activities: activities.map((row) => ({
      id: row.id,
      type: row.type,
      actor: row.actor,
      detail: row.detail,
      createdAt: row.created_at,
    })),
    sessions: sessions.map((row) => ({
      id: row.id,
      userId: row.user_id,
      expiresAt: Number(row.expires_at),
    })),
  };
}

async function persistStore(connection, store) {
  for (const tableName of deleteOrder) {
    await connection.query(`DELETE FROM ${tableName}`);
  }

  for (const user of store.users) {
    await connection.query(
      `INSERT INTO users (id, username, password, name, age, address, phone_number, role, barangay, points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.username,
        user.password,
        user.name,
        Number(user.age || 0),
        user.address || "",
        user.phoneNumber || "",
        user.role,
        user.barangay,
        Number(user.points || 0),
      ],
    );
  }

  for (const bin of store.bins) {
    await connection.query(
      `INSERT INTO bins (id, name, location, fill_level, status, last_collected_at, sensor_health, waste_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bin.id,
        bin.name,
        bin.location,
        Number(bin.fillLevel || 0),
        bin.status,
        bin.lastCollectedAt || null,
        bin.sensorHealth || null,
        bin.wasteType || null,
      ],
    );
  }

  for (const submission of store.submissions) {
    await connection.query(
      `INSERT INTO submissions (
        id, resident_id, resident_name, waste_type, weight_kg, location,
        segregation_score, status, points_earned, submitted_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        submission.id,
        submission.residentId,
        submission.residentName,
        submission.wasteType,
        Number(submission.weightKg || 0),
        submission.location,
        Number(submission.segregationScore || 0),
        submission.status,
        Number(submission.pointsEarned || 0),
        submission.submittedAt,
        submission.notes || "",
      ],
    );
  }

  for (const pickup of store.pickups) {
    await connection.query(
      `INSERT INTO pickups (
        id, route_name, collector_id, collector_name, scheduled_date,
        truck, zone, status, load_kg, stops
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pickup.id,
        pickup.routeName,
        pickup.collectorId,
        pickup.collectorName,
        pickup.scheduledDate,
        pickup.truck,
        pickup.zone,
        pickup.status,
        Number(pickup.loadKg || 0),
        Number(pickup.stops || 0),
      ],
    );
  }

  for (const reward of store.rewards) {
    await connection.query(
      `INSERT INTO rewards (id, title, points_cost, stock, partner, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        reward.id,
        reward.title,
        Number(reward.pointsCost || 0),
        Number(reward.stock || 0),
        reward.partner,
        reward.description || "",
      ],
    );
  }

  for (const redemption of store.redemptions) {
    await connection.query(
      `INSERT INTO redemptions (
        id, reward_id, reward_title, user_id, user_name, points_spent, redeemed_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        redemption.id,
        redemption.rewardId,
        redemption.rewardTitle,
        redemption.userId,
        redemption.userName,
        Number(redemption.pointsSpent || 0),
        redemption.redeemedAt,
        redemption.status,
      ],
    );
  }

  for (const notification of store.notifications) {
    await connection.query(
      `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        notification.id,
        notification.userId,
        notification.title,
        notification.message,
        notification.type,
        notification.read ? 1 : 0,
        notification.createdAt,
      ],
    );
  }

  for (const activity of store.activities) {
    await connection.query(
      `INSERT INTO activities (id, type, actor, detail, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [activity.id, activity.type, activity.actor, activity.detail, activity.createdAt],
    );
  }

  for (const session of store.sessions) {
    await connection.query(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
      [session.id, session.userId, session.expiresAt],
    );
  }
}

async function writeStore(data) {
  const store = normalizeStore(data);

  // Validate data consistency before writing (Consistency property)
  checkDataConsistency(store);

  return executeInTransaction(async (transactionData) => {
    if (storageMode === "mysql") {
      await persistStore(transactionData, store);
    } else {
      Object.assign(transactionData, store);
    }
  }, true);
}

function createId(prefix) {
  return `${prefix}-${crypto.randomBytes(3).toString("hex")}`;
}

function calculatePoints(wasteType, weightKg, segregationScore) {
  const rewardRates = {
    biodegradable: 2,
    recyclable: 5,
  };
  const rate = rewardRates[wasteType] || 1;
  const multiplier = segregationScore >= 95 ? 1.2 : segregationScore >= 85 ? 1 : 0.8;
  return Math.max(1, Math.round(weightKg * rate * multiplier));
}

// ACID-Compliant Operations
async function createSubmission(submissionData) {
  return executeInTransaction(async (data) => {
    const resident = data.users.find(u => u.id === submissionData.residentId);
    if (!resident) {
      throw new Error('Resident not found');
    }

    const pointsEarned = calculatePoints(submissionData.wasteType, submissionData.weightKg, submissionData.segregationScore);

    // Create submission
    const submission = {
      id: createId('sub'),
      residentId: submissionData.residentId,
      residentName: resident.name,
      wasteType: submissionData.wasteType,
      weightKg: submissionData.weightKg,
      location: submissionData.location,
      segregationScore: submissionData.segregationScore,
      status: 'Pending pickup',
      pointsEarned,
      submittedAt: new Date().toISOString(),
      notes: submissionData.notes || '',
    };

    // Validate submission
    validateSubmission(submission);

    // Update resident points atomically
    resident.points += pointsEarned;

    // Add submission to data
    data.submissions.unshift(submission);

    // Add activity
    data.activities.unshift({
      id: createId('act'),
      type: 'Submission',
      actor: resident.name,
      detail: `Submitted ${submissionData.weightKg}kg of ${submissionData.wasteType} waste and earned ${pointsEarned} points.`,
      createdAt: new Date().toISOString(),
    });

    // Keep only last 25 activities
    data.activities = data.activities.slice(0, 25);

    return { submission, user: resident };
  });
}

async function updateSubmissionStatus(submissionId, newStatus, collectorId = null) {
  return executeInTransaction(async (data) => {
    const submission = data.submissions.find(s => s.id === submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    const oldStatus = submission.status;
    submission.status = newStatus;

    // Validate the updated submission
    validateSubmission(submission);

    // Add activity
    data.activities.unshift({
      id: createId('act'),
      type: 'Verification',
      actor: 'System',
      detail: `${submission.residentName}'s submission is now ${newStatus}.`,
      createdAt: new Date().toISOString(),
    });

    // If status changed to 'Collected', add notification
    if (newStatus === 'Collected' && oldStatus !== 'Collected') {
      const notification = {
        id: createId('note'),
        userId: submission.residentId,
        title: 'Waste collected successfully',
        message: `Your ${submission.wasteType} waste at ${submission.location} has been collected.`,
        type: 'Collection',
        read: false,
        createdAt: new Date().toISOString(),
      };

      data.notifications.unshift(notification);
      data.notifications = data.notifications.slice(0, 100);
    }

    data.activities = data.activities.slice(0, 25);

    return submission;
  });
}

async function createPickup(pickupData) {
  return executeInTransaction(async (data) => {
    const collector = data.users.find(u => u.id === pickupData.collectorId);
    if (!collector) {
      throw new Error('Collector not found');
    }

    const pickup = {
      id: createId('pick'),
      routeName: pickupData.routeName,
      collectorId: pickupData.collectorId,
      collectorName: collector.name,
      scheduledDate: pickupData.scheduledDate,
      truck: pickupData.truck,
      zone: pickupData.zone,
      status: 'Scheduled',
      loadKg: Number(pickupData.loadKg) || 0,
      stops: Number(pickupData.stops) || 0,
    };

    // Validate pickup
    validatePickup(pickup);

    data.pickups.unshift(pickup);

    // Add activity
    data.activities.unshift({
      id: createId('act'),
      type: 'Pickup',
      actor: collector.name,
      detail: `Scheduled ${pickupData.routeName} for ${pickupData.scheduledDate}.`,
      createdAt: new Date().toISOString(),
    });

    data.activities = data.activities.slice(0, 25);

    return pickup;
  });
}

async function updatePickupStatus(pickupId, newStatus) {
  return executeInTransaction(async (data) => {
    const pickup = data.pickups.find(p => p.id === pickupId);
    if (!pickup) {
      throw new Error('Pickup not found');
    }

    const oldStatus = pickup.status;
    pickup.status = newStatus;

    // Validate the updated pickup
    validatePickup(pickup);

    // Add activity
    data.activities.unshift({
      id: createId('act'),
      type: 'Pickup',
      actor: pickup.collectorName,
      detail: `${pickup.routeName} marked as ${newStatus}.`,
      createdAt: new Date().toISOString(),
    });

    // If status changed to 'In progress', notify relevant residents
    if (newStatus === 'In progress' && oldStatus !== 'In progress') {
      const relevantSubmissions = data.submissions.filter(submission =>
        submission.status !== 'Collected' &&
        String(submission.location || '').toLowerCase().includes(String(pickup.zone || '').toLowerCase())
      );

      for (const submission of relevantSubmissions) {
        const notification = {
          id: createId('note'),
          userId: submission.residentId,
          title: 'Collector is on the way',
          message: `${pickup.collectorName} has started ${pickup.routeName} and may arrive soon in ${submission.location}.`,
          type: 'Arrival',
          read: false,
          createdAt: new Date().toISOString(),
        };

        data.notifications.unshift(notification);
      }

      data.notifications = data.notifications.slice(0, 100);
    }

    data.activities = data.activities.slice(0, 25);

    return pickup;
  });
}

async function redeemReward(redemptionData) {
  return executeInTransaction(async (data) => {
    const user = data.users.find(u => u.id === redemptionData.userId);
    const reward = data.rewards.find(r => r.id === redemptionData.rewardId);

    if (!user) {
      throw new Error('User not found');
    }
    if (!reward) {
      throw new Error('Reward not found');
    }
    if (user.points < reward.pointsCost) {
      throw new Error('Insufficient points');
    }
    if (reward.stock <= 0) {
      throw new Error('Reward out of stock');
    }

    // Deduct points and stock
    user.points -= reward.pointsCost;
    reward.stock -= 1;

    // Create redemption record
    const redemption = {
      id: createId('red'),
      rewardId: redemptionData.rewardId,
      rewardTitle: reward.title,
      userId: redemptionData.userId,
      userName: user.name,
      pointsSpent: reward.pointsCost,
      redeemedAt: new Date().toISOString(),
      status: 'Ready for claim',
    };

    data.redemptions.unshift(redemption);

    // Add activity
    data.activities.unshift({
      id: createId('act'),
      type: 'Reward',
      actor: user.name,
      detail: `Redeemed ${reward.title} for ${reward.pointsCost} points.`,
      createdAt: new Date().toISOString(),
    });

    data.activities = data.activities.slice(0, 25);

    return { redemption, user, reward };
  });
}

async function registerUser(userData) {
  const passwordHash = hashPassword(userData.password);
  return executeInTransaction(async (data) => {
    // Check for existing username
    const normalizedUsername = String(userData.username).trim().toLowerCase();
    const existingUser = data.users.find(u => u.username.toLowerCase() === normalizedUsername);

    if (existingUser) {
      throw new Error('Username already exists');
    }

    const user = {
      id: createId('user'),
      username: normalizedUsername,
      password: passwordHash,
      name: String(userData.name).trim(),
      age: Number(userData.age),
      address: String(userData.address).trim(),
      phoneNumber: String(userData.phoneNumber).trim(),
      role: 'Resident',
      barangay: String(userData.address).trim(),
      points: 0,
    };

    // Validate user
    validateUser(user);

    data.users.push(user);

    // Add activity
    data.activities.unshift({
      id: createId('act'),
      type: 'Registration',
      actor: user.name,
      detail: 'Created a resident account.',
      createdAt: new Date().toISOString(),
    });

    data.activities = data.activities.slice(0, 25);

    return user;
  });
}

async function createSession(sessionData) {
  return executeInTransaction(async (data) => {
    if (storageMode === "mysql") {
      await data.query("DELETE FROM sessions WHERE expires_at <= ?", [Date.now()]);
      await data.query(
        "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
        [sessionData.id, sessionData.userId, sessionData.expiresAt],
      );
      return;
    }

    data.sessions = data.sessions.filter((session) => session.expiresAt > Date.now());
    data.sessions.push({
      id: sessionData.id,
      userId: sessionData.userId,
      expiresAt: sessionData.expiresAt,
    });
  }, true);
}

async function getSession(sessionId) {
  if (storageMode === "mysql") {
    const [rows] = await getPool().query(
      "SELECT id, user_id, expires_at FROM sessions WHERE id = ? LIMIT 1",
      [sessionId],
    );
    if (!rows.length) {
      return null;
    }
    return {
      id: rows[0].id,
      userId: rows[0].user_id,
      expiresAt: Number(rows[0].expires_at),
    };
  }

  const data = await readStore();
  return data.sessions.find((session) => session.id === sessionId) || null;
}

async function deleteSession(sessionId) {
  return executeInTransaction(async (data) => {
    if (storageMode === "mysql") {
      await data.query("DELETE FROM sessions WHERE id = ?", [sessionId]);
      return;
    }
    data.sessions = data.sessions.filter((session) => session.id !== sessionId);
  }, true);
}

// Durability and Recovery Mechanisms
async function recoverFromBackup() {
  try {
    if (!fs.existsSync(backupDir)) {
      return false;
    }

    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup-'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        timestamp: parseInt(file.replace('backup-', '').replace('.json', ''))
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (files.length === 0) {
      return false;
    }

    // Try the most recent backup
    const latestBackup = files[0];
    const backupData = JSON.parse(fs.readFileSync(latestBackup.path, 'utf8'));

    // Validate the backup data
    checkDataConsistency(backupData);

    // Restore from backup
    await writeStore(backupData);

    console.log(`Recovered database from backup: ${latestBackup.name}`);
    return true;
  } catch (error) {
    console.error('Failed to recover from backup:', error);
    return false;
  }
}

async function validateAndRepairData() {
  try {
    const data = await readStore();

    // Check for data corruption
    checkDataConsistency(data);

    // If we get here, data is valid
    return true;
  } catch (error) {
    console.error('Data corruption detected:', error);

    // Attempt recovery
    const recovered = await recoverFromBackup();
    if (recovered) {
      console.log('Successfully recovered from backup');
      return true;
    }

    // If recovery fails, reinitialize with seed data
    console.log('Recovery failed, reinitializing with seed data');
    await writeStore(loadSeedData());
    return false;
  }
}

// Health check function for monitoring ACID compliance
async function performHealthCheck() {
  const results = {
    atomicity: true,
    consistency: true,
    isolation: true,
    durability: true,
    errors: [],
  };

  try {
    // Test consistency
    const data = await readStore();
    checkDataConsistency(data);
  } catch (error) {
    results.consistency = false;
    results.errors.push(`Consistency check failed: ${error.message}`);
  }

  // Test durability by checking backup integrity
  try {
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup-'));
      if (files.length > 0) {
        const latestBackup = files.sort().pop();
        const backupPath = path.join(backupDir, latestBackup);
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        checkDataConsistency(backupData);
      }
    }
  } catch (error) {
    results.durability = false;
    results.errors.push(`Durability check failed: ${error.message}`);
  }

  // Test isolation by checking for lock files
  if (fs.existsSync(lockFile)) {
    const lockAge = Date.now() - fs.statSync(lockFile).mtime.getTime();
    if (lockAge > 30000) { // 30 seconds
      results.isolation = false;
      results.errors.push('Stale lock file detected');
    }
  }

  return results;
}

// Initialize database with ACID validation
async function initializeDatabaseWithACID() {
  const mode = await initializeDatabase();

  // Perform initial health check
  await validateAndRepairData();

  return mode;
}

// Export health check functions
module.exports = {
  // ... existing exports ...
  recoverFromBackup,
  validateAndRepairData,
  performHealthCheck,
  initializeDatabase: initializeDatabaseWithACID,
};

function getAnalytics(data) {
  const totalWasteKg = data.submissions.reduce((sum, item) => sum + Number(item.weightKg || 0), 0);
  const totalPointsIssued =
    data.submissions.reduce((sum, item) => sum + Number(item.pointsEarned || 0), 0) +
    data.users.reduce((sum, user) => sum + Number(user.points || 0), 0);
  const pendingPickups = data.pickups.filter((item) => item.status !== "Completed").length;
  const binsNeedingPickup = data.bins.filter((bin) => bin.fillLevel >= 75).length;

  const wasteByType = Object.entries(
    data.submissions.reduce((acc, item) => {
      acc[item.wasteType] = (acc[item.wasteType] || 0) + Number(item.weightKg || 0);
      return acc;
    }, {})
  ).map(([label, value]) => ({ label, value: Number(value.toFixed(1)) }));

  const barangayLeaderboard = data.users
    .filter((user) => user.role === 'Resident')
    .map((user) => ({
      name: user.name,
      barangay: user.barangay,
      points: user.points,
      role: user.role,
    }))
    .sort((a, b) => b.points - a.points);

  return {
    totals: {
      users: data.users.length,
      totalWasteKg: Number(totalWasteKg.toFixed(1)),
      totalPointsIssued,
      pendingPickups,
      binsNeedingPickup,
      notifications: (data.notifications || []).length,
    },
    wasteByType,
    barangayLeaderboard,
  };
}

module.exports = {
  calculatePoints,
  createId,
  dbConfig,
  getAnalytics,
  hashPassword,
  initializeDatabase,
  getStorageMode: () => storageMode,
  readStore,
  writeStore,
  createSubmission,
  updateSubmissionStatus,
  createPickup,
  updatePickupStatus,
  redeemReward,
  registerUser,
  createSession,
  getSession,
  deleteSession,
  verifyPassword,
  performHealthCheck,
};

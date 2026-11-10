const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const {
  createId,
  dbConfig,
  getAnalytics,
  getStorageMode,
  initializeDatabase,
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
} = require("./db");
const {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
  signSession,
  verifySession,
} = require("./auth");

const app = express();
const port = process.env.PORT || 5050;
const angularDist = path.join(__dirname, "..", "frontend-angular", "dist", "frontend-angular", "browser");
const angularIndex = path.join(angularDist, "index.csr.html");
const legacyFrontend = path.join(__dirname, "..", "frontend");
const usingAngularFrontend = fs.existsSync(angularIndex);
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
if (isProduction && !usingAngularFrontend) {
  throw new Error("The Angular production build is required; refusing to serve the legacy frontend.");
}
const staticRoot = usingAngularFrontend ? angularDist : legacyFrontend;
const staticIndex = usingAngularFrontend ? angularIndex : path.join(legacyFrontend, "index.html");

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => cors({
  origin(origin, callback) {
    const requestOrigin = `${req.protocol}://${req.get("host")}`;
    if (!origin || origin === requestOrigin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin is not allowed by CORS."));
  },
  credentials: true,
})(req, res, next));
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use((req, res, next) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    req.body = {};
  }
  next();
});
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sanitizeUser(user) {
  const { password, ...sanitized } = user;
  return sanitized;
}

function requireRoles(...roles) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    next();
  };
}

async function authenticateSession(req, res, next) {
  const session = verifySession(readSessionCookie(req));
  if (!session) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }

  try {
    const storedSession = await getSession(session.sessionId);
    if (
      !storedSession ||
      storedSession.userId !== session.userId ||
      storedSession.expiresAt <= Date.now()
    ) {
      clearSessionCookie(res);
      return res.status(401).json({ message: "Your session has expired or been revoked." });
    }

    const data = await readStore();
    const user = data.users.find((item) => item.id === session.userId);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ message: "Your session is no longer valid." });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

const authAttempts = new Map();
function limitAuthAttempts(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const attempt = authAttempts.get(key);
  if (!attempt || now - attempt.startedAt >= 15 * 60 * 1000) {
    authAttempts.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (attempt.count >= 20) {
    return res.status(429).json({ message: "Too many sign-in attempts. Try again later." });
  }
  attempt.count += 1;
  next();
}

app.use((req, res, next) => {
  if (!isProduction) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// API routes here
app.get("/api/health", (req, res) => {
  const storageMode = getStorageMode();
  res.json({
    status: "ok",
    storage: storageMode,
    persistentStorage: storageMode === "mysql",
  });
});

app.post("/api/auth/login", limitAuthAttempts, asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password || password.length > 256) {
    return res.status(400).json({ message: "Username and password required." });
  }

  const data = await readStore();
  const user = data.users.find(
    (item) => item.username.toLowerCase() === username.trim().toLowerCase() && verifyPassword(password, item.password)
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const token = signSession(user.id);
  const session = verifySession(token);
  if (!session) {
    throw new Error("Could not create a valid authentication session.");
  }
  await createSession({
    id: session.sessionId,
    userId: user.id,
    expiresAt: session.expiresAt,
  });
  setSessionCookie(res, token);
  res.json({ user: sanitizeUser(user) });
}));

app.post("/api/auth/register", limitAuthAttempts, asyncHandler(async (req, res) => {
  const { name, age, address, phoneNumber, username, password } = req.body;

  if (typeof name !== "string" || !name.trim() || name.trim().length > 150) {
    return res.status(400).json({ message: "Enter your full name (up to 150 characters)." });
  }
  if (typeof username !== "string" || !/^[a-zA-Z0-9_.-]{3,100}$/.test(username.trim())) {
    return res.status(400).json({
      message: "Username must be 3-100 characters and use only letters, numbers, periods, underscores, or hyphens.",
    });
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 256) {
    return res.status(400).json({ message: "Password must be between 12 and 256 characters." });
  }
  if (age !== undefined && age !== null && (!Number.isInteger(Number(age)) || Number(age) < 1 || Number(age) > 120)) {
    return res.status(400).json({ message: "Age must be a whole number between 1 and 120." });
  }
  if (address !== undefined && (typeof address !== "string" || address.length > 255)) {
    return res.status(400).json({ message: "Address must be no more than 255 characters." });
  }
  if (phoneNumber !== undefined && (typeof phoneNumber !== "string" || phoneNumber.length > 50)) {
    return res.status(400).json({ message: "Contact number must be no more than 50 characters." });
  }

  const user = await registerUser({
    name,
    age: age || null,
    address: address || "",
    phoneNumber: phoneNumber || "",
    username,
    password,
  });

  res.status(201).json({ user: sanitizeUser(user) });
}));

app.post("/api/auth/logout", asyncHandler(async (req, res) => {
  const session = verifySession(readSessionCookie(req));
  if (session) {
    await deleteSession(session.sessionId);
  }
  clearSessionCookie(res);
  res.status(204).end();
}));

app.get("/api/auth/me", authenticateSession, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.use("/api", authenticateSession);

app.get("/api/bootstrap", asyncHandler(async (req, res) => {
  const data = await readStore();
  const isAdmin = req.user.role === "Administrator";
  const isCollector = req.user.role === "Collector";
  res.json({
    users: isAdmin ? data.users.map(sanitizeUser) : [sanitizeUser(req.user)],
    bins: data.bins,
    submissions: isAdmin || isCollector
      ? data.submissions
      : data.submissions.filter((item) => item.residentId === req.user.id),
    pickups: isAdmin || req.user.role === "Resident"
      ? data.pickups
      : data.pickups.filter((item) => item.collectorId === req.user.id),
    rewards: data.rewards,
    redemptions: isAdmin
      ? data.redemptions
      : data.redemptions.filter((item) => item.userId === req.user.id),
    notifications: (data.notifications || []).filter((item) => item.userId === req.user.id),
    activities: isAdmin || isCollector
      ? data.activities
      : data.activities.filter((item) => item.actor === req.user.name),
    analytics: getAnalytics(data),
  });
}));

// Static files after API routes
app.use(express.static(staticRoot));

app.post("/api/submissions", requireRoles("Resident"), asyncHandler(async (req, res) => {
  const { residentId, wasteType, weightKg, location, segregationScore, notes } = req.body;

  const numericWeight = Number(weightKg);
  const numericScore = Number(segregationScore);

  if (
    !["biodegradable", "recyclable", "residual", "hazardous", "electronic"].includes(wasteType) ||
    !Number.isFinite(numericWeight) || numericWeight <= 0 || numericWeight > 10000 ||
    typeof location !== "string" || !location.trim() || location.length > 255 ||
    !Number.isInteger(numericScore) || numericScore < 1 || numericScore > 100 ||
    (notes !== undefined && (typeof notes !== "string" || notes.length > 2000))
  ) {
    return res.status(400).json({ message: "Missing required submission fields." });
  }

  const result = await createSubmission({
    residentId: req.user.id,
    wasteType,
    weightKg: numericWeight,
    location,
    segregationScore: numericScore,
    notes,
  });

  const data = await readStore();
  res.status(201).json({
    submission: result.submission,
    user: sanitizeUser(result.user),
    analytics: getAnalytics(data),
    activities: data.activities,
  });
}));

app.patch("/api/submissions/:id/status", requireRoles("Administrator", "Collector"), asyncHandler(async (req, res) => {
  if (!["Pending pickup", "Verified", "Collected", "Rejected"].includes(req.body?.status)) {
    return res.status(400).json({ message: "Invalid submission status." });
  }
  const submission = await updateSubmissionStatus(req.params.id, req.body.status);

  const data = await readStore();
  res.json({ submission, analytics: getAnalytics(data), activities: data.activities });
}));

app.post("/api/submissions/:id/arrival", requireRoles("Administrator", "Collector"), asyncHandler(async (req, res) => {
  const data = await readStore();
  const submission = data.submissions.find((item) => item.id === req.params.id);

  if (!submission) {
    return res.status(404).json({ message: "Submission not found." });
  }

  const collector = req.user;

  const notification = addNotification(
    data,
    submission.residentId,
    "Collector arriving soon",
    `${collector.name} is on the way to ${submission.location} to collect your waste submission.`,
    "Arrival"
  );

  addActivity(data, "Arrival notice", collector.name, `Sent an arrival notification to ${submission.residentName}.`);
  await writeStore(data);

  res.status(201).json({ notification, activities: data.activities });
}));

app.post("/api/pickups", requireRoles("Administrator", "Collector"), asyncHandler(async (req, res) => {
  const { routeName, collectorId, scheduledDate, truck, zone, loadKg, stops } = req.body;
  const numericLoad = Number(loadKg);
  const numericStops = Number(stops);
  if (
    typeof routeName !== "string" || !routeName.trim() || routeName.length > 150 ||
    typeof scheduledDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) ||
    Number.isNaN(Date.parse(`${scheduledDate}T00:00:00Z`)) ||
    typeof truck !== "string" || !truck.trim() || truck.length > 120 ||
    typeof zone !== "string" || !zone.trim() || zone.length > 255 ||
    (req.user.role === "Administrator" && typeof collectorId !== "string") ||
    !Number.isFinite(numericLoad) || numericLoad < 0 ||
    !Number.isInteger(numericStops) || numericStops < 0
  ) {
    return res.status(400).json({ message: "Valid route, date, truck, zone, load, and stop values are required." });
  }

  const pickup = await createPickup({
    routeName,
    collectorId: req.user.role === "Collector" ? req.user.id : collectorId,
    scheduledDate,
    truck,
    zone,
    loadKg: numericLoad,
    stops: numericStops,
  });

  const data = await readStore();
  res.status(201).json({ pickup, analytics: getAnalytics(data), activities: data.activities });
}));

app.patch("/api/pickups/:id/status", requireRoles("Administrator", "Collector"), asyncHandler(async (req, res) => {
  if (!["Scheduled", "In progress", "Completed", "Cancelled"].includes(req.body?.status)) {
    return res.status(400).json({ message: "Invalid pickup status." });
  }
  const pickup = await updatePickupStatus(req.params.id, req.body.status);

  const data = await readStore();
  res.json({ pickup, analytics: getAnalytics(data), activities: data.activities });
}));

app.get("/api/notifications/:userId", asyncHandler(async (req, res) => {
  if (req.params.userId !== req.user.id && req.user.role !== "Administrator") {
    return res.status(403).json({ message: "You do not have permission to view these notifications." });
  }
  const data = await readStore();
  const notifications = (data.notifications || [])
    .filter((item) => item.userId === req.params.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ notifications });
}));

app.patch("/api/notifications/:id/read", asyncHandler(async (req, res) => {
  const data = await readStore();
  const notification = (data.notifications || []).find((item) => item.id === req.params.id);

  if (!notification) {
    return res.status(404).json({ message: "Notification not found." });
  }
  if (notification.userId !== req.user.id && req.user.role !== "Administrator") {
    return res.status(403).json({ message: "You do not have permission to update this notification." });
  }

  notification.read = true;
  await writeStore(data);
  res.json({ notification });
}));

app.post("/api/bins", requireRoles("Administrator"), asyncHandler(async (req, res) => {
  const data = await readStore();
  const { name, location, fillLevel, sensorHealth, wasteType } = req.body;
  const numericFill = Number(fillLevel);
  if (
    typeof name !== "string" || !name.trim() || name.length > 150 ||
    typeof location !== "string" || !location.trim() || location.length > 255 ||
    !Number.isFinite(numericFill) || numericFill < 0 || numericFill > 100 ||
    typeof wasteType !== "string" || !wasteType.trim() || wasteType.length > 100
  ) {
    return res.status(400).json({ message: "Valid bin name, location, fill level, and waste type are required." });
  }

  const bin = {
    id: createId("bin"),
    name: name.trim(),
    location: location.trim(),
    fillLevel: numericFill,
    status: numericFill >= 75 ? "Needs pickup" : numericFill >= 50 ? "Monitor" : "Normal",
    lastCollectedAt: new Date().toISOString(),
    sensorHealth: sensorHealth || "Healthy",
    wasteType,
  };

  data.bins.unshift(bin);
  addActivity(data, "Smart bin", "System", `${name} registered at ${location}.`);
  await writeStore(data);

  res.status(201).json({ bin, analytics: getAnalytics(data), activities: data.activities });
}));

app.patch("/api/bins/:id/fill", requireRoles("Administrator"), asyncHandler(async (req, res) => {
  const data = await readStore();
  const bin = data.bins.find((item) => item.id === req.params.id);

  if (!bin) {
    return res.status(404).json({ message: "Smart bin not found." });
  }

  const fillLevel = Number(req.body.fillLevel);
  if (!Number.isFinite(fillLevel) || fillLevel < 0 || fillLevel > 100) {
    return res.status(400).json({ message: "Fill level must be between 0 and 100." });
  }
  bin.fillLevel = fillLevel;
  bin.status = fillLevel >= 75 ? "Needs pickup" : fillLevel >= 50 ? "Monitor" : "Normal";
  if (fillLevel < 20) {
    bin.lastCollectedAt = new Date().toISOString();
  }

  addActivity(data, "Smart bin", "Sensor feed", `${bin.name} updated to ${fillLevel}% full.`);
  await writeStore(data);

  res.json({ bin, analytics: getAnalytics(data), activities: data.activities });
}));

app.post("/api/redemptions", requireRoles("Resident"), asyncHandler(async (req, res) => {
  const { rewardId, userId } = req.body;

  if (typeof rewardId !== "string") {
    return res.status(400).json({ message: "A reward is required." });
  }
  const result = await redeemReward({ rewardId, userId: req.user.id });

  const data = await readStore();
  res.status(201).json({
    redemption: result.redemption,
    user: sanitizeUser(result.user),
    rewards: data.rewards,
    redemptions: data.redemptions,
    analytics: getAnalytics(data),
    activities: data.activities,
  });
}));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(staticIndex);
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body must contain valid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large." });
  }
  if (error.message === "Origin is not allowed by CORS.") {
    return res.status(403).json({ message: "Origin is not allowed." });
  }
  if (error.code === "ER_DUP_ENTRY" || error.message === "Username already exists") {
    return res.status(409).json({ message: "That username is already in use." });
  }
  const mysqlHint = error.code === "ECONNREFUSED" || error.code === "ER_ACCESS_DENIED_ERROR"
    ? ` Check backend/.env and make sure MySQL is running on ${dbConfig.host}:${dbConfig.port}.`
    : "";
  res.status(500).json({
    message: isProduction ? "Server error." : `Server error.${mysqlHint}`.trim(),
  });
});

initializeDatabase()
  .then((mode) => {
    console.log("Database initialized with mode:", mode);
    app.listen(port, () => {
      console.log(`Smart waste management server running on port ${port}`);
      console.log(`Serving frontend from: ${staticRoot}`);
      if (mode === "mysql") {
        console.log(`MySQL database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
      } else {
        console.log("MySQL is unavailable. Using local JSON fallback storage from backend/data/store.json");
      }
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MySQL:", error.message);
    if (isProduction) {
      process.exitCode = 1;
      return;
    }
    app.listen(port, () => {
      console.log(`Smart waste management server running on port ${port} (without database)`);
      console.log(`Serving frontend from: ${staticRoot}`);
    });
  });

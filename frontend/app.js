const state = {
  currentUser: null,
  data: null,
  activeView: "overview",
};

const api = {
  async request(url, options = {}) {
    let response;

    try {
      response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        ...options,
      });
    } catch (error) {
      throw new Error("Cannot connect to the local server on port 5050.");
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || `Request failed with status ${response.status}.`);
    }

    return payload;
  },
};

const elements = {};
const roleViewAccess = {
  Administrator: ["overview", "submissions", "pickups", "notifications", "analytics", "users"],
  Collector: ["overview", "submissions", "pickups", "notifications", "analytics"],
  Resident: ["overview", "submissions", "pickups", "notifications", "rewards", "analytics"],
};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  elements.scheduledDate.value = new Date().toISOString().slice(0, 10);
});

function cacheElements() {
  Object.assign(elements, {
    loginPage: document.getElementById("loginPage"),
    loginForm: document.getElementById("loginForm"),
    loginError: document.getElementById("loginError"),
    registerForm: document.getElementById("registerForm"),
    registerMessage: document.getElementById("registerMessage"),
    registerError: document.getElementById("registerError"),
    app: document.getElementById("app"),
    appMessage: document.getElementById("appMessage"),
    sidebar: document.getElementById("sidebar"),
    sidebarToggleBtn: document.getElementById("sidebarToggleBtn"),
    sidebarCloseBtn: document.getElementById("sidebarCloseBtn"),
    sidebarUser: document.getElementById("sidebarUser"),
    welcomeTitle: document.getElementById("welcomeTitle"),
    roleBadge: document.getElementById("roleBadge"),
    pointBalance: document.getElementById("pointBalance"),
    metricsGrid: document.getElementById("metricsGrid"),
    activityFeed: document.getElementById("activityFeed"),
    residentNoticePanel: document.getElementById("residentNoticePanel"),
    residentNotificationsPreview: document.getElementById("residentNotificationsPreview"),
    submissionsTable: document.getElementById("submissionsTable"),
    pickupList: document.getElementById("pickupList"),
    notificationList: document.getElementById("notificationList"),
    rewardGrid: document.getElementById("rewardGrid"),
    redemptionList: document.getElementById("redemptionList"),
    wasteChart: document.getElementById("wasteChart"),
    leaderboard: document.getElementById("leaderboard"),
    usersList: document.getElementById("usersList"),
    logoutBtn: document.getElementById("logoutBtn"),
    wasteForm: document.getElementById("wasteForm"),
    pickupForm: document.getElementById("pickupForm"),
    scheduledDate: document.getElementById("scheduledDate"),
  });
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.registerForm.addEventListener("submit", handleRegister);
  elements.logoutBtn.addEventListener("click", logout);
  elements.wasteForm.addEventListener("submit", submitWaste);
  elements.pickupForm.addEventListener("submit", createPickup);
  elements.sidebarToggleBtn.addEventListener("click", () => setSidebarOpen(true));
  elements.sidebarCloseBtn.addEventListener("click", () => setSidebarOpen(false));

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
      if (window.innerWidth <= 1100) {
        setSidebarOpen(false);
      }
    });
  });

  document.addEventListener("click", async (event) => {
    const { action, id, value } = event.target.dataset;
    if (!action) {
      return;
    }

    try {
      if (action === "submission-status") {
        await api.request(`/api/submissions/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: value }),
        });
        showAppMessage(`Submission marked as ${value}.`);
      }

      if (action === "pickup-status") {
        await api.request(`/api/pickups/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: value }),
        });
        showAppMessage(`Pickup route marked as ${value}.`);
      }

      if (action === "notify-arrival") {
        await api.request(`/api/submissions/${id}/arrival`, {
          method: "POST",
          body: JSON.stringify({ collectorId: state.currentUser.id }),
        });
        showAppMessage("Resident notified successfully.");
      }

      if (action === "read-notification") {
        await api.request(`/api/notifications/${id}/read`, {
          method: "PATCH",
        });
        showAppMessage("Notification marked as read.");
      }

      if (action === "redeem") {
        await api.request("/api/redemptions", {
          method: "POST",
          body: JSON.stringify({ rewardId: id, userId: state.currentUser.id }),
        });
      }

      await loadDashboard();
    } catch (error) {
      alert(error.message);
    }
  });
}

async function handleLogin(event) {
  event.preventDefault();
  elements.loginError.textContent = "";
  elements.registerMessage.textContent = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const { user } = await api.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    state.currentUser = user;
    await loadDashboard();
    elements.app.classList.remove("hidden");
    elements.loginPage.classList.add("hidden");
  } catch (error) {
    elements.loginError.textContent = error.message;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  elements.registerMessage.textContent = "";
  elements.registerError.textContent = "";

  try {
    const payload = {
      name: document.getElementById("registerName").value.trim(),
      barangay: document.getElementById("registerBarangay").value.trim(),
      username: document.getElementById("registerUsername").value.trim(),
      password: document.getElementById("registerPassword").value.trim(),
    };

    const { user } = await api.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    elements.registerForm.reset();
    document.getElementById("registerBarangay").value = "Katipunan, Villanueva, Misamis Oriental";
    elements.registerMessage.textContent = `${user.name} was registered successfully. You can now log in with @${user.username}.`;
    document.getElementById("username").value = user.username;
    document.getElementById("password").value = "";
  } catch (error) {
    elements.registerError.textContent = error.message;
  }
}

function logout() {
  state.currentUser = null;
  state.data = null;
  elements.app.classList.add("hidden");
  elements.loginPage.classList.remove("hidden");
  elements.loginForm.reset();
  elements.registerMessage.textContent = "";
  elements.loginError.textContent = "";
  clearAppMessage();
  setSidebarOpen(false);
}

async function loadDashboard() {
  const data = await api.request("/api/bootstrap");
  state.data = data;
  syncCurrentUser();
  render();
}

function syncCurrentUser() {
  if (!state.currentUser || !state.data) {
    return;
  }

  const latestUser = state.data.users.find((user) => user.id === state.currentUser.id);
  if (latestUser) {
    state.currentUser = latestUser;
  }
}

function render() {
  renderHeader();
  renderMetrics();
  renderActivities();
  renderSubmissions();
  renderPickups();
  renderNotifications();
  renderRewards();
  renderRedemptions();
  renderWasteChart();
  renderLeaderboard();
  renderUsers();
  renderPermissions();
  setView(state.activeView);
}

function renderHeader() {
  elements.sidebarUser.textContent = `${state.currentUser.name} · ${state.currentUser.barangay}`;
  elements.welcomeTitle.textContent = `${state.currentUser.name}'s smart waste dashboard`;
  elements.roleBadge.textContent = state.currentUser.role;
  elements.pointBalance.textContent = `${state.currentUser.points} pts`;
}

function renderPermissions() {
  const allowedViews = roleViewAccess[state.currentUser.role] || ["overview"];

  document.querySelectorAll(".nav-item").forEach((button) => {
    const allowed = allowedViews.includes(button.dataset.view);
    button.classList.toggle("hidden", !allowed);
  });

  elements.wasteForm.closest(".panel").classList.toggle("hidden", state.currentUser.role !== "Resident");
  elements.pickupForm.closest(".panel").classList.toggle("hidden", state.currentUser.role === "Resident");
  elements.residentNoticePanel.classList.toggle("hidden", state.currentUser.role !== "Resident");

  if (!allowedViews.includes(state.activeView)) {
    state.activeView = "overview";
  }
}

function renderMetrics() {
  const metrics = [
    { label: "Registered users", value: state.data.analytics.totals.users },
    { label: "Waste collected", value: `${state.data.analytics.totals.totalWasteKg} kg` },
    { label: "Pending pickups", value: state.data.analytics.totals.pendingPickups },
    { label: "Notifications", value: getUserNotifications().filter((item) => !item.read).length },
    { label: `${state.currentUser.name.split(" ")[0]}'s points`, value: state.currentUser.points },
  ];

  elements.metricsGrid.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric-card">
          <p>${metric.label}</p>
          <strong>${metric.value}</strong>
        </article>
      `
    )
    .join("");
}

function renderActivities() {
  elements.activityFeed.innerHTML = state.data.activities
    .slice(0, 8)
    .map(
      (activity) => `
        <article class="timeline-item">
          <div class="row-top">
            <strong>${activity.type}</strong>
            <span class="status-chip">${formatDateTime(activity.createdAt)}</span>
          </div>
          <p>${activity.actor}</p>
          <p class="muted">${activity.detail}</p>
        </article>
      `
    )
    .join("");
}

function renderSubmissions() {
  const canReview = state.currentUser.role !== "Resident";
  const visibleSubmissions = canReview
    ? state.data.submissions
    : state.data.submissions.filter((submission) => submission.residentId === state.currentUser.id);

  elements.submissionsTable.innerHTML = visibleSubmissions
    .map((submission) => {
      const tone = getStatusTone(submission.status);
      return `
        <article class="data-row">
          <div class="row-top">
            <strong>${submission.residentName}</strong>
            <span class="status-chip ${tone}">${submission.status}</span>
          </div>
          <div class="row-meta">
            <p>${titleCase(submission.wasteType)} · ${submission.weightKg} kg · ${submission.pointsEarned} pts</p>
            <p>${submission.location}</p>
          </div>
          <p class="muted">Segregation score: ${submission.segregationScore} · ${formatDateTime(submission.submittedAt)}</p>
          <p>${submission.notes || "No notes provided."}</p>
          ${
            canReview
              ? `<div class="action-row">
                  <button class="status-btn" data-action="notify-arrival" data-id="${submission.id}">Notify arriving</button>
                  <button class="status-btn" data-action="submission-status" data-id="${submission.id}" data-value="Collected">Collected</button>
                </div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderPickups() {
  elements.pickupList.innerHTML = state.data.pickups
    .map((pickup) => `
      <article class="pickup-card">
        <div class="row-top">
          <strong>${pickup.routeName}</strong>
          <span class="status-chip ${getStatusTone(pickup.status)}">${pickup.status}</span>
        </div>
        <div class="row-meta">
          <p>${pickup.zone} · ${pickup.truck}</p>
          <p>${pickup.collectorName}</p>
        </div>
        <div class="row-meta">
          <p>${pickup.loadKg} kg forecast</p>
          <p>${pickup.stops} stops · ${pickup.scheduledDate}</p>
        </div>
        ${
          state.currentUser.role === "Resident"
            ? ""
            : `<div class="action-row">
                <button class="status-btn" data-action="pickup-status" data-id="${pickup.id}" data-value="In progress">Start route</button>
                <button class="status-btn" data-action="pickup-status" data-id="${pickup.id}" data-value="Completed">Complete route</button>
              </div>`
        }
      </article>
    `)
    .join("");
}

function renderNotifications() {
  const notifications = getUserNotifications();

  const markup = notifications.length
    ? notifications
        .map(
          (notification) => `
            <article class="notification-card ${notification.read ? "" : "unread"}">
              <div class="row-top">
                <strong>${notification.title}</strong>
                <span class="status-chip ${notification.type === "Arrival" ? "warn" : ""}">${notification.type}</span>
              </div>
              <p>${notification.message}</p>
              <div class="row-meta">
                <p>${formatDateTime(notification.createdAt)}</p>
                ${
                  notification.read
                    ? "<p class=\"muted\">Read</p>"
                    : `<button class="ghost-inline-btn" data-action="read-notification" data-id="${notification.id}">Mark as read</button>`
                }
              </div>
            </article>
          `
        )
        .join("")
    : `<article class="data-row"><p>No notifications yet. Arrival and collection updates will appear here.</p></article>`;

  elements.notificationList.innerHTML = markup;
  elements.residentNotificationsPreview.innerHTML = notifications
    .slice(0, 2)
    .map(
      (notification) => `
        <article class="notification-card ${notification.read ? "" : "unread"}">
          <div class="row-top">
            <strong>${notification.title}</strong>
            <span class="status-chip ${notification.type === "Arrival" ? "warn" : ""}">${notification.type}</span>
          </div>
          <p>${notification.message}</p>
          <p class="muted">${formatDateTime(notification.createdAt)}</p>
        </article>
      `
    )
    .join("") || `<article class="data-row"><p>No resident alerts yet.</p></article>`;
}

function renderRewards() {
  if (state.currentUser.role !== "Resident") {
    elements.rewardGrid.innerHTML = "";
    return;
  }

  elements.rewardGrid.innerHTML = state.data.rewards
    .map((reward) => {
      const insufficient = state.currentUser.points < reward.pointsCost || reward.stock === 0;
      return `
        <article class="reward-card">
          <div class="row-top">
            <strong>${reward.title}</strong>
            <span class="status-chip">${reward.pointsCost} pts</span>
          </div>
          <p>${reward.description}</p>
          <div class="row-meta">
            <p>${reward.partner}</p>
            <p>${reward.stock} remaining</p>
          </div>
          <button class="primary-btn" data-action="redeem" data-id="${reward.id}" ${insufficient ? "disabled" : ""}>Redeem reward</button>
        </article>
      `;
    })
    .join("");
}

function renderRedemptions() {
  if (state.currentUser.role !== "Resident") {
    elements.redemptionList.innerHTML = "";
    return;
  }

  const visibleRedemptions = state.currentUser.role === "Administrator"
    ? state.data.redemptions
    : state.data.redemptions.filter((redemption) => redemption.userId === state.currentUser.id);

  elements.redemptionList.innerHTML = visibleRedemptions
    .slice(0, 8)
    .map(
      (redemption) => `
        <article class="data-row">
          <div class="row-top">
            <strong>${redemption.rewardTitle}</strong>
            <span class="status-chip">${redemption.status}</span>
          </div>
          <div class="row-meta">
            <p>${redemption.userName}</p>
            <p>${redemption.pointsSpent} pts</p>
          </div>
          <p class="muted">${formatDateTime(redemption.redeemedAt)}</p>
        </article>
      `
    )
    .join("");
}

function renderWasteChart() {
  const values = state.data.analytics.wasteByType;
  const max = Math.max(...values.map((item) => item.value), 1);

  elements.wasteChart.innerHTML = values
    .map(
      (item) => `
        <div class="chart-row">
          <div class="chart-label">
            <span>${titleCase(item.label)}</span>
            <span>${item.value} kg</span>
          </div>
          <div class="chart-track"><span style="width: ${(item.value / max) * 100}%"></span></div>
        </div>
      `
    )
    .join("");
}

function renderLeaderboard() {
  elements.leaderboard.innerHTML = state.data.analytics.barangayLeaderboard
    .map(
      (user, index) => `
        <article class="leader-row">
          <div class="row-top">
            <span class="rank-badge">${index + 1}</span>
            <div>
              <strong>${user.name}</strong>
              <p class="muted">${user.role} · ${user.barangay}</p>
            </div>
          </div>
          <strong>${user.points} pts</strong>
        </article>
      `
    )
    .join("");
}

function renderUsers() {
  const isAdmin = state.currentUser.role === "Administrator";
  const visibleUsers = isAdmin
    ? state.data.users
    : state.data.users.filter((user) => user.id === state.currentUser.id);

  elements.usersList.innerHTML = visibleUsers
    .map(
      (user) => `
        <article class="data-row">
          <div class="row-top">
            <strong>${user.name}</strong>
            <span class="status-chip">${user.role}</span>
          </div>
          <div class="row-meta">
            <p>@${user.username}</p>
            <p>${user.points} pts</p>
          </div>
          <p class="muted">${user.barangay}</p>
        </article>
      `
    )
    .join("");
}

function setView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `${viewName}View`);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
}

function setSidebarOpen(isOpen) {
  if (!elements.sidebar) {
    return;
  }

  elements.sidebar.classList.toggle("sidebar-open", isOpen);
}

async function submitWaste(event) {
  event.preventDefault();

  try {
    await api.request("/api/submissions", {
      method: "POST",
      body: JSON.stringify({
        residentId: state.currentUser.id,
        wasteType: document.getElementById("wasteType").value,
        weightKg: document.getElementById("weightKg").value,
        location: document.getElementById("wasteLocation").value.trim(),
        segregationScore: document.getElementById("segregationScore").value,
        notes: document.getElementById("wasteNotes").value.trim(),
      }),
    });

    event.target.reset();
    document.getElementById("segregationScore").value = 90;
    await loadDashboard();
    setView("submissions");
  } catch (error) {
    alert(error.message);
  }
}

async function createPickup(event) {
  event.preventDefault();
  const collector = pickCollector();

  try {
    await api.request("/api/pickups", {
      method: "POST",
      body: JSON.stringify({
        routeName: document.getElementById("routeName").value.trim(),
        collectorId: collector.id,
        scheduledDate: document.getElementById("scheduledDate").value,
        truck: document.getElementById("truck").value.trim(),
        zone: document.getElementById("pickupZone").value.trim(),
        loadKg: document.getElementById("loadKg").value,
        stops: document.getElementById("stops").value,
      }),
    });

    event.target.reset();
    elements.scheduledDate.value = new Date().toISOString().slice(0, 10);
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
}

function pickCollector() {
  if (state.currentUser.role === "Collector") {
    return state.currentUser;
  }

  return state.data.users.find((user) => user.role === "Collector") || state.currentUser;
}

function getUserNotifications() {
  return (state.data.notifications || [])
    .filter((notification) => notification.userId === state.currentUser.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getStatusTone(status) {
  const normalized = status.toLowerCase();
  if (normalized.includes("need") || normalized.includes("hazard") || normalized.includes("alert")) {
    return "alert";
  }
  if (normalized.includes("pending") || normalized.includes("monitor") || normalized.includes("progress") || normalized.includes("ready")) {
    return "warn";
  }
  return "";
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function titleCase(value) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function showAppMessage(message) {
  if (!elements.appMessage) {
    return;
  }

  elements.appMessage.textContent = message;
  window.clearTimeout(showAppMessage.timeoutId);
  showAppMessage.timeoutId = window.setTimeout(() => {
    clearAppMessage();
  }, 3000);
}

function clearAppMessage() {
  if (!elements.appMessage) {
    return;
  }

  elements.appMessage.textContent = "";
}

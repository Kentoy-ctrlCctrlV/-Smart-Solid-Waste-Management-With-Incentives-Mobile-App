import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  Activity,
  Api,
  BootstrapData,
  Notification,
  Pickup,
  Redemption,
  Reward,
  Submission,
  User,
  WasteByType,
} from '../api';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  currentUser: User | null = null;
  data: BootstrapData | null = null;
  activeView = 'overview';
  sidebarOpen = false;
  appMessage = '';
  loadError = '';
  isLoading = true;

  wasteForm = {
    wasteType: 'biodegradable',
    weightKg: null as number | null,
    location: '',
    segregationScore: 90,
    notes: '',
  };

  pickupForm = {
    routeName: '',
    scheduledDate: '',
    truck: '',
    zone: '',
    loadKg: null as number | null,
    stops: null as number | null,
  };

  readonly wasteTypes = ['biodegradable', 'recyclable', 'residual', 'hazardous', 'electronic'];

  readonly navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'profile', label: 'Profile' },
    { id: 'submissions', label: 'Waste Logs' },
    { id: 'pickups', label: 'Collection' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'rewards', label: 'Incentives' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'users', label: 'Users' },
  ];

  readonly roleViewAccess: Record<string, string[]> = {
    Administrator: ['overview', 'profile', 'submissions', 'pickups', 'notifications', 'analytics', 'users'],
    Collector: ['overview', 'profile', 'submissions', 'pickups', 'notifications', 'analytics'],
    Resident: ['overview', 'profile', 'submissions', 'pickups', 'notifications', 'rewards', 'analytics'],
  };

  readonly roleAuthorities: Record<string, { label: string; description: string; permissions: string[] }> = {
    Administrator: {
      label: 'Full system authority',
      description: 'Can monitor all accounts, review waste submissions, manage collection status, and inspect analytics.',
      permissions: [
        'View all resident, collector, and administrator profiles',
        'Notify residents when collection is arriving',
        'Mark waste submissions as collected',
        'Create and update pickup routes',
        'Review analytics, leaderboard, and user records',
      ],
    },
    Collector: {
      label: 'Collection operations authority',
      description: 'Can coordinate pickup routes and update collection status for resident waste submissions.',
      permissions: [
        'View operational waste submissions',
        'Notify residents before arrival',
        'Mark submissions as collected',
        'Create and update pickup routes',
        'View collection analytics',
      ],
    },
    Resident: {
      label: 'Resident account authority',
      description: 'Can submit segregated waste, receive collection notifications, earn points, and redeem rewards.',
      permissions: [
        'Submit segregated waste entries',
        'View personal submission and collection history',
        'Receive collector arrival notifications',
        'Redeem rewards using eco points',
        'View personal account points and leaderboard standing',
      ],
    },
  };

  private messageTimeout?: number;

  constructor(
    private api: Api,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    this.pickupForm.scheduledDate = this.todayIso();

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.loadCurrentUser();
  }

  loadCurrentUser() {
    this.isLoading = true;
    this.loadError = '';
    this.api.getCurrentUser().subscribe({
      next: ({ user }) => {
        this.currentUser = user;
        this.loadData();
      },
      error: (error) => {
        this.isLoading = false;
        if (error.message.includes('401')) {
          this.router.navigate(['/login']);
        } else {
          this.loadError = error.message;
        }
      },
    });
  }

  retryLoad() {
    if (this.currentUser) {
      this.isLoading = true;
      this.loadData();
    } else {
      this.loadCurrentUser();
    }
  }

  loadData() {
    this.loadError = '';
    this.api.getBootstrap().subscribe({
      next: (data) => {
        this.isLoading = false;
        this.data = data;
        this.syncCurrentUser();

        if (!this.allowedViews.includes(this.activeView)) {
          this.activeView = 'overview';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.loadError = error.message;
        if (error.message.includes('401')) {
          this.router.navigate(['/login']);
        }
      },
    });
  }

  syncCurrentUser() {
    if (!this.currentUser || !this.data) {
      return;
    }

    const latestUser = this.data.users.find((user) => user.id === this.currentUser?.id);
    if (latestUser) {
      this.currentUser = latestUser;
    }
  }

  setView(view: string) {
    if (!this.allowedViews.includes(view)) {
      return;
    }

    this.activeView = view;
    this.sidebarOpen = false;
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  submitWaste() {
    if (!this.currentUser || this.currentUser.role !== 'Resident') {
      return;
    }

    this.api.submitWaste({
      residentId: this.currentUser.id,
      wasteType: this.wasteForm.wasteType,
      weightKg: Number(this.wasteForm.weightKg || 0),
      location: this.wasteForm.location.trim(),
      segregationScore: Number(this.wasteForm.segregationScore || 0),
      notes: this.wasteForm.notes.trim(),
    }).subscribe({
      next: () => {
        this.wasteForm = {
          wasteType: 'biodegradable',
          weightKg: null,
          location: '',
          segregationScore: 90,
          notes: '',
        };
        this.showAppMessage('Waste entry submitted successfully.');
        this.loadData();
        this.setView('submissions');
      },
      error: (error) => this.showAppMessage(error.message),
    });
  }

  createPickup() {
    if (!this.currentUser || this.currentUser.role === 'Resident') {
      return;
    }

    const collector = this.pickCollector();

    this.api.createPickup({
      routeName: this.pickupForm.routeName.trim(),
      collectorId: collector.id,
      scheduledDate: this.pickupForm.scheduledDate,
      truck: this.pickupForm.truck.trim(),
      zone: this.pickupForm.zone.trim(),
      loadKg: Number(this.pickupForm.loadKg || 0),
      stops: Number(this.pickupForm.stops || 0),
    }).subscribe({
      next: () => {
        this.pickupForm = {
          routeName: '',
          scheduledDate: this.todayIso(),
          truck: '',
          zone: '',
          loadKg: null,
          stops: null,
        };
        this.showAppMessage('Pickup schedule created.');
        this.loadData();
      },
      error: (error) => this.showAppMessage(error.message),
    });
  }

  updateSubmissionStatus(submission: Submission, status: string) {
    this.api.updateSubmissionStatus(submission.id, status).subscribe({
      next: () => {
        this.showAppMessage(`Submission marked as ${status}.`);
        this.loadData();
      },
      error: (error) => this.showAppMessage(error.message),
    });
  }

  notifyArrival(submission: Submission) {
    if (!this.currentUser) {
      return;
    }

    this.api.notifyArrival(submission.id).subscribe({
      next: () => {
        this.showAppMessage('Resident notified successfully.');
        this.loadData();
      },
      error: (error) => this.showAppMessage(error.message),
    });
  }

  updatePickupStatus(pickup: Pickup, status: string) {
    this.api.updatePickupStatus(pickup.id, status).subscribe({
      next: () => {
        this.showAppMessage(`Pickup route marked as ${status}.`);
        this.loadData();
      },
      error: (error) => this.showAppMessage(error.message),
    });
  }

  markNotificationRead(notification: Notification) {
    this.api.markNotificationRead(notification.id).subscribe({
      next: () => {
        this.showAppMessage('Notification marked as read.');
        this.loadData();
      },
      error: (error) => this.showAppMessage(error.message),
    });
  }

  redeemReward(reward: Reward) {
    if (!this.currentUser || this.currentUser.role !== 'Resident') {
      return;
    }

    this.api.redeemReward(reward.id, this.currentUser.id).subscribe({
      next: () => {
        this.showAppMessage(`${reward.title} redeemed.`);
        this.loadData();
      },
      error: (error) => this.showAppMessage(error.message),
    });
  }

  logout() {
    this.api.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: (error) => this.showAppMessage(error.message),
    });
  }

  getInitials(name: string): string {
    if (!name) return '';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  get allowedViews() {
    if (!this.currentUser) {
      return [];
    }
    return this.roleViewAccess[this.currentUser.role] || ['overview'];
  }

  get isResident() {
    return this.currentUser?.role === 'Resident';
  }

  get canReview() {
    return !!this.currentUser && this.currentUser.role !== 'Resident';
  }

  get firstName() {
    return this.currentUser?.name.split(' ')[0] || 'Your';
  }

  get metrics() {
    if (!this.data || !this.currentUser) {
      return [];
    }

    return [
      { label: 'Registered users', value: this.data.analytics.totals.users },
      { label: 'Waste collected', value: `${this.data.analytics.totals.totalWasteKg} kg` },
      { label: 'Pending pickups', value: this.data.analytics.totals.pendingPickups },
      { label: 'Notifications', value: this.getUserNotifications().filter((item) => !item.read).length },
      { label: `${this.firstName}'s points`, value: this.currentUser.points },
    ];
  }

  get currentAuthority() {
    return this.getAuthorityFor(this.currentUser?.role || '');
  }

  get currentProfileStats() {
    return this.currentUser ? this.getAccountStats(this.currentUser) : [];
  }

  get activities(): Activity[] {
    return this.data?.activities.slice(0, 8) || [];
  }

  get visibleSubmissions(): Submission[] {
    if (!this.data || !this.currentUser) {
      return [];
    }

    return this.canReview
      ? this.data.submissions
      : this.data.submissions.filter((submission) => submission.residentId === this.currentUser?.id);
  }

  get visiblePickups(): Pickup[] {
    return this.data?.pickups || [];
  }

  get userNotifications(): Notification[] {
    return this.getUserNotifications();
  }

  get notificationPreview(): Notification[] {
    return this.userNotifications.slice(0, 2);
  }

  get visibleRewards(): Reward[] {
    if (!this.isResident) {
      return [];
    }
    return this.data?.rewards || [];
  }

  get visibleRedemptions(): Redemption[] {
    if (!this.data || !this.currentUser) {
      return [];
    }

    const redemptions = this.currentUser.role === 'Administrator'
      ? this.data.redemptions
      : this.data.redemptions.filter((redemption) => redemption.userId === this.currentUser?.id);

    return redemptions.slice(0, 8);
  }

  get wasteByType(): WasteByType[] {
    return this.data?.analytics.wasteByType || [];
  }

  get leaderboard() {
    return this.data?.analytics.barangayLeaderboard || [];
  }

  get visibleUsers(): User[] {
    if (!this.data || !this.currentUser) {
      return [];
    }

    return this.currentUser.role === 'Administrator'
      ? this.data.users
      : this.data.users.filter((user) => user.id === this.currentUser?.id);
  }

  getAuthorityFor(role: string) {
    return this.roleAuthorities[role] || {
      label: 'Basic account authority',
      description: 'This account has standard access only.',
      permissions: ['View assigned dashboard information'],
    };
  }

  getAccountStats(user: User) {
    const submissions = this.data?.submissions.filter((submission) => submission.residentId === user.id).length || 0;
    const pickups = this.data?.pickups.filter((pickup) => pickup.collectorId === user.id).length || 0;
    const redemptions = this.data?.redemptions.filter((redemption) => redemption.userId === user.id).length || 0;
    const unread = this.data?.notifications.filter((notification) => notification.userId === user.id && !notification.read).length || 0;

    const stats = [];
    
    // Only show eco points for residents
    if (user.role === 'Resident') {
      stats.push({ label: 'Eco points', value: user.points });
    }
    
    stats.push(
      { label: 'Waste logs', value: submissions },
      { label: 'Pickup routes', value: pickups },
      { label: 'Reward claims', value: redemptions },
      { label: 'Unread alerts', value: unread },
    );
    
    return stats;
  }

  getUserInitials(user: User) {
    return user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  getChartWidth(item: WasteByType) {
    const max = Math.max(...this.wasteByType.map((entry) => entry.value), 1);
    return `${(item.value / max) * 100}%`;
  }

  canRedeem(reward: Reward) {
    return !!this.currentUser && this.currentUser.points >= reward.pointsCost && reward.stock > 0;
  }

  getStatusTone(status: string) {
    const normalized = status.toLowerCase();
    if (normalized.includes('need') || normalized.includes('hazard') || normalized.includes('alert')) {
      return 'alert';
    }
    if (
      normalized.includes('pending') ||
      normalized.includes('monitor') ||
      normalized.includes('progress') ||
      normalized.includes('ready')
    ) {
      return 'warn';
    }
    return '';
  }

  formatDateTime(value: string) {
    if (!value) {
      return '';
    }

    return new Date(value).toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  titleCase(value: string) {
    return value
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private pickCollector(): User {
    if (this.currentUser?.role === 'Collector') {
      return this.currentUser;
    }

    return this.data?.users.find((user) => user.role === 'Collector') || this.currentUser!;
  }

  private getUserNotifications(): Notification[] {
    if (!this.data || !this.currentUser) {
      return [];
    }

    return (this.data.notifications || [])
      .filter((notification) => notification.userId === this.currentUser?.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private showAppMessage(message: string) {
    this.appMessage = message;

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    window.clearTimeout(this.messageTimeout);
    this.messageTimeout = window.setTimeout(() => {
      this.appMessage = '';
    }, 3000);
  }

  private todayIso() {
    return new Date().toISOString().slice(0, 10);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

declare global {
  interface Window {
    __ECOLOOP_API_BASE_URL__?: string;
  }
}

export interface User {
  id: string;
  username: string;
  name: string;
  age?: number;
  address?: string;
  phoneNumber?: string;
  role: 'Administrator' | 'Collector' | 'Resident' | string;
  barangay: string;
  points: number;
}

export interface Bin {
  id: string;
  name: string;
  location: string;
  fillLevel: number;
  status: string;
  lastCollectedAt: string;
  sensorHealth: string;
  wasteType: string;
}

export interface Submission {
  id: string;
  residentId: string;
  residentName: string;
  wasteType: string;
  weightKg: number;
  location: string;
  segregationScore: number;
  status: string;
  pointsEarned: number;
  submittedAt: string;
  notes: string;
}

export interface Pickup {
  id: string;
  routeName: string;
  collectorId: string;
  collectorName: string;
  scheduledDate: string;
  truck: string;
  zone: string;
  status: string;
  loadKg: number;
  stops: number;
}

export interface Reward {
  id: string;
  title: string;
  pointsCost: number;
  stock: number;
  partner: string;
  description: string;
}

export interface Redemption {
  id: string;
  rewardId: string;
  rewardTitle: string;
  userId: string;
  userName: string;
  pointsSpent: number;
  redeemedAt: string;
  status: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: string;
  actor: string;
  detail: string;
  createdAt: string;
}

export interface AnalyticsTotals {
  users: number;
  totalWasteKg: number;
  totalPointsIssued: number;
  pendingPickups: number;
  binsNeedingPickup: number;
  notifications: number;
}

export interface WasteByType {
  label: string;
  value: number;
}

export interface LeaderboardUser {
  name: string;
  barangay: string;
  points: number;
  role: string;
}

export interface Analytics {
  totals: AnalyticsTotals;
  wasteByType: WasteByType[];
  barangayLeaderboard: LeaderboardUser[];
}

export interface BootstrapData {
  users: User[];
  bins: Bin[];
  submissions: Submission[];
  pickups: Pickup[];
  rewards: Reward[];
  redemptions: Redemption[];
  notifications: Notification[];
  activities: Activity[];
  analytics: Analytics;
}

export interface WasteSubmissionPayload {
  residentId: string;
  wasteType: string;
  weightKg: number;
  location: string;
  segregationScore: number;
  notes: string;
}

export interface PickupPayload {
  routeName: string;
  collectorId: string;
  scheduledDate: string;
  truck: string;
  zone: string;
  loadKg: number;
  stops: number;
}

@Injectable({
  providedIn: 'root',
})
export class Api {
  private readonly baseUrl = (
    typeof window !== 'undefined' && window.__ECOLOOP_API_BASE_URL__
      ? window.__ECOLOOP_API_BASE_URL__
      : '/api'
  ).replace(/\/$/, '');
  private readonly requestOptions = { withCredentials: true };

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = error.error?.message || `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    return throwError(() => new Error(errorMessage));
  }

  login(username: string, password: string): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(`${this.baseUrl}/auth/login`, { username, password }, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  getCurrentUser(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${this.baseUrl}/auth/me`, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, {}, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  register(name: string, age: number | null, address: string, phoneNumber: string, username: string, password: string): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(`${this.baseUrl}/auth/register`, { name, age, address, phoneNumber, username, password }, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  getBootstrap(): Observable<BootstrapData> {
    return this.http.get<BootstrapData>(`${this.baseUrl}/bootstrap`, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  submitWaste(payload: WasteSubmissionPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/submissions`, payload, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  updateSubmissionStatus(id: string, status: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/submissions/${id}/status`, { status }, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  notifyArrival(id: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/submissions/${id}/arrival`, {}, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  createPickup(payload: PickupPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/pickups`, payload, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  updatePickupStatus(id: string, status: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/pickups/${id}/status`, { status }, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  markNotificationRead(id: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/notifications/${id}/read`, {}, this.requestOptions)
      .pipe(catchError(this.handleError));
  }

  redeemReward(rewardId: string, userId: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/redemptions`, { rewardId, userId }, this.requestOptions)
      .pipe(catchError(this.handleError));
  }
}

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Api } from './api';

describe('Api', () => {
  let api: Api;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    api = TestBed.inject(Api);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the same-origin API and sends cookie credentials for login', () => {
    api.login('resident', 'password').subscribe();

    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({ username: 'resident', password: 'password' });
    request.flush({
      user: {
        id: 'user-1',
        username: 'resident',
        name: 'Resident',
        role: 'Resident',
        barangay: 'Central',
        points: 0
      }
    });
  });

  it('sends cookie credentials when loading bootstrap data', () => {
    api.getBootstrap().subscribe();

    const request = http.expectOne('/api/bootstrap');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      users: [],
      bins: [],
      submissions: [],
      pickups: [],
      rewards: [],
      redemptions: [],
      notifications: [],
      activities: [],
      analytics: {
        totals: {
          users: 0,
          totalWasteKg: 0,
          totalPointsIssued: 0,
          pendingPickups: 0,
          binsNeedingPickup: 0,
          notifications: 0
        },
        wasteByType: [],
        barangayLeaderboard: []
      }
    });
  });
});

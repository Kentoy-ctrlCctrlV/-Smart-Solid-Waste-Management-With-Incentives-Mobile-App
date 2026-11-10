import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Dashboard } from './dashboard';
import { Api, BootstrapData, User } from '../api';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  const user: User = {
    id: 'user-resident',
    username: 'resident',
    name: 'Mia Santos',
    role: 'Resident',
    barangay: 'Katipunan',
    points: 185,
  };
  const data: BootstrapData = {
    users: [user],
    bins: [],
    submissions: [],
    pickups: [],
    rewards: [],
    redemptions: [],
    notifications: [],
    activities: [],
    analytics: {
      totals: {
        users: 1,
        totalWasteKg: 0,
        totalPointsIssued: 185,
        pendingPickups: 0,
        binsNeedingPickup: 0,
        notifications: 0,
      },
      wasteByType: [],
      barangayLeaderboard: [],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        {
          provide: Api,
          useValue: {
            getCurrentUser: () => of({ user }),
            getBootstrap: () => of(data),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

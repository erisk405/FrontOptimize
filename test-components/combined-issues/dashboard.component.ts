import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, Subscription } from 'rxjs';
import { map, filter, takeUntil, debounceTime } from 'rxjs/operators';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
// Unused imports
import { UnusedPipe } from './pipes/unused.pipe';
import { OldService } from './services/old.service';
import { DeprecatedHelper } from './helpers/deprecated';

interface DashboardData {
  users: User[];
  stats: Statistics;
  notifications: Notification[];
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Statistics {
  totalUsers: number;
  activeUsers: number;
  revenue: number;
}

interface Notification {
  id: number;
  message: string;
  type: string;
  timestamp: Date;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  dashboardData: DashboardData | null = null;
  loading: boolean = false;
  error: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeDashboard();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Missing await issues
  async initializeDashboard(): Promise<void> {
    this.loading = true;
    this.loadDashboardData(); // Missing await
    this.loadUserPreferences(); // Missing await
    this.loading = false;
  }

  async loadDashboardData(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.dashboardData = {
          users: [],
          stats: { totalUsers: 0, activeUsers: 0, revenue: 0 },
          notifications: []
        };
        resolve();
      }, 1000);
    });
  }

  async loadUserPreferences(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 500);
    });
  }

  // Duplicate logic
  async refreshDashboard(): Promise<void> {
    this.loading = true;
    this.loadDashboardData(); // Duplicate pattern
    this.loadUserPreferences(); // Duplicate pattern
    this.loading = false;
  }

  // More duplicate methods
  getUserCount(): number {
    return this.dashboardData?.users.length || 0;
  }

  getTotalUsers(): number {
    return this.dashboardData?.users.length || 0;
  }

  calculateRevenue(): number {
    return this.dashboardData?.stats.revenue || 0;
  }

  getRevenue(): number {
    return this.dashboardData?.stats.revenue || 0;
  }
}

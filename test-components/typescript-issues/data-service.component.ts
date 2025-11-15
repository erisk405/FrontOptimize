import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, filter, tap } from 'rxjs/operators';
import { UnusedInterface } from './models';
import { AnotherUnusedImport } from './utils';

interface User {
  id: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-data-service',
  templateUrl: './data-service.component.html',
  styleUrls: ['./data-service.component.css']
})
export class DataServiceComponent implements OnInit {
  users: User[] = [];
  loading: boolean = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  // Missing await - async function called without await
  async loadUsers(): Promise<void> {
    this.loading = true;
    this.fetchUsers(); // Should be: await this.fetchUsers()
    this.loading = false;
  }

  async fetchUsers(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.users = [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' }
        ];
        resolve();
      }, 1000);
    });
  }

  // Another missing await
  async processData(): Promise<void> {
    this.validateData(); // Should be: await this.validateData()
    console.log('Data processed');
  }

  async validateData(): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 500);
    });
  }

  // Duplicate logic - similar to loadUsers
  async refreshUsers(): Promise<void> {
    this.loading = true;
    this.fetchUsers(); // Duplicate pattern
    this.loading = false;
  }

  // More duplicate logic
  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }

  findUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }
}

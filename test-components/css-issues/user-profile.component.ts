import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { UnusedService } from './unused.service';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {
  userName: string = 'John Doe';
  userEmail: string = 'john@example.com';

  constructor() {}

  ngOnInit(): void {
    this.loadUserData();
  }

  loadUserData(): void {
    console.log('Loading user data...');
  }

  updateProfile(): void {
    console.log('Profile updated');
  }
}

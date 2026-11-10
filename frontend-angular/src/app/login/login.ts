import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Api, User } from '../api';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  username = '';
  password = '';
  loginError = '';

  registerName = '';
  registerAge: number | null = null;
  registerAddress = 'Katipunan, Villanueva, Misamis Oriental';
  registerPhone = '';
  registerUsername = '';
  registerPassword = '';
  registerMessage = '';
  registerError = '';

  constructor(private api: Api, private router: Router) {}

  onLogin() {
    this.loginError = '';
    this.api.login(this.username, this.password).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.loginError = error.message;
      }
    });
  }

  onRegister() {
    this.registerMessage = '';
    this.registerError = '';
    this.api.register(
      this.registerName,
      this.registerAge,
      this.registerAddress,
      this.registerPhone,
      this.registerUsername,
      this.registerPassword
    ).subscribe({
      next: () => {
        this.registerMessage = 'Account created successfully! You can now log in.';
        this.registerName = '';
        this.registerAge = null;
        this.registerAddress = 'Katipunan, Villanueva, Misamis Oriental';
        this.registerPhone = '';
        this.registerUsername = '';
        this.registerPassword = '';
      },
      error: (error) => {
        this.registerError = error.message;
      }
    });
  }
}

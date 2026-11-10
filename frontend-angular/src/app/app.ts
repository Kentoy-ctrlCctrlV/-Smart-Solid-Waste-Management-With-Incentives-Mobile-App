import { Component, HostListener, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = 'frontend-angular';
  isOnline = true;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private swUpdate: SwUpdate,
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.isOnline = navigator.onLine;
      this.updateApplication();
    }
  }

  private updateApplication() {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this.swUpdate.activateUpdate()
          .then(() => window.location.reload())
          .catch((error: unknown) => console.error('Could not activate the application update.', error));
      }
    });

    navigator.serviceWorker.ready
      .then(() => this.swUpdate.checkForUpdate())
      .catch((error: unknown) => console.error('Could not check for an application update.', error));
  }

  @HostListener('window:online')
  onOnline() {
    this.isOnline = true;
  }

  @HostListener('window:offline')
  onOffline() {
    this.isOnline = false;
  }
}

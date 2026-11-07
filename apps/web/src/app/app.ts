import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { MkToastHostComponent } from './shared/ui/toast/toast-host.component'

/** Root component: every frame (shell, full-screen pages) is a route; toasts float above all of them. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MkToastHostComponent],
  template: `
    <router-outlet />
    <mk-toast-host />
  `,
})
export class App {}

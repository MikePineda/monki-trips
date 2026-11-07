import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'

/** Root component: every frame (shell, full-screen pages) is a route. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}

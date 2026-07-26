import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmToasterImports } from './ui/sonner/src';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ...HlmToasterImports],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  title = 'CartShare';
}

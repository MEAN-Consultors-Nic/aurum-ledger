import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-imports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <div class="text-2xl font-semibold">Importar CSV</div>
      <div class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        Drop CSV here (wizard en construccion)
      </div>
    </div>
  `,
})
export class ImportsComponent {}

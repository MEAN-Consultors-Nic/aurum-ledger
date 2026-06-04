import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  pulse: number;
};

type Pulse = {
  from: number;
  to: number;
  t: number;
  speed: number;
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="relative min-h-screen overflow-hidden bg-[#05060d] text-slate-100">
      <!-- Animated neural network canvas -->
      <canvas
        #neuralCanvas
        class="absolute inset-0 h-full w-full"
      ></canvas>

      <!-- Ambient gradient orbs -->
      <div class="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl"></div>
      <div class="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"></div>

      <!-- Subtle grid overlay -->
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.04]"
        style="background-image: linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px); background-size: 48px 48px;"
      ></div>

      <!-- Content -->
      <div class="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div class="w-full max-w-md">
          <!-- Brand mark with terminal cursor -->
          <div class="mb-8 text-center">
            <div class="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-300">
              <span class="relative flex h-1.5 w-1.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
              </span>
              Neural Core // v2.1
            </div>
            <h1 class="mt-6 bg-gradient-to-br from-white via-slate-200 to-cyan-200 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
              AurumLedger
            </h1>
            <p class="mt-2 font-mono text-xs text-slate-400">
              <span class="text-cyan-400">$</span> mean-consultors --authenticate<span class="animate-blink text-cyan-400">_</span>
            </p>
          </div>

          <!-- Glass card -->
          <div class="relative">
            <!-- Decorative neon frame -->
            <div class="absolute -inset-px rounded-2xl bg-gradient-to-br from-cyan-400/40 via-violet-500/20 to-cyan-400/40 opacity-60 blur-sm"></div>

            <div class="relative rounded-2xl border border-white/10 bg-slate-950/70 p-8 backdrop-blur-xl shadow-[0_0_40px_-10px_rgba(34,211,238,0.3)]">
              <!-- Corner accents -->
              <div class="absolute left-3 top-3 h-3 w-3 border-l border-t border-cyan-400/60"></div>
              <div class="absolute right-3 top-3 h-3 w-3 border-r border-t border-cyan-400/60"></div>
              <div class="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-cyan-400/60"></div>
              <div class="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-cyan-400/60"></div>

              <form class="space-y-5" [formGroup]="form" (ngSubmit)="submit()">
                <div>
                  <label class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    <span class="h-px w-3 bg-cyan-400/60"></span>
                    Identifier
                  </label>
                  <input
                    type="text"
                    formControlName="identifier"
                    autocomplete="username"
                    class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                    placeholder="username or user@domain.com"
                  />
                </div>

                <div>
                  <label class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    <span class="h-px w-3 bg-cyan-400/60"></span>
                    Access Key
                  </label>
                  <div class="relative mt-2">
                    <input
                      [type]="showPassword ? 'text' : 'password'"
                      formControlName="password"
                      autocomplete="current-password"
                      class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-11 text-sm text-slate-100 placeholder-slate-500 transition focus:border-cyan-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      (click)="showPassword = !showPassword"
                      [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
                      [attr.aria-pressed]="showPassword"
                      tabindex="-1"
                      class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition hover:text-cyan-300"
                    >
                      <svg *ngIf="!showPassword" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      <svg *ngIf="showPassword" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.66 18.66 0 0 1 4.06-5.06"/>
                        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.16 3.19"/>
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                        <line x1="2" y1="2" x2="22" y2="22"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    formControlName="remember"
                    class="h-4 w-4 rounded border-white/20 bg-white/5 accent-cyan-400"
                  />
                  Persist session
                </label>

                <button
                  type="submit"
                  class="group relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-lg shadow-cyan-500/30 transition hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  [disabled]="form.invalid || isLoading"
                >
                  <span class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"></span>
                  <span class="relative flex items-center justify-center gap-2">
                    <svg *ngIf="!isLoading" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                    </svg>
                    <svg *ngIf="isLoading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M22 12a10 10 0 0 1-10 10"/>
                    </svg>
                    {{ isLoading ? 'Authenticating…' : 'Initialize Session' }}
                  </span>
                </button>

                <div
                  *ngIf="error"
                  class="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
                >
                  <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {{ error }}
                </div>
              </form>
            </div>
          </div>

          <!-- Footer -->
          <p class="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
            MEAN Consultors · Nicaragua · &copy; {{ year }}
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      @keyframes blink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
      .animate-blink { animation: blink 1s steps(1) infinite; }

      /* Kill the browser's white autofill background that breaks the dark theme. */
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-text-fill-color: #f1f5f9 !important;
        -webkit-box-shadow: 0 0 0 1000px rgba(15, 23, 42, 0.6) inset !important;
        box-shadow: 0 0 0 1000px rgba(15, 23, 42, 0.6) inset !important;
        caret-color: #f1f5f9 !important;
        transition: background-color 9999s ease-in-out 0s;
      }
    `,
  ],
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  error = '';
  isLoading = false;
  showPassword = false;
  readonly year = new Date().getFullYear();
  form;

  private rafId: number | null = null;
  private resizeHandler?: () => void;
  private nodes: Node[] = [];
  private pulses: Pulse[] = [];
  private mouse = { x: -1000, y: -1000 };
  private mouseHandler?: (e: MouseEvent) => void;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.form = this.fb.group({
      identifier: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      remember: [false],
    });
    this.loadRemembered();
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    this.resizeHandler = resize;
    window.addEventListener('resize', resize);

    this.mouseHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', this.mouseHandler);

    this.seedNodes(canvas.clientWidth, canvas.clientHeight);
    this.animate(ctx, canvas);
  }

  private seedNodes(w: number, h: number) {
    const count = Math.min(80, Math.floor((w * h) / 18000));
    this.nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 1 + Math.random() * 1.5,
      pulse: Math.random() * Math.PI * 2,
    }));
  }

  private animate(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const linkDist = 140;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const tick = () => {
      ctx.clearRect(0, 0, w, h);

      // Move nodes + draw
      for (const n of this.nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.pulse += 0.04;
      }

      // Draw connections
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const a = this.nodes[i];
          const b = this.nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < linkDist) {
            const alpha = (1 - d / linkDist) * 0.35;
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            // Random chance to emit a travelling pulse along this edge
            if (Math.random() < 0.0008 && this.pulses.length < 30) {
              this.pulses.push({ from: i, to: j, t: 0, speed: 0.005 + Math.random() * 0.01 });
            }
          }
        }
      }

      // Connect nodes to mouse
      for (const n of this.nodes) {
        const dx = n.x - this.mouse.x;
        const dy = n.y - this.mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 180) {
          const alpha = (1 - d / 180) * 0.6;
          ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(this.mouse.x, this.mouse.y);
          ctx.stroke();
        }
      }

      // Draw pulses
      this.pulses = this.pulses.filter((p) => {
        p.t += p.speed;
        if (p.t >= 1) return false;
        const a = this.nodes[p.from];
        const b = this.nodes[p.to];
        if (!a || !b) return false;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        ctx.fillStyle = 'rgba(165, 243, 252, 0.95)';
        ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        return true;
      });

      // Draw nodes
      for (const n of this.nodes) {
        const glow = 0.6 + Math.sin(n.pulse) * 0.2;
        ctx.fillStyle = `rgba(125, 211, 252, ${glow})`;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      this.rafId = requestAnimationFrame(tick);
    };

    tick();
  }

  ngOnDestroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.mouseHandler && this.canvasRef?.nativeElement) {
      this.canvasRef.nativeElement.removeEventListener('mousemove', this.mouseHandler);
    }
  }

  submit() {
    if (this.form.invalid) {
      return;
    }

    this.error = '';
    this.isLoading = true;
    const { identifier, password, remember } = this.form.getRawValue();
    if (!remember) {
      this.clearRemembered();
    }

    this.authService.login(identifier ?? '', password ?? '').subscribe({
      next: () => {
        if (remember) {
          this.saveRemembered(identifier ?? '', password ?? '');
        }
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isLoading = false;
        this.error = 'Invalid credentials';
      },
    });
  }

  private loadRemembered() {
    try {
      const raw = localStorage.getItem('rememberedLogin');
      if (!raw) {
        return;
      }
      const data = JSON.parse(raw) as { identifier?: string; email?: string; password?: string };
      const identifier = data?.identifier ?? data?.email ?? '';
      if (identifier && data?.password) {
        this.form.patchValue({ identifier, password: data.password, remember: true });
      }
    } catch {
      this.clearRemembered();
    }
  }

  private saveRemembered(identifier: string, password: string) {
    localStorage.setItem('rememberedLogin', JSON.stringify({ identifier, password }));
  }

  private clearRemembered() {
    localStorage.removeItem('rememberedLogin');
  }
}

import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  root() {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AurumLedger API</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #0b1020;
        --panel: #0f172a;
        --text: #e2e8f0;
        --muted: #94a3b8;
        --accent: #22d3ee;
      }
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        margin: 0;
        background: radial-gradient(1200px 600px at 20% -10%, #1f2937 0%, var(--bg) 55%, #020617 100%);
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
        display: grid;
        place-items: center;
      }
      .card {
        width: min(640px, 92vw);
        background: color-mix(in srgb, var(--panel) 90%, #0b132a 10%);
        border: 1px solid color-mix(in srgb, #1f2937 70%, #0b1020 30%);
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 30px 80px rgba(2, 6, 23, 0.5);
      }
      .title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      h1 {
        font-size: 24px;
        margin: 0;
        letter-spacing: 0.2px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(34, 211, 238, 0.12);
        color: var(--accent);
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 12px rgba(34, 211, 238, 0.9);
      }
      p {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.6;
      }
      .meta {
        margin-top: 18px;
        display: flex;
        gap: 18px;
        color: var(--muted);
        font-size: 12px;
      }
      .meta span {
        padding: 6px 10px;
        border-radius: 10px;
        background: rgba(148, 163, 184, 0.08);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="title">
        <h1>AurumLedger API</h1>
        <div class="pill"><span class="dot"></span>Live</div>
      </div>
      <p>Minimal public health page. If you can read this, the API is up.</p>
      <div class="meta">
        <span>Versioned at /api/v1</span>
        <span>Health at /health</span>
      </div>
    </div>
  </body>
</html>`;
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

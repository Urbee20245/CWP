type PdfSection = { title: string; html: string };

const safe = (s: string) => String(s ?? '').replace(/[<>]/g, '');

export function openPrintToPdf(options: {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
  footerNote?: string;
}) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=980,height=980');
  if (!w) return;

  const { title, subtitle, sections, footerNote } = options;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${safe(title)}</title>
    <style>
      body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 28px; color: #0f172a; }
      h1,h2,h3 { margin: 0 0 10px; }
      .muted { color: #475569; }
      .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 12px 0; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      table { width:100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
      th { color:#475569; font-weight: 700; }
      .badge { display:inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .critical { background:#fee2e2; color:#991b1b; }
      .important { background:#ffedd5; color:#9a3412; }
      .recommended { background:#fef3c7; color:#92400e; }
    </style>
  </head><body>`);

  w.document.write(`<h1>${safe(title)}</h1>`);
  if (subtitle) w.document.write(`<p class="muted">${safe(subtitle)}</p>`);

  sections.forEach((s) => {
    w.document.write(`<div class="card"><h2>${safe(s.title)}</h2>${s.html}</div>`);
  });

  w.document.write(`<p class="muted">${safe(footerNote || 'Tip: Use your browser’s Print → “Save as PDF”.')}</p>`);
  w.document.write(`</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}


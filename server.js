const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json({ limit: '1mb' }));

const AUTH_TOKEN = process.env.AUTH_TOKEN || 'joy-br-2026-secret';
const BASE_URL   = process.env.BASE_URL   || 'https://br-externe-production.up.railway.app';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pages (
      id      CHAR(6) PRIMARY KEY,
      slug    TEXT,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('DB ready');
}
initDb().catch(console.error);

function shortId() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function toSlug(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'venue';
}

// ─── POST /pages ────────────────────────────────────────────────────────────
app.post('/pages', async (req, res) => {
  if (req.headers['authorization'] !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { venue_id, venue_name, ae_name, wa_number, recos, reco_texts, metrics } = req.body;
  if (!venue_id) return res.status(400).json({ error: 'venue_id requis' });

  // Mapping clés n8n → clés page web
  // features_usage supprimé
  // trafic_direct a deux variantes selon la couleur
  const RECO_MAP = {
    search_upsell:           'privateaser_search',
    transfo_good_reactivity: 'transformation',
    transfo_bad_reactivity:  'transformation',
    conversion:              'conversion',
    trafic_direct_bad:       'direct_traffic_bad',
    trafic_direct_good:      'direct_traffic_good',
  };

  const payload = {
    venue_id,
    venue_name:  venue_name || `Venue ${venue_id}`,
    ae_name:     ae_name || '',
    wa_number:   wa_number || '',
    scenarios:   (recos || []).map(r => RECO_MAP[r]).filter(Boolean),
    reco_texts:  reco_texts || {},
    metrics:     metrics || {},
  };

  const slug = toSlug(venue_name || venue_id);

  let id, attempts = 0;
  do {
    id = shortId();
    const exists = await pool.query('SELECT 1 FROM pages WHERE id = $1', [id]);
    if (!exists.rows.length) break;
  } while (++attempts < 10);

  await pool.query(
    'INSERT INTO pages (id, slug, payload) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET payload = $3',
    [id, slug, payload]
  );

  const url = `${BASE_URL}/r/${id}/${slug}`;
  return res.json({ ok: true, url });
});

// ─── GET /r/:id/:slug ────────────────────────────────────────────────────────
app.get('/r/:id/:slug?', async (req, res) => {
  const result = await pool.query('SELECT payload FROM pages WHERE id = $1', [req.params.id]);
  if (!result.rows.length) return res.status(404).send(NOT_FOUND_HTML);
  const data = result.rows[0].payload;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderPage(data));
});

app.get('/health', (_, res) => res.json({ ok: true }));

// ─── HTML ────────────────────────────────────────────────────────────────────
const LOGO_SVG = `<svg width="60" height="27" viewBox="0 0 241 108" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><path d="M9.196 107.631C17.983 107.631 24.496 105.316 28.737 100.685C32.977 96.054 35.097 88.802 35.097 78.929L35.097 0L15.48 0L15.48 78.319C15.48 82.186 14.764 84.96 13.334 86.639C11.903 88.319 9.758 89.158 6.897 89.158C3.934 89.158 1.635 89.107 0 89.006L0 107.02C3.372 107.428 6.437 107.631 9.196 107.631Z" fill="#3226C0"/><g transform="translate(56.155 2.34)" fill="#FDA886"><path d="M65.94 8.815C71.47 10.572 74.496 16.381 72.699 21.788C70.919 27.141 65.079 30.095 59.596 28.448L59.43 28.396C57.014 27.628 54.477 27.216 51.875 27.182L51.519 27.179C45.704 27.179 40.99 22.57 40.99 16.884C40.99 11.198 45.704 6.589 51.519 6.589C56.464 6.589 61.317 7.345 65.94 8.815ZM87.583 62.55C81.827 62.537 77.159 58.009 77.08 52.401L77.079 52.149C77.077 49.618 76.693 47.149 75.95 44.793L75.846 44.472C74.057 39.062 77.092 33.258 82.625 31.509C88.158 29.76 94.094 32.727 95.883 38.137C97.321 42.485 98.084 47.04 98.135 51.688L98.137 52.279C98.123 57.964 93.398 62.563 87.583 62.55ZM65.786 95.576C60.25 97.315 54.32 94.336 52.542 88.922C50.781 83.563 53.75 77.827 59.181 76.026L59.347 75.972C61.789 75.205 64.095 74.08 66.193 72.638L66.478 72.439C71.189 69.107 77.772 70.14 81.18 74.746C84.588 79.353 83.532 85.789 78.82 89.122C74.857 91.926 70.462 94.108 65.786 95.576ZM13.651 78.761C10.256 74.145 11.331 67.711 16.052 64.392C20.726 61.105 27.221 62.103 30.645 66.602L30.748 66.74C32.249 68.781 34.059 70.594 36.109 72.112L36.39 72.317C41.073 75.688 42.075 82.132 38.628 86.711C35.181 91.291 28.59 92.271 23.907 88.9C19.969 86.066 16.506 82.642 13.651 78.761ZM14.02 25.087C17.478 20.516 24.071 19.551 28.746 22.932C33.375 26.279 34.388 32.631 31.053 37.193L30.95 37.331C29.424 39.349 28.217 41.577 27.373 43.944L27.261 44.268C25.423 49.662 19.462 52.579 13.944 50.783C8.427 48.987 5.444 43.157 7.281 37.763C8.832 33.208 11.11 28.933 14.02 25.087Z"/></g><path d="M194.366 107.631L241 0L219.389 0L203.466 39.124C201.624 43.561 200.649 47.89 200.541 52.111L199.891 52.111C199.674 46.591 198.374 41.126 195.991 35.715L181.042 0L159.107 0L190.792 69.644L174.056 107.631L194.366 107.631Z" fill="#3226C0"/></g></svg>`;

// Mapping couleur → emoji pastille
const COLOR_EMOJI = { green: '🟢', blue: '🔵', orange: '🟠', red: '🔴', white: '⚪️' };

// Scénarios — features_usage supprimé
// trafic_direct : deux variantes (bad = rouge/orange, good = vert/bleu)
const SCENARIOS = {
  privateaser_search: {
    icon: '🔍', label: 'Visibilité Privateaser', tone: 'positive', tagLabel: 'Opportunité ✨',
    metricKey: 'search_color',
    context: 'Privateaser vous apporte assez de visibilité par rapport à votre abonnement.',
    reco: "Vous avez atteint le plafond de visibilité inclus dans votre abonnement actuel. Pour accéder à davantage de trafic, votre chargé de compte peut vous présenter les options disponibles. Assurez-vous que la conversion et la transformation des demandes suivent.",
    ctaLabel: '📈 Je veux upsell',
    ctaHref: 'wa', // → wa.me de l'AE
  },
  direct_traffic_bad: {
    icon: '📣', label: 'Votre trafic', tone: 'neutral', tagLabel: 'Recommandation',
    metricKey: 'trafic_direct_color',
    context: "Vous ne mettez pas assez en avant votre activité de groupe sur vos canaux (Instagram, Google, etc.).",
    reco: "Pensez à mettre votre vitrine évènementielle en avant sur Instagram, Google, etc. pour que vos clients passent par la plateforme. Votre chargé de compte peut vous aider à activer ces leviers.",
  },
  direct_traffic_good: {
    icon: '📣', label: 'Votre trafic', tone: 'positive', tagLabel: 'Opportunité ✨',
    metricKey: 'trafic_direct_color',
    context: "Vous mettez bien en avant votre activité de groupe sur vos canaux (Instagram, Google, etc.).",
    reco: "Votre trafic direct est excellent. Continuez à mettre en avant votre vitrine évènementielle sur vos canaux pour maintenir ce niveau. Votre chargé de compte peut vous aider à aller encore plus loin.",
  },
  conversion: {
    icon: '🎯', label: 'Conversion de votre vitrine', tone: 'neutral', tagLabel: 'Recommandation',
    metricKey: 'conversion_color',
    context: "Les organisateurs qui voient votre lieu ne le choisissent pas.",
    reco: "Votre lieu ne plaît pas assez aux organisateurs. Ajoutez sur votre vitrine des photos, des vidéos de vrais événements et des avis pour convaincre davantage.",
    ctaLabel: 'Envoyez nous vos contenus',
    ctaHref: 'https://joy.io/media', // → lien fixe
  },
  transformation: {
    icon: '✅', label: 'Transformation des demandes', tone: 'neutral', tagLabel: 'Recommandation',
    metricKey: 'transformation_color',
    context: "Une partie de vos demandes ne se transforment pas en réservations confirmées.",
    reco: "Répondez aux demandes rapidement avec une posture commerciale (n'hésitez pas à utiliser les templates) et proposez des conditions claires et cohérentes.",
  },
};

const TONE_STYLE = {
  positive: {
    cardBorder: 'border:1px solid #f1f5f9;border-left:4px solid #3B82F6',
    iconBg:     'background:#EFF6FF',
    tagStyle:   'background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE',
  },
  neutral: {
    cardBorder: 'border:1px solid #f1f5f9;border-left:4px solid #F0967A',
    iconBg:     'background:#FDF1EC',
    tagStyle:   'background:#FDF1EC;color:#F0967A;border:1px solid #FDDCC8',
  },
};

const WA_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

function renderCard(key, data, index) {
  const s = SCENARIOS[key];
  if (!s) return '';
  const style  = TONE_STYLE[s.tone];
  const delay  = index * 0.08;
  const waHref = data.wa_number
    ? `https://wa.me/${data.wa_number.replace(/[^0-9+]/g, '')}`
    : 'https://joy.privateaser.com';

  // CTA : utilise le lien fixe si défini, sinon WA de l'AE
  const ctaLabel = s.ctaLabel || 'Contacter mon chargé de compte';
  const ctaHref  = (s.ctaHref && s.ctaHref !== 'wa')
    ? s.ctaHref
    : waHref;

  // Emoji couleur à la place du tag opportunité/recommandation
  const metricColor = s.metricKey ? (data.metrics?.[s.metricKey] || '') : '';
  const colorEmoji  = COLOR_EMOJI[metricColor] || '';

  return `<div style="background:#fff;border-radius:16px;padding:20px;animation:fadeIn .35s ease ${delay}s both;box-shadow:0 2px 16px rgba(26,26,94,0.07);${style.cardBorder}">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:36px;height:36px;border-radius:10px;${style.iconBg};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${s.icon}</div>
        <p style="font-weight:700;color:#1A1A5E;font-size:13px;line-height:1.3;margin:0">${s.label}</p>
      </div>
      ${colorEmoji ? `<span style="font-size:22px">${colorEmoji}</span>` : ''}
    </div>
    <p style="color:#9099B0;font-size:12px;line-height:1.5;margin:0 0 8px;border-top:1px solid #f1f5f9;padding-top:12px;font-style:italic">${s.context}</p>
    <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;margin-bottom:12px">
      <p style="color:#1A1A5E;font-size:12px;line-height:1.6;font-weight:500;margin:0">${s.reco}</p>
    </div>
    <button onclick="if(window.umami){umami.track('cta_click',{scenario:'${key}',venue:'${data.venue_id}'})}; window.open('${ctaHref}','_blank')"
      style="display:flex;align-items:center;justify-content:center;gap:8px;background:#F0967A;color:#fff;font-weight:700;padding:10px 16px;border-radius:10px;font-size:12px;width:100%;border:none;cursor:pointer">
      ${WA_ICON} ${ctaLabel}
    </button>
  </div>`;
}

function renderPage(data) {
  // Ordre funnel : Search → Trafic → Conversion → Transformation
  const PRIORITY = ['privateaser_search', 'direct_traffic_good', 'direct_traffic_bad', 'conversion', 'transformation'];
  const sorted  = (data.scenarios || []).sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
  const count   = sorted.length;
  const cards   = sorted.map((k, i) => renderCard(k, data, i)).join('\n');
  const name    = data.venue_name || '';
  const subtitle = `Voici ${count === 1 ? 'une recommandation personnalisée' : count + ' recommandations personnalisées'} basées sur votre activité des dernières semaines.`;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Joy — ${name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <script defer src="https://umami-production-6419.up.railway.app/script.js" data-website-id="a88c2899-babf-42ff-b139-71c91f687158"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
    body{background:#F8F8FF;color:#1A1A5E;min-height:100vh}
    header{background:#fff;border-bottom:1px solid #f1f5f9;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
    .venue-name{font-size:11px;font-weight:600;color:#9099B0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    main{max-width:640px;margin:0 auto;padding:16px 16px 48px;display:flex;flex-direction:column;gap:12px}
    .intro-card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 16px rgba(26,26,94,0.07);border:1px solid #f1f5f9}
    .intro-tag{color:#F0967A;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
    .intro-title{font-size:18px;font-weight:800;color:#1A1A5E;margin-bottom:6px}
    .intro-sub{font-size:12px;color:#9099B0;line-height:1.5}
    .cards{display:flex;flex-direction:column;gap:12px}
    footer{text-align:center;padding:8px 0 16px}
    footer p{font-size:11px;color:#9099B0;margin-top:6px}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  </style>
</head>
<body>
  <header>
    ${LOGO_SVG}
    <span class="venue-name">${name}</span>
  </header>
  <main>
    <div class="intro-card">
      <p class="intro-tag">Vos recommandations Joy</p>
      <p class="intro-title">${name}</p>
      <p class="intro-sub">${subtitle}</p>
    </div>
    <div class="cards">${cards}</div>
    <footer>
      ${LOGO_SVG}
      <p>Ces recommandations sont personnalisées pour votre établissement.</p>
    </footer>
  </main>
</body>
</html>`;
}

const NOT_FOUND_HTML = `<!doctype html><html lang="fr"><head><meta charset="UTF-8"><title>Page introuvable</title></head><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>😕 Page introuvable</h1><p>Ce lien n'est plus valide.</p></body></html>`;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));

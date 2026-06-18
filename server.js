const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

const AUTH_TOKEN = process.env.AUTH_TOKEN || 'joy-br-2026-secret';
const BASE_URL   = process.env.BASE_URL   || 'https://br-externe-production.up.railway.app';

function toSlug(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'venue';
}

app.post('/pages', (req, res) => {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${AUTH_TOKEN}`) return res.status(401).json({ error: 'Unauthorized' });

  const { venue_id, venue_name, recos, reco_texts, metrics } = req.body;
  if (!venue_id) return res.status(400).json({ error: 'venue_id requis' });

  const RECO_MAP = {
    search_upsell: 'privateaser_search',
    transfo_good_reactivity: 'transformation',
    transfo_bad_reactivity: 'transformation',
    conversion: 'conversion',
    trafic_direct: 'direct_traffic',
    features_usage: 'feature_usage',
  };

  const scenarios = (recos || []).map(r => RECO_MAP[r]).filter(Boolean);
  const reactivity = (metrics?.transformation_color === 'red') ? 'slow' : 'normal';

  const payload = {
    venue_id,
    venue_name: venue_name || `Venue ${venue_id}`,
    scenarios,
    reactivity,
    reco_texts: reco_texts || {},
    metrics: metrics || {},
  };

  const token = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const slug = toSlug(venue_name || venue_id);
  const url = `${BASE_URL}/venue/${slug}?token=${token}`;

  return res.json({ ok: true, url });
});

// Route générique — le slug est décoratif, les données sont dans le token
app.get('/venue/:slug', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(PAGE_HTML);
});

app.get('/health', (_, res) => res.json({ ok: true }));

const LOGO_SVG = `<svg width="60" height="27" viewBox="0 0 241 108" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><path d="M9.196 107.631C17.983 107.631 24.496 105.316 28.737 100.685C32.977 96.054 35.097 88.802 35.097 78.929L35.097 0L15.48 0L15.48 78.319C15.48 82.186 14.764 84.96 13.334 86.639C11.903 88.319 9.758 89.158 6.897 89.158C3.934 89.158 1.635 89.107 0 89.006L0 107.02C3.372 107.428 6.437 107.631 9.196 107.631Z" fill="#3226C0"/><g transform="translate(56.155 2.34)" fill="#FDA886"><path d="M65.94 8.815C71.47 10.572 74.496 16.381 72.699 21.788C70.919 27.141 65.079 30.095 59.596 28.448L59.43 28.396C57.014 27.628 54.477 27.216 51.875 27.182L51.519 27.179C45.704 27.179 40.99 22.57 40.99 16.884C40.99 11.198 45.704 6.589 51.519 6.589C56.464 6.589 61.317 7.345 65.94 8.815ZM87.583 62.55C81.827 62.537 77.159 58.009 77.08 52.401L77.079 52.149C77.077 49.618 76.693 47.149 75.95 44.793L75.846 44.472C74.057 39.062 77.092 33.258 82.625 31.509C88.158 29.76 94.094 32.727 95.883 38.137C97.321 42.485 98.084 47.04 98.135 51.688L98.137 52.279C98.123 57.964 93.398 62.563 87.583 62.55ZM65.786 95.576C60.25 97.315 54.32 94.336 52.542 88.922C50.781 83.563 53.75 77.827 59.181 76.026L59.347 75.972C61.789 75.205 64.095 74.08 66.193 72.638L66.478 72.439C71.189 69.107 77.772 70.14 81.18 74.746C84.588 79.353 83.532 85.789 78.82 89.122C74.857 91.926 70.462 94.108 65.786 95.576ZM13.651 78.761C10.256 74.145 11.331 67.711 16.052 64.392C20.726 61.105 27.221 62.103 30.645 66.602L30.748 66.74C32.249 68.781 34.059 70.594 36.109 72.112L36.39 72.317C41.073 75.688 42.075 82.132 38.628 86.711C35.181 91.291 28.59 92.271 23.907 88.9C19.969 86.066 16.506 82.642 13.651 78.761ZM14.02 25.087C17.478 20.516 24.071 19.551 28.746 22.932C33.375 26.279 34.388 32.631 31.053 37.193L30.95 37.331C29.424 39.349 28.217 41.577 27.373 43.944L27.261 44.268C25.423 49.662 19.462 52.579 13.944 50.783C8.427 48.987 5.444 43.157 7.281 37.763C8.832 33.208 11.11 28.933 14.02 25.087Z"/></g><path d="M194.366 107.631L241 0L219.389 0L203.466 39.124C201.624 43.561 200.649 47.89 200.541 52.111L199.891 52.111C199.674 46.591 198.374 41.126 195.991 35.715L181.042 0L159.107 0L190.792 69.644L174.056 107.631L194.366 107.631Z" fill="#3226C0"/></g></svg>`;

const PAGE_HTML = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Joy — Vos recommandations</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
          colors: {
            joy: {
              blue: '#3226C0',
              coral: '#F0967A', 'coral-dark': '#D97A5A', 'coral-light': '#FDF1EC',
              navy: '#1A1A5E', bg: '#F8F8FF', muted: '#9099B0',
            },
          },
          boxShadow: { card: '0 2px 16px rgba(26,26,94,0.07)' },
        },
      },
    };
  <\/script>
  <style>
    * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    body { background-color: #F8F8FF; }
    .fade-in { animation: fadeIn .35s ease; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body class="text-joy-navy min-h-screen">

  <header class="bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between sticky top-0 z-10">
    <div>${LOGO_SVG}</div>
    <span id="venue-name-header" class="text-xs font-semibold text-joy-muted truncate max-w-[180px]"></span>
  </header>

  <div id="view-loading" class="flex flex-col items-center justify-center min-h-[70vh] gap-4">
    <div class="w-10 h-10 border-4 border-joy-coral/20 border-t-joy-coral rounded-full spin"></div>
    <p class="text-joy-muted text-sm font-medium">Chargement de vos recommandations…</p>
  </div>

  <div id="view-error" class="hidden flex flex-col items-center justify-center min-h-[70vh] px-6 text-center gap-4">
    <div class="text-4xl">😕</div>
    <h2 class="text-joy-navy font-bold text-lg">Lien invalide ou expiré</h2>
    <p class="text-joy-muted text-sm leading-relaxed max-w-xs">Ce lien n'est plus valide. Contactez votre chargé de compte Joy pour recevoir un nouveau lien.</p>
  </div>

  <main id="view-content" class="hidden max-w-lg mx-auto px-4 py-4 space-y-3 fade-in pb-8">
    <section class="bg-white rounded-2xl shadow-card border border-slate-100 px-5 py-4">
      <p class="text-joy-coral text-xs font-bold uppercase tracking-widest mb-1">Vos recommandations Joy</p>
      <p id="main-subtitle" class="text-joy-muted text-xs leading-relaxed"></p>
    </section>
    <div id="reco-list" class="space-y-3"></div>
    <div class="text-center pt-1 pb-2">
      <div class="flex justify-center mb-1.5">${LOGO_SVG}</div>
      <p class="text-joy-muted text-xs">Ces recommandations sont personnalisées pour votre établissement.</p>
    </div>
  </main>

<script>
const SCENARIOS = {
  privateaser_search: {
    icon: '🔍', label: 'Visibilité Privateaser',
    context: () => 'Votre établissement est très bien positionné dans les recherches Privateaser.',
    reco: "Vous avez atteint le plafond de visibilité inclus dans votre abonnement actuel. Pour accéder à davantage de trafic, votre chargé de compte peut vous présenter les options disponibles.",
    tone: 'positive',
  },
  transformation: {
    icon: '✅', label: 'Transformation des demandes',
    context: () => 'La majorité de vos demandes ne se transforment pas en réservations confirmées.',
    reco: (d) => d.reactivity === 'slow'
      ? "Pour améliorer votre taux de transformation : répondez aux demandes rapidement, proposez des conditions claires et cohérentes avec votre vitrine, et adoptez une posture commerciale dans vos échanges. Votre chargé de compte peut vous accompagner."
      : "Pour améliorer votre taux de transformation : proposez des conditions simples et cohérentes avec votre vitrine, adoptez une posture commerciale et soyez assidu dans vos relances. Votre chargé de compte peut vous conseiller.",
    tone: 'neutral',
  },
  conversion: {
    icon: '🎯', label: 'Conversion de votre vitrine',
    context: () => "Peu de visiteurs de votre vitrine envoient une demande, alors qu'ils ont montré de l'intérêt.",
    reco: "Pour convertir davantage de visiteurs : misez sur la qualité de votre vitrine — photos d'événements groupes, salles prêtes à accueillir, vidéos, promotions. Votre chargé de compte peut vous aider à la mettre à jour.",
    tone: 'neutral',
  },
  direct_traffic: {
    icon: '📥', label: 'Trafic via Joy',
    context: () => "Vos demandes groupes n'arrivent pas suffisamment via Joy, ce qui réduit votre visibilité sur la plateforme.",
    reco: "Pensez à mettre votre vitrine évènementielle en avant : sur Instagram, Google, votre site internet. Votre chargé de compte peut vous aider à activer ces leviers.",
    tone: 'neutral',
  },
  feature_usage: {
    icon: '⚙️', label: 'Fonctionnalités Joy',
    context: () => "Certaines fonctionnalités Joy ne sont pas encore activées sur votre compte.",
    reco: "Activez la caution et utilisez l'éditeur de factures et devis Joy pour simplifier votre gestion. Votre chargé de compte peut vous guider en quelques minutes.",
    tone: 'neutral',
  },
};

const TONE_STYLE = {
  positive: { border: 'border-blue-100', iconBg: 'bg-blue-50', tag: 'bg-blue-50 text-blue-700 border-blue-200', tagLabel: 'Opportunité ✨' },
  neutral:  { border: 'border-slate-100', iconBg: 'bg-joy-coral-light', tag: 'bg-joy-coral-light text-joy-coral border-joy-coral/20', tagLabel: 'Recommandation' },
};

const WA_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

function recoCard(scenario_key, data, index) {
  const s = SCENARIOS[scenario_key];
  if (!s) return '';
  const style = TONE_STYLE[s.tone] ?? TONE_STYLE.neutral;
  const context = typeof s.context === 'function' ? s.context(data) : s.context;
  const reco = typeof s.reco === 'function' ? s.reco(data) : s.reco;

  return \`<div class="bg-white rounded-2xl shadow-card border \${style.border} px-5 py-4 fade-in" style="animation-delay:\${index * 0.08}s">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-xl \${style.iconBg} flex items-center justify-center text-lg flex-shrink-0">\${s.icon}</div>
        <p class="font-bold text-joy-navy text-xs leading-tight">\${s.label}</p>
      </div>
      <span class="text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 \${style.tag}">\${style.tagLabel}</span>
    </div>
    <p class="text-joy-muted text-xs leading-relaxed mb-2 border-t border-slate-100 pt-3">\${context}</p>
    <div class="bg-slate-50 rounded-xl px-3 py-2.5 mb-3">
      <p class="text-joy-navy text-xs leading-relaxed font-medium">\${reco}</p>
    </div>
    <button onclick="window.open('https://joy.privateaser.com', '_blank')"
      class="inline-flex items-center justify-center gap-2 bg-joy-coral hover:bg-joy-coral-dark text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors w-full">
      \${WA_ICON} Contacter mon chargé de compte
    </button>
  </div>\`;
}

function render(data) {
  document.getElementById('venue-name-header').textContent = data.venue_name ?? '';
  const count = data.scenarios.length;
  document.getElementById('main-subtitle').textContent =
    \`Voici \${count === 1 ? 'une recommandation personnalisée' : count + ' recommandations personnalisées'} basées sur votre activité des dernières semaines.\`;

  const PRIORITY = ['privateaser_search', 'transformation', 'conversion', 'direct_traffic', 'feature_usage'];
  const sorted = [...data.scenarios].sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
  document.getElementById('reco-list').innerHTML = sorted.map((s, i) => recoCard(s, data, i)).join('');

  hide('view-loading');
  show('view-content');
}

function load() {
  const token = new URLSearchParams(location.search).get('token');
  if (!token || token === 'demo') { render(DEMO_DATA); return; }
  try {
    const json = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    render(JSON.parse(json));
  } catch { hide('view-loading'); show('view-error'); }
}

const DEMO_DATA = {
  venue_name: 'Café San Francisco',
  scenarios: ['transformation', 'conversion', 'privateaser_search'],
  reactivity: 'slow',
};

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

load();
<\/script>
</body>
</html>`;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BR Externe server on port ${PORT}`));

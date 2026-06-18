const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

// Stockage en mémoire des pages (venue_id → données)
// En prod Railway redémarre rarement, mais si besoin on peut ajouter une DB
const pages = new Map();

// Token d'auth pour que seul n8n puisse pousser des données
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'joy-br-externe-secret';

// ─── POST /pages — reçoit les données depuis n8n ───────────────────────────
app.post('/pages', (req, res) => {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { venue_id, venue_name, recos, reco_texts, metrics } = req.body;
  if (!venue_id) return res.status(400).json({ error: 'venue_id requis' });

  pages.set(String(venue_id), { venue_id, venue_name, recos, reco_texts, metrics, created_at: new Date().toISOString() });

  const base_url = process.env.BASE_URL || `https://${req.headers.host}`;
  const url = `${base_url}/venue/${venue_id}`;

  return res.json({ ok: true, url });
});

// ─── GET /venue/:id — affiche la page HTML ─────────────────────────────────
app.get('/venue/:id', (req, res) => {
  const data = pages.get(req.params.id);
  if (!data) return res.status(404).send(renderNotFound());
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderPage(data));
});

// ─── GET /health — healthcheck Railway ────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, pages: pages.size }));

// ─── Rendu HTML ────────────────────────────────────────────────────────────
const RECO_CONFIG = {
  search_upsell:           { icon: '🔍', label: 'Visibilité Privateaser',       color: '#EBF5FF', border: '#3B82F6', tag: 'Opportunité +', tag_color: '#3B82F6' },
  transfo_good_reactivity: { icon: '✅', label: 'Transformation des demandes',  color: '#FFF9EB', border: '#F59E0B', tag: 'Recommandation',  tag_color: '#F59E0B' },
  transfo_bad_reactivity:  { icon: '✅', label: 'Transformation des demandes',  color: '#FFF9EB', border: '#F59E0B', tag: 'Recommandation',  tag_color: '#F59E0B' },
  conversion:              { icon: '🎯', label: 'Conversion de votre vitrine',  color: '#FFF5EB', border: '#F97316', tag: 'Recommandation',  tag_color: '#F97316' },
  trafic_direct:           { icon: '📢', label: 'Trafic direct',                color: '#F0FDF4', border: '#22C55E', tag: 'Recommandation',  tag_color: '#22C55E' },
  features_usage:          { icon: '⚙️', label: 'Fonctionnalités Joy',          color: '#F5F3FF', border: '#8B5CF6', tag: 'À activer',       tag_color: '#8B5CF6' },
};

const COLOR_CONTEXT = {
  search_color: {
    green:  'Votre établissement est très bien positionné dans les recherches Privateaser.',
    blue:   'Votre établissement est excellemment positionné dans les recherches Privateaser.',
    orange: 'Votre établissement est moyennement positionné dans les recherches Privateaser.',
    red:    'Votre établissement est peu visible dans les recherches Privateaser.',
  },
  transformation_color: {
    green:  'La majorité de vos demandes se transforment en réservations confirmées.',
    blue:   'Vos demandes se transforment très bien en réservations.',
    orange: 'Une partie de vos demandes ne se transforment pas en réservations confirmées.',
    red:    'La majorité de vos demandes ne se transforment pas en réservations confirmées.',
  },
  conversion_color: {
    green:  'Vos visiteurs passent bien à l\'action de demande.',
    blue:   'Vos visiteurs passent très bien à l\'action de demande.',
    orange: 'Peu de visiteurs de votre vitrine envoient une demande, alors qu\'ils ont montré de l\'intérêt.',
    red:    'Très peu de visiteurs de votre vitrine envoient une demande.',
  },
  trafic_direct_color: {
    green:  'Une bonne part de vos clients arrivent directement par Joy.',
    blue:   'La majorité de vos clients passent par Joy.',
    orange: 'Une partie de vos clients n\'arrive pas par la plateforme Joy.',
    red:    'La plupart de vos clients n\'arrivent pas par la plateforme Joy.',
  },
};

const RECO_TO_METRIC = {
  search_upsell: 'search_color',
  transfo_good_reactivity: 'transformation_color',
  transfo_bad_reactivity: 'transformation_color',
  conversion: 'conversion_color',
  trafic_direct: 'trafic_direct_color',
  features_usage: null,
};

function getContext(reco_id, metrics) {
  const metricKey = RECO_TO_METRIC[reco_id];
  if (!metricKey || !metrics) return '';
  const colorVal = metrics[metricKey];
  return (COLOR_CONTEXT[metricKey] || {})[colorVal] || '';
}

function renderCard(reco_id, reco_text, metrics) {
  const cfg = RECO_CONFIG[reco_id] || { icon: '💡', label: reco_id, color: '#F9FAFB', border: '#6B7280', tag: 'Recommandation', tag_color: '#6B7280' };
  const context = getContext(reco_id, metrics);
  const title = reco_text?.title || cfg.label;
  const body = reco_text?.body || '';
  const cta = reco_text?.cta || 'Contacter mon chargé de compte';

  return `
    <div class="card" style="background:${cfg.color}; border-left: 4px solid ${cfg.border};">
      <div class="card-header">
        <span class="card-icon">${cfg.icon}</span>
        <span class="card-label">${cfg.label}</span>
        <span class="card-tag" style="color:${cfg.tag_color}; border-color:${cfg.tag_color};">${cfg.tag}</span>
      </div>
      ${context ? `<p class="card-context">${context}</p>` : ''}
      ${body ? `<p class="card-body" style="color:${cfg.border};">${body}</p>` : ''}
      <button class="cta-btn" onclick="window.open('https://joy.privateaser.com', '_blank')">
        💬 ${cta}
      </button>
    </div>`;
}

function renderPage({ venue_id, venue_name, recos = [], reco_texts = {}, metrics = {} }) {
  const name = venue_name && venue_name !== venue_id ? venue_name : `Venue ${venue_id}`;
  const cards = recos.map(r => renderCard(r, reco_texts[r], metrics)).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vos recommandations Joy — ${name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F9FAFB; color: #111827; min-height: 100vh; }

    .header { background: #fff; border-bottom: 1px solid #E5E7EB; padding: 20px 24px; display: flex; align-items: center; gap: 12px; }
    .header-logo { font-weight: 800; font-size: 20px; color: #111827; letter-spacing: -0.5px; }
    .header-logo span { color: #FF5A1F; }

    .main { max-width: 640px; margin: 0 auto; padding: 32px 16px 64px; }

    .hero { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #E5E7EB; }
    .hero-tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #FF5A1F; margin-bottom: 8px; }
    .hero-title { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .hero-sub { font-size: 14px; color: #6B7280; line-height: 1.5; }

    .cards { display: flex; flex-direction: column; gap: 16px; }

    .card { background: #fff; border-radius: 12px; padding: 20px; border: 1px solid #E5E7EB; }
    .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .card-icon { font-size: 20px; }
    .card-label { font-size: 15px; font-weight: 600; color: #111827; flex: 1; }
    .card-tag { font-size: 11px; font-weight: 600; border: 1px solid; border-radius: 20px; padding: 2px 10px; white-space: nowrap; }
    .card-context { font-size: 13px; color: #6B7280; margin-bottom: 10px; font-style: italic; line-height: 1.5; }
    .card-body { font-size: 13px; font-weight: 500; line-height: 1.6; margin-bottom: 16px; background: rgba(255,255,255,0.6); border-radius: 8px; padding: 12px; }
    .cta-btn { width: 100%; background: #FF5A1F; color: #fff; border: none; border-radius: 8px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .cta-btn:hover { background: #E54E1A; }

    .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #9CA3AF; }
    .footer a { color: #FF5A1F; text-decoration: none; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-logo"><span>Joy</span> by Privateaser</div>
  </div>
  <div class="main">
    <div class="hero">
      <div class="hero-tag">Vos recommandations Joy</div>
      <div class="hero-title">${name}</div>
      <div class="hero-sub">Voici ${recos.length} recommandation${recos.length > 1 ? 's' : ''} personnalisée${recos.length > 1 ? 's' : ''} basée${recos.length > 1 ? 's' : ''} sur votre activité des dernières semaines.</div>
    </div>
    <div class="cards">
      ${cards}
    </div>
    <div class="footer">
      Propulsé par <a href="https://joy.privateaser.com" target="_blank">Joy</a>
    </div>
  </div>
</body>
</html>`;
}

function renderNotFound() {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Page introuvable</title></head><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Page introuvable</h1><p>Cette page n'existe pas ou a expiré.</p></body></html>`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BR Externe server running on port ${PORT}`));

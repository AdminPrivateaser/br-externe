# BR Externe Server

Serveur Express pour les pages de Business Review gérants Joy/Privateaser.

## Stack
- Node.js + Express
- Stockage en mémoire (Map)
- Déployé sur Railway

## API

### POST /pages
Reçoit les données depuis n8n et crée la page.

**Headers :** `Authorization: Bearer <AUTH_TOKEN>`

**Body :**
```json
{
  "venue_id": "43310",
  "venue_name": "Café San Francisco",
  "recos": ["search_upsell", "conversion", "features_usage"],
  "reco_texts": {
    "search_upsell": { "title": "...", "body": "...", "cta": "..." }
  },
  "metrics": {
    "search_color": "green",
    "conversion_color": "orange"
  }
}
```

**Réponse :** `{ "ok": true, "url": "https://xxx.railway.app/venue/43310" }`

### GET /venue/:id
Affiche la page HTML du venue.

### GET /health
Healthcheck.

## Variables d'environnement

| Variable | Description | Défaut |
|---|---|---|
| `AUTH_TOKEN` | Token d'auth pour l'API n8n | `joy-br-externe-secret` |
| `BASE_URL` | URL de base du serveur | auto-détecté |
| `PORT` | Port d'écoute | `3000` |

## Déploiement Railway

1. Crée un nouveau projet Railway depuis ce repo GitHub
2. Ajoute les variables d'env `AUTH_TOKEN` et `BASE_URL`
3. Railway déploie automatiquement à chaque push

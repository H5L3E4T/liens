# Les liens de Loan

Mes guides, mes vidéos « Le Tchek IA » et les outils IA que je recommande.

**Site :** https://loanhsl.app/ (Vercel, mis à jour automatiquement à chaque envoi sur `main`)

- `index.html` : la page de liens (vidéos, boîte à outils, bandeau de logos cliquable).
- `guide/` : le guide « Créer ton 1er outil avec l'IA ».
- `media/` : les vidéos et leurs miniatures ; `img/` : logos, mascotte, image d'aperçu (`og.jpg`).

Mise à jour : Claude modifie la page puis pousse ici ; Vercel republie le site tout seul en quelques secondes.

## Boutique : paiement Apple Pay sur la page

- `api/pay.js` : catalogue de toutes les offres (montants en centimes) et création du paiement Stripe côté serveur. Le montant ne vient jamais du navigateur.
- Sur la page, le visiteur choisit son offre, puis paie avec le bouton Apple Pay / Google Pay (ou par carte via le lien Stripe).
- Réglages dans Vercel → Settings → Environment Variables (Production) :
  - `STRIPE_SECRET_KEY` : clé restreinte Stripe « loanhsl-boutique » (PaymentIntents : écriture).
  - `STRIPE_PUBLISHABLE_KEY` : clé publique `pk_live_…`.
  - `VENTES_OUVERTES` : groupes ouverts, séparés par des virgules (`zop`, `cv`). Vide = tout fermé. Redéployer après chaque changement.
- Dans Stripe → Paramètres → Domaines des moyens de paiement : `loanhsl.app` et `www.loanhsl.app` doivent être enregistrés, sinon Apple Pay ne s'affiche pas.
- Ajouter une offre : une ligne dans `CATALOGUE`, puis le bloc sur la page.

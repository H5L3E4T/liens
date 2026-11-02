// Boutique de loanhsl.app : paiement Apple Pay / Google Pay directement sur la page, pour toutes les offres.
//
// GET  /api/pay?groupe=zop  -> { open, pk }        : la page sait si la vente de ce groupe est ouverte.
// POST /api/pay             -> { clientSecret }    : crée le paiement Stripe pour l'offre choisie.
//
// Réglages dans Vercel (Settings > Environment Variables), jamais dans le code :
//   STRIPE_SECRET_KEY       clé restreinte Stripe (PaymentIntents : écriture)
//   STRIPE_PUBLISHABLE_KEY  clé publique (pk_live_...)
//   VENTES_OUVERTES         groupes ouverts à la vente, séparés par des virgules (ex. "zop,cv"). Vide = tout fermé.
//
// Ajouter une offre : une ligne dans CATALOGUE (montant en centimes), puis le bouton sur la page.

const CATALOGUE = {
  'zop-essentiel': { groupe: 'zop', amount: 2900, label: 'Zéro Oubli Paie · Essentiel' },
  'zop-pro': { groupe: 'zop', amount: 5900, label: 'Zéro Oubli Paie · Pro' },
  'zop-accompagnement': { groupe: 'zop', amount: 49000, label: 'Zéro Oubli Paie · Accompagnement' },
  'cv-essentiel': { groupe: 'cv', amount: 1500, label: 'Pack CV · Essentiel' },
  'cv-pro': { groupe: 'cv', amount: 2900, label: 'Pack CV · Pro' },
  // Offre cachée pour tester Apple Pay (page ?test=applepay). Fermée si « test » n'est pas dans VENTES_OUVERTES.
  'test-1euro': { groupe: 'test', amount: 100, label: 'Test Apple Pay · 1 €' },
};

function ouvert(groupe) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) return false;
  const liste = (process.env.VENTES_OUVERTES || '').split(',').map((x) => x.trim()).filter(Boolean);
  return liste.includes(groupe);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const groupe = String((req.query && req.query.groupe) || '');
    const open = ouvert(groupe);
    return res.status(200).json({ open, pk: open ? process.env.STRIPE_PUBLISHABLE_KEY : null });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const id = body && body.offre;
  const offre = Object.prototype.hasOwnProperty.call(CATALOGUE, id) ? CATALOGUE[id] : null;
  if (!offre) return res.status(400).json({ error: 'offre' });
  if (!ouvert(offre.groupe)) return res.status(403).json({ error: 'closed' });

  const email = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ? body.email.slice(0, 200) : null;

  // Le montant vient toujours du catalogue, jamais du navigateur.
  const params = new URLSearchParams();
  params.append('amount', String(offre.amount));
  params.append('currency', 'eur');
  params.append('payment_method_types[]', 'card'); // carte + Apple Pay + Google Pay
  params.append('description', offre.label);
  params.append('metadata[offre]', id);
  params.append('metadata[groupe]', offre.groupe);
  params.append('metadata[canal]', 'loanhsl.app');
  if (email) params.append('receipt_email', email);

  try {
    const r = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const pi = await r.json();
    if (!r.ok) {
      console.error('stripe', pi && pi.error && pi.error.code);
      return res.status(502).json({ error: 'stripe' });
    }
    return res.status(200).json({ clientSecret: pi.client_secret });
  } catch (e) {
    console.error('stripe network');
    return res.status(502).json({ error: 'network' });
  }
};

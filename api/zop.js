// Zéro Oubli Paie : paiement Apple Pay / Google Pay directement sur loanhsl.app.
//
// GET  /api/zop  -> { open, pk }  : la page sait si la vente est ouverte et reçoit la clé publique.
// POST /api/zop  -> { clientSecret } : crée le paiement Stripe pour l'offre choisie.
//
// Réglages dans Vercel (Settings > Environment Variables), jamais dans le code :
//   STRIPE_SECRET_KEY       clé secrète (de préférence une clé restreinte : PaymentIntents en écriture)
//   STRIPE_PUBLISHABLE_KEY  clé publique (pk_live_...)
//   ZOP_OPEN                "1" pour ouvrir la vente, absent ou "0" pour la garder fermée

const OFFRES = {
  essentiel: { amount: 2900, label: 'Zéro Oubli Paie · Essentiel' },
  pro: { amount: 5900, label: 'Zéro Oubli Paie · Pro' },
  accompagnement: { amount: 49000, label: 'Zéro Oubli Paie · Accompagnement' },
};

function isOpen() {
  return process.env.ZOP_OPEN === '1' && !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PUBLISHABLE_KEY;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({ open: isOpen(), pk: isOpen() ? process.env.STRIPE_PUBLISHABLE_KEY : null });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method' });
  }

  if (!isOpen()) return res.status(403).json({ error: 'closed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const niveau = body && body.niveau;
  const offre = OFFRES[niveau];
  if (!offre) return res.status(400).json({ error: 'offre' });

  const email = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ? body.email.slice(0, 200) : null;

  // Le montant vient toujours d'ici, jamais du navigateur.
  const params = new URLSearchParams();
  params.append('amount', String(offre.amount));
  params.append('currency', 'eur');
  params.append('payment_method_types[]', 'card'); // carte + Apple Pay + Google Pay
  params.append('description', offre.label);
  params.append('statement_descriptor_suffix', 'ZERO OUBLI PAIE');
  params.append('metadata[offre]', 'zero-oubli-paie');
  params.append('metadata[niveau]', niveau);
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

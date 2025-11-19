// Stripe Checkout API
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { service, price, customerEmail, customerName } = req.body;

    // Validate required fields
    if (!service || !price || !customerEmail) {
      return res.status(400).json({ 
        error: 'Missing required fields'
      });
    }

    // Convert price to cents
    const amountInCents = Math.round(parseFloat(price) * 100);

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: service,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: process.env.REDIRECT_URL || 'https://trinityproclean.com/thank-you',
      cancel_url: 'https://trinityproclean.com/checkout',
      customer_email: customerEmail,
    });

    return res.status(200).json({
      checkoutUrl: session.url,
    });

  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message,
    });
  }
};

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      service,
      price,
      customerEmail,
      customerName,
      customerPhone,
      customerAddress,
      customerCity,
      customerState,
      customerZip,
      specialInstructions,
      addons,
      discountCode,
    } = req.body;

    // Validate required fields
    if (!service || !price || !customerEmail) {
      return res.status(400).json({ 
        error: 'Missing required fields: service, price, or customerEmail',
        received: req.body 
      });
    }

    // Convert price to cents (Stripe uses cents)
    const priceInCents = Math.round(parseFloat(price) * 100);

    // Build line items
    const lineItems = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: service,
            description: specialInstructions || 'Professional cleaning service',
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ];

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: customerEmail,
      success_url: 'https://trinityproclean.com/thank-you?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://trinityproclean.com/checkout',
      metadata: {
        service,
        customerName,
        customerPhone,
        customerAddress,
        customerCity,
        customerState,
        customerZip,
        specialInstructions: specialInstructions || '',
        addons: JSON.stringify(addons || []),
        discountCode: discountCode || '',
      },
    });

    // Return the checkout URL
    return res.status(200).json({ 
      checkoutUrl: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ 
      error: error.message,
      details: error.type,
      stack: error.stack 
    });
  }
};

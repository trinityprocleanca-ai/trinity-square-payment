// Square Checkout API Function
const { Client, Environment } = require('square');

// Initialize Square client
const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production,
});

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
    if (!service || !price || !customerEmail || !customerName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['service', 'price', 'customerEmail', 'customerName'],
        received: req.body
      });
    }

    // Convert price to cents (Square uses smallest currency unit)
    const amountMoney = {
      amount: Math.round(parseFloat(price) * 100),
      currency: 'USD',
    };

    console.log('Creating payment link with:', {
      service,
      amount: amountMoney.amount,
      customerEmail
    });

    // Create checkout using the correct API structure
    const { result } = await client.checkoutApi.createPaymentLink({
      idempotencyKey: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID,
        lineItems: [
          {
            name: service,
            quantity: '1',
            basePriceMoney: amountMoney,
          },
        ],
      },
      checkoutOptions: {
        redirectUrl: process.env.REDIRECT_URL || 'https://trinityproclean.com/thank-you',
        askForShippingAddress: false,
      },
      prePopulatedData: {
        buyerEmail: customerEmail,
      },
    });

    console.log('Square API response:', result);

    // Check different possible response structures
    const checkoutUrl = result.paymentLink?.url || result.payment_link?.url || result.url;

    if (!checkoutUrl) {
      console.error('No checkout URL in response:', result);
      return res.status(500).json({
        error: 'Square did not return a checkout URL',
        details: 'Response structure unexpected',
        response: result
      });
    }

    return res.status(200).json({
      checkoutUrl: checkoutUrl,
    });
  } catch (error) {
    console.error('Square API Error:', error);
    return res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message,
      stack: error.stack
    });
  }
};

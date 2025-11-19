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

    // Convert price to cents
    const amountMoney = Math.round(parseFloat(price) * 100);

    console.log('Creating payment link for:', { service, amountMoney, customerEmail });

    // Try using the checkoutApi with proper structure
    try {
      const response = await client.checkoutApi.createPaymentLink({
        idempotencyKey: `trinity-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        order: {
          locationId: process.env.SQUARE_LOCATION_ID,
          lineItems: [
            {
              name: service,
              quantity: '1',
              basePriceMoney: {
                amount: BigInt(amountMoney),
                currency: 'USD',
              },
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

      console.log('Square response:', JSON.stringify(response, null, 2));

      // Extract URL from response
      const checkoutUrl = response?.result?.paymentLink?.url || 
                         response?.result?.payment_link?.url ||
                         response?.paymentLink?.url ||
                         response?.payment_link?.url;

      if (!checkoutUrl) {
        console.error('No URL found in response:', response);
        return res.status(500).json({
          error: 'Square response missing checkout URL',
          response: response
        });
      }

      return res.status(200).json({
        checkoutUrl: checkoutUrl,
      });

    } catch (squareError) {
      console.error('Square API detailed error:', {
        message: squareError.message,
        errors: squareError.errors,
        statusCode: squareError.statusCode,
        body: squareError.body
      });

      return res.status(500).json({
        error: 'Square API error',
        message: squareError.message,
        details: squareError.errors || squareError.body,
      });
    }

  } catch (error) {
    console.error('General error:', error);
    return res.status(500).json({
      error: 'Server error',
      details: error.message,
    });
  }
};

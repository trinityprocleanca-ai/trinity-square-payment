// Square Checkout API Function using direct HTTP calls

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

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const redirectUrl = process.env.REDIRECT_URL || 'https://trinityproclean.com/thank-you';

    if (!accessToken || !locationId) {
      return res.status(500).json({ 
        error: 'Missing Square credentials' 
      });
    }

    console.log('Creating payment link for:', { service, amountMoney, customerEmail });

    // Create payment link using direct HTTP call
    const paymentLinkData = {
      idempotency_key: `trinity-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      order: {
        location_id: locationId,
        line_items: [
          {
            name: service,
            quantity: '1',
            base_price_money: {
              amount: amountMoney,
              currency: 'USD',
            },
          },
        ],
      },
      checkout_options: {
        redirect_url: redirectUrl,
        ask_for_shipping_address: false,
      },
      pre_populated_data: {
        buyer_email: customerEmail,
      },
    };

    const response = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentLinkData),
    });

    const data = await response.json();

    console.log('Square response:', data);

    if (data.errors) {
      console.error('Square API errors:', data.errors);
      return res.status(400).json({
        error: 'Square API error',
        details: data.errors,
      });
    }

    const checkoutUrl = data.payment_link?.url;

    if (!checkoutUrl) {
      console.error('No URL in response:', data);
      return res.status(500).json({
        error: 'No checkout URL returned',
        response: data,
      });
    }

    return res.status(200).json({
      checkoutUrl: checkoutUrl,
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      error: 'Server error',
      details: error.message,
    });
  }
};

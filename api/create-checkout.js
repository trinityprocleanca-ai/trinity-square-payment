// Square Checkout API using direct HTTP calls

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

    console.log('Creating checkout for:', { service, amountMoney, customerEmail });

    // First, create an order
    const orderData = {
      idempotency_key: `order-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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
    };

    const orderResponse = await fetch('https://connect.squareup.com/v2/orders', {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    const orderResult = await orderResponse.json();

    if (orderResult.errors) {
      console.error('Order creation errors:', orderResult.errors);
      return res.status(400).json({
        error: 'Failed to create order',
        details: orderResult.errors,
      });
    }

    const orderId = orderResult.order?.id;

    if (!orderId) {
      console.error('No order ID in response:', orderResult);
      return res.status(500).json({
        error: 'No order ID returned',
        response: orderResult,
      });
    }

    console.log('Order created:', orderId);

    // Now create a checkout with that order
    const checkoutData = {
      idempotency_key: `checkout-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      order_id: orderId,
      redirect_url: redirectUrl,
      pre_populate_buyer_email: customerEmail,
    };

    const checkoutResponse = await fetch(`https://connect.squareup.com/v2/locations/${locationId}/checkouts`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutData),
    });

    const checkoutResult = await checkoutResponse.json();

    console.log('Checkout response:', checkoutResult);

    if (checkoutResult.errors) {
      console.error('Checkout creation errors:', checkoutResult.errors);
      return res.status(400).json({
        error: 'Failed to create checkout',
        details: checkoutResult.errors,
      });
    }

    const checkoutUrl = checkoutResult.checkout?.checkout_page_url;

    if (!checkoutUrl) {
      console.error('No checkout URL in response:', checkoutResult);
      return res.status(500).json({
        error: 'No checkout URL returned',
        response: checkoutResult,
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

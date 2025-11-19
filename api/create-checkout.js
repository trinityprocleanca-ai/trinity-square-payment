const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      service,
      serviceSlug,
      tier,
      type,
      price,
      originalPrice,
      addons,
      addonsTotal,
      discountCode,
      discountAmount,
      customerEmail,
      customerName,
      customerPhone,
      customerAddress,
      customerCity,
      customerState,
      customerZip,
      specialInstructions,
    } = req.body;

    // Validate required fields
    if (!service || !price || !customerEmail || !customerName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: req.body 
      });
    }

    // Parse price to cents (Stripe uses cents)
    const priceInCents = Math.round(parseFloat(price) * 100);

    // Determine if this is a subscription or one-time payment
    const isSubscription = type === 'subscription';

    let session;

    if (isSubscription) {
      // CREATE SUBSCRIPTION CHECKOUT
      
      // Build line items for subscription
      const lineItems = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: service,
              description: specialInstructions || 'Monthly recurring cleaning service',
            },
            recurring: {
              interval: 'month',
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ];

      // Create Stripe Checkout Session for Subscription
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: lineItems,
        customer_email: customerEmail,
        success_url: 'https://trinityproclean.com/thank-you?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://trinityproclean.com/checkout',
        metadata: {
          service,
          serviceSlug,
          tier,
          type: 'subscription',
          customerName,
          customerPhone,
          customerAddress,
          customerCity,
          customerState,
          customerZip,
          specialInstructions,
          addons: JSON.stringify(addons || []),
          discountCode: discountCode || '',
        },
      });
    } else {
      // CREATE ONE-TIME PAYMENT CHECKOUT
      
      const lineItems = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: service,
              description: specialInstructions || 'One-time cleaning service',
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ];

      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        customer_email: customerEmail,
        success_url: 'https://trinityproclean.com/thank-you?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://trinityproclean.com/checkout',
        metadata: {
          service,
          serviceSlug,
          tier,
          type: 'one-time',
          customerName,
          customerPhone,
          customerAddress,
          customerCity,
          customerState,
          customerZip,
          specialInstructions,
          addons: JSON.stringify(addons || []),
          discountCode: discountCode || '',
        },
      });
    }

    // Return the checkout URL
    return res.status(200).json({ 
      checkoutUrl: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ 
      error: error.message,
      details: error.type 
    });
  }
};

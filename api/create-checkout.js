// Import Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Price ID mapping for subscriptions
const SUBSCRIPTION_PRICE_IDS = {
  'standard-cleaning-cozy-home': 'price_xxxxx1', // Replace with your actual Price IDs
  'standard-cleaning-comfortable-home': 'price_xxxxx2',
  'standard-cleaning-spacious-home': 'price_xxxxx3',
  'standard-cleaning-large-estate': 'price_xxxxx4',
  'standard-cleaning-luxury-estate': 'price_xxxxx5',
  'deep-cleaning-small-home': 'price_xxxxx6',
  'deep-cleaning-medium-home': 'price_xxxxx7',
  'deep-cleaning-large-home': 'price_xxxxx8',

};

module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      service,
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
      type, // 'one-time' or 'subscription'
      tier, // e.g., 'cozy-apartment', 'medium-home'
    } = req.body;

    // Get service key from URL parameters
    const serviceKey = `${service}-${tier}`.toLowerCase().replace(/\s+/g, '-');

    let sessionConfig = {
      customer_email: customerEmail,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout`,
      metadata: {
        customerName,
        customerPhone,
        customerAddress,
        customerCity,
        customerState,
        customerZip,
        specialInstructions: specialInstructions || '',
        service,
        tier,
        type,
      },
    };

    // SUBSCRIPTION MODE
    if (type === 'subscription') {
      const priceId = SUBSCRIPTION_PRICE_IDS[serviceKey];
      
      if (!priceId) {
        return res.status(400).json({ 
          error: 'Invalid subscription configuration',
          serviceKey 
        });
      }

      sessionConfig.mode = 'subscription';
      sessionConfig.line_items = [
        {
          price: priceId,
          quantity: 1,
        }
      ];

      // Add subscription-specific settings
      sessionConfig.subscription_data = {
        metadata: {
          service,
          tier,
          customerName,
          customerPhone,
        },
      };

      // Handle add-ons for subscriptions
      if (addons && addons.length > 0) {
        // Create one-time line items for add-ons (they'll recur with subscription)
        addons.forEach(addon => {
          sessionConfig.line_items.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Add-on: ${addon.name}`,
                description: `Recurring add-on service (${addon.quantity}x)`,
              },
              unit_amount: Math.round(addon.price * 100),
              recurring: {
                interval: 'month',
              },
            },
            quantity: addon.quantity,
          });
        });
      }

    } 
    // ONE-TIME PAYMENT MODE
    else {
      sessionConfig.mode = 'payment';
      
      const finalAmount = parseFloat(price) * 100; // Convert to cents

      sessionConfig.line_items = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: service,
              description: `One-time cleaning service for ${tier}`,
            },
            unit_amount: Math.round(finalAmount),
          },
          quantity: 1,
        }
      ];

      // Add one-time add-ons
      if (addons && addons.length > 0) {
        addons.forEach(addon => {
          sessionConfig.line_items.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Add-on: ${addon.name}`,
              },
              unit_amount: Math.round(addon.price * 100),
            },
            quantity: addon.quantity,
          });
        });
      }
    }

    // Create the checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Return the checkout URL
    return res.status(200).json({ 
      checkoutUrl: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ 
      error: error.message,
      details: error 
    });
  }
};

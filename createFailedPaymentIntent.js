require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const testUserEmails = [
  "user1@example.com",
  "user2@example.com",
  "user3@example.com",
  "user4@example.com",
  "user5@example.com",
  "user6@example.com",
  "user7@example.com",
  "user8@example.com",
  "user9@example.com",
];

//different error types for testing here: https://docs.stripe.com/testing?testing-method=payment-methods
const errorTypes = [
  "pm_card_chargeDeclined",
  "pm_card_chargeDeclinedInsufficientFunds",
  "pm_card_chargeDeclinedExpiredCard",
  "pm_card_chargeDeclinedIncorrectCvc",
];

async function triggerFailingIntent(userId) {
  try {
    const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000,
      currency: "usd",
      payment_method: errorType,
      confirm: true,
      metadata: {
        user_id: userId,
        test_run: "webhook_demo",
      },
      // disabling redirects was needed for testing
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });

    console.log("Intent created:", paymentIntent.id);
  } catch (err) {
    console.error(`[FAIL] ${userId}: ${err.message}`);
  }
}

triggerFailingIntent(
  testUserEmails[Math.floor(Math.random() * testUserEmails.length)]
);

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const TEST_USERS = [
  { id: "user1@example.com", failureRate: 0.1 },
  { id: "user2@example.com", failureRate: 0.6 },
  { id: "user3@example.com", failureRate: 0.2 },
  { id: "user4@example.com", failureRate: 0.2 },
  { id: "user5@example.com", failureRate: 0.4 },
  { id: "user6@example.com", failureRate: 0.6 },
  { id: "user7@example.com", failureRate: 0.1 },
  { id: "user8@example.com", failureRate: 0.3 },
  { id: "user9@example.com", failureRate: 0.7 },
];

// https://docs.stripe.com/testing?testing-method=tokens#visa -> test tokens from Stripe
const testTokens = {
  success: "tok_visa",
  declined: "tok_chargeDeclined",
  insufficientFunds: "tok_chargeDeclinedInsufficientFunds",
  expired: "tok_chargeDeclinedExpiredCard",
};

// Have a range of currencies
const currencyArray = ["usd", "eur", "gbp"];

async function createCharge(email, isFailure = false, failureType = "expired") {
  try {
    const token = isFailure ? testTokens[failureType] : testTokens.success;

    // Create a new customer with a test token attached as a source
    const customer = await stripe.customers.create({
      email,
      //use source to create a "default" token/card for testing -> saved to the users object
      source: token,
      metadata: {
        user_id: email,
        test_run: "daily_report_demo",
      },
    });

    // Now charge the customer's default source
    const charge = await stripe.charges.create({
      amount: 1000 + Math.floor(Math.random() * 5000),
      //floor to get round number
      currency: currencyArray[Math.floor(Math.random() * currencyArray.length)],
      customer: customer.id,
      metadata: {
        user_id: email,
        test_run: "daily_report_demo",
      },
    });

    return charge;
  } catch (err) {
    console.error(`[FAIL] ${email}: ${err.message}`);
    return null;
  }
}

async function generateCharges() {
  let totalCharges = 0;

  for (const user of TEST_USERS) {
    for (let i = 0; i < 15; i++) {
      const shouldFail = Math.random() < user.failureRate;
      const charge = await createCharge(user.id, shouldFail, "declined");

      // Simulate a refund on ~25% of successful charges
      if (charge && !shouldFail && Math.random() < 0.25) {
        await stripe.refunds.create({ charge: charge.id });
      }

      totalCharges++;
      if (totalCharges >= 100) return;
    }
  }
}

generateCharges();

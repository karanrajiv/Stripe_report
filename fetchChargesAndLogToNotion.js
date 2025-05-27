require("dotenv").config();
const { logChargeToNotion } = require("./updateTransactionsDB");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function fetchAllCharges() {
  const now = Math.floor(Date.now() / 1000); // current time in seconds
  const twentyFourHoursAgo = now - 60 * 60 * 24;

  const charges = await stripe.charges.list({
    // created: {
    //   gte: twentyFourHoursAgo,
    //   lte: now,
    // },
    limit: 100,
  });

  for (let item of charges.data) {
    try {
      const updateStatus = await logChargeToNotion({
        userId: item.metadata.user_id,
        amount: item.amount,
        itemStatus: item.status,
        refunded: item.refunded,
        chargeId: item.id,
        errorType: item.failure_message || "none",
        testRun: "daily_demo",
        timestamp: new Date(item.created * 1000).toISOString(),
      });
      console.log(updateStatus);
    } catch (err) {
      console.error(`[FAIL] ${item.metadata.user_id}: ${err.message}`);
    }
  }
}

fetchAllCharges();

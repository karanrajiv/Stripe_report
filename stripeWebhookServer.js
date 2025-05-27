// This is your test secret API key.
require("dotenv").config();
const { logChargeToNotion } = require("./updateTransactionsDB");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// Replace this endpoint secret with your endpoint's unique secret
// If you are testing with the CLI, find the secret by running 'stripe listen'
// If you are using an endpoint defined with the API or dashboard, look in your webhook settings
// at https://dashboard.stripe.com/webhooks
const endpointSecret = process.env.WEBHOOK_ENDPOINT_SECRET;
const express = require("express");
const app = express();

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    console.log("Webhook request recieved!");
    let event = request.body;
    // Only verify the event if you have an endpoint secret defined.
    // Otherwise use the basic event deserialized with JSON.parse
    if (endpointSecret) {
      // Get the signature sent by Stripe
      const signature = request.headers["stripe-signature"];
      try {
        event = stripe.webhooks.constructEvent(
          request.body,
          signature,
          endpointSecret
        );
      } catch (err) {
        console.log(`⚠️  Webhook signature verification failed.`, err.message);
        return response.sendStatus(400);
      }
    }

    // Handle the event
    switch (event.type) {
      case "payment_intent.payment_failed":
        console.log("Pushing the failure to the NotionDB!");
        console.log(event);
        const paymentIntent = event.data.object;
        const userId = paymentIntent.metadata.user_id || "Unknown User";
        const errorType =
          paymentIntent.last_payment_error?.message || "unknown_error";

        await logChargeToNotion({
          userId,
          amount: paymentIntent.amount || 0,
          itemStatus: "failed",
          refunded: false,
          chargeId: paymentIntent.id,
          errorType,
          testRun: "webhook",
          timestamp: new Date(
            (paymentIntent.created || Date.now()) * 1000
          ).toISOString(),
        });

        console.log("Pushed failed intent to Notion!");
        break;
      default:
        // Unexpected event type
        console.log(`Unhandled event type ${event.type}.`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

app.listen(4242, () => console.log("Running on port 4242"));

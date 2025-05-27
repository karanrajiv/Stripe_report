# StripeReport
A project to gather information from Stripe about successful and failed charges, and aggregate the data into useful report metrics in Notion.

To start project, you will need:
1. A notion account
2. A notion database to hold transaction data
3. A notion database to hold daily report data
4. A Test Stripe Account

Learn more about setting up Notion Integrations here: https://developers.notion.com/docs/authorization

Once the above has been configured, you will need to store the relevant keys in your .env file.

To create mock data:
1. Run node generateTestData.js (let this finish)
2. Run stripe listen --forward-to localhost:4242/webhook
3. Run npm start to start the webhook server
4. Run node createFailedPaymentIntent.js (Run this a couple of times to create some failure data).

Now that we have our test data set up:
1. node fetchChargesAndLogToNotion.js -> Populates the transaction table
2. node createStipeReport.js

You will now see your daily report in notion!

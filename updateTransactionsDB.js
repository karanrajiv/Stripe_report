const { Client } = require("@notionhq/client");
const notion = new Client({ auth: process.env.NOTION_TOKEN });

const TRANSACTION_LOG_DB_ID = process.env.TRANSACTION_LOG_DB_ID;

async function logChargeToNotion({
  userId,
  amount,
  itemStatus,
  refunded = false,
  chargeId = "",
  errorType = "",
  testRun = "daily_demo",
  timestamp = new Date().toISOString(),
}) {
  try {
    console.log("userId:", userId);
    const response = await notion.pages.create({
      parent: {
        database_id: TRANSACTION_LOG_DB_ID,
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: `Charge: ${chargeId}`,
              },
            },
          ],
        },
        "Status of Transaction": {
          status: {
            name: itemStatus,
          },
        },
        "Transaction Amount": {
          number: amount,
        },
        "User ID": {
          rich_text: [
            {
              text: {
                content: userId,
              },
            },
          ],
        },
        "Error Type": {
          rich_text: [
            {
              text: {
                content: errorType,
              },
            },
          ],
        },
        "Charge ID": {
          rich_text: [
            {
              text: {
                content: chargeId,
              },
            },
          ],
        },
        Refunded: {
          checkbox: refunded,
        },
        Timestamp: {
          date: {
            start: timestamp,
          },
        },
        "Test Run": {
          rich_text: [
            {
              text: {
                content: testRun,
              },
            },
          ],
        },
      },
    });

    console.log(`Logged charge for ${userId} : Notion page: ${response.id}`);
    return "Successful update!";
  } catch (error) {
    console.error("Failed to log charge to Notion:", error);
    return "Failed update!";
  }
}

module.exports = { logChargeToNotion };

require("dotenv").config();
const { Client } = require("@notionhq/client");
const notion = new Client({ auth: process.env.NOTION_TOKEN });

const TRANSACTION_DB_ID = process.env.TRANSACTION_LOG_DB_ID;

const conversionRatesToUSD = {
  USD: 1,
  EUR: 1.07,
  GBP: 1.2,
};

async function createDailyReportPage({
  total,
  successful,
  failed,
  revenueUSD,
  riskyUsers,
  topErrors,
}) {
  const errorText = topErrors.join("\n");
  const riskyText = riskyUsers
    .map((user) => `${user.user} (Refunded ${user.refunded} of ${user.total})`)
    .join("\n");

  const riskyUsersMultiSelect = riskyUsers.map((user) => ({
    name: user.user,
  }));

  const page = await notion.pages.create({
    parent: { database_id: process.env.DAILY_REPORT_DB_ID },
    properties: {
      Name: {
        title: [
          {
            text: {
              content: `📆 Stripe Daily Report - ${new Date().toLocaleDateString()}`,
            },
          },
        ],
      },
      Date: {
        date: {
          start: new Date().toISOString(),
        },
      },
      "Failed Charges": {
        number: failed,
      },
      "Failure %": {
        number: Number((failed / total).toFixed(2)),
      },
      "High-Risk Users": {
        multi_select: riskyUsersMultiSelect,
      },
      "Top Error": {
        rich_text: [
          {
            text: {
              content: topErrors.length > 0 ? topErrors[0] : "None",
            },
          },
        ],
      },
      "Total Charges": {
        number: total,
      },
      "Total Refunded": {
        number: riskyUsers.reduce((sum, user) => sum + user.refunded, 0),
      },
    },
    children: [
      formatTextBlock(`🧾 Stripe Daily Report`),
      formatTextBlock(`Total: ${total}`),
      formatTextBlock(`✅ Successful: ${successful}`),
      formatTextBlock(`❌ Failed: ${failed}`),
      formatTextBlock(`💰 Revenue (USD): $${revenueUSD}`),
      formatTextBlock(`🚩 Risky Users:\n${riskyText || "None"}`),
      formatTextBlock(`🐞 Top Errors:\n${errorText || "None"}`),
    ],
  });

  console.log("Report created in Notion:", page.id);
}

function formatTextBlock(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: { content: text },
        },
      ],
    },
  };
}

async function fetchTransaction(filter = null) {
  const pages = [];
  // keep going until next_cursor is null => https://developers.notion.com/reference/intro#pagination
  let cursor = undefined;

  do {
    let query = {
      database_id: TRANSACTION_DB_ID,
      start_cursor: cursor,
    };

    if (filter) {
      query.filter = filter;
    }

    const transactionResults = await notion.databases.query(query);

    pages.push(...transactionResults.results);
    cursor = transactionResults.has_more
      ? transactionResults.next_cursor
      : null;
  } while (cursor);

  return pages;
}

async function findRiskyUsers() {
  // if the user has a refund rate greater than 50 percent, we consider them risky.
  // use two maps to get
  // 1. total transactions per user
  // 2. total refunds per user
  // we already have all the transactions
  // reunded are still considered successful, so we can use the successful results
  // fix -> we can use a single map with an object as a key
  const successfulTransactionCountWithRefunds = await fetchTransaction({
    and: [
      {
        property: "Status of Transaction",
        status: {
          equals: "succeeded",
        },
      },
    ],
  });

  const userStats = new Map();

  for (const transaction of successfulTransactionCountWithRefunds) {
    const user =
      transaction.properties["User ID"]["rich_text"][0].plain_text ||
      "unknown_user";
    const wasRefunded = transaction.properties["Refunded"]?.checkbox || false;

    if (!userStats.has(user)) {
      userStats.set(user, { total: 0, refunded: 0 });
    }

    const current = userStats.get(user);
    current.total += 1;
    if (wasRefunded) current.refunded += 1;

    userStats.set(user, current);
  }

  const riskyUsers = [];

  for (const [user, stats] of userStats.entries()) {
    if (stats.refunded / stats.total > 0.5) {
      riskyUsers.push({ user, ...stats });
    }
  }

  return riskyUsers;
}

async function buildStripeReport() {
  let errorMap = new Map();
  const totalTransactionCount = await fetchTransaction();

  //   https://developers.notion.com/reference/post-database-query -> how to query multiple properties at once
  const successfulTransactionCount = await fetchTransaction({
    and: [
      {
        property: "Status of Transaction",
        status: {
          equals: "succeeded",
        },
      },
      {
        property: "Refunded",
        checkbox: { equals: false },
      },
    ],
  });

  const failedTransactionCount = await fetchTransaction({
    property: "Status of Transaction",
    status: {
      equals: "failed",
    },
  });

  console.log("Total Transactions Amount: ", totalTransactionCount.length);
  console.log(
    "Successful Transactions Amount: ",
    successfulTransactionCount.length
  );
  console.log("Failed Transactions Amount: ", failedTransactionCount.length);

  //   https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce
  const revenue = successfulTransactionCount.reduce((sum, currentValue) => {
    const transactionAmount =
      currentValue.properties["Transaction Amount"]?.number || 0;
    const currency = currentValue.properties["Currency"]?.select?.name || "usd";
    const conversionRate = conversionRatesToUSD[currency] || 1;
    return sum + transactionAmount * conversionRate;
  }, 0);

  const revenueUSD = revenue / 100;

  //   create error map

  for (let page of failedTransactionCount) {
    page.properties["Error Type"]["rich_text"].map((item) => {
      const errorMessage = item.plain_text;
      if (errorMap.has(errorMessage)) {
        errorMap.set(errorMessage, errorMap.get(errorMessage) + 1);
      } else {
        errorMap.set(errorMessage, 1);
      }
    });
  }

  console.log(errorMap);

  const refunededUsers = await findRiskyUsers(successfulTransactionCount);

  const sortedErrors = Array.from(errorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([error, count]) => `${error}: ${count}`);

  await createDailyReportPage({
    total: totalTransactionCount.length,
    successful: successfulTransactionCount.length,
    failed: failedTransactionCount.length,
    revenueUSD,
    riskyUsers: refunededUsers,
    topErrors: sortedErrors,
  });
}

buildStripeReport();

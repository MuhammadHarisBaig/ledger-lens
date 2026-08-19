import { TransactionCategory } from "@prisma/client";

/**
 * SYNTHETIC evaluation dataset — hand-labeled ground truth for the categorizer.
 *
 * ⚠️ Every merchant string is INVENTED. There is NO real personal or financial data here.
 * This is a fabricated test set whose only purpose is to measure the LLM's categorization
 * accuracy against known-correct labels (see eval/README.md).
 *
 * `expectedCategory` is typed against the Prisma `TransactionCategory` enum, so the compiler
 * rejects any label outside the taxonomy — the ground truth can't drift from the real schema.
 *
 * Sign convention (same as production): amount < 0 is money out, amount > 0 is money in.
 * The set deliberately spans ALL categories and includes genuinely AMBIGUOUS descriptions
 * (noted inline) so the metrics reflect hard cases, not just easy ones.
 */
export type EvalExample = {
  rawDescription: string;
  amount: number;
  expectedCategory: TransactionCategory;
};

export const dataset: EvalExample[] = [
  // GROCERIES
  { rawDescription: "GREENLEAF MARKET #218", amount: -84.32, expectedCategory: "GROCERIES" },
  { rawDescription: "VALLEY FRESH GROCERS", amount: -52.19, expectedCategory: "GROCERIES" },
  { rawDescription: "SUNRISE FOODMART POS 4471", amount: -23.87, expectedCategory: "GROCERIES" },
  { rawDescription: "HARVEST WHOLE FOODS CO", amount: -117.4, expectedCategory: "GROCERIES" },
  { rawDescription: "CORNER PANTRY MINI MART", amount: -9.65, expectedCategory: "GROCERIES" },

  // DINING
  { rawDescription: "THE COPPER SKILLET", amount: -41.5, expectedCategory: "DINING" },
  { rawDescription: "TACO LIBRE #12", amount: -18.75, expectedCategory: "DINING" },
  { rawDescription: "BLUE HERON BISTRO", amount: -96.2, expectedCategory: "DINING" },
  { rawDescription: "SQ *THE COFFEE BAR", amount: -5.85, expectedCategory: "DINING" }, // ambiguous: dining vs groceries
  { rawDescription: "DOORDASH *NOODLE HOUSE", amount: -32.1, expectedCategory: "DINING" },

  // TRANSPORT
  { rawDescription: "METRO TRANSIT FARE", amount: -2.75, expectedCategory: "TRANSPORT" },
  { rawDescription: "SHELL OIL 57302188", amount: -48.9, expectedCategory: "TRANSPORT" },
  { rawDescription: "RIDEWAVE TRIP 8842", amount: -21.4, expectedCategory: "TRANSPORT" }, // invented rideshare
  { rawDescription: "CITY PARKING GARAGE B", amount: -14.0, expectedCategory: "TRANSPORT" },

  // UTILITIES
  { rawDescription: "NORTHERN POWER & LIGHT", amount: -132.66, expectedCategory: "UTILITIES" },
  { rawDescription: "CLEARSTREAM WATER DIST", amount: -58.03, expectedCategory: "UTILITIES" },
  { rawDescription: "FIBERLINK BROADBAND", amount: -79.99, expectedCategory: "UTILITIES" }, // ambiguous: utilities vs other

  // RENT
  { rawDescription: "OAKRIDGE APARTMENTS RENT", amount: -1650.0, expectedCategory: "RENT" },
  { rawDescription: "PROP MGMT ACH LEASE 4402", amount: -1200.0, expectedCategory: "RENT" },

  // INCOME
  { rawDescription: "ACME CORP PAYROLL DIRECT DEP", amount: 2840.55, expectedCategory: "INCOME" },
  { rawDescription: "STIPEND DEPOSIT NORTHWIND", amount: 500.0, expectedCategory: "INCOME" },
  { rawDescription: "IRS TREAS TAX REF", amount: 612.0, expectedCategory: "INCOME" }, // ambiguous: income vs transfer
  { rawDescription: "INTEREST PAYMENT", amount: 3.42, expectedCategory: "INCOME" },

  // ENTERTAINMENT
  { rawDescription: "STREAMFLIX MONTHLY", amount: -15.99, expectedCategory: "ENTERTAINMENT" }, // invented streaming
  { rawDescription: "GALAXY CINEMAS 14", amount: -27.5, expectedCategory: "ENTERTAINMENT" },
  { rawDescription: "TUNEWAVE MUSIC SUBSCR", amount: -10.99, expectedCategory: "ENTERTAINMENT" },
  { rawDescription: "PIXELFORGE GAMES STORE", amount: -59.99, expectedCategory: "ENTERTAINMENT" },

  // HEALTH
  { rawDescription: "WELLPATH PHARMACY 220", amount: -24.6, expectedCategory: "HEALTH" },
  { rawDescription: "CEDAR CLINIC COPAY", amount: -35.0, expectedCategory: "HEALTH" },
  { rawDescription: "FLEXFIT GYM MEMBERSHIP", amount: -39.0, expectedCategory: "HEALTH" }, // ambiguous: health vs entertainment

  // TRANSFER
  { rawDescription: "VENMO PAYMENT", amount: -40.0, expectedCategory: "TRANSFER" }, // ambiguous: transfer vs dining/other
  { rawDescription: "ONLINE XFER TO SAVINGS 9921", amount: -300.0, expectedCategory: "TRANSFER" },
  { rawDescription: "ZELLE TO J RIVERA", amount: -75.0, expectedCategory: "TRANSFER" },

  // FEES
  { rawDescription: "MONTHLY MAINTENANCE FEE", amount: -12.0, expectedCategory: "FEES" },
  { rawDescription: "ATM WITHDRAWAL FEE", amount: -3.5, expectedCategory: "FEES" },
  { rawDescription: "FOREIGN TRANSACTION FEE", amount: -1.87, expectedCategory: "FEES" },
  { rawDescription: "OVERDRAFT ITEM FEE", amount: -34.0, expectedCategory: "FEES" },

  // OTHER
  { rawDescription: "AMZN MKTP US*2R4TY", amount: -63.24, expectedCategory: "OTHER" }, // ambiguous: could be many things
  { rawDescription: "BRIGHT HORIZON DONATION", amount: -25.0, expectedCategory: "OTHER" },
  { rawDescription: "GENERAL STORE 8841 MISC", amount: -19.99, expectedCategory: "OTHER" },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  // ADVERSARIAL / AMBIGUOUS cases (5A.1). These are the transactions a real statement actually
  // contains and that a model can plausibly get wrong: payment-aggregator strings that hide the
  // real merchant, big-box stores that could be GROCERIES or OTHER, gas-station convenience buys,
  // cryptic bank/POS codes with weak signal, refunds (money IN but not income), and a fee dressed
  // up like a purchase. A discriminating eval MUST include failable cases — see eval/README.md.
  // Labels are the most defensible call; judgment calls are noted.
  // ─────────────────────────────────────────────────────────────────────────────────────────

  // Aggregator obfuscation — the real merchant is behind a processor prefix (SQ */PAYPAL */SP *).
  { rawDescription: "SQ *BLUE BOTTLE", amount: -5.25, expectedCategory: "DINING" }, // Square; coffee
  { rawDescription: "PAYPAL *STEAMGAMES", amount: -19.99, expectedCategory: "ENTERTAINMENT" },
  { rawDescription: "PAYPAL *RIDEHAILCO", amount: -23.1, expectedCategory: "TRANSPORT" },
  { rawDescription: "SP * NORTHWIND GOODS", amount: -34.5, expectedCategory: "OTHER" }, // Stripe "SP *", no signal
  { rawDescription: "VENMO *CASHOUT", amount: 85.0, expectedCategory: "TRANSFER" }, // money IN, but a transfer — NOT income

  // Warehouse / big-box — defensible either way; we commit to a call and let the metric show confusion.
  { rawDescription: "COSTCO WHSE #0455", amount: -214.83, expectedCategory: "GROCERIES" }, // judgment: warehouse ≈ groceries (could be OTHER)
  { rawDescription: "WM SUPERCENTER #12", amount: -88.1, expectedCategory: "GROCERIES" }, // judgment: supercenter grocery
  { rawDescription: "TARGET T-2245", amount: -63.4, expectedCategory: "OTHER" }, // judgment: general merch, not clearly groceries
  { rawDescription: "AMZN MKTP US*A1B2C3", amount: -47.99, expectedCategory: "OTHER" }, // judgment: ambiguous marketplace

  // Gas-station convenience — bought snacks, but the merchant is a fuel stop.
  { rawDescription: "SHELL SERVICE STN SNACKS", amount: -12.4, expectedCategory: "TRANSPORT" }, // judgment: gas-station → TRANSPORT
  { rawDescription: "CIRCLE K #772", amount: -8.75, expectedCategory: "TRANSPORT" }, // judgment: convenience at fuel stop

  // Cryptic bank/POS codes — almost no merchant signal.
  { rawDescription: "POS DEBIT 7788 234109", amount: -54.2, expectedCategory: "OTHER" },
  { rawDescription: "CHECKCARD 0912 SP AFF*", amount: -29.0, expectedCategory: "OTHER" },

  // Refunds — positive amount, but the category still follows the merchant, not the sign.
  { rawDescription: "REFUND GREENLEAF MARKET", amount: 84.32, expectedCategory: "GROCERIES" },
  { rawDescription: "RETURN CR TUNEWAVE", amount: 10.99, expectedCategory: "ENTERTAINMENT" },

  // Fees that read like purchases/subscriptions.
  { rawDescription: "ANNUAL MEMBERSHIP FEE", amount: -95.0, expectedCategory: "FEES" }, // card fee, not a purchase
  { rawDescription: "SVC CHARGE", amount: -4.0, expectedCategory: "FEES" },

  // App-store / media billing, and the UBER-vs-UBER-EATS trap.
  { rawDescription: "APPLE.COM/BILL", amount: -2.99, expectedCategory: "ENTERTAINMENT" }, // judgment: app/media billing
  { rawDescription: "GOOGLE *YOUTUBEPREMIUM", amount: -13.99, expectedCategory: "ENTERTAINMENT" },
  { rawDescription: "UBER EATS 8842", amount: -28.75, expectedCategory: "DINING" }, // trap: NOT transport
];

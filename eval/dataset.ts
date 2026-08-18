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
];

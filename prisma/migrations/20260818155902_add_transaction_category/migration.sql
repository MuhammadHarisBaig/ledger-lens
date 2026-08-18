-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('GROCERIES', 'DINING', 'TRANSPORT', 'UTILITIES', 'RENT', 'INCOME', 'ENTERTAINMENT', 'HEALTH', 'TRANSFER', 'FEES', 'OTHER');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "category" "TransactionCategory";

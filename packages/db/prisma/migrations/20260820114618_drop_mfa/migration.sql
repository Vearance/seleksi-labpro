/*
  Warnings:

  - You are about to drop the column `mfa_secret` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "mfa_secret";

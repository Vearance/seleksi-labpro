/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "applications" DROP COLUMN "deleted_at";

-- AlterTable
ALTER TABLE "groups" DROP COLUMN "deleted_at";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "deleted_at";

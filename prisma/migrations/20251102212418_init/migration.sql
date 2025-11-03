/*
  Warnings:

  - A unique constraint covering the columns `[fullname]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "User_fullname_key" ON "public"."User"("fullname");

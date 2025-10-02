/*
  Warnings:

  - You are about to drop the column `userId` on the `Chatroom` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Chatroom" DROP COLUMN "userId",
ADD COLUMN     "adminId" INTEGER;

-- CreateTable
CREATE TABLE "public"."ChatroomUsers" (
    "chatroomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatroomUsers_pkey" PRIMARY KEY ("chatroomId","userId")
);

-- AddForeignKey
ALTER TABLE "public"."ChatroomUsers" ADD CONSTRAINT "ChatroomUsers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatroomUsers" ADD CONSTRAINT "ChatroomUsers_chatroomId_fkey" FOREIGN KEY ("chatroomId") REFERENCES "public"."Chatroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

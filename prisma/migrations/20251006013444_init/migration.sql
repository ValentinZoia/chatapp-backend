-- CreateEnum
CREATE TYPE "public"."ChatroomAccess" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "public"."Chatroom" ADD COLUMN     "access" "public"."ChatroomAccess" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "colorHex" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "topic" DROP NOT NULL;
ALTER TABLE "Activity" ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "unitId" TEXT;

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "RetreatEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetreatEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "incurredOn" TIMESTAMP(3),
    "note" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetreatEvent_startDate_idx" ON "RetreatEvent"("startDate");

-- CreateIndex
CREATE INDEX "ExpenseRequest_userId_idx" ON "ExpenseRequest"("userId");

-- CreateIndex
CREATE INDEX "ExpenseRequest_status_idx" ON "ExpenseRequest"("status");

-- AddForeignKey
ALTER TABLE "ExpenseRequest" ADD CONSTRAINT "ExpenseRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

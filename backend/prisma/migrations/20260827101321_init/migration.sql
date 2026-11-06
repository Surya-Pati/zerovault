-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RESEARCHER', 'BUYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('COMMITTED', 'BOUNTY_LOCKED', 'SETTLED', 'EXPIRED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "role" "Role" NOT NULL,
    "verified_buyer" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VulnerabilityListing" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "merkle_root" TEXT NOT NULL,
    "price_wei" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'COMMITTED',
    "encrypted_payload_uri" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VulnerabilityListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "contract_address" TEXT NOT NULL,
    "tx_hash_fund" TEXT,
    "tx_hash_settle" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'COMMITTED',
    "bounty_locked_at" TIMESTAMP(3),

    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureProof" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "leaf_index" INTEGER NOT NULL,
    "revealed_value" TEXT NOT NULL,
    "merkle_proof" JSONB NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DisclosureProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_address_key" ON "User"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowTransaction_listing_id_key" ON "EscrowTransaction"("listing_id");

-- AddForeignKey
ALTER TABLE "VulnerabilityListing" ADD CONSTRAINT "VulnerabilityListing_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "VulnerabilityListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureProof" ADD CONSTRAINT "DisclosureProof_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "VulnerabilityListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

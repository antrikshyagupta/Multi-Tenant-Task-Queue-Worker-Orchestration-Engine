-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "api_key_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "max_concurrent_jobs" INTEGER NOT NULL DEFAULT 2,
    "max_queued_jobs" INTEGER NOT NULL DEFAULT 50,
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 60,
    "max_payload_bytes" INTEGER NOT NULL DEFAULT 65536,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Key',
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_hash_key" ON "ApiKey"("key_hash");

-- CreateIndex
CREATE INDEX "ApiKey_tenant_id_is_active_idx" ON "ApiKey"("tenant_id", "is_active");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

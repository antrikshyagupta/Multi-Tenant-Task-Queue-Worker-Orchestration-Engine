const prisma = require('../src/config/prisma');

async function main() {
  const plans = [
    {
      name: 'free',
      max_concurrent_jobs: 2,
      max_queued_jobs: 20,
      rate_limit_per_min: 30,
      max_payload_bytes: 32768, // 32 KB
      weight: 1,
    },
    {
      name: 'pro',
      max_concurrent_jobs: 10,
      max_queued_jobs: 500,
      rate_limit_per_min: 120,
      max_payload_bytes: 262144, // 256 KB
      weight: 3,
    },
    {
      name: 'enterprise',
      max_concurrent_jobs: 50,
      max_queued_jobs: 10000,
      rate_limit_per_min: 600,
      max_payload_bytes: 1048576, // 1 MB
      weight: 10,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  // Assign the 'free' plan to any existing tenants that don't have a plan yet
  const freePlan = await prisma.plan.findUnique({ where: { name: 'free' } });
  if (freePlan) {
    await prisma.tenant.updateMany({
      where: { plan_id: null },
      data: { plan_id: freePlan.id },
    });
  }

  console.log('Seeded plans (free, pro, enterprise) and updated existing tenants.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
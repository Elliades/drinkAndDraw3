import { PrismaClient } from "@prisma/client";
import { normalizeTagName } from "../src/domain/tags";

const prisma = new PrismaClient();

const SEED_TAGS = [
  "hand",
  "hands",
  "portrait",
  "figure",
  "anatomy",
  "gesture",
  "still-life",
  "landscape",
  "animal",
  "drapery",
];

async function main() {
  console.log("Seeding tags...");
  for (const raw of SEED_TAGS) {
    const name = normalizeTagName(raw);
    if (!name) continue;
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const tagCount = await prisma.tag.count();
  console.log(`Done. ${tagCount} tags in database.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

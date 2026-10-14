import { PrismaClient, Currency } from '@prisma/client';

const prisma = new PrismaClient();
const firstNames = [
  'Aarav', 'Maya', 'Noah', 'Aisha', 'Leo', 'Sofia', 'Ethan', 'Priya', 'Amara', 'Lucas',
  'Zara', 'Daniel', 'Mei', 'Oliver', 'Nina', 'Arjun', 'Grace', 'Mateo', 'Elena', 'Samir',
];
const lastNames = [
  'Patel', 'Brooks', 'Khan', 'Romero', 'Nwosu', 'Mehta', 'Liu', 'Keller', 'Shah', 'Wilson',
  'Haddad', 'Martin', 'Okafor', 'Singh', 'Garcia', 'Chen', 'Muller', 'Silva', 'Ahmed', 'Kim',
];
const departments = [
  'Engineering', 'Finance', 'Product', 'Marketing', 'Operations', 'People Ops', 'Design', 'Sales',
];
const markets: { country: string; currency: Currency; base: number; range: number }[] = [
  { country: 'United States', currency: 'USD', base: 65000, range: 150000 },
  { country: 'India', currency: 'INR', base: 700000, range: 3300000 },
  { country: 'United Kingdom', currency: 'GBP', base: 42000, range: 125000 },
  { country: 'Germany', currency: 'EUR', base: 44000, range: 116000 },
  { country: 'France', currency: 'EUR', base: 41000, range: 109000 },
  { country: 'Spain', currency: 'EUR', base: 32000, range: 78000 },
  { country: 'Nigeria', currency: 'USD', base: 30000, range: 70000 },
  { country: 'Singapore', currency: 'USD', base: 62000, range: 130000 },
  { country: 'Canada', currency: 'USD', base: 58000, range: 125000 },
  { country: 'United Arab Emirates', currency: 'USD', base: 50000, range: 140000 },
];

async function seed() {
  const batchSize = 1000;

  for (let offset = 0; offset < 10000; offset += batchSize) {
    const data = Array.from({ length: batchSize }, (_, batchIndex) => {
      const index = offset + batchIndex;
      const market = markets[index % markets.length];
      const salary = market.base + ((index * 7919) % market.range);
      const year = 2024 + (index % 3);
      const month = (index % 12) + 1;

      return {
        employeeCode: `ACM-${String(index + 1).padStart(5, '0')}`,
        fullName: `${firstNames[index % firstNames.length]} ${lastNames[(index * 7) % lastNames.length]}`,
        department: departments[(index * 3) % departments.length],
        country: market.country,
        currency: market.currency,
        salary: salary.toFixed(2),
        effectiveDate: new Date(Date.UTC(year, month - 1, 1)),
      };
    });

    await prisma.employee.createMany({ data, skipDuplicates: true });
  }

  const count = await prisma.employee.count();
  console.log(`Seed complete. ${count} employees are available.`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
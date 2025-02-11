import bcrypt from 'bcrypt'
import postgres from 'postgres'
import { invoices, customers, revenue, users } from '../lib/placeholder-data'

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' })

async function seedUsers() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `

  const insertedUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10)
      return sql`
        INSERT INTO users (name, email, password)
        VALUES (${user.name}, ${user.email}, ${hashedPassword})
        ON CONFLICT (email) DO NOTHING;
      `
    })
  )

  return insertedUsers
}

async function seedCustomers() {
  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      image_url VARCHAR(255) NOT NULL
    );
  `

  const insertedCustomers = await Promise.all(
    customers.map(
      (customer) => sql`
        INSERT INTO customers (name, email, image_url)
        VALUES (${customer.name}, ${customer.email}, ${customer.image_url})
        ON CONFLICT (email) DO NOTHING;
      `
    )
  )

  return insertedCustomers
}

async function seedInvoices() {
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
  `

  // Fetch customer IDs dynamically since we removed predefined IDs
  const customersFromDB = await sql`SELECT id, email FROM customers;`

  // Map customer emails to their new auto-incremented IDs
  const customerMap = Object.fromEntries(
    customersFromDB.map((c) => [c.email, c.id])
  )

  const insertedInvoices = await Promise.all(
    invoices.map((invoice) => {
      const customerId = customerMap[invoice.customer_id] // Map old ID to new one
      if (!customerId) return Promise.resolve()

      return sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${invoice.amount}, ${invoice.status}, ${invoice.date})
        ON CONFLICT (id) DO NOTHING;
      `
    })
  )

  return insertedInvoices
}

async function seedRevenue() {
  await sql`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `

  const insertedRevenue = await Promise.all(
    revenue.map(
      (rev) => sql`
        INSERT INTO revenue (month, revenue)
        VALUES (${rev.month}, ${rev.revenue})
        ON CONFLICT (month) DO NOTHING;
      `
    )
  )

  return insertedRevenue
}

export async function GET() {
  try {
    const result = await sql.begin((sql) => [
      seedUsers(),
      seedCustomers(),
      seedInvoices(),
      seedRevenue(),
    ])

    return Response.json({ message: 'Database seeded successfully' })
  } catch (error) {
    return Response.json({ error }, { status: 500 })
  }
}

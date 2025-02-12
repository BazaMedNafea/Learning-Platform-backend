import { PrismaClient } from "@prisma/client";

// Create a Prisma client instance
const prisma = new PrismaClient();

/**
 * Function to check the database connection.
 */
async function checkDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log("Database connection successful");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Database connection failed:", error.message);
    } else {
      console.error("Unexpected error:", error);
    }
  }
}

// Export the Prisma client and the connection check function
export { prisma, checkDatabaseConnection };

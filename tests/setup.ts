const { config } = require("dotenv");

// Load test environment variables
config({ path: ".env.test" });

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = "test";

  // Mock console methods to reduce noise in tests
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Global test timeout
jest.setTimeout(10000);

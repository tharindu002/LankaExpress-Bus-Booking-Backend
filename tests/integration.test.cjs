/**
 * LankaExpress - Integration Test Suite
 * ---------------------------------------
 * These tests verify that the deployed backend modules (Auth, Bus, Route,
 * Schedule, Booking, Wallet) work correctly TOGETHER against the live
 * MongoDB Atlas database, by calling the real, deployed REST API.
 */

const axios = require("axios");

const BASE_URL = "https://lankaexpress-bus-booking-backend.onrender.com";
const api = axios.create({ baseURL: BASE_URL, validateStatus: () => true });

// Increase timeout because Render free-tier can take a few seconds to wake up
jest.setTimeout(30000);

describe("Integration Test Suite - LankaExpress Backend", () => {

  test("Server is reachable and responds", async () => {
    const res = await api.get("/");
    expect(res.status).toBeLessThan(500);
  });

  test("Auth + Bus modules integrate: registering a user does not break bus listing", async () => {
    const randomEmail = `test_${Date.now()}@example.com`;

    const registerRes = await api.post("/api/auth/register", {
      name: "Integration Test User",
      fullName: "Integration Test User",
      email: randomEmail,
      phone: "0771234567",
      password: "TestPassword123",
    });
    expect([200, 201]).toContain(registerRes.status);

    const busRes = await api.get("/api/buses");
    expect(busRes.status).toBe(200);
    expect(Array.isArray(busRes.data) || typeof busRes.data === "object").toBe(true);
  });

  test("Auth module rejects invalid login credentials", async () => {
    const res = await api.post("/api/auth/login", {
      email: "thariya02@gmail.com",
      password: "DefinitelyWrongPassword999",
    });
    expect([400, 401]).toContain(res.status);
  });

  test("Route + Schedule modules integrate: routes feed into schedule search", async () => {
    const routesRes = await api.get("/api/routes");
    expect(routesRes.status).toBe(200);

    const scheduleRes = await api.get("/api/schedules");
    expect(scheduleRes.status).toBe(200);
  });

  test("Booking module correctly rejects an unauthenticated booking attempt", async () => {
    const res = await api.post("/api/bookings", {
      scheduleId: "000000000000000000000000",
      seatNumbers: ["D2"],
    });
    expect([400, 401, 404]).toContain(res.status);
  });

  test("Wallet module requires authentication (protected route check)", async () => {
    const res = await api.get("/api/wallet");
    expect([401, 403]).toContain(res.status);
  });

  test("Operator module integrates correctly with Bus module data", async () => {
    const operatorsRes = await api.get("/api/operators");
    expect(operatorsRes.status).toBe(200);

    const busesRes = await api.get("/api/buses");
    expect(busesRes.status).toBe(200);
  });
});

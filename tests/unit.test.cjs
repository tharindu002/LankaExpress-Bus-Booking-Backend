/**
 * LankaExpress - Unit Test Suite
 * ---------------------------------------
 * These tests verify individual components (Mongoose models/schemas) in
 * ISOLATION, testing schema validation, default values, required fields
 * and data structures without external network or server dependency.
 */

const mongoose = require("mongoose");

let Bus;

beforeAll(async () => {
  const busMod = await import("../src/models/Bus.js");
  Bus = busMod.Bus;
});

describe("Unit Test Suite - Bus Model (isolated schema validation)", () => {

  test("A valid Bus document validates successfully", async () => {
    const bus = new Bus({
      busId: "bus_test_001",
      operatorId: "op_001",
      busNo: "WP ND-4582",
      name: "Southern Luxury Liner",
      model: "Volvo B11R",
      busType: "Expressway Luxury AC",
      seatLayout: "2+2",
      totalSeats: 40,
    });

    const err = bus.validateSync();
    expect(err).toBeUndefined();
    expect(bus.busNo).toBe("WP ND-4582");
    expect(bus.totalSeats).toBe(40);
  });

  test("Bus document is rejected when a required field is missing", async () => {
    const busWithoutNo = new Bus({
      name: "Missing Required Fields Test",
      totalSeats: 40,
    });

    const err = busWithoutNo.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.busId || err.errors.operatorId || err.errors.busType).toBeDefined();
  });

  test("Bus totalSeats field only accepts a valid number", async () => {
    const busWithBadSeats = new Bus({
      busId: "bus_test_003",
      operatorId: "op_001",
      busNo: "WP ND-9999",
      name: "Type Check Bus",
      busType: "Super Luxury",
      totalSeats: "forty",
    });

    const err = busWithBadSeats.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.totalSeats).toBeDefined();
  });

  test("Bus defaults apply correctly (serviceCategory, seatLayout, status)", async () => {
    const bus = new Bus({
      busId: "bus_test_004",
      operatorId: "op_001",
      name: "Defaults Bus",
      busType: "Expressway Luxury",
    });

    expect(bus.serviceCategory).toBe("Super Luxury");
    expect(bus.seatLayout).toBe("2+2");
    expect(bus.status).toBe("Active");
    expect(bus.totalSeats).toBe(40);
  });

});

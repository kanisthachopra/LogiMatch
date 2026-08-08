process.env.JWT_SECRET = "test-secret";
process.env.RESEND_API_KEY = "";

const jwt = require("jsonwebtoken");
const request = require("supertest");

const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
};

jest.mock("../db", () => mockPool);

const app = require("../server");

const tokenFor = (payload) => jwt.sign(payload, process.env.JWT_SECRET);

describe("LogiMatch backend routes", () => {
  beforeEach(() => {
    mockPool.query.mockReset();
    mockPool.connect.mockReset();
  });

  test("rejects invalid price estimate input", async () => {
    const response = await request(app).post("/api/price-estimate").send({
      originCity: "Mumbai",
      destCity: "Delhi",
      weight: -100,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/positive/);
  });

  test("rejects partial and excessive price estimate dimensions", async () => {
    const partialResponse = await request(app).post("/api/price-estimate").send({
      originCity: "Mumbai",
      destCity: "Delhi",
      weight: 100,
      length_cm: 20,
    });
    const excessiveResponse = await request(app).post("/api/price-estimate").send({
      originCity: "Mumbai",
      destCity: "Delhi",
      weight: 100,
      length_cm: 10001,
      width_cm: 20,
      height_cm: 20,
    });

    expect(partialResponse.status).toBe(400);
    expect(partialResponse.body.error).toMatch(/all three/);
    expect(excessiveResponse.status).toBe(400);
    expect(excessiveResponse.body.error).toMatch(/supported limit/);
  });

  test("rejects bidding on a closed job", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ seeker_id: 42, status: "assigned" }],
    });

    const response = await request(app)
      .post("/api/bids")
      .set("Authorization", `Bearer ${tokenFor({ id: 7, role: "driver" })}`)
      .send({ job_id: 12, amount: 5000 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/no longer open/);
  });

  test("rejects bid acceptance by non-seeker", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          job_id: 12,
          provider_id: 7,
          amount: 5000,
          seeker_id: 99,
          job_status: "open",
        },
      ],
    });

    const response = await request(app)
      .put("/api/bids/3/accept")
      .set("Authorization", `Bearer ${tokenFor({ id: 7, role: "driver" })}`);

    expect(response.status).toBe(403);
  });

  test("rejects bid acceptance after the job is assigned", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          job_id: 12,
          provider_id: 7,
          amount: 5000,
          seeker_id: 5,
          job_status: "assigned",
        },
      ],
    });

    const response = await request(app)
      .put("/api/bids/3/accept")
      .set("Authorization", `Bearer ${tokenFor({ id: 5, role: "seeker" })}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/no longer open/);
  });

  test("accepts one bid and rejects all competing bids in one transaction", async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 3 })
        .mockResolvedValueOnce({}),
      release: jest.fn(),
    };
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          job_id: 12,
          provider_id: 7,
          amount: 5000,
          seeker_id: 5,
          job_status: "open",
        },
      ],
    });
    mockPool.connect.mockResolvedValueOnce(client);

    const response = await request(app)
      .put("/api/bids/3/accept")
      .set("Authorization", `Bearer ${tokenFor({ id: 5, role: "seeker" })}`);

    expect(response.status).toBe(200);
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("CASE WHEN id = $1 THEN 'accepted' ELSE 'rejected' END"),
      ["3", 12],
    );
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("blocks shipment updates from an unrelated provider", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ status: "assigned", provider_id: 7 }],
    });

    const response = await request(app)
      .put("/api/jobs/12/track")
      .set("Authorization", `Bearer ${tokenFor({ id: 99, role: "driver" })}`)
      .send({ location: "Mumbai", status: "picked_up" });

    expect(response.status).toBe(403);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  test("rejects invalid shipment transitions", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ status: "assigned", provider_id: 7 }],
    });

    const response = await request(app)
      .put("/api/jobs/12/track")
      .set("Authorization", `Bearer ${tokenFor({ id: 7, role: "driver" })}`)
      .send({ location: "Delhi", status: "delivered" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/cannot move/);
  });

  test("returns seeker insights summary", async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [
          {
            total_jobs: 2,
            awarded_jobs: 1,
            completed_jobs: 1,
            total_spend: "9000",
            average_accepted_price: "9000",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ origin: "Mumbai", destination: "Delhi", job_count: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [{ status: "delivered", count: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            job_id: 1,
            route: "Mumbai to Delhi",
            status: "delivered",
            accepted_price: "9000",
            created_month: "Jul 2026",
          },
        ],
      });

    const response = await request(app)
      .get("/api/insights/summary")
      .set("Authorization", `Bearer ${tokenFor({ id: 5, role: "seeker" })}`);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe("seeker");
    expect(response.body.summary.total_jobs).toBe(2);
    expect(response.body.records).toHaveLength(1);
  });

  test("blocks unrelated users from accepted job chat", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ seeker_id: 5, provider_id: 7 }],
      });

    const response = await request(app)
      .get("/api/jobs/12/messages")
      .set("Authorization", `Bearer ${tokenFor({ id: 99, role: "seeker" })}`);

    expect(response.status).toBe(403);
  });

  test("sends a job chat message for an accepted participant", async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{ seeker_id: 5, provider_id: 7 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 20,
            job_id: 12,
            sender_id: 5,
            message: "Please call before pickup.",
            created_at: "2026-07-25T10:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ sender_name: "Acme Foods", sender_role: "seeker" }],
      });

    const response = await request(app)
      .post("/api/jobs/12/messages")
      .set("Authorization", `Bearer ${tokenFor({ id: 5, role: "seeker" })}`)
      .send({ message: "Please call before pickup." });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Please call before pickup.");
    expect(response.body.sender_name).toBe("Acme Foods");
  });

  test("rejects empty and oversized chat messages", async () => {
    const token = tokenFor({ id: 5, role: "seeker" });
    const emptyResponse = await request(app)
      .post("/api/jobs/12/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "   " });
    const oversizedResponse = await request(app)
      .post("/api/jobs/12/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "x".repeat(1001) });

    expect(emptyResponse.status).toBe(400);
    expect(emptyResponse.body.error).toMatch(/empty/);
    expect(oversizedResponse.status).toBe(400);
    expect(oversizedResponse.body.error).toMatch(/too long/);
  });

  test("allows only the seeker to rate the assigned provider", async () => {
    mockPool.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ seeker_id: 5, provider_id: 7, status: "delivered" }],
      });

    const response = await request(app)
      .post("/api/users/7/rate")
      .set("Authorization", `Bearer ${tokenFor({ id: 7, role: "driver" })}`)
      .send({ job_id: 12, score: 5 });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/shipment seeker/);
  });

  test("prevents rating the same completed shipment twice", async () => {
    const duplicateError = Object.assign(new Error("duplicate"), { code: "23505" });
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(duplicateError)
        .mockResolvedValueOnce({}),
      release: jest.fn(),
    };
    mockPool.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ seeker_id: 5, provider_id: 7, status: "delivered" }],
      });
    mockPool.connect.mockResolvedValueOnce(client);

    const response = await request(app)
      .post("/api/users/7/rate")
      .set("Authorization", `Bearer ${tokenFor({ id: 5, role: "seeker" })}`)
      .send({ job_id: 12, score: 5 });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/already been rated/);
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("blocks unrelated users from freight manifest PDF", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 12, seeker_id: 5, provider_id: 7 }],
    });

    const response = await request(app)
      .get("/api/jobs/12/manifest.pdf")
      .set("Authorization", `Bearer ${tokenFor({ id: 99, role: "seeker" })}`);

    expect(response.status).toBe(403);
  });

  test("generates freight manifest PDF for an involved user", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 12,
          seeker_id: 5,
          provider_id: 7,
          origin: "Mumbai",
          destination: "Delhi",
          status: "assigned",
          current_location: "Mumbai",
          winning_bid: "12000",
          seeker_name: "Acme Foods",
          seeker_email: "seeker@example.com",
          seeker_company: "Acme Foods",
          provider_name: "Fast Freight",
          provider_email: "driver@example.com",
          provider_company: "Fast Freight",
          weight_kg: "2000",
          length_cm: "200",
          width_cm: "150",
          height_cm: "120",
          packaging_type: "Palletized",
          is_fragile: false,
          is_hazmat: false,
          requires_refrigeration: false,
          requires_liftgate: true,
          requires_loading_dock: false,
          pickup_window_start: null,
          pickup_window_end: null,
          delivery_window_start: null,
          delivery_window_end: null,
          actual_pickup_time: null,
          actual_delivery_time: null,
          special_instructions: "Call before arrival.",
        },
      ],
    });

    const response = await request(app)
      .get("/api/jobs/12/manifest.pdf")
      .set("Authorization", `Bearer ${tokenFor({ id: 5, role: "seeker" })}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/pdf/);
  });
});

import { expect, Page, test } from "@playwright/test";

const openJob = {
  id: 12,
  seeker_id: 5,
  origin: "Mumbai, Maharashtra",
  destination: "Delhi, Delhi",
  weight_kg: "2000",
  seeker_ask: "35000",
  status: "open",
  bids: [],
  packaging_type: "Palletized",
  is_hazmat: false,
  is_fragile: false,
  requires_refrigeration: false,
  requires_liftgate: false,
  requires_loading_dock: false,
  special_instructions: "Call before pickup.",
};

const acceptedJob = {
  ...openJob,
  status: "assigned",
  current_location: "Mumbai",
  bids: [
    {
      bid_id: 30,
      amount: "35000",
      status: "accepted",
      provider_id: 7,
      provider_name: "Fast Freight",
      provider_email: "provider@example.com",
      rating_sum: 18,
      rating_count: 4,
    },
  ],
};

async function setSession(page: Page, role: "seeker" | "driver", id: number) {
  await page.addInitScript(
    ({ sessionRole, sessionId }) => {
      localStorage.setItem("token", "test-token");
      localStorage.setItem("userRole", sessionRole);
      localStorage.setItem("userId", String(sessionId));
    },
    { sessionRole: role, sessionId: id },
  );
}

async function mockDashboardApi(page: Page, onBid?: () => void) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/status") {
      return route.fulfill({ status: 200, json: { message: "ok" } });
    }
    if (path === "/api/jobs" && request.method() === "GET") {
      return route.fulfill({ status: 200, json: [openJob] });
    }
    if (path === "/api/profile/my-jobs") {
      return route.fulfill({ status: 200, json: [] });
    }
    if (path === "/api/bids" && request.method() === "POST") {
      onBid?.();
      return route.fulfill({ status: 201, json: { id: 31 } });
    }

    return route.fulfill({ status: 404, json: { error: "Not mocked" } });
  });
}

async function mockProfileApi(page: Page, role: "seeker" | "driver") {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const profile = {
      id: role === "seeker" ? 5 : 7,
      name: role === "seeker" ? "Acme Foods" : "Fast Freight",
      role,
      rating_sum: 18,
      rating_count: 4,
      is_public: true,
    };

    const responses: Record<string, unknown> = {
      "/api/status": { message: "ok" },
      "/api/users/me": profile,
      "/api/profile/my-jobs": role === "seeker" ? [acceptedJob] : [],
      "/api/profile/won-jobs":
        role === "driver"
          ? [
              {
                ...acceptedJob,
                job_id: 12,
                winning_bid: "35000",
                seeker_name: "Acme Foods",
                seeker_email: "seeker@example.com",
              },
            ]
          : [],
      "/api/profile/active-bids": [],
      "/api/insights/summary": {
        role,
        summary: {},
        routes: [],
        statuses: [],
        records: [],
      },
      "/api/jobs/12/messages": [],
    };

    if (path in responses) {
      return route.fulfill({ status: 200, json: responses[path] });
    }
    return route.fulfill({ status: 404, json: { error: "Not mocked" } });
  });
}

test("dashboard actions follow the signed-in role", async ({ page }) => {
  await setSession(page, "seeker", 5);
  await mockDashboardApi(page);
  await page.goto("/dashboard");

  await expect(page.getByRole("button", { name: "Post a Job" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Bid" })).toHaveCount(0);
});

test("bid confirmation cancels without a request and confirms once", async ({ page }) => {
  let bidRequests = 0;
  await setSession(page, "driver", 7);
  await mockDashboardApi(page, () => {
    bidRequests += 1;
  });
  await page.goto("/dashboard");

  await page.getByPlaceholder("Enter your competitive bid").fill("32000");
  await page.getByRole("button", { name: "Submit Bid" }).click();
  await expect(page.getByTestId("bid-confirmation-modal")).toBeVisible();
  await expect(page.getByText("₹32,000")).toBeVisible();

  await page.getByRole("button", { name: "Cancel / Edit" }).click();
  expect(bidRequests).toBe(0);

  await page.getByRole("button", { name: "Submit Bid" }).click();
  await page.getByTestId("confirm-bid-button").click();
  await expect(page.getByRole("heading", { name: "Bid submitted" })).toBeVisible();
  expect(bidRequests).toBe(1);
});

test("accepted shipment controls are role-specific", async ({ page }) => {
  await setSession(page, "seeker", 5);
  await mockProfileApi(page, "seeker");
  await page.goto("/profile");

  await expect(page.getByRole("heading", { name: /My Active Shipments/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Track Shipment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download Manifest" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Chat" })).toBeVisible();
  await expect(page.getByText("Update Shipment", { exact: true })).toHaveCount(0);
});

test("accepted provider sees shipment update controls", async ({ page }) => {
  await setSession(page, "driver", 7);
  await mockProfileApi(page, "driver");
  await page.goto("/profile");

  await expect(page.getByRole("heading", { name: /Confirmed Dispatches/ })).toBeVisible();
  await expect(page.getByText(/Update Shipment/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm Cargo Picked Up/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /My Active Shipments/ })).toHaveCount(0);
});

test("mobile bid, tracking, chat and insights controls do not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setSession(page, "driver", 7);
  await mockDashboardApi(page);
  await page.goto("/dashboard");

  await page.getByPlaceholder("Enter your competitive bid").fill("32000");
  await page.getByRole("button", { name: "Submit Bid" }).click();
  await expect(page.getByTestId("bid-confirmation-modal")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Cancel / Edit" }).click();

  await page.unroute("**/api/**");
  await setSession(page, "seeker", 5);
  await mockProfileApi(page, "seeker");
  await page.goto("/profile");
  await page.getByRole("button", { name: "Open Chat" }).click();
  await expect(page.getByText("No messages yet. Start the dispatch conversation here.")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);

  await page.getByRole("button", { name: "Market Insights" }).click();
  await expect(page.getByRole("heading", { name: "Custom Historical Graph Analyser" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});

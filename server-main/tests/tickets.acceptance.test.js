import { jest } from "@jest/globals";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockTicketRepo = {
  listTickets: jest.fn(),
  getTicketById: jest.fn(),
  createTicket: jest.fn(),
  updateTicket: jest.fn(),
  deleteTicket: jest.fn(),
};

jest.unstable_mockModule(
  "../src/repositories/ticketRepo.js",
  () => mockTicketRepo
);

jest.unstable_mockModule(
  "../src/services/webhookDispatcher.service.js",
  () => ({ dispatchWebhookEvent: jest.fn().mockResolvedValue({}) })
);

// ─── Importações (depois dos mocks!) ─────────────────────────────────────────

const { default: app } = await import("../src/app.js");
const { default: request } = await import("supertest");

// ─── Limpar mocks entre testes ────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});
// ═════════════════════════════════════════════════════════════════════════════
// GET /tickets
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /tickets", () => {
  test("responde 200 com data e paging", async () => {
    const fakeRows = [
      { id: 1, CI_Name: "API Gateway", Status: "Open" },
      { id: 2, CI_Name: "Auth Service", Status: "Closed" },
    ];
    mockTicketRepo.listTickets.mockResolvedValue({ rows: fakeRows, total: 2 });

    const res = await request(app).get("/tickets");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.paging.total).toBe(2);
  });

  test("passa os filtros status e priority ao repositório", async () => {
    mockTicketRepo.listTickets.mockResolvedValue({ rows: [], total: 0 });

    await request(app).get("/tickets?status=Open&priority=1");

    const args = mockTicketRepo.listTickets.mock.calls[0][0];
    expect(args.status).toBe("Open");
    expect(args.priority).toBe("1");
  });
});
// ═════════════════════════════════════════════════════════════════════════════
// GET /tickets/:id
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /tickets/:id", () => {
  test("responde 200 com o ticket quando existe", async () => {
    const fakeTicket = { id: 42, CI_Name: "Payment API", Status: "Open" };
    mockTicketRepo.getTicketById.mockResolvedValue(fakeTicket);

    const res = await request(app).get("/tickets/42");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(fakeTicket);
  });

  test("responde 404 quando o ticket não existe", async () => {
    mockTicketRepo.getTicketById.mockResolvedValue(null);

    const res = await request(app).get("/tickets/999");

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Ticket not found");
  });

  test("responde 400 com id inválido", async () => {
    const res = await request(app).get("/tickets/abc");

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Invalid ticket id");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /tickets
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /tickets", () => {
  test("responde 201 com o ticket criado", async () => {
    const created = {
      id: 1,
      CI_Name: "API Gateway",
      Status: "Open",
      Open_Time: "2026-01-01T00:00:00Z",
    };
    mockTicketRepo.createTicket.mockResolvedValue(created);

    const res = await request(app)
      .post("/tickets")
      .send({
        CI_Name: "API Gateway",
        Status: "Open",
        Open_Time: "2026-01-01T00:00:00Z",
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(created);
  });

  test("responde 400 quando Open_Time está em falta", async () => {
    const res = await request(app)
      .post("/tickets")
      .send({ CI_Name: "Sem data" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Open_Time is required");
    expect(mockTicketRepo.createTicket).not.toHaveBeenCalled();
  });
});
// ═════════════════════════════════════════════════════════════════════════════
// PATCH /tickets/:id
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /tickets/:id", () => {
  test("responde 200 com before e after", async () => {
    const before = { id: 7, Status: "Open" };
    const after = { id: 7, Status: "Closed" };

    mockTicketRepo.getTicketById.mockResolvedValue(before);
    mockTicketRepo.updateTicket.mockResolvedValue(after);

    const res = await request(app)
      .patch("/tickets/7")
      .send({ Status: "Closed" });

    expect(res.status).toBe(200);
    expect(res.body.data.before).toEqual(before);
    expect(res.body.data.after).toEqual(after);
  });

  test("responde 404 quando o ticket não existe", async () => {
    mockTicketRepo.getTicketById.mockResolvedValue(null);

    const res = await request(app)
      .patch("/tickets/999")
      .send({ Status: "Closed" });

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /tickets/:id
// ═════════════════════════════════════════════════════════════════════════════

describe("DELETE /tickets/:id", () => {
  test("responde 200 com o ticket eliminado", async () => {
    const deleted = { id: 10, CI_Name: "Old Service" };
    mockTicketRepo.deleteTicket.mockResolvedValue(deleted);

    const res = await request(app).delete("/tickets/10");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(deleted);
  });

  test("responde 404 quando o ticket não existe", async () => {
    mockTicketRepo.deleteTicket.mockResolvedValue(null);

    const res = await request(app).delete("/tickets/999");

    expect(res.status).toBe(404);
  });
});
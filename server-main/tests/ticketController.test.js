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

// ─── Importar o controller (depois dos mocks!) ────────────────────────────────

const {
  listTickets,
  getTicket,
  createTicket,
  deleteTicket,
  patchTicket,
} = await import("../src/controllers/ticketController.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(overrides = {}) {
  return { query: {}, params: {}, body: {}, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. listTickets
// ═════════════════════════════════════════════════════════════════════════════

describe("listTickets", () => {
  test("responde com data + paging quando o repositório devolve resultados", async () => {
    const fakeRows = [
      { id: 1, CI_Name: "API Gateway", Status: "Open" },
      { id: 2, CI_Name: "Auth Service", Status: "Closed" },
    ];
    mockTicketRepo.listTickets.mockResolvedValue({ rows: fakeRows, total: 2 });

    const req = makeReq({ query: { limit: "2", offset: "0" } });
    const res = makeRes();

    await listTickets(req, res);

    expect(mockTicketRepo.listTickets).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      data: fakeRows,
      paging: { total: 2, limit: 2, offset: 0 },
    });
  });

  test("usa limit=10 e offset=0 como valores por omissão", async () => {
    mockTicketRepo.listTickets.mockResolvedValue({ rows: [], total: 0 });

    const req = makeReq();
    const res = makeRes();

    await listTickets(req, res);

    const args = mockTicketRepo.listTickets.mock.calls[0][0];
    expect(args.limit).toBe(10);
    expect(args.offset).toBe(0);
  });

  test("aplica limite máximo de 100 mesmo que o query diga 999", async () => {
    mockTicketRepo.listTickets.mockResolvedValue({ rows: [], total: 0 });

    const req = makeReq({ query: { limit: "999" } });
    const res = makeRes();

    await listTickets(req, res);

    const args = mockTicketRepo.listTickets.mock.calls[0][0];
    expect(args.limit).toBe(100);
  });

  test("passa filtros status e priority ao repositório", async () => {
    mockTicketRepo.listTickets.mockResolvedValue({ rows: [], total: 0 });

    const req = makeReq({ query: { status: "Open", priority: "1" } });
    const res = makeRes();

    await listTickets(req, res);

    const args = mockTicketRepo.listTickets.mock.calls[0][0];
    expect(args.status).toBe("Open");
    expect(args.priority).toBe("1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. getTicket
// ═════════════════════════════════════════════════════════════════════════════

describe("getTicket", () => {
  test("devolve o ticket quando o id existe", async () => {
    const fakeTicket = { id: 42, CI_Name: "Payment API", Status: "Open" };
    mockTicketRepo.getTicketById.mockResolvedValue(fakeTicket);

    const req = makeReq({ params: { id: "42" } });
    const res = makeRes();

    await getTicket(req, res);

    expect(mockTicketRepo.getTicketById).toHaveBeenCalledWith(42);
    expect(res.json).toHaveBeenCalledWith({ data: fakeTicket });
  });

  test("lança erro 404 quando o ticket não existe", async () => {
    mockTicketRepo.getTicketById.mockResolvedValue(null);

    const req = makeReq({ params: { id: "999" } });
    const res = makeRes();

    await expect(getTicket(req, res)).rejects.toMatchObject({
      statusCode: 404,
      message: "Ticket not found",
    });
  });

  test("lança erro 400 quando o id não é um número", async () => {
    const req = makeReq({ params: { id: "abc" } });
    const res = makeRes();

    await expect(getTicket(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid ticket id",
    });
  });
});
// ═════════════════════════════════════════════════════════════════════════════
// 3. createTicket
// ═════════════════════════════════════════════════════════════════════════════

describe("createTicket", () => {
  test("cria ticket e devolve 201 com o ticket criado", async () => {
    const created = {
      id: 1,
      CI_Name: "API Gateway",
      Status: "Open",
      Open_Time: "2026-01-01T00:00:00Z",
    };
    mockTicketRepo.createTicket.mockResolvedValue(created);

    const req = makeReq({
      body: {
        CI_Name: "API Gateway",
        Status: "Open",
        Open_Time: "2026-01-01T00:00:00Z",
      },
    });
    const res = makeRes();

    await createTicket(req, res);

    expect(mockTicketRepo.createTicket).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: created });
  });

  test("lança erro 400 quando Open_Time está em falta", async () => {
    const req = makeReq({ body: { CI_Name: "Sem data" } });
    const res = makeRes();

    await expect(createTicket(req, res)).rejects.toMatchObject({
      statusCode: 400,
      message: "Open_Time is required",
    });

    expect(mockTicketRepo.createTicket).not.toHaveBeenCalled();
  });

  test("aceita campos em snake_case (ci_name, open_time)", async () => {
    const created = { id: 2, Open_Time: "2026-06-01T00:00:00Z" };
    mockTicketRepo.createTicket.mockResolvedValue(created);

    const req = makeReq({
      body: {
        ci_name: "Backend",
        open_time: "2026-06-01T00:00:00Z",
      },
    });
    const res = makeRes();

    await createTicket(req, res);

    const args = mockTicketRepo.createTicket.mock.calls[0][0];
    expect(args.ciName).toBe("Backend");
    expect(args.openTime).toBe("2026-06-01T00:00:00Z");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. deleteTicket
// ═════════════════════════════════════════════════════════════════════════════

describe("deleteTicket", () => {
  test("apaga e devolve o ticket eliminado", async () => {
    const deleted = { id: 10, CI_Name: "Old Service" };
    mockTicketRepo.deleteTicket.mockResolvedValue(deleted);

    const req = makeReq({ params: { id: "10" } });
    const res = makeRes();

    await deleteTicket(req, res);

    expect(mockTicketRepo.deleteTicket).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith({ data: deleted });
  });

  test("lança 404 quando o ticket não existe", async () => {
    mockTicketRepo.deleteTicket.mockResolvedValue(null);

    const req = makeReq({ params: { id: "999" } });
    const res = makeRes();

    await expect(deleteTicket(req, res)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("lança 400 com id inválido", async () => {
    const req = makeReq({ params: { id: "nope" } });
    const res = makeRes();

    await expect(deleteTicket(req, res)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. patchTicket
// ═════════════════════════════════════════════════════════════════════════════

describe("patchTicket", () => {
  test("devolve before e after quando o patch é bem-sucedido", async () => {
    const before = { id: 7, Status: "Open" };
    const after = { id: 7, Status: "Closed" };

    mockTicketRepo.getTicketById.mockResolvedValue(before);
    mockTicketRepo.updateTicket.mockResolvedValue(after);

    const req = makeReq({
      params: { id: "7" },
      body: { Status: "Closed" },
    });
    const res = makeRes();

    await patchTicket(req, res);

    expect(res.json).toHaveBeenCalledWith({ data: { before, after } });
  });

  test("lança 404 quando o ticket a atualizar não existe", async () => {
    mockTicketRepo.getTicketById.mockResolvedValue(null);

    const req = makeReq({ params: { id: "1" }, body: { Status: "Closed" } });
    const res = makeRes();

    await expect(patchTicket(req, res)).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(mockTicketRepo.updateTicket).not.toHaveBeenCalled();
  });

  test("lança 400 com id inválido", async () => {
    const req = makeReq({ params: { id: "xyz" }, body: {} });
    const res = makeRes();

    await expect(patchTicket(req, res)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
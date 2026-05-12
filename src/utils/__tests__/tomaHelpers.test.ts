import {
  startOfDay,
  endOfDay,
  parseYMD,
  jsDayToISOdow,
  buildDedupeKey,
  buildWindow,
  computeTomaStatus,
  shouldSendExpiryWarning,
} from "../tomaHelpers";

// ── Helpers de fecha ──

describe("startOfDay", () => {
  it("pone la hora a 00:00:00.000", () => {
    const result = startOfDay(new Date(2026, 0, 15, 14, 30, 45));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("no modifica la fecha original", () => {
    const original = new Date(2026, 0, 15, 14, 30);
    startOfDay(original);
    expect(original.getHours()).toBe(14);
  });
});

describe("endOfDay", () => {
  it("pone la hora a 23:59:59.999", () => {
    const result = endOfDay(new Date(2026, 0, 15, 8, 0));
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
    expect(result.getMilliseconds()).toBe(999);
  });
});

describe("parseYMD", () => {
  it("parsea '2026-03-15' correctamente", () => {
    const d = parseYMD("2026-03-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2); // marzo = 2
    expect(d.getDate()).toBe(15);
  });
});

describe("jsDayToISOdow", () => {
  it("convierte domingo JS (0) a ISO 8601 (7)", () => {
    expect(jsDayToISOdow(0)).toBe(7);
  });

  it("convierte lunes JS (1) a ISO 8601 (1)", () => {
    expect(jsDayToISOdow(1)).toBe(1);
  });

  it("convierte sábado JS (6) a ISO 8601 (6)", () => {
    expect(jsDayToISOdow(6)).toBe(6);
  });
});

// ── Lógica de tomas ──

describe("buildDedupeKey", () => {
  it("genera clave con formato scheduleId__plannedAt", () => {
    const key = buildDedupeKey("sched123", "2026-03-15T10:00:00.000Z");
    expect(key).toBe("sched123__2026-03-15T10:00:00.000Z");
  });
});

describe("buildWindow", () => {
  it("genera ventana de ±30 minutos", () => {
    const planned = new Date("2026-03-15T10:00:00.000Z");
    const { windowStart, windowEnd } = buildWindow(planned, 30);
    expect(windowStart).toBe("2026-03-15T09:30:00.000Z");
    expect(windowEnd).toBe("2026-03-15T10:30:00.000Z");
  });

  it("genera ventana de ±15 minutos", () => {
    const planned = new Date("2026-03-15T10:00:00.000Z");
    const { windowStart, windowEnd } = buildWindow(planned, 15);
    expect(windowStart).toBe("2026-03-15T09:45:00.000Z");
    expect(windowEnd).toBe("2026-03-15T10:15:00.000Z");
  });
});

// ── Transición de estados ──

describe("computeTomaStatus", () => {
  const windowStart = "2026-03-15T09:30:00.000Z";
  const windowEnd = "2026-03-15T10:30:00.000Z";

  it("devuelve PLANNED si ahora es antes de la ventana", () => {
    const now = "2026-03-15T08:00:00.000Z";
    expect(computeTomaStatus(now, windowStart, windowEnd, "PLANNED")).toBe("PLANNED");
  });

  it("devuelve DUE si ahora está dentro de la ventana", () => {
    const now = "2026-03-15T10:00:00.000Z";
    expect(computeTomaStatus(now, windowStart, windowEnd, "PLANNED")).toBe("DUE");
  });

  it("devuelve EXPIRED si ahora es después de la ventana", () => {
    const now = "2026-03-15T11:00:00.000Z";
    expect(computeTomaStatus(now, windowStart, windowEnd, "PLANNED")).toBe("EXPIRED");
  });

  it("mantiene CONFIRMED sin importar la hora", () => {
    const now = "2026-03-15T11:00:00.000Z";
    expect(computeTomaStatus(now, windowStart, windowEnd, "CONFIRMED")).toBe("CONFIRMED");
  });
});

// ── Aviso de expiración ──

describe("shouldSendExpiryWarning", () => {
  const windowEnd = "2026-03-15T10:30:00.000Z";

  it("devuelve true 3 minutos antes de expirar (con aviso de 5 min)", () => {
    const now = "2026-03-15T10:27:00.000Z";
    expect(shouldSendExpiryWarning(now, windowEnd, 5, false, "DUE")).toBe(true);
  });

  it("devuelve false si ya se notificó", () => {
    const now = "2026-03-15T10:27:00.000Z";
    expect(shouldSendExpiryWarning(now, windowEnd, 5, true, "DUE")).toBe(false);
  });

  it("devuelve false si la toma ya está confirmada", () => {
    const now = "2026-03-15T10:27:00.000Z";
    expect(shouldSendExpiryWarning(now, windowEnd, 5, false, "CONFIRMED")).toBe(false);
  });

  it("devuelve false si falta mucho para expirar", () => {
    const now = "2026-03-15T10:00:00.000Z";
    expect(shouldSendExpiryWarning(now, windowEnd, 5, false, "DUE")).toBe(false);
  });
});

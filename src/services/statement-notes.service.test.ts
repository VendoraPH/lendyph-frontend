/**
 * GET /accounting/statements/notes (backend B4), over real HTTP against a stub:
 * the service sends the year and answers the server's `data.pesos` unchanged.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import type { accountingService as AccountingService } from "./accounting.service";

const PESOS = {
  year: 2025,
  score: "78.50",
  rating: "Very Good",
  source: "finalized",
  provisional: false,
  finalized_at: "2026-04-20T02:00:00.000000Z",
  verified: false,
  disclosure: "Enhanced PESOS figures follow a placeholder template.",
};

let server: Server;
let service: typeof AccountingService;
const seen: { path: string; year: string | null }[] = [];

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    seen.push({ path: url.pathname.replace(/^\/api/, ""), year: url.searchParams.get("year") });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: { pesos: PESOS } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  service = (await import("./accounting.service")).accountingService;
});

after(() => server.close());

test("the notes are read for the year asked, and the PESOS figures come back as the server sent them", async () => {
  const notes = await service.statementNotes(2025);
  assert.deepEqual(seen.at(-1), { path: "/accounting/statements/notes", year: "2025" });
  assert.deepEqual(notes.pesos, PESOS);
});

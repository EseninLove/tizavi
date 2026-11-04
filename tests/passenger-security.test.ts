import assert from "node:assert/strict";
import test from "node:test";
import { clientAddress } from "../api/_security.js";

test("Passenger client addresses use protected headers only in Passenger runtime", () => {
  const previous = {
    passenger: process.env.TIZAVI_PASSENGER,
    vercel: process.env.VERCEL,
  };
  try {
    delete process.env.VERCEL;
    const req = {
      headers: {
        "!~passenger-client-address": "203.0.113.5",
        "x-forwarded-for": "198.51.100.9",
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;
    delete process.env.TIZAVI_PASSENGER;
    assert.equal(clientAddress(req), "127.0.0.1");
    process.env.TIZAVI_PASSENGER = "1";
    assert.equal(clientAddress(req), "203.0.113.5");
    delete req.headers["!~passenger-client-address"];
    assert.equal(clientAddress(req), "127.0.0.1");
  } finally {
    for (const [key, value] of [
      ["TIZAVI_PASSENGER", previous.passenger],
      ["VERCEL", previous.vercel],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  }
});

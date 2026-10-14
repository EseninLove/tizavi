import test from "node:test";
import assert from "node:assert/strict";
import {
  readPrivate,
  writePrivate,
  clearPrivate,
} from "../src/lib/private-storage";

test("private browser drafts reject expired data, remove legacy permanent copies and clear on logout", () => {
  const memory = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  };
  const original = Object.fromEntries(
    ["localStorage", "sessionStorage", "window"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const permanent = memory(),
    tab = memory(),
    events = new EventTarget();
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: permanent,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: tab,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: events,
    });
    permanent.setItem(
      "tizavi_delivery",
      JSON.stringify({ address: "old address" }),
    );
    assert.equal(readPrivate("tizavi_delivery"), null);
    assert.equal(permanent.getItem("tizavi_delivery"), null);
    writePrivate("tizavi_delivery", { address: "new address" });
    assert.deepEqual(readPrivate("tizavi_delivery"), {
      address: "new address",
    });
    const saved = JSON.parse(tab.getItem("tizavi_delivery")!);
    assert.ok(saved.expiresAt <= Date.now() + 86400000);
    tab.setItem(
      "tizavi_delivery",
      JSON.stringify({ ...saved, expiresAt: Date.now() - 1 }),
    );
    assert.equal(readPrivate("tizavi_delivery"), null);
    assert.equal(tab.getItem("tizavi_delivery"), null);
    tab.setItem(
      "tizavi_delivery",
      JSON.stringify({ value: { address: "unbounded" } }),
    );
    assert.equal(readPrivate("tizavi_delivery"), null);
    let cleared = false;
    events.addEventListener("tizavi-private-data-cleared", () => {
      cleared = true;
    });
    writePrivate("tizavi_delivery", { address: "private" });
    writePrivate("tizavi_checkout_request", { fingerprint: "digest" });
    clearPrivate();
    assert.equal(tab.getItem("tizavi_delivery"), null);
    assert.equal(tab.getItem("tizavi_checkout_request"), null);
    assert.equal(cleared, true);
  } finally {
    for (const key of Object.keys(original)) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]!);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { createBillDownloadToken, verifyBillDownloadToken } from "./field-bill-storage";

test("bill download tokens are bound to the bill and expire", () => {
  const billId = "00000000-0000-4000-8000-000000000201";
  const token = createBillDownloadToken(billId, Date.now() + 60_000);

  assert.equal(verifyBillDownloadToken(token, billId), true);
  assert.equal(verifyBillDownloadToken(token, "00000000-0000-4000-8000-000000000202"), false);
  assert.equal(verifyBillDownloadToken(createBillDownloadToken(billId, Date.now() - 1), billId), false);
  assert.equal(verifyBillDownloadToken(`${token}tampered`, billId), false);
});

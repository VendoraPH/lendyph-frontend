/**
 * The Release dialog's "Add Co-Maker": who is offered it, which registered
 * co-makers it offers, and what it sends.
 *
 * WHAT THIS PROVES: the action is offered only for an `approved` loan and only
 * to a user holding `loans:release`; of the borrower's registered co-makers,
 * only active ones not already on the loan are offered; and a new co-maker's
 * body is trimmed, with blank optional fields left out and no body at all
 * while a name is blank.
 * WHAT IT DOES NOT PROVE: that the dialog renders it this way (no DOM in this
 * suite), or the API's own checks, which the backend's tests cover.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { CoMaker } from "@/types";
import type { LoanStatus } from "@/types/loan";
import {
  EMPTY_NEW_CO_MAKER,
  canAddLoanCoMaker,
  linkableCoMakers,
  newCoMakerPayload,
} from "./loan-co-makers";

describe("linkableCoMakers", () => {
  const registered: CoMaker[] = [
    { id: 21, full_name: "Carla Diaz", status: "active" },
    { id: 22, full_name: "Dino Reyes", status: "inactive" },
    { id: 23, full_name: "Elena Lim", status: "active" },
    { id: 24, full_name: "Fe Santos", status: "active" },
  ];

  test("offers the active ones not on the loan, in the API's order", () => {
    const offered = linkableCoMakers(registered, [{ id: 23, full_name: "Elena Lim" }]);

    assert.deepEqual(offered.map((cm) => cm.id), [21, 24]);
  });

  test("never an inactive one, which the API refuses to link", () => {
    assert.ok(!linkableCoMakers(registered, []).some((cm) => cm.id === 22));
  });

  test("never one without a status, rather than guess it is active", () => {
    assert.deepEqual(linkableCoMakers([{ id: 25, full_name: "Gil Tan" }], []), []);
  });

  test("nothing when none are registered", () => {
    assert.deepEqual(linkableCoMakers([], []), []);
  });
});

describe("canAddLoanCoMaker", () => {
  test("an approved loan, to a user who can release it", () => {
    assert.equal(canAddLoanCoMaker("approved", true), true);
  });

  test("never to a user who cannot release the loan", () => {
    assert.equal(canAddLoanCoMaker("approved", false), false);
  });

  test("never once the loan is past approval, or before it", () => {
    const others: LoanStatus[] = [
      "draft",
      "for_review",
      "rejected",
      "released",
      "current",
      "past_due",
      "ongoing",
      "completed",
      "defaulted",
      "restructured",
      "closed",
      "void",
    ];
    for (const status of others) {
      assert.equal(canAddLoanCoMaker(status, true), false, status);
    }
  });

  test("not before the loan has loaded", () => {
    assert.equal(canAddLoanCoMaker(undefined, true), false);
  });
});

describe("newCoMakerPayload", () => {
  test("trims every field", () => {
    assert.deepEqual(
      newCoMakerPayload({
        first_name: "  Carla ",
        last_name: " Diaz",
        contact_number: " 09171234567 ",
        relationship_to_borrower: " Sibling ",
      }),
      {
        first_name: "Carla",
        last_name: "Diaz",
        contact_number: "09171234567",
        relationship_to_borrower: "Sibling",
      },
    );
  });

  test("leaves a blank optional field out rather than sending it empty", () => {
    assert.deepEqual(
      newCoMakerPayload({ ...EMPTY_NEW_CO_MAKER, first_name: "Carla", last_name: "Diaz", contact_number: "   " }),
      { first_name: "Carla", last_name: "Diaz" },
    );
  });

  test("is null while either name is blank or only spaces", () => {
    assert.equal(newCoMakerPayload(EMPTY_NEW_CO_MAKER), null);
    assert.equal(newCoMakerPayload({ ...EMPTY_NEW_CO_MAKER, first_name: "Carla" }), null);
    assert.equal(newCoMakerPayload({ ...EMPTY_NEW_CO_MAKER, first_name: "Carla", last_name: "  " }), null);
    assert.equal(newCoMakerPayload({ ...EMPTY_NEW_CO_MAKER, first_name: " ", last_name: "Diaz" }), null);
  });
});

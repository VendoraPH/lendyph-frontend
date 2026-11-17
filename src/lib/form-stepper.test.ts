import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canGoToStep,
  enterGoesToNext,
  errorMessages,
  fieldKeyCandidates,
  firstErrorField,
  firstStepWithError,
  hasStepErrors,
  nativeValidityApplies,
  nextStepIndex,
  previousStepIndex,
  stepCheckFailure,
  stepErrorsOf,
  stepFooterButtons,
  stepMenuOptions,
  stepIndexForField,
  stepProgressPercent,
  stepProgressText,
  stepperLayoutClasses,
  type FormStepDef,
} from "./form-stepper";

const steps: FormStepDef[] = [
  { id: "personal", title: "Personal", fields: ["first_name", "last_name", "birthdate"] },
  { id: "contact", title: "Contact", fields: ["contact_number", "email", "address"] },
  { id: "ids", title: "Valid IDs", fields: ["valid_ids"] },
  { id: "review", title: "Review" },
];

test("next moves forward one step and stops at the last", () => {
  assert.equal(nextStepIndex(0, 4), 1);
  assert.equal(nextStepIndex(2, 4), 3);
  assert.equal(nextStepIndex(3, 4), 3);
});

test("previous moves back one step and stops at the first", () => {
  assert.equal(previousStepIndex(2, 4), 1);
  assert.equal(previousStepIndex(1, 4), 0);
  assert.equal(previousStepIndex(0, 4), 0);
});

test("an out-of-range index is pulled back inside, then moved", () => {
  assert.equal(nextStepIndex(9, 4), 3);
  assert.equal(previousStepIndex(9, 4), 2);
  assert.equal(nextStepIndex(-2, 4), 1);
  assert.equal(previousStepIndex(-2, 4), 0);
});

test("with no steps both stay at 0", () => {
  assert.equal(nextStepIndex(0, 0), 0);
  assert.equal(previousStepIndex(0, 0), 0);
});

test("create: earlier steps and the current one are always reachable", () => {
  const passed = [true, false, false, false];
  assert.equal(canGoToStep(0, { mode: "create", current: 1, passed }), true);
  assert.equal(canGoToStep(1, { mode: "create", current: 1, passed }), true);
});

test("create: a later step needs every step before it passed (the current one is checked on the way)", () => {
  // On step 2 (index 1) with step 1 passed: step 3 is next, reachable once
  // the current step validates; step 4 needs step 3 to have passed too.
  const passed = [true, false, false, false];
  assert.equal(canGoToStep(2, { mode: "create", current: 1, passed }), true);
  assert.equal(canGoToStep(3, { mode: "create", current: 1, passed }), false);
});

test("create: going back does not unlock steps that never passed", () => {
  const passed = [true, true, false, false];
  assert.equal(canGoToStep(2, { mode: "create", current: 0, passed }), true);
  assert.equal(canGoToStep(3, { mode: "create", current: 0, passed }), false);
});

test("edit: every step is reachable", () => {
  const passed = [false, false, false, false];
  for (let i = 0; i < 4; i++) {
    assert.equal(canGoToStep(i, { mode: "edit", current: 0, passed }), true);
  }
});

test("a step outside the list is never reachable", () => {
  const passed = [true, true, true, true];
  assert.equal(canGoToStep(-1, { mode: "edit", current: 0, passed }), false);
  assert.equal(canGoToStep(4, { mode: "edit", current: 0, passed }), false);
  assert.equal(canGoToStep(4, { mode: "create", current: 0, passed }), false);
});

test("the step for a field key, including server keys under a listed field", () => {
  assert.equal(stepIndexForField("first_name", steps), 0);
  assert.equal(stepIndexForField("email", steps), 1);
  // Laravel answers array fields as dotted keys.
  assert.equal(stepIndexForField("valid_ids.0.id_number", steps), 2);
  assert.equal(stepIndexForField("unknown", steps), -1);
  // A prefix only counts at a dot: "email_2" is not "email".
  assert.equal(stepIndexForField("email_2", steps), -1);
});

test("the first step with an error, whatever the order of the errors map", () => {
  assert.equal(firstStepWithError({ email: "Email", first_name: "First name" }, steps), 0);
  assert.equal(firstStepWithError({ "valid_ids.1.type": ["Required"], address: "Street address" }, steps), 1);
  assert.equal(firstStepWithError({ "valid_ids.1.type": "ID type" }, steps), 2);
});

test("empty messages, unknown keys and an empty map point at no step", () => {
  assert.equal(firstStepWithError({}, steps), -1);
  assert.equal(firstStepWithError({ email: "", first_name: [], last_name: null, birthdate: undefined }, steps), -1);
  assert.equal(firstStepWithError({ branch_id: "Branch" }, steps), -1);
});

test("a step's own errors are picked out of a full errors map", () => {
  const errors = { email: "Email", first_name: "First name", "valid_ids.0.number": ["ID number"], blank: "" };
  assert.deepEqual(stepErrorsOf(errors, steps[1]), { email: "Email" });
  assert.deepEqual(stepErrorsOf(errors, steps[2]), { "valid_ids.0.number": "ID number" });
  assert.deepEqual(stepErrorsOf(errors, steps[3]), {});
});

test("whether a validation result has errors", () => {
  assert.equal(hasStepErrors(true), false);
  assert.equal(hasStepErrors({}), false);
  assert.equal(hasStepErrors({ email: "" }), false);
  assert.equal(hasStepErrors({ email: "Email" }), true);
  assert.equal(hasStepErrors({ email: ["Email"] }), true);
});

test("the first invalid field follows the step's field order, then the map's", () => {
  const fields = steps[0].fields;
  assert.equal(firstErrorField({ birthdate: "Date of birth", first_name: "First name" }, fields), "first_name");
  assert.equal(firstErrorField({ extra: "Extra", birthdate: "Date of birth" }, fields), "birthdate");
  assert.equal(firstErrorField({ extra: "Extra" }, fields), "extra");
  assert.equal(firstErrorField({ "valid_ids.2.number": "ID number" }, ["valid_ids"]), "valid_ids.2.number");
  assert.equal(firstErrorField({}, fields), null);
  assert.equal(firstErrorField({ email: "Email" }), "email");
});

test("a dotted key is looked up from the most to the least specific", () => {
  assert.deepEqual(fieldKeyCandidates("valid_ids.0.number"), ["valid_ids.0.number", "valid_ids.0", "valid_ids"]);
  assert.deepEqual(fieldKeyCandidates("email"), ["email"]);
});

test("'Step n of m' text, with the step's title when given", () => {
  assert.equal(stepProgressText(0, 4), "Step 1 of 4");
  assert.equal(stepProgressText(1, 4, "Contact"), "Step 2 of 4 · Contact");
  assert.equal(stepProgressText(3, 4, "  "), "Step 4 of 4");
});

test("progress is the share of steps up to and including the current one", () => {
  assert.equal(stepProgressPercent(0, 4), 25);
  assert.equal(stepProgressPercent(3, 4), 100);
  assert.equal(Math.round(stepProgressPercent(0, 3)), 33);
  assert.equal(stepProgressPercent(0, 0), 0);
});

const typing = { key: "Enter", tagName: "INPUT", inputType: "text", isComposing: false, defaultPrevented: false };

test("Enter in a field before the last step goes to Next", () => {
  assert.equal(enterGoesToNext({ ...typing, isLastStep: false }), true);
  assert.equal(enterGoesToNext({ ...typing, inputType: "email", isLastStep: false }), true);
  assert.equal(enterGoesToNext({ ...typing, inputType: "date", isLastStep: false }), true);
});

test("Enter on the last step is left to the form, which submits", () => {
  assert.equal(enterGoesToNext({ ...typing, isLastStep: true }), false);
});

test("Enter is left alone in text areas, buttons, pickers that handled it, and while composing", () => {
  assert.equal(enterGoesToNext({ ...typing, tagName: "TEXTAREA", inputType: undefined, isLastStep: false }), false);
  assert.equal(enterGoesToNext({ ...typing, tagName: "BUTTON", inputType: undefined, isLastStep: false }), false);
  assert.equal(enterGoesToNext({ ...typing, inputType: "checkbox", isLastStep: false }), false);
  assert.equal(enterGoesToNext({ ...typing, inputType: "file", isLastStep: false }), false);
  assert.equal(enterGoesToNext({ ...typing, defaultPrevented: true, isLastStep: false }), false);
  assert.equal(enterGoesToNext({ ...typing, isComposing: true, isLastStep: false }), false);
  assert.equal(enterGoesToNext({ ...typing, key: "a", isLastStep: false }), false);
});

test("the messages of an errors map, once each, for the validation toast", () => {
  assert.deepEqual(
    errorMessages({ first_name: "First name", email: ["Email", "Email"], blank: "", none: null, last_name: "Last name" }),
    ["First name", "Email", "Last name"]
  );
  assert.deepEqual(errorMessages({}), []);
});

test("create: Back from step 2, Next until the last step, Save only on the last", () => {
  assert.deepEqual(stepFooterButtons({ mode: "create", index: 0, count: 3 }), {
    back: false, next: true, submit: false, primary: "next",
  });
  assert.deepEqual(stepFooterButtons({ mode: "create", index: 1, count: 3 }), {
    back: true, next: true, submit: false, primary: "next",
  });
  assert.deepEqual(stepFooterButtons({ mode: "create", index: 2, count: 3 }), {
    back: true, next: false, submit: true, primary: "submit",
  });
});

test("edit: Save shows on every step beside Back and Next, and is the main button", () => {
  assert.deepEqual(stepFooterButtons({ mode: "edit", index: 0, count: 3 }), {
    back: false, next: true, submit: true, primary: "submit",
  });
  assert.deepEqual(stepFooterButtons({ mode: "edit", index: 1, count: 3 }), {
    back: true, next: true, submit: true, primary: "submit",
  });
  assert.deepEqual(stepFooterButtons({ mode: "edit", index: 2, count: 3 }), {
    back: true, next: false, submit: true, primary: "submit",
  });
});

test("a single step is just the form: Save only, in both modes", () => {
  for (const mode of ["create", "edit"] as const) {
    assert.deepEqual(stepFooterButtons({ mode, index: 0, count: 1 }), {
      back: false, next: false, submit: true, primary: "submit",
    });
  }
});

test("stepper classes: a page fits only at fit, a dialog always scrolls its body", () => {
  const page = stepperLayoutClasses("page");
  assert.match(page.root, /fit:flex-1/);
  assert.equal(page.scrollAlways, false);
  assert.equal(page.fabClear, true);
  assert.match(page.railCompact, /(^| )md:hidden/);
  assert.match(page.railFull, /(^| )md:flex/);

  const dialog = stepperLayoutClasses("dialog");
  assert.match(dialog.root, /(^| )flex-1( |$)/);
  assert.match(dialog.root, /min-h-0/);
  assert.equal(dialog.scrollAlways, true);
  // The dialog's overlay already covers Linda's button.
  assert.equal(dialog.fabClear, false);
  // The rail switches on the dialog's own width, not the screen's.
  assert.match(dialog.root, /@container/);
  assert.match(dialog.railCompact, /@xl:hidden/);
  assert.match(dialog.railFull, /@xl:flex/);
  // Pinned to the dialog's foot like DialogFooter.
  assert.match(dialog.footer, /-mb-4/);
});

test("phones: edit mode lists every step in a menu, labelled like the compact line", () => {
  assert.deepEqual(stepMenuOptions(steps, "edit"), [
    { id: "personal", label: "Step 1 of 4 · Personal" },
    { id: "contact", label: "Step 2 of 4 · Contact" },
    { id: "ids", label: "Step 3 of 4 · Valid IDs" },
    { id: "review", label: "Step 4 of 4 · Review" },
  ]);
});

test("phones: create mode keeps the plain compact line, with no menu", () => {
  assert.equal(stepMenuOptions(steps, "create"), null);
});

test("phones: a single step needs no menu in either mode", () => {
  assert.equal(stepMenuOptions(steps.slice(0, 1), "edit"), null);
});

test("noValidate: a form that opts out of browser validation is never checked natively", () => {
  // The loan form's Share Capital Build-Up steps by whole pesos, so ₱50.50 is
  // :invalid to the browser, yet the form (noValidate) and the server accept it.
  assert.equal(nativeValidityApplies({ noValidate: true }), false);
  assert.equal(nativeValidityApplies({ noValidate: true }, { formNoValidate: false }), false);
});

test("a form that validates natively keeps the native check, unless the button opts out", () => {
  assert.equal(nativeValidityApplies({ noValidate: false }), true);
  assert.equal(nativeValidityApplies({ noValidate: false }, { formNoValidate: false }), true);
  assert.equal(nativeValidityApplies({ noValidate: false }, { formNoValidate: true }), false);
});

test("outside a form there is nothing to check natively", () => {
  assert.equal(nativeValidityApplies(null), false);
  assert.equal(nativeValidityApplies(undefined), false);
});

test("nextDisabled: create mode can't move forward from the rail either, but can go back", () => {
  const passed = [true, true, false, false];
  const blocked = { mode: "create" as const, current: 1, passed, nextDisabled: true };
  assert.equal(canGoToStep(0, blocked), true);
  assert.equal(canGoToStep(1, blocked), true);
  assert.equal(canGoToStep(2, blocked), false);
});

test("nextDisabled: edit mode keeps every step reachable from the rail", () => {
  const passed = [false, false, false, false];
  for (let i = 0; i < 4; i++) {
    assert.equal(canGoToStep(i, { mode: "edit", current: 1, passed, nextDisabled: true }), true);
  }
});

test("a step's check: the browser's own constraints first, then validateStep", () => {
  // Like a real multi-page form: required, min, max and pattern report with
  // the browser's message before the form's own rules run.
  assert.equal(stepCheckFailure({ nativeApplies: true, nativeInvalid: true, result: { email: "Email" } }), "native");
  assert.equal(stepCheckFailure({ nativeApplies: true, nativeInvalid: true, result: true }), "native");
  assert.equal(stepCheckFailure({ nativeApplies: true, nativeInvalid: false, result: { email: "Email" } }), "custom");
  assert.equal(stepCheckFailure({ nativeApplies: true, nativeInvalid: false, result: true }), null);
  assert.equal(stepCheckFailure({ nativeApplies: true, nativeInvalid: false, result: {} }), null);
});

test("a step's check in a noValidate form ignores the browser and uses validateStep only", () => {
  assert.equal(stepCheckFailure({ nativeApplies: false, nativeInvalid: true, result: true }), null);
  assert.equal(stepCheckFailure({ nativeApplies: false, nativeInvalid: true, result: { a: "A" } }), "custom");
});

test("dialog layout has one fixed height from sm, so the footer never moves between steps", () => {
  const dialog = stepperLayoutClasses("dialog").root;
  // A fixed height, not a minimum: hidden steps take no room, so a minimum
  // below the tallest step let the dialog (and its footer) jump.
  assert.match(dialog, /(^| )sm:h-\[min\(36rem,70dvh\)\]( |$)/);
  assert.doesNotMatch(dialog, /min-h-\[/);
  // flex-1's zero basis would ignore the height; from sm the root sizes by
  // it and can still shrink inside a short screen's dialog.
  assert.match(dialog, /(^| )sm:flex-initial( |$)/);
  // Phones keep the content-sized dialog.
  assert.doesNotMatch(dialog, /(^| )h-\[/);
  assert.doesNotMatch(stepperLayoutClasses("page").root, /h-\[/);
});

// Conformance: join-point mutation in one advice should not leak to others.

function f() {}

AJS.before(PCs.exec("f"), function (jp) {
  jp.finalResult = "changed";
  if (jp.finalResult !== "changed") {
    Testing.flag("no-change");
  }
});

AJS.before(PCs.exec("f"), function () {
  Testing.flag("adv");
});

f();
Testing.check("no-change", "adv");

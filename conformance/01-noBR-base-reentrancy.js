// Conformance: base-triggered reentrancy can be constrained with noBR.

function f(n) {
  if (n > 0) {
    return f(n - 1);
  }
  return 0;
}

AJS.before(PCs.noBR(PCs.exec("f")), function () {
  Testing.flag("adv");
});

f(3);
Testing.check("adv");

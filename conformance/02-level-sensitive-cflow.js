// Conformance: control-flow checks should be level-sensitive.
// z runs in before advice for x and must not be observed as in-cflow of x.

function x() {}
function z() {}

AJS.before(PCs.exec("x"), function () {
  AJS.down(function () {
    Testing.flag("x-advice");
    z();
  });
});

AJS.before(PCs.exec("z").inCFlowOf(PCs.exec("x")), function () {
  Testing.flag("z-in-x-cflow");
});

x();
Testing.check("x-advice");

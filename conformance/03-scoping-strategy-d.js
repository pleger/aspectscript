// Conformance: d strategy controls deployment on created objects.

function f() {}

AJS.deployOn(
  [false, true, true],
  AJS.aspect(AJS.BEFORE, PCs.call(f), function () {
    Testing.flag("seen");
  }),
  AJS.globalObject
);

var object = {
  x: function () {
    f();
  }
};

object.x();
Testing.check("seen");

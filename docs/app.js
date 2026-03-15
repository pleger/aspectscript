const examples = [
  {
    id: "before-exec",
    title: "Before Advice",
    description: "Intercept a function execution and record a flag before the body runs.",
    code: `function greet(name) {
  print("Hello, " + name + "!");
}

AJS.before(PCs.exec(greet), function () {
  Testing.flag("before");
});

greet("AspectScript");
Testing.check("before");`,
  },
  {
    id: "around-call",
    title: "Around Advice",
    description: "Change call-time arguments and return value through proceed.",
    code: `function add(a, b) {
  return a + b;
}

AJS.around(PCs.call("add"), function (jp) {
  Testing.flag("around");
  return jp.proceed(10, 20);
});

var result = add(1, 2);
print("result =", result);
Testing.check("around");`,
  },
  {
    id: "property-write",
    title: "Property Write",
    description: "Observe writes to a specific property on an object.",
    code: `var account = { balance: 0 };

AJS.before(PCs.set(account, "balance"), function (jp) {
  print("writing balance:", jp.value);
  Testing.flag("set");
});

account.balance = 250;
Testing.check("set");`,
  },
  {
    id: "custom-event",
    title: "Custom Event",
    description: "Emit an application-level event and advise it like any other join point.",
    code: `AJS.after(PCs.event("save"), function (jp) {
  print("saved:", jp.recordId);
  Testing.flag("after-event");
});

AspectScript.event("save", { recordId: 42 }, function () {
  print("save thunk running");
});

Testing.check("after-event");`,
  },
  {
    id: "dynamic-deploy",
    title: "Dynamic Deployment",
    description: "Deploy an aspect only for the dynamic extent of a block.",
    code: `function work() {
  print("working");
}

var aspect = AJS.aspect(AJS.BEFORE, PCs.exec(work), function () {
  Testing.flag("inside");
});

AJS.deploy(aspect, function () {
  work();
});

work();
Testing.check("inside");`,
  },
];

const exampleList = document.getElementById("example-list");
const editor = document.getElementById("editor");
const output = document.getElementById("output");
const traceBody = document.getElementById("trace-body");
const runButton = document.getElementById("run-button");
const resetButton = document.getElementById("reset-button");
const runnerFrame = document.getElementById("runner-frame");

let currentExample = examples[0];

function stripLoads(source) {
  return source
    .split("\n")
    .filter((line) => !/^\s*load\(/.test(line))
    .join("\n");
}

function appendOutput(line = "") {
  output.textContent += line + "\n";
}

function setOutput(lines) {
  output.textContent = lines.join("\n");
}

function renderExamples() {
  exampleList.innerHTML = "";
  for (const example of examples) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "example-button" + (example.id === currentExample.id ? " active" : "");
    button.innerHTML = `<strong>${example.title}</strong><span>${example.description}</span>`;
    button.addEventListener("click", () => {
      currentExample = example;
      editor.value = example.code;
      renderExamples();
      clearOutput();
      clearTrace();
    });
    exampleList.appendChild(button);
  }
}

function clearOutput() {
  setOutput(["Ready."]);
}

function clearTrace() {
  traceBody.innerHTML = "";
}

function renderTrace(entries) {
  clearTrace();
  entries.forEach((entry, index) => {
    const tr = document.createElement("tr");
    tr.className = "trace-row" + (entry.matched ? " matched" : "");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${entry.label}</td>
      <td><span class="pill ${entry.matched ? "yes" : "no"}">${entry.matched ? "yes" : "no"}</span></td>
      <td>${entry.beforeOrAroundMatches + entry.afterMatches}</td>
    `;
    traceBody.appendChild(tr);
  });
}

function makeTesting(logs) {
  const flags = [];

  function format(value) {
    if (typeof value === "string") {
      return value;
    }
    if (value && typeof value.toString === "function" && value.toString !== Object.prototype.toString) {
      return String(value);
    }
    return JSON.stringify(value);
  }

  return {
    flag(value) {
      flags.push(value);
      logs.push("flag: " + format(value));
    },
    assert(expr) {
      if (!runnerFrame.contentWindow.eval(String(expr))) {
        throw new Error("Assertion failed: " + expr);
      }
      logs.push("assert ok: " + expr);
    },
    assert2(label, condition) {
      if (!condition) {
        throw new Error("Assertion " + label + " failed");
      }
      logs.push("assert2 ok: " + label);
    },
    check(...expected) {
      if (expected.length !== flags.length) {
        throw new Error("Expected " + expected.join(" ") + " but got " + flags.join(" "));
      }
      for (let i = 0; i < expected.length; i += 1) {
        if (expected[i] !== flags[i]) {
          throw new Error("Expected " + expected.join(" ") + " but got " + flags.join(" "));
        }
      }
      logs.push("check ok: " + expected.join(" "));
      flags.length = 0;
    },
  };
}

function prepareFrame(logs) {
  const frameWindow = runnerFrame.contentWindow;
  frameWindow.document.open();
  frameWindow.document.write("<!doctype html><title>runner</title>");
  frameWindow.document.close();

  frameWindow.console = {
    log: (...args) => logs.push(args.join(" ")),
    error: (...args) => logs.push("error: " + args.join(" ")),
    warn: (...args) => logs.push("warn: " + args.join(" ")),
  };
  frameWindow.print = (...args) => logs.push(args.join(" "));
  frameWindow.load = () => {};
  frameWindow.Function = window.Function;
  frameWindow.AspectScript = window.AspectScript.createAspectScript(frameWindow);
  frameWindow.AJS = frameWindow.AspectScript;
  frameWindow.PCs = frameWindow.AspectScript.Pointcuts;
  frameWindow.Testing = makeTesting(logs);
  frameWindow.AspectScript.tracer.enable();

  return frameWindow;
}

function runCurrentCode() {
  const logs = [];
  clearTrace();
  try {
    const frameWindow = prepareFrame(logs);
    const transformed = window.AspectScriptInstrument.transformProgram(stripLoads(editor.value));
    frameWindow.eval(transformed + "\n//# sourceURL=playground-example.js");
    renderTrace(frameWindow.AspectScript.tracer.getEntries());
    setOutput(logs.length ? logs : ["Done."]);
  } catch (error) {
    setOutput((logs.length ? logs : []).concat([
      "",
      error && error.stack ? error.stack : String(error),
    ]));
  }
}

runButton.addEventListener("click", runCurrentCode);
resetButton.addEventListener("click", () => {
  editor.value = currentExample.code;
  clearOutput();
  clearTrace();
});

editor.value = currentExample.code;
renderExamples();
clearOutput();

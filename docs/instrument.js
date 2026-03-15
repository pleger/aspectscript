const acorn = typeof require === "function" ? require("acorn") : globalThis.acorn;
const astring = typeof require === "function" ? require("astring") : globalThis.astring;

let scopeCounter = 1;

function id(name) {
  return { type: "Identifier", name };
}

function literal(value) {
  return { type: "Literal", value };
}

function member(object, property, computed = false) {
  return { type: "MemberExpression", object, property, computed, optional: false };
}

function callExpr(callee, args) {
  return { type: "CallExpression", callee, arguments: args, optional: false };
}

function arrayExpr(elements) {
  return { type: "ArrayExpression", elements };
}

function exprStmt(expression) {
  return { type: "ExpressionStatement", expression };
}

function returnStmt(argument) {
  return { type: "ReturnStatement", argument };
}

function block(body) {
  return { type: "BlockStatement", body };
}

function varDecl(kind, declarations) {
  return { type: "VariableDeclaration", kind, declarations };
}

function decl(name, init = null) {
  return { type: "VariableDeclarator", id: id(name), init };
}

function functionExpr(name, params, body) {
  return {
    type: "FunctionExpression",
    id: name ? id(name) : null,
    params,
    body,
    generator: false,
    async: false,
    expression: false,
  };
}

function objectExpr(properties) {
  return { type: "ObjectExpression", properties };
}

function propertyNode(key, value, computed = false) {
  return {
    type: "Property",
    key,
    value,
    kind: "init",
    method: false,
    shorthand: false,
    computed,
  };
}

function clone(node) {
  return JSON.parse(JSON.stringify(node));
}

class Scope {
  constructor(kind, parent, declarations, scopeName) {
    this.kind = kind;
    this.parent = parent;
    this.declarations = declarations;
    this.scopeName = scopeName;
    this.scopeId = kind === "function" || kind === "catch" ? "__as_scope_" + scopeCounter++ : null;
  }

  owns(name) {
    return this.declarations.has(name);
  }

  resolve(name) {
    if (name === "undefined" || name === "NaN" || name === "Infinity" || name === "arguments") {
      return null;
    }
    let cursor = this;
    while (cursor) {
      if (cursor.owns(name)) {
        if (cursor.kind === "global") {
          return { mode: "globalProp", target: member(id("AspectScript"), id("globalObject")) };
        }
        return { mode: "local", target: id(cursor.scopeId) };
      }
      cursor = cursor.parent;
    }
    return { mode: "globalProp", target: member(id("AspectScript"), id("globalObject")) };
  }
}

function collectFunctionScopeDeclarations(statements, out = new Set()) {
  for (const stmt of statements) {
    if (!stmt) {
      continue;
    }
    switch (stmt.type) {
      case "FunctionDeclaration":
        out.add(stmt.id.name);
        break;
      case "VariableDeclaration":
        if (stmt.kind === "var") {
          for (const declarator of stmt.declarations) {
            if (declarator.id.type === "Identifier") {
              out.add(declarator.id.name);
            }
          }
        }
        break;
      case "BlockStatement":
        collectFunctionScopeDeclarations(stmt.body, out);
        break;
      case "IfStatement":
        collectFunctionScopeDeclarations([stmt.consequent], out);
        if (stmt.alternate) {
          collectFunctionScopeDeclarations([stmt.alternate], out);
        }
        break;
      case "ForStatement":
        if (stmt.init && stmt.init.type === "VariableDeclaration" && stmt.init.kind === "var") {
          for (const declarator of stmt.init.declarations) {
            if (declarator.id.type === "Identifier") {
              out.add(declarator.id.name);
            }
          }
        }
        collectFunctionScopeDeclarations([stmt.body], out);
        break;
      case "ForInStatement":
      case "ForOfStatement":
        if (stmt.left && stmt.left.type === "VariableDeclaration" && stmt.left.kind === "var") {
          for (const declarator of stmt.left.declarations) {
            if (declarator.id.type === "Identifier") {
              out.add(declarator.id.name);
            }
          }
        }
        collectFunctionScopeDeclarations([stmt.body], out);
        break;
      case "WhileStatement":
      case "DoWhileStatement":
      case "LabeledStatement":
      case "WithStatement":
        collectFunctionScopeDeclarations([stmt.body], out);
        break;
      case "SwitchStatement":
        for (const switchCase of stmt.cases) {
          collectFunctionScopeDeclarations(switchCase.consequent, out);
        }
        break;
      case "TryStatement":
        collectFunctionScopeDeclarations([stmt.block], out);
        if (stmt.handler) {
          collectFunctionScopeDeclarations(stmt.handler.body.body, out);
        }
        if (stmt.finalizer) {
          collectFunctionScopeDeclarations([stmt.finalizer], out);
        }
        break;
      default:
        break;
    }
  }
  return out;
}

function transformProgram(source) {
  scopeCounter = 1;
  const ast = acorn.parse(source, {
    ecmaVersion: 2020,
    sourceType: "script",
    allowReturnOutsideFunction: true,
  });
  const globalDecls = collectFunctionScopeDeclarations(ast.body);
  const scope = new Scope("global", null, globalDecls, "global");
  const body = transformStatementList(ast.body, scope, null);
  return astring.generate({ type: "Program", body, sourceType: "script" });
}

function transformStatementList(statements, scope, catchScope) {
  const hoisted = [];
  const body = [];
  for (const stmt of statements) {
    if (!stmt) {
      continue;
    }
    if (stmt.type === "FunctionDeclaration") {
      hoisted.push(varDecl("var", [decl(stmt.id.name, transformFunction(stmt, scope))]));
      continue;
    }
    const transformed = transformStatement(stmt, scope, catchScope);
    if (Array.isArray(transformed)) {
      body.push(...transformed);
    } else if (transformed) {
      body.push(transformed);
    }
  }
  return hoisted.concat(body);
}

function transformFunction(node, parentScope) {
  const declarations = collectFunctionScopeDeclarations(node.body.body, new Set());
  for (const param of node.params) {
    if (param.type === "Identifier") {
      declarations.add(param.name);
    }
  }
  if (node.id && node.type === "FunctionExpression") {
    declarations.add(node.id.name);
  }
  const scope = new Scope("function", parentScope, declarations, node.id ? node.id.name : "");
  const transformedBody = transformStatementList(node.body.body, scope, null);
  transformedBody.unshift(varDecl("var", [decl(scope.scopeId, callExpr(member(id("AspectScript"), id("__scope")), [literal(scope.scopeName || "")]))]));
  return callExpr(member(id("AspectScript"), id("__wrapFunction")), [
    functionExpr(node.id ? node.id.name : null, node.params, block(transformedBody)),
    literal(node.id ? node.id.name : ""),
  ]);
}

function transformCatchClause(node, scope) {
  const declarations = new Set();
  if (node.param && node.param.type === "Identifier") {
    declarations.add(node.param.name);
  }
  const catchScope = new Scope("catch", scope, declarations, node.param ? node.param.name : "");
  const body = transformStatementList(node.body.body, scope, catchScope);
  body.unshift(varDecl("var", [decl(catchScope.scopeId, callExpr(member(id("AspectScript"), id("__scope")), [literal(catchScope.scopeName || "")]))]));
  return {
    type: "CatchClause",
    param: node.param,
    body: block(body),
  };
}

function transformStatement(node, scope, catchScope) {
  switch (node.type) {
    case "BlockStatement":
      return block(transformStatementList(node.body, scope, catchScope));
    case "ExpressionStatement":
      return exprStmt(transformExpression(node.expression, scope, catchScope));
    case "VariableDeclaration":
      return transformVariableDeclaration(node, scope, catchScope);
    case "ReturnStatement":
      return returnStmt(node.argument ? transformExpression(node.argument, scope, catchScope) : null);
    case "IfStatement":
      return {
        type: "IfStatement",
        test: transformExpression(node.test, scope, catchScope),
        consequent: wrapStatement(transformStatement(node.consequent, scope, catchScope)),
        alternate: node.alternate ? wrapStatement(transformStatement(node.alternate, scope, catchScope)) : null,
      };
    case "WhileStatement":
      return {
        type: "WhileStatement",
        test: transformExpression(node.test, scope, catchScope),
        body: wrapStatement(transformStatement(node.body, scope, catchScope)),
      };
    case "DoWhileStatement":
      return {
        type: "DoWhileStatement",
        body: wrapStatement(transformStatement(node.body, scope, catchScope)),
        test: transformExpression(node.test, scope, catchScope),
      };
    case "ForStatement":
      return {
        type: "ForStatement",
        init: node.init ? transformForInit(node.init, scope, catchScope) : null,
        test: node.test ? transformExpression(node.test, scope, catchScope) : null,
        update: node.update ? transformExpression(node.update, scope, catchScope) : null,
        body: wrapStatement(transformStatement(node.body, scope, catchScope)),
      };
    case "ForInStatement":
      return {
        type: "ForInStatement",
        left: node.left,
        right: transformExpression(node.right, scope, catchScope),
        body: wrapStatement(transformStatement(node.body, scope, catchScope)),
      };
    case "ForOfStatement":
      return {
        type: "ForOfStatement",
        await: false,
        left: node.left,
        right: transformExpression(node.right, scope, catchScope),
        body: wrapStatement(transformStatement(node.body, scope, catchScope)),
      };
    case "BreakStatement":
    case "ContinueStatement":
    case "DebuggerStatement":
    case "EmptyStatement":
      return clone(node);
    case "ThrowStatement":
      return { type: "ThrowStatement", argument: transformExpression(node.argument, scope, catchScope) };
    case "TryStatement":
      return {
        type: "TryStatement",
        block: transformStatement(node.block, scope, catchScope),
        handler: node.handler ? transformCatchClause(node.handler, scope) : null,
        finalizer: node.finalizer ? transformStatement(node.finalizer, scope, catchScope) : null,
      };
    case "SwitchStatement":
      return {
        type: "SwitchStatement",
        discriminant: transformExpression(node.discriminant, scope, catchScope),
        cases: node.cases.map((switchCase) => ({
          type: "SwitchCase",
          test: switchCase.test ? transformExpression(switchCase.test, scope, catchScope) : null,
          consequent: transformStatementList(switchCase.consequent, scope, catchScope),
        })),
      };
    case "FunctionDeclaration":
      return null;
    default:
      return clone(node);
  }
}

function wrapStatement(node) {
  return node.type === "BlockStatement" ? node : block([node]);
}

function transformForInit(node, scope, catchScope) {
  if (node.type === "VariableDeclaration") {
    return node;
  }
  return transformExpression(node, scope, catchScope);
}

function transformVariableDeclaration(node, scope, catchScope) {
  const declarations = [];
  const extra = [];
  for (const declarator of node.declarations) {
    declarations.push(decl(declarator.id.name, null));
    if (declarator.init) {
      extra.push(exprStmt(transformAssignment(
        { type: "AssignmentExpression", operator: "=", left: declarator.id, right: declarator.init },
        scope,
        catchScope,
      )));
    }
  }
  return [varDecl(node.kind, declarations), ...extra];
}

function transformExpression(node, scope, catchScope, context = {}) {
  if (!node) {
    return node;
  }
  switch (node.type) {
    case "Literal":
      return clone(node);
    case "Identifier":
      return transformIdentifier(node, scope, catchScope, context);
    case "ThisExpression":
      return scope.kind === "global" ? member(id("AspectScript"), id("globalObject")) : clone(node);
    case "FunctionExpression":
      return transformFunction(node, scope);
    case "ArrayExpression":
      return arrayExpr(node.elements.map((element) => element ? transformExpression(element, scope, catchScope) : null));
    case "ObjectExpression":
      return transformObjectExpression(node, scope, catchScope);
    case "CallExpression":
      return transformCall(node, scope, catchScope);
    case "NewExpression":
      return transformNew(node, scope, catchScope);
    case "MemberExpression":
      return transformMemberExpression(node, scope, catchScope, context);
    case "AssignmentExpression":
      return transformAssignment(node, scope, catchScope);
    case "UpdateExpression":
      return transformUpdate(node, scope, catchScope);
    case "UnaryExpression":
      return transformUnary(node, scope, catchScope);
    case "BinaryExpression":
    case "LogicalExpression":
      return {
        type: node.type,
        operator: node.operator,
        left: transformExpression(node.left, scope, catchScope),
        right: transformExpression(node.right, scope, catchScope),
      };
    case "ConditionalExpression":
      return {
        type: "ConditionalExpression",
        test: transformExpression(node.test, scope, catchScope),
        consequent: transformExpression(node.consequent, scope, catchScope),
        alternate: transformExpression(node.alternate, scope, catchScope),
      };
    case "SequenceExpression":
      return {
        type: "SequenceExpression",
        expressions: node.expressions.map((expr) => transformExpression(expr, scope, catchScope)),
      };
    case "ArrayPattern":
    case "ObjectPattern":
      return clone(node);
    default:
      return clone(node);
  }
}

function transformIdentifier(node, scope, catchScope, context) {
  if (context.noRewrite) {
    return clone(node);
  }
  const binding = (catchScope && catchScope.resolve(node.name)) || scope.resolve(node.name);
  if (!binding) {
    return clone(node);
  }
  if (binding.mode === "globalProp") {
    return callExpr(member(id("AspectScript"), id("__getProp")), [
      binding.target,
      literal(node.name),
    ]);
  }
  return callExpr(member(id("AspectScript"), id("__getVar")), [
    binding.target,
    literal(node.name),
    functionExpr(null, [], block([returnStmt(clone(node))])),
    literal(binding.mode),
  ]);
}

function transformObjectExpression(node, scope, catchScope) {
  const entries = [];
  for (const prop of node.properties) {
    if (prop.type !== "Property" || prop.kind !== "init") {
      continue;
    }
    const key = prop.computed ? transformExpression(prop.key, scope, catchScope) :
      literal(prop.key.type === "Identifier" ? prop.key.name : prop.key.value);
    entries.push(objectExpr([
      propertyNode(id("key"), key, prop.computed),
      propertyNode(id("value"), transformExpression(prop.value, scope, catchScope)),
    ]));
  }
  return callExpr(member(id("AspectScript"), id("__makeObjectLiteral")), [arrayExpr(entries)]);
}

function transformCall(node, scope, catchScope) {
  if (node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.property.type === "Identifier" &&
      (node.callee.property.name === "call" || node.callee.property.name === "apply") &&
      isExplicitFunctionDispatch(node.callee.object)) {
    const calleeObject = node.callee.object;
    const methodName = inferMethodNames(calleeObject);
    const target = node.arguments[0] ? transformExpression(node.arguments[0], scope, catchScope) : literal(null);
    if (node.callee.property.name === "call") {
      return callExpr(member(id("AspectScript"), id("__explicitCall")), [
        transformCallable(calleeObject, scope, catchScope),
        target,
        arrayExpr(node.arguments.slice(1).map((arg) => transformExpression(arg, scope, catchScope))),
        arrayExpr(methodName.map(literal)),
      ]);
    }
    return callExpr(member(id("AspectScript"), id("__explicitApply")), [
      transformCallable(calleeObject, scope, catchScope),
      target,
      node.arguments[1] ? transformExpression(node.arguments[1], scope, catchScope) : arrayExpr([]),
      arrayExpr(methodName.map(literal)),
    ]);
  }

  if (node.callee.type === "MemberExpression") {
    return callExpr(member(id("AspectScript"), id("__callProp")), [
      transformExpression(node.callee.object, scope, catchScope),
      node.callee.computed ?
        transformExpression(node.callee.property, scope, catchScope) :
        literal(node.callee.property.name),
      arrayExpr(node.arguments.map((arg) => transformExpression(arg, scope, catchScope))),
      arrayExpr(inferMethodNames(node.callee).map(literal)),
    ]);
  }

  return callExpr(member(id("AspectScript"), id("__call")), [
    member(id("AspectScript"), id("globalObject")),
    transformCallable(node.callee, scope, catchScope),
    arrayExpr(node.arguments.map((arg) => transformExpression(arg, scope, catchScope))),
    arrayExpr(inferMethodNames(node.callee).map(literal)),
  ]);
}

function isExplicitFunctionDispatch(node) {
  return node.type === "Identifier" && !["AJS", "PCs", "Testing", "AspectScript"].includes(node.name);
}

function transformCallable(node, scope, catchScope) {
  if (node.type === "Identifier") {
    const binding = (catchScope && catchScope.resolve(node.name)) || scope.resolve(node.name);
    if (binding && binding.mode === "globalProp") {
      return callExpr(member(id("AspectScript"), id("__getProp")), [
        binding.target,
        literal(node.name),
      ]);
    }
    return clone(node);
  }
  return transformExpression(node, scope, catchScope);
}

function transformNew(node, scope, catchScope) {
  return callExpr(member(id("AspectScript"), id("__new")), [
    transformCallable(node.callee, scope, catchScope),
    arrayExpr(node.arguments.map((arg) => transformExpression(arg, scope, catchScope))),
    arrayExpr(inferMethodNames(node.callee).map(literal)),
  ]);
}

function transformMemberExpression(node, scope, catchScope, context) {
  if (context.asLeft) {
    return clone(node);
  }
  const object = transformExpression(node.object, scope, catchScope);
  const key = node.computed ? transformExpression(node.property, scope, catchScope) : literal(node.property.name);
  return callExpr(member(id("AspectScript"), id("__getProp")), [object, key]);
}

function makeSetterFunction(left, binding) {
  const actualLeft = binding && binding.mode === "globalProp"
    ? member(binding.target, literal(left.name), true)
    : left;
  return functionExpr(null, [id("__as_value")], block([returnStmt({
    type: "AssignmentExpression",
    operator: "=",
    left: actualLeft,
    right: id("__as_value"),
  })]));
}

function transformAssignment(node, scope, catchScope) {
  if (node.operator !== "=") {
    const asBinary = {
      type: "AssignmentExpression",
      operator: "=",
      left: node.left,
      right: {
        type: "BinaryExpression",
        operator: node.operator.slice(0, -1),
        left: clone(node.left),
        right: node.right,
      },
    };
    return transformAssignment(asBinary, scope, catchScope);
  }

  const right = transformExpression(node.right, scope, catchScope);
  if (node.left.type === "Identifier") {
    const binding = (catchScope && catchScope.resolve(node.left.name)) || scope.resolve(node.left.name);
    if (binding.mode === "globalProp") {
      return callExpr(member(id("AspectScript"), id("__setProp")), [
        binding.target,
        literal(node.left.name),
        right,
      ]);
    }
    return callExpr(member(id("AspectScript"), id("__setVar")), [
      binding.target,
      literal(node.left.name),
      right,
      makeSetterFunction(clone(node.left), binding),
      literal(binding.mode),
    ]);
  }

  if (node.left.type === "MemberExpression") {
    return callExpr(member(id("AspectScript"), id("__setProp")), [
      transformExpression(node.left.object, scope, catchScope),
      node.left.computed ? transformExpression(node.left.property, scope, catchScope) : literal(node.left.property.name),
      right,
    ]);
  }

  return {
    type: "AssignmentExpression",
    operator: "=",
    left: clone(node.left),
    right,
  };
}

function transformUpdate(node, scope, catchScope) {
  const delta = node.operator === "++" ? 1 : -1;
  if (node.argument.type === "Identifier") {
    const binding = (catchScope && catchScope.resolve(node.argument.name)) || scope.resolve(node.argument.name);
    if (binding.mode === "globalProp") {
      return callExpr(member(id("AspectScript"), id("__updateProp")), [
        binding.target,
        literal(node.argument.name),
        literal(delta),
        literal(node.prefix),
      ]);
    }
    return callExpr(member(id("AspectScript"), id("__updateVar")), [
      binding.target,
      literal(node.argument.name),
      functionExpr(null, [], block([returnStmt(clone(node.argument))])),
      makeSetterFunction(clone(node.argument), binding),
      literal(delta),
      literal(node.prefix),
      literal(binding.mode),
    ]);
  }
  if (node.argument.type === "MemberExpression") {
    return callExpr(member(id("AspectScript"), id("__updateProp")), [
      transformExpression(node.argument.object, scope, catchScope),
      node.argument.computed ? transformExpression(node.argument.property, scope, catchScope) : literal(node.argument.property.name),
      literal(delta),
      literal(node.prefix),
    ]);
  }
  return clone(node);
}

function transformUnary(node, scope, catchScope) {
  if (node.operator === "delete" && node.argument.type === "MemberExpression") {
    return callExpr(member(id("AspectScript"), id("__deleteProp")), [
      transformExpression(node.argument.object, scope, catchScope),
      node.argument.computed ? transformExpression(node.argument.property, scope, catchScope) : literal(node.argument.property.name),
    ]);
  }
  return {
    type: "UnaryExpression",
    operator: node.operator,
    prefix: node.prefix,
    argument: transformExpression(node.argument, scope, catchScope),
  };
}

function inferMethodNames(node) {
  if (!node) {
    return [];
  }
  if (node.type === "Identifier") {
    return [node.name];
  }
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return [node.property.name];
  }
  return [];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    transformProgram,
  };
} else {
  globalThis.AspectScriptInstrument = {
    transformProgram,
  };
}

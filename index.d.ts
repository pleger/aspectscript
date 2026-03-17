type AdviceKind = "before" | "around" | "after";

interface JoinPoint {
  target: unknown;
  fun: unknown;
  name?: string;
  value?: unknown;
  args: unknown[];
  methods: string[];
  finalResult: unknown;
  metaLevel: number;
  ctx?: unknown;
  eventType?: string;
  proceed(...args: unknown[]): unknown;
  clone(): JoinPoint;
  isCall(): boolean;
  isExec(): boolean;
  isInit(): boolean;
  isCreation(): boolean;
  isPropRead(): boolean;
  isPropWrite(): boolean;
  isEvent(): boolean;
  toString(): string;
}

declare class Env {
  constructor(map?: Map<unknown, unknown>);
  bind(key: unknown, value: unknown): Env;
  bind(pair: [unknown, unknown]): Env;
  unbind(...keys: unknown[]): Env;
  get(key: unknown): unknown;
}

type PointcutResult = boolean | Env | unknown;
type PointcutFn = (jp: JoinPoint, env: Env) => PointcutResult;
type PointcutLike = Pointcut | PointcutFn;
type AdviceFn = (jp: JoinPoint, env?: Env) => unknown;
type StrategyPredicate = boolean | ((jp: JoinPoint) => boolean);
type ScopingStrategy = [StrategyPredicate, StrategyPredicate, StrategyPredicate];

interface Pointcut extends PointcutFn {
  and(other: PointcutLike): Pointcut;
  or(other: PointcutLike): Pointcut;
  not(): Pointcut;
  inCFlowOf(other: PointcutLike): Pointcut;
}

interface Aspect {
  kind: AdviceKind;
  pointcut: Pointcut;
  advice: AdviceFn;
  option?: unknown;
}

interface TraceEntry {
  label: string;
  kind: string;
  matched: boolean;
  beforeOrAroundMatches: number;
  afterMatches: number;
}

interface Tracer {
  enable(): void;
  disable(): void;
  reset(): void;
  getEntries(): TraceEntry[];
  dump(): TraceEntry[];
  toJSON(pretty?: boolean): string;
  saveToFile(filePath: string, pretty?: boolean): void;
}

interface PointcutsApi {
  call(fun: unknown): Pointcut;
  exec(fun: unknown): Pointcut;
  init(fun: unknown): Pointcut;
  creation(fun: unknown): Pointcut;
  get(name: string): Pointcut;
  get(target: unknown, name: string): Pointcut;
  set(name: string): Pointcut;
  set(target: unknown, name: string): Pointcut;
  event(type: string): Pointcut;
  cflow(other: PointcutLike): Pointcut;
  within(target: unknown): Pointcut;
  noBR(other: PointcutLike, ctxFn?: (jp: JoinPoint) => unknown): Pointcut;
}

interface AspectScriptRuntime {
  BEFORE: "before";
  AROUND: "around";
  AFTER: "after";
  Pointcuts: PointcutsApi;
  emptyEnv: Env;
  globalObject: unknown;
  tracer: Tracer;
  i13n: Record<string, (...args: unknown[]) => unknown>;
  Env: typeof Env;

  aspect(kind: AdviceKind, pointcut: PointcutLike, advice: AdviceFn, option?: unknown): Aspect;
  before(pointcut: PointcutLike, advice: AdviceFn, option?: unknown): unknown;
  around(pointcut: PointcutLike, advice: AdviceFn, option?: unknown): unknown;
  after(pointcut: PointcutLike, advice: AdviceFn, option?: unknown): unknown;

  deploy(aspect: Aspect, thunk?: () => unknown, strategy?: ScopingStrategy): unknown;
  deploy(strategy: ScopingStrategy, aspect: Aspect, thunk?: () => unknown): unknown;
  undeploy(deployment: unknown): void;
  deployOn(aspect: Aspect, target: unknown, strategy?: ScopingStrategy): unknown;
  deployOn(strategy: ScopingStrategy, aspect: Aspect, target: unknown): unknown;

  up<T>(thunk: () => T): T;
  down<T>(thunk: () => T): T;
  event(type: string, ctx: unknown, block: (...args: unknown[]) => unknown): unknown;

  createAspectScript(runtimeGlobal?: unknown): AspectScriptRuntime;
}

declare const AspectScript: AspectScriptRuntime;

declare global {
  var AspectScript: AspectScriptRuntime;
}

export = AspectScript;

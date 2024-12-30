export interface GraphQLRequest {
  query: string;
  operationName?: string;
  variables?: Record<string, unknown>;
}

export interface GraphQLResponse {
  data?: unknown;
  errors?: GraphQLError[];
  extensions?: Record<string, unknown>;
}

export type GraphQLDataResponse = GraphQLResponse & { data: unknown };

export interface GraphQLError {
  message: string;
  locations?: GraphQLLocation[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLLocation {
  line: number;
  column: number;
}

export function buildMutation(
  name: string,
  varTypes: Record<string, string>,
  variables: Record<string, unknown>,
  query: string,
  operationName = ucFirst(name)
): GraphQLRequest {
  const queryVars = findQueryVars(query);
  const varDecls = declVars(varTypes, variables);
  const varArgs = mapVars(variables, queryVars);
  return {
    query: `mutation ${operationName}(${varDecls}) { ${name}(input: { ${varArgs} }) { ${query} } }`,
    operationName,
    variables,
  };
}

export function buildQuery(
  name: string,
  varTypes: Record<string, string>,
  variables: Record<string, unknown>,
  query: string,
  operationName = ucFirst(name)
): GraphQLRequest {
  const queryVars = findQueryVars(query);
  const varDecls = declVars(varTypes, variables);
  const varArgs = mapVars(variables, queryVars);
  return {
    query: `query ${operationName}(${varDecls}) { ${name}(${varArgs}) { ${query} } }`,
    operationName,
    variables,
  };
}

function findQueryVars(query: string): Set<string> {
  const result = new Set<string>();
  const matches = query.matchAll(/\$([_A-Za-z][_0-9A-Za-z]*)/g);
  for (const match of matches) {
    result.add(match[1]);
  }
  return result;
}

function declVars(
  varTypes: Record<string, string>,
  variables: Record<string, unknown>
): string {
  return Object.entries(varTypes)
    .filter(([k]) => k in variables)
    .map(([k, v]) => `$${k}: ${v}`)
    .join(", ");
}

function mapVars(
  variables: Record<string, unknown>,
  exclude: Set<string>
): string {
  return Object.keys(variables)
    .filter((k) => !exclude.has(k))
    .map((k) => `${k}: $${k}`)
    .join(", ");
}

function ucFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.substring(1);
}

function isAnyOf<T>(actual: T, expected: T | T[]): boolean {
  return Array.isArray(expected)
    ? expected.includes(actual)
    : actual === expected;
}

export function hasExceptionCode(
  response: GraphQLResponse,
  code: string | string[]
): boolean {
  return (
    response.errors != null &&
    response.errors.some(
      (err) =>
        isObject(err.extensions?.exception) &&
        isAnyOf(err.extensions.exception.code, code)
    )
  );
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isDuplicateError(response: GraphQLResponse): boolean {
  return hasExceptionCode(response, ["DUPLICATE_KEY", "ER_DUP_ENTRY"]);
}

export function isNotFoundError(response: GraphQLResponse): boolean {
  return hasExceptionCode(response, "NOT_FOUND");
}

export function getResponseData(
  response: GraphQLResponse,
  operation?: GraphQLRequest | string | (() => string | undefined)
): unknown {
  function decorateMessage(message: string): string {
    let operationStr;
    switch (typeof operation) {
      case "string":
        operationStr = operation;
        break;
      case "function":
        operationStr = operation();
        break;
      case "object":
        operationStr = describeRequest(operation);
        break;
    }
    if (operationStr) {
      message = `${message} for ${operationStr}`;
    }

    const requestId = response.extensions?.requestId;
    if (requestId) {
      message = `${message} in request ${requestId}`;
    }

    return message;
  }

  if (response.errors && response.errors.length > 0) {
    throw new Error(decorateMessage(response.errors[0].message));
  }
  if (!response.data) {
    throw new Error(decorateMessage("No data returned for API request"));
  }
  return response.data;
}

export function describeRequest(request: GraphQLRequest): string {
  let result;
  if (request.operationName) {
    result = request.operationName;
    if (request.variables) {
      result += `(${JSON.stringify(request.variables)})`;
    }
  } else {
    result = request.query;
  }
  return result;
}

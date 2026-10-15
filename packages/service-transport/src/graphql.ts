import type { GraphQLResolverMap } from '@apollo/subgraph';
import { buildSubgraphSchema } from '@apollo/subgraph';
import type { DocumentNode, FragmentDefinitionNode, GraphQLSchema, SelectionSetNode } from 'graphql';
import { execute, GraphQLError, Kind, NoSchemaIntrospectionCustomRule, parse, specifiedRules, validate, valueFromASTUntyped } from 'graphql';

import {GRAPHQL_LIMITS} from './transport-limits.js';
import { objectValue, stringValue } from './wire.js';

export interface IGraphqlSettings { maximumBytes:number; maximumResponseBytes:number; maximumDepth:number; maximumRootFields:number; maximumSelectedFields:number; introspection:boolean; }

export class FederationBoundary {
  private readonly schema:GraphQLSchema;

  constructor(sdl:string, resolvers:GraphQLResolverMap<unknown>, private readonly settings:Readonly<IGraphqlSettings>) {
    if (settings.maximumBytes !== GRAPHQL_LIMITS.requestBytes || settings.maximumResponseBytes !== GRAPHQL_LIMITS.responseBytes || settings.maximumDepth !== GRAPHQL_LIMITS.depth || settings.maximumRootFields !== GRAPHQL_LIMITS.rootFields || settings.maximumSelectedFields !== GRAPHQL_LIMITS.selectedFields || typeof settings.introspection !== 'boolean') throw new Error('Unsupported GraphQL admission limits');
    this.schema = buildSubgraphSchema([{typeDefs:parse(sdl), resolvers}]);
  }

  async execute(body:unknown, context:unknown):Promise<unknown> {
    try {
      const request = objectValue(body);

      if (Object.keys(request).some(key=>!['query', 'variables', 'operationName'].includes(key))) throw new Error('Invalid GraphQL envelope');
      if (Buffer.byteLength(JSON.stringify(request)) > this.settings.maximumBytes) throw new Error('GraphQL envelope too large');

      const query = stringValue(request.query);const document = parse(query);const variables = request.variables === undefined ? {} : objectValue(request.variables);const operationName = request.operationName === undefined ? undefined : stringValue(request.operationName);
      const errors = validate(this.schema, document, this.settings.introspection ? specifiedRules : [...specifiedRules, NoSchemaIntrospectionCustomRule]);

      if (errors.length) return {errors:errors.map(()=>({message:'INVALID_INPUT', extensions:{code:'INVALID_INPUT', retryable:false, outcomeUnknown:false}}))};
      this.admit(document, variables, operationName);
      const result = await execute({schema:this.schema, document, contextValue:context, variableValues:variables, ...(operationName ? {operationName} : {})});

      if (Buffer.byteLength(JSON.stringify(result)) > this.settings.maximumResponseBytes) {
        const mutates = document.definitions.some(d=>d.kind === Kind.OPERATION_DEFINITION && d.operation === 'mutation' && (!operationName || d.name?.value === operationName));

        return {errors:[{message:'OVERLOADED', extensions:{code:'OVERLOADED', retryable:true, outcomeUnknown:mutates}}]};
      }

      return result;
    } catch {return {errors:[{message:'INVALID_INPUT', extensions:{code:'INVALID_INPUT', retryable:false, outcomeUnknown:false}}]};}
  }

  private admit(document:DocumentNode, variables:Record<string, unknown>, name?:string):void {
    const fragments = new Map<string, FragmentDefinitionNode>();
    const operations = document.definitions.filter(d=>d.kind === Kind.OPERATION_DEFINITION && (!name || d.name?.value === name));

    if (operations.length !== 1) throw new Error('Single selected operation required');

    for (const d of document.definitions) if (d.kind === Kind.FRAGMENT_DEFINITION)fragments.set(d.name.value, d);
    const values = {...variables};

    for (const d of operations) if (d.kind === Kind.OPERATION_DEFINITION) for (const v of d.variableDefinitions ?? []) if (values[v.variable.name.value] === undefined && v.defaultValue)values[v.variable.name.value] = valueFromASTUntyped(v.defaultValue);
    let roots = 0, fields = 0;
    const scanLimits = (value:unknown, depth = 0):void=>{
      if (depth > 64) throw new Error('Input too deep');
      if (Array.isArray(value)) {for (const item of value)scanLimits(item, depth + 1);}
      else if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
        if (key === 'limit' && (typeof item !== 'number' || !Number.isInteger(item) || item < 1 || item > 200)) throw new Error('Invalid page limit');
        scanLimits(item, depth + 1);
      }
    };
    const visitSet = (set:SelectionSetNode, depth:number, active:ReadonlySet<string>):void=>{
      if (depth > this.settings.maximumDepth) throw new Error('Depth exceeded');

      for (const selection of set.selections) {
        if (selection.kind === Kind.FRAGMENT_SPREAD) {const fragment = fragments.get(selection.name.value);

if (!fragment || active.has(fragment.name.value)) throw new Error('Invalid fragment');visitSet(fragment.selectionSet, depth, new Set([...active, fragment.name.value]));continue;}
        if (selection.kind === Kind.INLINE_FRAGMENT) {visitSet(selection.selectionSet, depth, active);continue;}
        if (depth === 1 && ++roots > this.settings.maximumRootFields) throw new Error('Root field limit');
        if (++fields > this.settings.maximumSelectedFields) throw new Error('Selected field limit');

        for (const argument of selection.arguments ?? []) {
          const value:unknown = valueFromASTUntyped(argument.value, values);

          if (argument.name.value === 'limit' && (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 200)) throw new Error('Invalid page limit');
          if (argument.name.value === 'representations' && (!Array.isArray(value) || value.length > GRAPHQL_LIMITS.entityBatch)) throw new Error('Invalid entity batch');
          scanLimits(value);
        }

        if (selection.selectionSet)visitSet(selection.selectionSet, depth + 1, active);
      }
    };

    for (const operation of operations) if (operation.kind === Kind.OPERATION_DEFINITION)visitSet(operation.selectionSet, 1, new Set());
  }
}

export function businessGraphqlError(error:unknown):GraphQLError {
  const result = objectValue(error);

  return new GraphQLError(stringValue(result.code), {extensions:{...result}});
}

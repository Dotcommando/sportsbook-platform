import type { GraphQLResolverMap } from '@apollo/subgraph';
import { buildSubgraphSchema } from '@apollo/subgraph';
import type { DocumentNode, FragmentDefinitionNode, GraphQLSchema, ObjectFieldNode, SelectionSetNode } from 'graphql';
import { execute, GraphQLError, Kind, NoSchemaIntrospectionCustomRule, parse, specifiedRules, validate } from 'graphql';

import { objectValue, stringValue } from './wire.js';

export interface IGraphqlSettings { maximumBytes:number; maximumDepth:number; maximumRootFields:number; maximumCost:number; introspection:boolean; }

export class FederationBoundary {
  private readonly schema:GraphQLSchema;

  constructor(sdl:string, resolvers:GraphQLResolverMap<unknown>, private readonly settings:Readonly<IGraphqlSettings>) {
    if (settings.maximumBytes !== 65536 || settings.maximumDepth !== 8 || settings.maximumRootFields !== 20 || settings.maximumCost !== 1000 || typeof settings.introspection !== 'boolean') throw new Error('Unsupported GraphQL admission limits');
    this.schema = buildSubgraphSchema([{typeDefs:parse(sdl), resolvers}]);
  }

  async execute(body:unknown, context:unknown):Promise<unknown> {
    try {
      const request = objectValue(body);

      if (Object.keys(request).some(key=>!['query', 'variables', 'operationName'].includes(key))) throw new Error('Invalid GraphQL envelope');

      const query = stringValue(request.query);

      if (Buffer.byteLength(query) > this.settings.maximumBytes) throw new Error('Query too large');

      const document = parse(query); const variables = request.variables === undefined ? {} : objectValue(request.variables);
      const operationName = request.operationName === undefined ? undefined : stringValue(request.operationName);
      const rules = this.settings.introspection ? specifiedRules : [...specifiedRules, NoSchemaIntrospectionCustomRule];
      const errors = validate(this.schema, document, rules);

      if (errors.length) return {errors:errors.map(()=>({message:'INVALID_INPUT', extensions:{code:'INVALID_INPUT', retryable:false, outcomeUnknown:false}}))};
      this.admit(document, variables, operationName);

      return await execute({schema:this.schema, document, contextValue:context, variableValues:variables, ...(operationName ? {operationName} : {})});
    } catch {return {errors:[{message:'INVALID_INPUT', extensions:{code:'INVALID_INPUT', retryable:false, outcomeUnknown:false}}]};}
  }

  private admit(document:DocumentNode, variables:Record<string, unknown>, name?:string):void {
    const fragments = new Map<string, FragmentDefinitionNode>();
    const operations = document.definitions.filter(definition=>definition.kind === Kind.OPERATION_DEFINITION && (!name || definition.name?.value === name));

    for (const definition of document.definitions) if (definition.kind === Kind.FRAGMENT_DEFINITION)fragments.set(definition.name.value, definition);

    if (operations.length !== 1) throw new Error('Single selected operation required');

    let roots = 0;let cost = 0;
    const listFields = new Set(['entries', 'transactions', 'restrictions', 'markets', 'events', 'selections', 'contacts', 'checks', 'cases', '_entities']);
    const visitSet = (set:SelectionSetNode, depth:number, multiplier:number, inheritedLimit?:number):void=> {
      if (depth > this.settings.maximumDepth) throw new Error('Depth exceeded');

      for (const selection of set.selections) {
        if (selection.kind === Kind.FRAGMENT_SPREAD) {const fragment = fragments.get(selection.name.value);

if (!fragment) throw new Error('Missing fragment');visitSet(fragment.selectionSet, depth, multiplier, inheritedLimit);continue;}
        if (selection.kind === Kind.INLINE_FRAGMENT) {visitSet(selection.selectionSet, depth, multiplier, inheritedLimit);continue;}
        if (depth === 1 && ++roots > this.settings.maximumRootFields) throw new Error('Root field limit');

        let requestedLimit = inheritedLimit;

        for (const argument of selection.arguments ?? []) {
          const scan = (value:unknown):void=> {if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) {if (key === 'limit') {if (typeof item !== 'number' || !Number.isInteger(item) || item < 1 || item > 200) throw new Error('Invalid list limit');requestedLimit = item;} else scan(item);}};

          if (argument.value.kind === Kind.VARIABLE)scan(variables[argument.value.name.value]);
          else if (argument.value.kind === Kind.OBJECT) {
            const scanLiteral = (fields:readonly ObjectFieldNode[]):void=>{for (const field of fields) {if (field.name.value === 'limit' && field.value.kind === Kind.INT) {requestedLimit = Number(field.value.value);

if (requestedLimit < 1 || requestedLimit > 200) throw new Error('Invalid list limit');} else if (field.value.kind === Kind.OBJECT)scanLiteral(field.value.fields);}};

            scanLiteral(argument.value.fields);
          }
          if (argument.name.value === 'representations' && argument.value.kind === Kind.VARIABLE && Array.isArray(variables[argument.value.name.value])) {const representations = variables[argument.value.name.value];

if (Array.isArray(representations)) {if (representations.length > 200) throw new Error('Too many entity representations');requestedLimit = representations.length;}}
        }
        const listLimit = listFields.has(selection.name.value) ? requestedLimit ?? 50 : 1;

        cost += multiplier;

        if (cost > this.settings.maximumCost) throw new Error('Cost exceeded');
        if (selection.selectionSet)visitSet(selection.selectionSet, depth + 1, multiplier * listLimit, requestedLimit);
      }
    };

    for (const operation of operations) if (operation.kind === Kind.OPERATION_DEFINITION)visitSet(operation.selectionSet, 1, 1);
  }
}

export function businessGraphqlError(error:unknown):GraphQLError {
  const result = objectValue(error);

  return new GraphQLError(stringValue(result.code), {extensions:{...result}});
}

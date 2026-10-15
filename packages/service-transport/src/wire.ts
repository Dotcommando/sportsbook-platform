import { parse, visit } from 'jsonc-parser';

export function objectValue(value:unknown):Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');

  return Object.fromEntries(Object.entries(value));
}

export function stringValue(value:unknown):string {if (typeof value !== 'string') throw new Error('Expected string');

return value;}

export function strictJson(text:string):unknown {
  if (Buffer.byteLength(text) > 65536) throw new Error('Request too large');

  const stack:Set<string>[] = [];

  visit(text, {onObjectBegin:()=>{stack.push(new Set());},
onObjectProperty:name=>{const keys = stack.at(-1);

if (!keys || keys.has(name) || ['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('Duplicate or unsafe property');keys.add(name);},
onObjectEnd:()=>{stack.pop();},
onError:()=>{throw new Error('Invalid JSON');}}, {disallowComments:true, allowTrailingComma:false});
  const errors: {error:number;offset:number;length:number}[] = [];
  const value:unknown = parse(text, errors, {disallowComments:true, allowTrailingComma:false});

  if (errors.length) throw new Error('Invalid JSON');

  return value;
}

export function snake(name:string):string {return name.replace(/[A-Z]/g, character=>'_' + character.toLowerCase());}

export function camel(name:string):string {return name.replace(/_([a-z])/g, (_match, character:string)=>character.toUpperCase());}

export function jsonWire(value:unknown, snakeCase = false):unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(item=>jsonWire(item, snakeCase));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([,item])=>item !== undefined).map(([key, item])=>[snakeCase ? snake(key) : key, jsonWire(item, snakeCase)]));

  return value;
}

export function camelWire(value:unknown):unknown {
  if (Array.isArray(value)) return value.map(camelWire);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item])=>[camel(key), camelWire(item)]));

  return value;
}

export enum ShapeKind { STRING = 'string', BIGINT = 'bigint', NUMBER = 'number', BOOLEAN = 'boolean', OBJECT = 'object', ARRAY = 'array', ENUM = 'enum', UNION = 'union', REFERENCE = 'reference' }

export enum StringFormat { UUID = 'UUID', INSTANT = 'INSTANT', CURRENCY = 'CURRENCY' }

export interface IShape {kind:ShapeKind;fields?:Record<string, IShape>;optional?:boolean;items?:IShape;values?:readonly string[];members?:readonly IShape[];name?:string;literal?:boolean;format?:StringFormat;}

function validString(value:string, format?:StringFormat):boolean {
  if (format === StringFormat.UUID) return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) && value !== '00000000-0000-0000-0000-000000000000';
  if (format === StringFormat.CURRENCY) return /^[A-Z]{3}$/.test(value);
  if (format === StringFormat.INSTANT) {if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;

const calendar = new Date(value.slice(0, 19) + 'Z');

return Number.isFinite(calendar.getTime()) && calendar.toISOString().slice(0, 19) === value.slice(0, 19);}

  return [...value].every(character => {const code = character.codePointAt(0) ?? 0;

return code >= 32 && code !== 127;});
}

export function decodeShape(value:unknown, shape:IShape, protobuf = false, registry:Readonly<Record<string, IShape>> = {}, depth = 0):unknown {
  if (depth > 64) throw new Error('Shape too deep');
  if (value === undefined && shape.optional) return undefined;

  switch (shape.kind) {
    case ShapeKind.STRING: {const text = stringValue(value);

if (!validString(text, shape.format)) throw new Error('Invalid string format');

return shape.format === StringFormat.INSTANT ? new Date(text).toISOString() : text;}
    case ShapeKind.BIGINT: {
      if (protobuf && typeof value === 'bigint') return value;

      const text = stringValue(value);

if (!/^(0|-?[1-9]\d*)$/.test(text)) throw new Error('Lossless decimal required');

const amount = BigInt(text);

if (amount < -9223372036854775808n || amount > 9223372036854775807n) throw new Error('Int64 overflow');

return amount;
    }
    case ShapeKind.NUMBER: if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error('Integer required');

return value;
    case ShapeKind.BOOLEAN: if (typeof value !== 'boolean' || shape.literal !== undefined && value !== shape.literal) throw new Error('Boolean required');

return value;
    case ShapeKind.ENUM: {const text = stringValue(value);const found = shape.values?.find(candidate=>candidate === text || protobuf && text.endsWith('_' + candidate));

if (!found) throw new Error('Unknown enum');

return found;}
    case ShapeKind.ARRAY: if (!Array.isArray(value) || !shape.items || value.length > 200) throw new Error('Bounded array required');

return value.map(item=>decodeShape(item, shape.items ?? {kind:ShapeKind.STRING}, protobuf, registry, depth + 1));
    case ShapeKind.UNION: for (const member of shape.members ?? []) {try {return decodeShape(value, member, protobuf, registry, depth + 1);} catch {continue;}} throw new Error('Invalid variant');
    case ShapeKind.OBJECT: {const record = objectValue(value);const fields = shape.fields ?? {};

if (Object.keys(record).some(key=>!(key in fields))) throw new Error('Unknown field');

return Object.fromEntries(Object.entries(fields).flatMap(([key, field])=>{const result = decodeShape(record[key], field, protobuf, registry, depth + 1);

return result === undefined ? [] : [[key, result]];}));}
    case ShapeKind.REFERENCE: {const target = registry[shape.name ?? ''];

if (!target) throw new Error('Unregistered shape');

return decodeShape(value, target, protobuf, registry, depth + 1);}
  }
}

export function matchesShape(value:unknown, shape:IShape, registry:Readonly<Record<string, IShape>> = {}, depth = 0):boolean {
  if (depth > 64) return false;
  if (value === undefined) return shape.optional === true;

  switch (shape.kind) {
    case ShapeKind.STRING:return typeof value === 'string' && validString(value, shape.format);
    case ShapeKind.BIGINT:return typeof value === 'bigint' && value >= -9223372036854775808n && value <= 9223372036854775807n;
    case ShapeKind.NUMBER:return typeof value === 'number' && Number.isSafeInteger(value);
    case ShapeKind.BOOLEAN:return typeof value === 'boolean' && (shape.literal === undefined || value === shape.literal);
    case ShapeKind.ENUM:return typeof value === 'string' && shape.values?.includes(value) === true;
    case ShapeKind.ARRAY:return Array.isArray(value) && value.length <= 200 && shape.items !== undefined && value.every(item=>shape.items !== undefined && matchesShape(item, shape.items, registry, depth + 1));
    case ShapeKind.UNION:return shape.members?.some(member=>matchesShape(value, member, registry, depth + 1)) === true;
    case ShapeKind.OBJECT:if (value === null || typeof value !== 'object' || Array.isArray(value)) return false; {const record = objectValue(value);const fields = shape.fields ?? {};

return Object.keys(record).every(key=>key in fields) && Object.entries(fields).every(([key, field])=>matchesShape(record[key], field, registry, depth + 1));}
    case ShapeKind.REFERENCE:{const target = registry[shape.name ?? ''];

return target !== undefined && matchesShape(value, target, registry, depth + 1);}
  }
}

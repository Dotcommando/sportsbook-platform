import type {IncomingMessage} from 'node:http';

import type {INestApplication} from '@nestjs/common';

import {GRAPHQL_LIMITS, REST_LIMITS} from './transport-limits.js';

interface IJsonResponse {statusCode:number;json(value:unknown):unknown;}

export function installHttpResponseLimits(app:INestApplication):void {
  app.use((request:IncomingMessage, response:IJsonResponse, next:()=>void):void=>{
    const graphql = new URL(request.url ?? '/', 'http://localhost').pathname === '/internal/graphql';
    const maximum = graphql ? GRAPHQL_LIMITS.responseBytes : REST_LIMITS.responseBytes;
    const send = response.json.bind(response);

    response.json = (body:unknown):unknown=>{
      try {const encoded = JSON.stringify(body);

if (typeof encoded === 'string' && Buffer.byteLength(encoded) <= maximum) return send(body);} catch {/* The boundary returns an explicit serialization failure below. */}
      response.statusCode = 429;
      const mutates = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method ?? '');
      const error = {code:'OVERLOADED', message:'OVERLOADED', retryable:true, outcomeUnknown:mutates};

      return send(graphql ? {errors:[{message:error.code, extensions:error}]} : {...error, outcome_unknown:mutates, outcomeUnknown:undefined});
    };
    next();
  });
}

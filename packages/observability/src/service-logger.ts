import { ConsoleLogger } from '@nestjs/common';

export function createServiceLogger(serviceName: string): ConsoleLogger {
  return new ConsoleLogger(serviceName, { json: true, colors: false });
}

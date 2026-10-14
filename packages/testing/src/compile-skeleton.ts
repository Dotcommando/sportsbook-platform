import 'reflect-metadata';

import type { Type } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

export async function compileSkeleton(moduleType: Type): Promise<TestingModule> {
  const module = await Test.createTestingModule({ imports: [moduleType] }).compile();

  await module.init();

  return module;
}

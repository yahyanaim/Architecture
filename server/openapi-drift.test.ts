import { describe, it, expect } from 'vitest';
import { swaggerSpec } from './config/swagger';
import { CreateUserSchema } from './api/dtos/UserDTO';
import { LoginSchema, RegisterSchema } from './api/dtos/AuthDTO';

describe('OpenAPI Drift Test: Zod DTOs match Swagger Component Schemas', () => {
  const spec = swaggerSpec as any;

  it('spec defines both v1 and legacy /api servers', () => {
    expect(spec.servers).toBeDefined();
    const urls = spec.servers.map((s: any) => s.url);
    expect(urls).toContain('/api/v1');
    expect(urls).toContain('/api');
  });

  it('CreateUserInput schema matches CreateUserSchema Zod DTO', () => {
    const swaggerSchema = spec.components?.schemas?.CreateUserInput;
    expect(swaggerSchema).toBeDefined();

    const zodKeys = Object.keys(CreateUserSchema.shape);
    const swaggerKeys = Object.keys(swaggerSchema.properties);

    expect(swaggerKeys.sort()).toEqual(zodKeys.sort());
    expect(swaggerSchema.required.sort()).toEqual(zodKeys.sort());
  });

  it('LoginInput schema matches LoginSchema Zod DTO', () => {
    const swaggerSchema = spec.components?.schemas?.LoginInput;
    expect(swaggerSchema).toBeDefined();

    const zodKeys = Object.keys(LoginSchema.shape);
    const swaggerKeys = Object.keys(swaggerSchema.properties);

    expect(swaggerKeys.sort()).toEqual(zodKeys.sort());
    expect(swaggerSchema.required.sort()).toEqual(zodKeys.sort());
  });

  it('RegisterInput schema matches RegisterSchema Zod DTO', () => {
    const swaggerSchema = spec.components?.schemas?.RegisterInput;
    expect(swaggerSchema).toBeDefined();

    // RegisterSchema uses .refine(), so underlying shape is on ._def.schema.shape
    const innerShape = (RegisterSchema as any)._def?.schema?.shape ?? (RegisterSchema as any).shape;
    const zodKeys = Object.keys(innerShape);
    const swaggerKeys = Object.keys(swaggerSchema.properties);

    expect(swaggerKeys.sort()).toEqual(zodKeys.sort());
    expect(swaggerSchema.required.sort()).toEqual(zodKeys.sort());
  });
});

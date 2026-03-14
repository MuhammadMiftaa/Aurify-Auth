# 🧪 Testing Pattern Documentation — Aurify Auth (NestJS)

> Panduan lengkap untuk mereproduksi pola unit test & e2e test pada service NestJS serupa.

---

## 📋 Daftar Isi

- [Tech Stack Testing](#tech-stack-testing)
- [Struktur File Test](#struktur-file-test)
- [Konfigurasi Jest](#konfigurasi-jest)
- [Pola Mocking](#pola-mocking)
  - [PrismaService](#1-prismaservice)
  - [JwtService](#2-jwtservice)
  - [EmailService (Nodemailer)](#3-emailservice-nodemailer)
  - [Winston Logger](#4-winston-logger)
  - [ConfigService](#5-configservice)
  - [bcryptjs](#6-bcryptjs)
  - [Utility Functions (spyOn)](#7-utility-functions-spyon)
- [Pattern per Layer](#pattern-per-layer)
  - [Service Layer](#service-layer-unit-test)
  - [Controller Layer](#controller-layer-unit-test)
  - [Middleware](#middleware-unit-test)
  - [Validation Pipe & Filter](#validation-pipe--filter)
  - [Zod Model Validation](#zod-model-validation)
  - [Utility Functions](#utility-functions)
- [E2E Test Pattern](#e2e-test-pattern)
- [GitLab CI & SonarQube](#gitlab-ci--sonarqube)
- [Checklist Reproduksi](#checklist-reproduksi)
- [Troubleshooting](#troubleshooting)

---

## Tech Stack Testing

| Package           | Version | Keterangan                                |
| ----------------- | ------- | ----------------------------------------- |
| `jest`            | ^30.0   | Test runner                               |
| `ts-jest`         | ^29.2   | TypeScript transformer untuk Jest         |
| `@nestjs/testing` | ^11.0   | NestJS testing utilities                  |
| `supertest`       | ^7.0    | HTTP assertion untuk e2e                  |
| `zod`             | ^4.3    | Schema validation (bukan class-validator) |
| `prisma`          | ^7.3    | ORM (generated client)                    |

---

## Struktur File Test

```
src/
├── auth/auth/
│   ├── auth.service.ts
│   ├── auth.service.spec.ts          ← Unit test service
│   ├── auth.controller.ts
│   └── auth.controller.spec.ts       ← Unit test controller
├── email/email/
│   ├── email.service.ts
│   └── email.service.spec.ts         ← Unit test email
├── prisma/prisma/
│   ├── prisma.service.ts
│   └── prisma.service.spec.ts        ← Unit test prisma
├── validation/
│   ├── validation.pipe.ts
│   ├── validation.pipe.spec.ts       ← Unit test pipe
│   ├── validation.filter.ts
│   ├── validation.filter.spec.ts     ← Unit test filter
│   └── validation/
│       ├── validation.service.ts
│       └── validation.service.spec.ts
├── middleware/log/
│   ├── log.middleware.ts
│   └── log.middleware.spec.ts        ← Unit test middleware
├── model/
│   └── model.validation.spec.ts      ← Unit test zod schemas
├── utils/
│   ├── generate.utils.ts
│   └── generate.utils.spec.ts        ← Unit test utilities
test/
└── app.e2e-spec.ts                   ← E2E test
```

**Konvensi penamaan**: `<nama>.spec.ts` untuk unit test, `<nama>.e2e-spec.ts` untuk e2e test.

---

## Konfigurasi Jest

### `package.json` — Unit Tests

```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s",
      "!**/*.spec.(t|j)s",
      "!**/*.module.(t|j)s",
      "!main.ts"
    ],
    "coverageDirectory": "../coverage",
    "coverageReporters": ["text", "lcov", "cobertura"],
    "testEnvironment": "node",
    "moduleNameMapper": {
      "^src/(.*)$": "<rootDir>/$1",
      "^generated/(.*)$": "<rootDir>/../generated/$1",
      "^(\\.{1,2}/.*)\\.js$": "$1"
    }
  }
}
```

### `test/jest-e2e.json` — E2E Tests

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "roots": ["<rootDir>/test"],
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/src/$1",
    "^generated/(.*)$": "<rootDir>/generated/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
}
```

### Penjelasan `moduleNameMapper`

| Pattern                       | Fungsi                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `^src/(.*)$`                  | Resolve path alias `src/` → folder source aktual                               |
| `^generated/(.*)$`            | Resolve path alias `generated/` → folder generated Prisma                      |
| `^(\\.{1,2}/.*)\\.js$` → `$1` | Strip `.js` extension dari relative import Prisma generated client (ESM → CJS) |

> **Penting**: Pattern `.js` harus hanya match relative path (`./` atau `../`), BUKAN absolute/module path. Jika menggunakan `^(.*)\\.js$` maka `@nestjs/platform-express` dan module lain di `node_modules` akan ikut ter-strip dan gagal resolve.

---

## Pola Mocking

### 1. PrismaService

Prisma menggunakan adapter pattern (`@prisma/adapter-pg` + `PrismaPg`), sehingga **tidak bisa** di-instantiate tanpa koneksi database. Mock seluruh model methods:

```typescript
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  oTP: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  userAuthProvider: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

// Di dalam TestingModule:
{ provide: PrismaService, useValue: mockPrismaService }
```

> **Catatan**: nama property model mengikuti camelCase dari nama Prisma model. `OTP` → `oTP`.

### 2. JwtService

```typescript
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

{ provide: JwtService, useValue: mockJwtService }
```

### 3. EmailService (Nodemailer)

```typescript
// Untuk mock EmailService di consumer (AuthService):
const mockEmailService = {
  sendOTP: jest.fn().mockResolvedValue(undefined),
};

{ provide: EmailService, useValue: mockEmailService }

// Untuk unit test EmailService sendiri, mock nodemailer:
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    verify: jest.fn().mockResolvedValue(true),
  }),
}));
```

### 4. Winston Logger

```typescript
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

{ provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
```

### 5. ConfigService

```typescript
const mockConfigService = {
  get: jest.fn().mockReturnValue('default-value'),
};

// Atau dengan implementasi dinamis:
const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      REDIRECT_URL: 'http://localhost:5173',
      JWT_SECRET: 'test-secret',
      EMAIL_USER: 'test@test.com',
      EMAIL_PASS: 'password',
    };
    return config[key];
  }),
};

{ provide: ConfigService, useValue: mockConfigService }
```

### 6. bcryptjs

```typescript
import bcrypt from 'bcryptjs';

// Untuk test login (password comparison):
jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

// Untuk test register (password hashing):
jest
  .spyOn(bcrypt, 'hash')
  .mockImplementation(() => Promise.resolve('hashed-password'));
```

### 7. Utility Functions (spyOn)

```typescript
import * as generateUtils from 'src/utils/generate.utils';

jest.spyOn(generateUtils, 'generateOTP').mockReturnValue('123456');
jest
  .spyOn(generateUtils, 'generateTempToken')
  .mockReturnValue('mock-temp-token');
jest
  .spyOn(generateUtils, 'generateHashPassword')
  .mockResolvedValue('hashed-pw');
```

---

## Pattern per Layer

### Service Layer Unit Test

**File**: `*.service.spec.ts`

**Prinsip**:

- Mock SEMUA dependency (Prisma, JWT, Email, Logger)
- Test setiap method untuk happy path & error path
- Gunakan `jest.clearAllMocks()` di `beforeEach`
- Verify mock dipanggil dengan argument yang benar

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from 'src/email/email/email.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { HttpException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user and send OTP', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockResolvedValue([
        {},
        { email: 'test@example.com' },
      ]);

      const result = await service.register({ email: 'test@example.com' });

      expect(result).toEqual({ email: 'test@example.com' });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockEmailService.sendOTP).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
    });

    it('should throw 400 if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        password: 'hashed',
      });

      await expect(
        service.register({ email: 'test@example.com' }),
      ).rejects.toThrow(new HttpException('User already exists', 400));
    });
  });
});
```

### Controller Layer Unit Test

**File**: `*.controller.spec.ts`

**Prinsip**:

- Mock hanya AuthService (controller tidak punya logic, hanya orchestrate)
- Test response shape (status, statusCode, message, data)
- TIDAK perlu mock Prisma/JWT/Email di controller test

```typescript
describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('should return success response on register', async () => {
      mockAuthService.register.mockResolvedValue({ email: 'test@example.com' });

      const result = await controller.register({ email: 'test@example.com' });

      expect(result).toEqual({
        status: true,
        statusCode: 200,
        message: 'Registration successful, please verify your email',
        data: { email: 'test@example.com' },
      });
    });
  });
});
```

### Middleware Unit Test

**File**: `*.middleware.spec.ts`

```typescript
describe('LogMiddleware', () => {
  let middleware: LogMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogMiddleware,
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    middleware = module.get<LogMiddleware>(LogMiddleware);
    jest.clearAllMocks();
  });

  it('should log request and call next()', () => {
    const req = {
      method: 'POST',
      originalUrl: '/auth/login',
      ip: '127.0.0.1',
    } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(mockLogger.info).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
```

### Validation Pipe & Filter

**Pipe** (`ValidationPipe`): menggunakan Zod schema, throw `ZodError` jika invalid.

```typescript
import { z } from 'zod/v4';
import { ValidationPipe } from './validation.pipe';

describe('ValidationPipe', () => {
  const schema = z.object({ email: z.email() });
  const pipe = new ValidationPipe(schema);

  it('should pass valid data through', () => {
    const result = pipe.transform(
      { email: 'test@example.com' },
      { type: 'body' },
    );
    expect(result).toEqual({ email: 'test@example.com' });
  });

  it('should throw ZodError for invalid data', () => {
    expect(() => pipe.transform({ email: 'bad' }, { type: 'body' })).toThrow(
      z.ZodError,
    );
  });
});
```

**Filter** (`ValidationFilter`): catch `ZodError`, return 400 response.

```typescript
import { z } from 'zod/v4';
import { ValidationFilter } from './validation.filter';

describe('ValidationFilter', () => {
  const filter = new ValidationFilter();

  it('should return 400 with formatted errors', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockResponse = { status: mockStatus } as any;
    const mockHost = {
      switchToHttp: () => ({ getResponse: () => mockResponse }),
    } as any;

    // Create a real ZodError
    try {
      z.object({ email: z.email() }).parse({ email: 'bad' });
    } catch (error) {
      filter.catch(error as z.ZodError, mockHost);
    }

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: false,
        statusCode: 400,
        message: 'Validation failed',
      }),
    );
  });
});
```

### Zod Model Validation

**File**: `src/model/model.validation.spec.ts`

Test semua Zod schema secara langsung, tanpa NestJS context:

```typescript
import { registerRequestValidation } from './register.model';
import { loginRequestValidation } from './login.model';

describe('Zod Model Validations', () => {
  describe('registerRequestValidation', () => {
    it('should accept valid email', () => {
      const result = registerRequestValidation.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerRequestValidation.safeParse({ email: 'bad' });
      expect(result.success).toBe(false);
    });

    it('should reject empty object', () => {
      const result = registerRequestValidation.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
```

### Utility Functions

**File**: `src/utils/generate.utils.spec.ts`

Test fungsi murni tanpa NestJS context:

```typescript
import {
  generateOTP,
  generateTempToken,
  generateHashPassword,
} from './generate.utils';

describe('generateOTP', () => {
  it('should return a 6-digit string', () => {
    const otp = generateOTP();
    expect(otp).toMatch(/^\d{6}$/);
  });
});

describe('generateHashPassword', () => {
  it('should return a bcrypt hash', async () => {
    const hash = await generateHashPassword('password');
    expect(hash).toBeDefined();
    expect(hash).not.toBe('password');
    expect(hash.startsWith('$2')).toBe(true);
  });
});
```

---

## E2E Test Pattern

**File**: `test/app.e2e-spec.ts`

**Prinsip kunci**:

- **JANGAN** import `AppModule` — karena akan pull seluruh dependency tree (OAuth strategies, DB connection, env vars)
- Build **standalone module** dengan hanya controllers + mocked providers
- Gunakan `supertest` untuk HTTP requests
- Test validation (400), business logic errors (404, 409), dan happy path

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { AuthController } from './../src/auth/auth/auth.controller';
import { AuthService } from './../src/auth/auth/auth.service';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, AuthController],
      providers: [
        AppService,
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger },
        ValidationService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ValidationFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /test → 200', () => {
    return request(app.getHttpServer())
      .get('/test')
      .expect(200)
      .expect({ message: 'Hello World' });
  });

  it('POST /auth/register → 400 invalid email', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-email' })
      .expect(400);

    expect(res.body.status).toBe(false);
    expect(res.body.message).toBe('Validation failed');
  });
});
```

---

## GitLab CI & SonarQube

### `.gitlab-ci.yml` — Test Stage

```yaml
test:
  stage: test
  image: node:22-alpine
  script:
    - npm ci
    - npx prisma generate
    - npx jest --no-coverage --forceExit --detectOpenHandles
    - npx jest --config ./test/jest-e2e.json --no-coverage --forceExit --detectOpenHandles

test:coverage:
  stage: test
  image: node:22-alpine
  script:
    - npm ci
    - npx prisma generate
    - npx jest --coverage --coverageReporters=text --coverageReporters=lcov --coverageReporters=cobertura --forceExit
  artifacts:
    paths:
      - coverage/
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

### `sonar-project.properties`

```properties
sonar.projectKey=Aurify-Auth
sonar.projectName=Aurify-Auth
sonar.sources=src
sonar.tests=src,test
sonar.test.inclusions=**/*.spec.ts,**/*.e2e-spec.ts
sonar.exclusions=**/node_modules/**,**/dist/**,**/generated/**
sonar.typescript.lcov.reportPaths=coverage/lcov.info
sonar.coverage.exclusions=**/*.spec.ts,**/*.e2e-spec.ts,**/main.ts,**/*.module.ts
```

**CI Variables** (set di GitLab → Settings → CI/CD → Variables):

- `SONAR_HOST_URL` — URL SonarQube server
- `SONAR_TOKEN` — Token autentikasi SonarQube

---

## Checklist Reproduksi

Saat membuat test untuk service baru dengan tech stack yang sama:

### Setup Awal

- [ ] Install dev dependencies: `jest`, `ts-jest`, `@nestjs/testing`, `supertest`, `@types/jest`, `@types/supertest`
- [ ] Konfigurasi `jest` di `package.json` dengan `moduleNameMapper` untuk path alias
- [ ] Konfigurasi `test/jest-e2e.json` dengan `rootDir: ".."` dan `roots: ["<rootDir>/test"]`
- [ ] Tambahkan `.js` → strip mapper: `"^(\\.{1,2}/.*)\\.js$": "$1"` (untuk Prisma generated client)

### Per Service/Module

- [ ] Buat `*.service.spec.ts` — mock semua dependency
- [ ] Buat `*.controller.spec.ts` — mock hanya service
- [ ] Buat `*.middleware.spec.ts` jika ada middleware
- [ ] Buat `*.pipe.spec.ts` dan `*.filter.spec.ts` untuk validation
- [ ] Buat `model.validation.spec.ts` — test Zod schemas langsung
- [ ] Buat `*.utils.spec.ts` — test pure functions

### E2E

- [ ] Buat standalone testing module (JANGAN import AppModule)
- [ ] Register semua controllers + mocked providers
- [ ] Apply global filters/pipes di `beforeAll`
- [ ] Test validation errors (400), not found (404), success (200/201)

### CI/CD

- [ ] Tambahkan test stage di `.gitlab-ci.yml`
- [ ] Tambahkan coverage stage dengan artifacts
- [ ] Buat `sonar-project.properties` dengan projectName yang sesuai
- [ ] Set CI variables `SONAR_HOST_URL` dan `SONAR_TOKEN`

---

## Troubleshooting

### `@nestjs/platform-express is missing`

**Penyebab**: `rootDir` di jest-e2e.json menunjuk ke folder `test/` sehingga `node_modules` tidak ditemukan.
**Solusi**: Set `rootDir: ".."` dan `roots: ["<rootDir>/test"]`.

### `Cannot find module './internal/class.js'`

**Penyebab**: Prisma generated client menggunakan `.js` extension (ESM), tapi Jest resolve ke `.ts`.
**Solusi**: Tambahkan `"^(\\.{1,2}/.*)\\.js$": "$1"` di `moduleNameMapper`.
**JANGAN** gunakan `"^(.*)\\.js$"` karena akan match semua module termasuk `node_modules`.

### `PrismaClient is unable to run in this browser environment`

**Penyebab**: Trying to instantiate real PrismaClient in test.
**Solusi**: SELALU mock PrismaService, jangan pernah instantiate asli di test.

### `A worker process has failed to exit gracefully`

**Penyebab**: Open handles (biasanya dari timers, DB connections, atau HTTP server).
**Solusi**: Tambahkan `--forceExit --detectOpenHandles` flag. Pastikan `afterAll(() => app.close())` di e2e test.

### `Cannot spy on generateOTP / generateTempToken`

**Penyebab**: Import individual function bukan module namespace.
**Solusi**: Import sebagai `import * as generateUtils from 'src/utils/generate.utils'` lalu `jest.spyOn(generateUtils, 'generateOTP')`.

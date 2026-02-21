# trunks

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

English | [日本語](/README.ja.md)

A CLI wrapper for [@kintone/dts-gen](https://github.com/kintone/js-sdk/tree/main/packages/dts-gen) that generates TypeScript type definitions for multiple Kintone apps with a single configuration file.

## Features

- Generate type definitions for multiple apps in one command
- TypeScript configuration file with type safety (`trunks.config.ts`)
- Multiple authentication methods (Password, API Token, OAuth)
- Optional Prettier formatting for generated files
- Support for preview environments and guest spaces

## Quick Start

1. Create a configuration file `trunks.config.ts` in your project root:

```typescript
import { defineConfig } from '@goqoo/trunks';

export default defineConfig({
  host: 'your-subdomain.cybozu.com',
  apps: {
    customer: 123,
    order: 456,
    product: 789,
  },
  auth: { type: 'oauth' },
});
```

2. Run the command:

With global installation:

```bash
npm install -g @goqoo/trunks
trunks
```

Without global installation:

```bash
npx @goqoo/trunks
```

3. Type definition files will be generated in the `dts/` directory:
   - `dts/customer-fields.d.ts`
   - `dts/order-fields.d.ts`
   - `dts/product-fields.d.ts`

## Configuration

### Basic Configuration

```typescript
import { defineConfig } from '@goqoo/trunks';

export default defineConfig({
  // Required
  host: 'your-subdomain.cybozu.com',
  apps: {
    customer: 123,  // { appName: appId }
    order: 456,
  },
  auth: { type: 'oauth' },

  // Optional
  outDir: 'dts',           // Output directory (default: "dts")
  preview: false,          // Use preview environment (default: false)
  guestSpaceId: 5,         // Guest space ID (if applicable)
  namespace: 'kintone.types', // TypeScript namespace (default: "kintone.types")
  format: true,            // Format with Prettier (default: false)
});
```

### Authentication Methods

Environment variables can be set in a `.env` file in your project root:

```bash
# .env
KINTONE_USERNAME=your-username
KINTONE_PASSWORD=your-password
KINTONE_API_TOKEN=your-api-token
```

> **Warning**: If you write credentials directly in the config file, make sure to add the config file to `.gitignore` to avoid committing sensitive information to version control. Using environment variables (`.env` file) or stdin prompts is recommended.

#### Password

Credentials are read from the config file, environment variables `KINTONE_USERNAME` and `KINTONE_PASSWORD`, or prompted via stdin (in that order of priority).

```typescript
auth: { type: 'password' },
// Or with direct credentials (not recommended)
auth: { type: 'password', username: 'user', password: 'pass' },
```

#### API Token

Token is read from the config file, environment variable `KINTONE_API_TOKEN`, or prompted via stdin (in that order of priority).

```typescript
auth: { type: 'api-token' },
// Or with direct token (not recommended)
auth: { type: 'api-token', token: 'your-token' },
```

For multiple apps, use comma-separated tokens in `.env`:

```bash
KINTONE_API_TOKEN=token1,token2,token3
```

#### OAuth

Uses [Gyuma](https://github.com/nicecai/gyuma) for OAuth authentication. A browser window will open for authentication.

```typescript
auth: {
  type: 'oauth',
  scope: 'k:app_settings:read',  // Optional: custom scope
},
```

### Additional Options

#### Basic Authentication

For environments that require basic authentication:

```typescript
basicAuth: {
  username: 'basic-user',
  password: 'basic-password',
},
```

#### Proxy

```typescript
proxy: {
  host: 'proxy.example.com',
  port: 8080,
},
```

#### Client Certificate (for OAuth)

```typescript
pfx: {
  filepath: '/path/to/cert.pfx',
  password: 'certificate-password',
},
```

## CLI Options

```bash
trunks [options]

Options:
  -c, --config <path>  Path to config file (default: auto-detect)
  -h, --help           Display help
  -V, --version        Display version
```

## Generated Output

For an app named `customer` (ID: 123), the following file is generated:

```typescript
// dts/customer-fields.d.ts
declare namespace kintone.types {
  interface CustomerFields {
    companyName: kintone.fieldTypes.SingleLineText;
    email: kintone.fieldTypes.Link;
    // ...
  }
  interface SavedCustomerFields extends CustomerFields {
    $id: kintone.fieldTypes.Id;
    $revision: kintone.fieldTypes.Revision;
    // ...
  }
}
```

## Development

```bash
# Build
yarn build

# Test
yarn test

# Watch mode
yarn dev
```

## Related Projects

- [@kintone/dts-gen](https://github.com/kintone/js-sdk/tree/main/packages/dts-gen) - The underlying type definition generator
- [Gyuma](https://github.com/nicecai/gyuma) - OAuth authentication for Kintone
- [gotenks](https://github.com/goqoo-on-kintone/gotenks) - Convert kintone TypeScript types to Go types

## License

MIT License - see [LICENSE](LICENSE) for details.

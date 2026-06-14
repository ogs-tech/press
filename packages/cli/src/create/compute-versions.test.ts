import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  computeVersions,
  renderVersionsModule,
  type EngineManifests,
} from './compute-versions';
import { VERSIONS } from './versions.generated';

const fixture: EngineManifests = {
  cli: { version: '0.1.0' },
  web: { version: '0.3.1', devDependencies: { react: '^18.3.1' } },
  cms: { version: '0.3.2', devDependencies: { '@strapi/strapi': '5.48.0' } },
};

describe('computeVersions', () => {
  it('pins @press/* to EXACT versions (no caret on 0.x)', () => {
    const v = computeVersions(fixture);
    expect(v.pressCli).toBe('0.1.0');
    expect(v.pressWeb).toBe('0.3.1');
    expect(v.pressCms).toBe('0.3.2');
  });

  it('derives react and strapi from the engine devDependencies', () => {
    const v = computeVersions(fixture);
    expect(v.react).toBe('^18.3.1');
    expect(v.strapi).toBe('5.48.0');
  });

  it('throws loudly when a framework pin has no canonical source', () => {
    expect(() =>
      computeVersions({ ...fixture, web: { version: '0.3.1', devDependencies: {} } }),
    ).toThrow(/cannot derive "react"/);
  });
});

describe('versions.generated.ts drift guard', () => {
  // Reads the real sibling manifests so a `@press/*` bump that forgets to run
  // `gen:versions` fails CI here — the same check as `gen:versions --check`.
  const packagesDir = path.resolve(__dirname, '..', '..', '..'); // packages/
  const real = (pkg: string) =>
    JSON.parse(readFileSync(path.join(packagesDir, pkg, 'package.json'), 'utf8'));

  it('matches what computeVersions derives from the live manifests', () => {
    const derived = computeVersions({ cli: real('cli'), web: real('web'), cms: real('cms') });
    expect(VERSIONS).toEqual(derived);
  });

  it('the committed file is byte-identical to a fresh render', () => {
    const derived = computeVersions({ cli: real('cli'), web: real('web'), cms: real('cms') });
    const committed = readFileSync(path.join(__dirname, 'versions.generated.ts'), 'utf8');
    expect(committed).toBe(renderVersionsModule(derived));
  });
});

import fs from 'fs';
import path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import jsf from 'json-schema-faker';

jsf.option({ alwaysFakeOptionals: true });

const OUT_DIR = './tests';

async function generate() {
  const swagger = await SwaggerParser.dereference('./swagger.json');

  // resolve base URL
  const baseUrl =
    swagger.servers?.[0]?.url ||
    (swagger.host ? `http://${swagger.host}${swagger.basePath || ''}` : 'http://localhost:5000');

  // cleanup old tests
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR);

  for (const pathKey in swagger.paths) {
    const methods = swagger.paths[pathKey];

    // folder name without slashes (e.g. /api/users → api_users)
    const folderName = pathKey.replace(/\//g, '_').replace(/^_/, '');
    const folderPath = path.join(OUT_DIR, folderName);
    fs.mkdirSync(folderPath);

    for (const method in methods) {
      const operation = methods[method];
      let body = null;

      if (operation.requestBody?.content?.['application/json']) {
        const schema = operation.requestBody.content['application/json'].schema;
        try {
          body = jsf.generate(schema);
        } catch (e) {
          console.warn(`⚠️ Could not generate body for ${method.toUpperCase()} ${pathKey}`);
        }
      }

      // build K6 script for this method
      const testScript = buildK6Script({
        baseUrl,
        path: pathKey,
        method: method.toUpperCase(),
        body,
      });

      const filePath = path.join(folderPath, `${method.toUpperCase()}.js`);
      fs.writeFileSync(filePath, testScript);
    }
  }

  // also create master runner
  fs.writeFileSync('master-test.js', buildMasterRunner());
  console.log('✅ Tests generated in ./tests and master-test.js created');
}

function buildK6Script({ baseUrl, path, method, body }) {
  const payloadVar = body ? `const payload = ${JSON.stringify(body, null, 2)};` : '';
  const bodyArg = body ? 'payload' : 'null';

  return `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const businessLatency = new Trend('business_latency');
const businessErrors  = new Rate('business_errors');

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
    business_errors: ['rate<0.01'],
  }
};

export default function () {
  const url = \`${baseUrl}${path}\`;
  const params = { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } };
  ${payloadVar}
  const start = Date.now();
  const res = http.${method.toLowerCase()}(url, ${bodyArg}, params);
  const elapsed = Date.now() - start;
  businessLatency.add(elapsed);
  const ok = check(res, { 'status 200': r => r.status === 200 });
  if (!ok) businessErrors.add(1);
  sleep(1);
}
`;
}

function buildMasterRunner() {
  return `
import exec from 'k6/execution';
import { sleep } from 'k6';

// Dynamic import all test files
const tests = [
${fs
  .readdirSync(OUT_DIR)
  .map(folder =>
    fs
      .readdirSync(path.join(OUT_DIR, folder))
      .map(file => `  require('./${OUT_DIR}/${folder}/${file}').default`)
      .join(',\n')
  )
  .join(',\n')}
];

export const options = {
  scenarios: {
    all_tests: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: tests.length,
    }
  }
};

export default function () {
  const i = exec.scenario.iterationInTest;
  tests[i]();
  sleep(1);
}
`;
}

generate().catch(err => console.error(err));

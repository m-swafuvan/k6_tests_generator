## Overview

This project generates **K6 performance test scripts** automatically from a **Swagger/OpenAPI specification**.
It helps us benchmark every backend endpoint without manually writing tests.

## Features

* Reads `swagger.json` (OpenAPI spec)
* Generates `generated-test.js` (K6 test file)
* Auto-creates dummy request bodies using **json-schema-faker**
* Custom metrics (`business_latency`, `business_errors`) for Grafana dashboards

---

## Prerequisites

* [Node.js](https://nodejs.org) (v16+)
* [K6](https://k6.io/docs/getting-started/installation)
* Swagger spec file (`swagger.json`) from the API

---

## Setup & Usage

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Download Swagger spec**

   ```bash
   curl -o swagger.json https://your-api/swagger/v1/swagger.json
   ```

3. **Generate the K6 test script**

   ```bash
   node generate-k6.js
   ```

   This creates:

   ```
   generated-test.js
   ```

4. **Run the performance test**

   ```bash
   k6 run generated-test.js
   ```

5. **Send results to InfluxDB (for Grafana)**

   ```bash
   k6 run --out influxdb=http://localhost:8086/k6 generated-test.js
   ```

---

## Project Structure

```
.
├── generate-k6.js       # Generator script
├── swagger.json         # API spec (ignored in git)
├── generated-test.js    # Auto-generated K6 test
├── package.json
└── .gitignore
```

---



# Mojaloop Reporting Service

The Reporting Service allows to create HTTP API endpoints using SQL queries and EJS templates and output the result in different formats.

- Create API endpoint description file in `templates/ENDPOINT_NAME.yaml`
- Create render template in `templates/ENDPOINT_NAME.ejs`
- See examples in `templates` directory
- See architecture diagram in docs [here](docs/Mojaloop%20Reporting%20Service%20Architecture.png) .
- Make requests as follows:
    ```
    curl localhost:3000/ENDPOINT_NAME.FORMAT?PARAM_NAME=VALUE
    ```
  `FORMAT` can be `xlsx`, `html` or `csv`
  Example:
    ```
    curl localhost:3000/participants.html?currency=USD
    ```

#### Build
From the repo root:
```sh
docker build -t reporting .
```

#### Deploy

##### Configure reporting templates
An example showing usage of a report template from Github, and a local report template. Run this
command from the repository root:
```sh
helm template helm/reporting-service \
  --set-file=templates."dfspSettlement\.ejs"=https://raw.githubusercontent.com/mojaloop/reporting/59dd08c67a2dca5b78376795f1580103cd5eea8a/templates/dfspSettlement.ejs \
  --set-file=templates."dfspSettlement\.yaml"=https://raw.githubusercontent.com/mojaloop/reporting/59dd08c67a2dca5b78376795f1580103cd5eea8a/templates/dfspSettlement.yaml \
  --set-file=templates."participants\.ejs"=templates/participants.ejs \
  --set-file=templates."participants\.yaml"=templates/participants.yaml
```

#### Audit Issues
 This repository uses [npm-audit-resolver](https://github.com/naugtur/npm-audit-resolver#readme) to check for security vulnerabilities. Basic troubleshooting of a failed security check is as follows:
 1. Run `npm audit` to show the current issues.
 2. Run `npm audit fix` to attempt to automatically fix the current issues.
 3. If there are still some packages with vulnerabilities, add the fixed (up-to-date) versions of those packages to `resolutions` in `package.json`.

#### TODO
- OpenAPI validation on requests and responses (optionally for reports)
- Streaming. The DB lib supports streaming, so does koa. This will be especially important for
    large reports.
- Streams in the logger.
- Measure test coverage
- Logger: enable printing of requests as cURL- perhaps by providing a custom handler thingie
- Eslint. Side-note: make sure 'no-floating-promises' is enabled.

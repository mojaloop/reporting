# Mojaloop Reporting Service

The Reporting Service allows to create HTTP API endpoints using SQL queries and EJS templates and output the result in different formats.

- Create Custom Resource for the report.
  
  The schema can be found in `helm/reporting-service/crds/mojaloopreport-crd.yaml`

  Examples in `resources/examples` directory
- See architecture diagram in docs [here](docs/Mojaloop%20Reporting%20Service%20Architecture.png) .
- Make requests as follows:
    ```
    curl localhost:3000/ENDPOINT_NAME?PARAM_NAME=VALUE&format=FORMAT
    ```
  `FORMAT` can be `xlsx`, `html`, `json` or `csv`
  Example:
    ```
    curl localhost:3000/participants?currency=USD&format=html
    ```

#### Build
From the repo root:
```sh
docker build -t reporting .
```

#### Run
Populate an environment file with the credentials of your Mojaloop instance:
```sh
cat <<EOF >./.my.env
DB_HOST="localhost"
DB_USER="central_ledger"
DB_PASSWORD="password"
DB_DATABASE="central_ledger"
KETO_READ_URL=http://keto/
EOF
```
Where `reporting` is the image name from the build stage:
```sh
docker run -v $PWD/config:/opt/reporting/config -p 3000:3000 --env-file=./.my.env reporting
```

#### Audit Issues
 This repository uses [npm-audit-resolver](https://github.com/naugtur/npm-audit-resolver#readme) to check for security vulnerabilities. Basic troubleshooting of a failed security check is as follows:
 1. Run `npm run audit:check` to show the current issues.
 2. Run `npm run audit:resolve` to attempt to automatically fix the current issues.


#### Running Integration test locally
- Start minikube K8S cluster with the following command
  ```
  minikube start --driver=docker --kubernetes-version=v1.21.5
  ```
- Build local docker image which can be accessed from minikube cluster
  ```
  sh script-minikube-docker-build.sh
  ```
- Install helm chart for dependencies
  ```
  helm dep up ./resources/test-integration/
  helm install test1 ./resources/test-integration/
  ```
- Wait for all the services to be up
- Port forward the mysql service
  ```
  kubectl port-forward -n default service/mysql 3306:3306
  ```
- Run the integration tests
  ```
  npm install
  npm run test:integration
  ```
- Adding the custom resource for manual testing
  ```
  kubectl apply -f resources/examples/participants.yaml
  ```
- Cleanup
  ```
  kubectl delete -f resources/examples/participants.yaml
  helm uninstall test1
  minikube stop
  ```

#### TODO
- OpenAPI validation on requests and responses (optionally for reports)
- Streaming. The DB lib supports streaming, so does koa. This will be especially important for
    large reports.
- Streams in the logger.
- Measure test coverage
- Logger: enable printing of requests as cURL- perhaps by providing a custom handler thingie
- Eslint. Side-note: make sure 'no-floating-promises' is enabled.


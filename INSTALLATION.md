# Installation

This document provides instructions for deploying this service locally.
Since the reporting service follows K8S operator pattern, we need to deploy a mini Kubernetes cluster on our machine and deploy the reporting service along with some dependent services.

## Pre-requisites
- Please make sure that you have the following softwares installed
  - git
  - docker
  - minikube
  - kubectl
  - helm
  - mysql-client

## Install K8S
- Start minikube K8S cluster with the following command
  ```
  minikube start --driver=docker --kubernetes-version=v1.21.5
  ```

## Clone the repository
- Download the repository
  ```
  git clone https://github.com/mojaloop/reporting.git
  cd reporting
  ```

## Deploy helm chart
- Install helm chart using the following commands
  ```
  helm dep up ./resources/test-integration/
  helm install test1 ./resources/test-integration/ --set reporting-legacy-api.image.tag=v11.0.0
  ```
- Wait for all the services to be up
  You can monitor the pods health or use the following commands to wait for the services
  ```
  kubectl -n default rollout status deployment test1-reporting-legacy-api
  kubectl -n default rollout status statefulset mysql
  ```

## Restore mysql database backup
- Port forward the mysql service
  ```
  kubectl port-forward -n default service/mysql 3306:3306
  ```
- Insert sample data into database. You can change the database name and filename in the following command as per your need.
  ```
  mysql -h127.0.0.1 -P3306 -uuser -ppassword default < ./resources/examples/participants_db_dump.sql
  ```

## Load reporting template
- Adding the custom resource using the following command
  ```
  kubectl apply -f resources/examples/participant_list.yaml
  ```

## Get the report
- Port forward the reporting service
  ```
  kubectl port-forward -n default service/test1-reporting-legacy-api 8080:80
  ```
- Get the report by opening the following URL in browser
  ```
  http://localhost/participant-list
  ```

## Cleanup
- Cleanup
  ```
  kubectl delete -f resources/examples/participant_list.yaml
  helm uninstall test1
  minikube stop
  ```

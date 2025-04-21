#!/bin/bash

echo "--=== Running Integration Test Runner ===--"
echo

K8S_VERSION=v1.21.5
MINIKUBE_VERSION=v1.21.0

## Install dependencies
sudo apt install mysql-client-core-8.0
# sudo apt-get install -y conntrack

## Setup kubectl
curl -Lo kubectl https://storage.googleapis.com/kubernetes-release/release/${K8S_VERSION}/bin/linux/amd64/kubectl && chmod +x kubectl && sudo mv kubectl /usr/local/bin/
mkdir -p ${HOME}/.kube
touch ${HOME}/.kube/config

## Install minikube
curl -Lo minikube https://github.com/kubernetes/minikube/releases/download/${MINIKUBE_VERSION}/minikube-linux-amd64 && chmod +x minikube && sudo mv minikube /usr/local/bin/

## Install Helm
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod +x get_helm.sh
./get_helm.sh

## Start minikube
minikube start --driver=docker --kubernetes-version=${K8S_VERSION}

## Load the pre-built docker image from workspace
eval $(minikube -p minikube docker-env)
docker load -i /tmp/docker-image.tar

## Install helm chart for dependencies
helm dep up ./resources/test-integration/
helm install test1 ./resources/test-integration/

## Wait for some time
sleep 30

## Populate the database
nohup kubectl port-forward -n default service/mysql 3306:3306 > portforward.log 2>&1 &
mysql -h127.0.0.1 -P3306 -uuser -ppassword default < ./resources/examples/participants_db_dump.sql

## Run integration tests
npx jest --testMatch '**/test/integration/**/*.(test|spec).js' --runInBand

## Cleanup
echo "Cleaning up..."
helm uninstall test1
minikube stop
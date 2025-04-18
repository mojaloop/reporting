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

## Start minikube
minikube start --driver=docker --kubernetes-version=${K8S_VERSION}

## Load the pre-built docker image from workspace
eval $(minikube -p minikube docker-env)
docker load -i /tmp/docker-image.tar

## Install helm chart for dependencies
helm dep up ./resources/test-integration/
helm install test1 ./resources/test-integration/

helm uninstall test1
minikube stop
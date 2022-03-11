eval $(minikube -p minikube docker-env)
docker build -t mojaloop/reporting:local .
eval $(minikube -p minikube docker-env)
export NODE_VERSION="$(cat .nvmrc)-alpine"
docker build -t mojaloop/reporting:local .
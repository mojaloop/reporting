{ nixpkgs ? import (fetchTarball https://github.com/NixOS/nixpkgs/archive/8e4fe32876ca15e3d5eb3ecd3ca0b224417f5f17.tar.gz) { } }:

let
  k3d = nixpkgs.stdenv.mkDerivation rec {
    version = "4.4.1";
    pname = "k3d";

    src = builtins.fetchurl {
      url = "https://github.com/rancher/k3d/releases/download/v4.4.1/k3d-linux-amd64";
      sha256 = "1bjmyhf0zbi6lfq71h6vazmlkxg0b46wky5vqv1dqbkr2bdr2s24";
    };

    dontUnpack = true;

    installPhase = ''
      mkdir -p $out/bin
      cp $src $out/bin/k3d
      chmod +x $out/bin/k3d
    '';

    dontFixup = true;
  };

in


[
  nixpkgs.kubeconform
  nixpkgs.kubernetes-helm
  k3d
]

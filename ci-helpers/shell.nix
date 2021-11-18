{ nixpkgs ? import (fetchTarball https://github.com/NixOS/nixpkgs/archive/8e4fe32876ca15e3d5eb3ecd3ca0b224417f5f17.tar.gz) { } }:
nixpkgs.mkShell {
  nativeBuildInputs = import ./default.nix { inherit nixpkgs; };
}

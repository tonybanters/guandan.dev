{
  description = "guandanbtw - Online Guan Dan card game";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };
  outputs = {
    self,
    nixpkgs,
  }: let
    systems = ["x86_64-linux" "aarch64-linux" "aarch64-darwin"];

    forAllSystems = fn: nixpkgs.lib.genAttrs systems (system: fn nixpkgs.legacyPackages.${system});
  in {
    devShells = forAllSystems (pkgs: {
      default = pkgs.mkShell {
        packages = [
          pkgs.go
          pkgs.gopls
          pkgs.gotools
          pkgs.air
          pkgs.nodejs
          pkgs.nodePackages.typescript
          pkgs.nodePackages.typescript-language-server
          pkgs.just
          pkgs.mprocs
        ];
        shellHook = ''
          export PS1="(guandan-dev) $PS1"
          echo ""
          echo "  guandan-dev"
          echo "  -----------"
          echo "  just dev      - run server + client"
          echo "  just server   - run go server only"
          echo "  just client   - run react client only"
          echo "  just build    - build for production"
          echo "  mprocs        - run with TUI"
          echo ""
        '';
      };
    });

    formatter = forAllSystems (pkgs: pkgs.alejandra);
  };
}

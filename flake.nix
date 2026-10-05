{
  description = "Nix development shell for the discord Cloudflare Worker";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};

      nodejs =
        pkgs.nodejs_26 or (throw "discord-worker requires Node.js 26 from nixpkgs");
    in
    {
      formatter.${system} = pkgs.nixfmt;

      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs
          git
          jq
          nil
          typescript
          typescript-language-server
          vscode-langservers-extracted
          yaml-language-server
        ];

        shellHook = ''
          export PATH="$PWD/node_modules/.bin:$PATH"
          export npm_config_cache="$PWD/.npm"

          echo "discord-worker dev shell"
          echo "- node: $(node --version)"
          echo "- npm:  $(npm --version)"
          echo "- local bins enabled from ./node_modules/.bin"
          echo "- run 'npm install' if dependencies are not installed yet"
        '';
      };
    };
}

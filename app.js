// Arquivo de entrada para o Node.js no Plesk / CPanel
// O motor (como o Phusion Passenger ou IISNode) vai buscar este arquivo para iniciar a aplicação.
// O TanStack Start / Nitro (framework base) vai renderizar a aplicação via ESM na pasta .output
// após o comando `npm run build` ter sido executado.

import('./.output/server/index.mjs').catch(err => {
  console.error('Erro ao iniciar a aplicação no Plesk. Verifique se o comando de build foi executado e se a pasta .output existe.', err);
});

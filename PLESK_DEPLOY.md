# Guia de Deploy no Plesk

Este projeto utiliza a nova geração do **TanStack Start**, que exige que a infraestrutura rode em **Node.js** com a funcionalidade de Server-Side Rendering (SSR). Isso significa que você hospedará um servidor que renderiza parte do projeto, e não apenas o front-end estático em HTML.

Para hospedar no **Plesk**, o painel/domínio precisará da extensão **Node.js** habitada.

## 1. Produzindo a versão otimizada (Build)
Antes de enviar os arquivos para o servidor, você precisa compilar o seu código-fonte gerando os servíveis de produção. O TanStack utiliza sob o capô a ferramenta de build **Nitro**, feita para rodar em diversos provedores.

Na raiz do seu projeto localmente, execute o seguinte comando no terminal:
```bash
NITRO_PRESET=node-server npm run build
```
*(Isso forçará a engine a exportar a aplicação num formato padronizado e limpo de Node.js caso as configs tentem forçá-la ao formato de funções Cloudflare)*

Dessa operação nascerá uma pasta geralmente oculta chamada `.output` no diretório raiz do projeto.

## 2. Enviando os arquivos
No **Gerenciador de Arquivos** do seu Plesk, acesse a pasta raiz onde ficará seu projeto (para o domínio principal, normalmente é `httpdocs`). 
Faça upload APENAS dos seguintes itens:

1. O conteúdo total da pasta **`.output/`** recém compiliada.
2. O script **`app.js`** que acabou de ser criado na raiz.
3. O arquivo de roteamento de servidor adequado para a sua máquina (se o Plesk para Linux, o **`.htaccess`**, se Windows, o **`web.config`**).
4. O arquivo **`.env`** (com suas keys ocultas do banco e Supabase. Nunca suba como `.env.example`).

**O que NÃO subir:** Não suba a sua pasta `src`, `node_modules` nem arquivos de dependência — o build feito para a pasta output já carrega toda a biblioteca pré-carregada.

## 3. Configurando a aplicação pelo Painel Plesk
1. Com os arquivos no seu servidor, busque pelo ícone **Configurações do Node.js** (ou Node.js App) acessível diretamente dentro da página de controle do domínio.
2. Ajuste as opções que aparecerem na tela com as definições a seguir:
   - **Document Root**: Mantenha apontando para `httpdocs`
   - **Application Root**: Mantenha apontando para `httpdocs`
   - **Application Startup File** (Arquivo de Inicialização): Digite exatemente `app.js`
   - **Variáveis de Ambiente**: Se preferir, invés do arquivo `.env` você pode cadastrar as chaves do Supabase clicando no botão para adicionar custom Variables.
3. Garanta que uma versão recomendada e LTS recente do Node.js (ex. Node 20.x ou superior) está marcada.
4. Clique no botão de **Enable Node.js** (Ativar Node.js) no topo da barra ferramentas e depois e **Restart App**.

Acesse o domínio. Se houver falha de "erro 503 HTTP", confira se a pasta `.output` subiu exatamente com tal nome e se dentro dela consta uma sub-pasta `server/index.mjs`.
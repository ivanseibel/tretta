# T007 — Validação da preparação gratuita

Data: 16 de outubro de 2026. Papel: orquestrador.

Preparação aceita. O report do executor está em [T007-release-preparation.md](T007-release-preparation.md). Os manifestos definem Render Free, Node 22, pnpm fixado, hooks desativados e build do monorepo; as URLs reais permanecem dependentes dos provedores.

Verificação independente: parse JSON e compatibilidade dos intervalos Node; seis casos do guard de URL Vercel (ausente, HTTP, localhost, IPv4 e IPv6 loopback recusados; origem HTTPS Render aceita). Conferido o isolamento de arquivos gerados, `.vercel` e ZIP bruto de navegador pelo `.gitignore`. A auditoria dos 332 arquivos inicialmente preparados, incluindo 243 arquivos de texto, não encontrou os padrões de credenciais examinados nem arquivos temporários indevidos. É uma verificação por padrões, não garantia sobre qualquer segredo possível.

`git diff --check` da árvore rastreada passou. Após preparar também os arquivos novos, `git diff --cached --check` apontou linhas vazias finais em três fontes de testes e oito evidências textuais, além de espaços finais em duas linhas de uma captura textual de erro. São avisos de formatação preexistentes; fontes e evidências foram preservadas. Não há alteração de comportamento associada a esses avisos.

Nenhum build ou E2E foi repetido sobre o `.next` usado pelo teste local ativo. As suítes da versão funcional já foram aceitas em T007; os novos manifestos ainda exigem comprovação de build nos provedores.

Commit e push estão autorizados pelo usuário nesta data. Publicação pública segue pendente de seleção do workspace Hobby Vercel, acesso à nova conta Render, configuração das origens reais e smoke HTTPS/WSS. Nenhum plano ou faturamento pode ser alterado para concluir esta etapa gratuita.

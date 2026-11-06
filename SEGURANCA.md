# Validação da Alva 1.4

Validação realizada em 05/11/2026 no Supabase real da Alva, sem upgrade de plano.

- 29 testes locais de finanças, negócio, API e interface de autenticação passaram.
- Cadastro com senha retornou sessão imediatamente, sem confirmação por e-mail.
- Login com senha correta passou; senha errada foi recusada.
- O servidor recusou senha fraca, independentemente do formulário.
- Cada uma das duas contas sintéticas enxergou apenas seu perfil e seus registros.
- Leitura direcionada ao UUID da outra conta retornou vazio. PATCH, DELETE direto e acesso anônimo foram recusados.
- A gravação por RPC alterou apenas a própria conta; conflito de revisão foi recusado e o provisionamento repetido preservou os dados.
- UUID malformado e valor com fração de centavo foram recusados.
- Após logout no servidor, o JWT anterior não conseguiu ler, provisionar ou escrever. O refresh token também foi recusado.
- As duas contas e seus registros temporários foram removidos ao final.
- Advisors de segurança e desempenho do Supabase retornaram zero avisos após a migração.

Revisão visual: login/cadastro, navegação pessoal e Meu negócio em tamanhos mobile e desktop. Respeito à preferência de movimento reduzido observado; aparelhos físicos não foram testados.

Limites: o e-mail não tem propriedade verificada por escolha do proprietário; recuperação automática ainda depende de SMTP e implementação da rota. CAPTCHA e verificação de senhas vazadas não estão configurados. Tokens ficam acessíveis ao JavaScript em sessionStorage; as proteções de XSS/CSP reduzem risco e não o eliminam. Não houve auditoria independente, pentest ou teste de carga. A IA externa não está ativada.

O relatório descreve os testes executados, não uma garantia de segurança absoluta.

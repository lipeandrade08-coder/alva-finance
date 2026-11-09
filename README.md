# Alva · Seu dinheiro, com clareza

Versão 1.4. Controle financeiro pessoal e de microempresas, com interface glass, mobile e autenticação por e-mail e senha. Projeto Supabase gratuito: `hulthncrbuyqedvdkynv`, organização pessoal, região São Paulo.

## Acesso

O cadastro pede nome, e-mail e senha e abre uma conta vazia imediatamente. A confirmação por e-mail está desativada por escolha do proprietário. Não há cobrança ou upgrade nesta configuração. O endereço informado **não tem propriedade verificada**: o identificador dos dados é o UUID autenticado, nunca o texto do e-mail.

O Supabase exige ao menos 10 caracteres, maiúscula, minúscula e número. O cliente também valida o limite de 72 bytes do bcrypt. Senhas são transmitidas via HTTPS ao Supabase Auth; o aplicativo não as armazena em logs, HTML ou armazenamento do navegador. Os hashes são gerenciados pelo Supabase.

A recuperação de senha por e-mail ainda depende de um serviço SMTP. Não há botão que simule envio ou prometa uma recuperação indisponível. Antes de oferecer o serviço a um público amplo, configure esse recurso; instruções em `ATIVAR-EMAIL.md`.

## Executar e testar

Requisitos: Node.js 20+ e Python 3; não há build ou dependências npm.

```sh
npm test
npm run dev
```

Abra http://127.0.0.1:4173. `dist/` contém os arquivos publicados. A URL e chave pública ficam em `dist/config.js`; não coloque service_role, chaves secretas, senha do banco ou SMTP no front-end.

`tests/verify_remote_auth.py` realiza a validação no projeto real pela CLI autenticada. Cria duas identidades sintéticas, cadastra com senha sem enviar e-mail, testa leitura/escrita, revisão, sessão revogada e remove somente suas contas temporárias em `finally`. Chaves administrativas e senhas existem apenas na memória do processo. Execute apenas no projeto autorizado.

## Proteções implementadas

- RLS em `profiles`, `finance_data` e `agent_usage`; nenhum acesso anônimo às tabelas.
- Leitura apenas do próprio UUID. Escritas diretas de clientes são recusadas, inclusive DELETE.
- Operações privilegiadas em `private`, fora dos esquemas expostos pela API. Wrappers públicos usam `SECURITY INVOKER`; funções internas usam search_path fixo e permissões mínimas.
- Leitura e gravação verificam a sessão em `auth.sessions`, além do JWT. Após logout bem-sucedido no servidor, o token antigo perde acesso ao banco imediatamente.
- JWT de 15 minutos com rotação de refresh token. Tokens da aplicação ficam em sessionStorage por aba; não em localStorage. Isso não equivale a cookies HttpOnly, e prevenir XSS continua essencial.
- Tokens em fragmentos de URL não são aceitos como login. Senhas não voltam ao HTML após uma tentativa.
- Ao sair ou receber sessão inválida, a interface limpa os dados da conta em memória.
- Validação de estrutura, tamanho (2 MB), limite de itens (5.000 por coleção), UUIDs, centavos inteiros e limites numéricos no banco. `save_finances` escreve o perfil e os registros na mesma transação, com controle de revisão contra sobrescrita concorrente.
- Conteúdo textual e identificadores são escapados ao renderizar; exportações CSV escapam fórmulas.
- CSP no HTML restringe scripts à própria origem e conexões ao Supabase da Alva. Não há scripts de terceiros. Fontes são carregadas do Google Fonts; Referrer-Policy é no-referrer.
- Limites nativos de autenticação do Supabase continuam ativos. Não foi habilitado recurso pago. Proteção de senhas vazadas requer plano compatível e não está ativa; CAPTCHA também não foi configurado.

Esses controles foram testados, mas não constituem garantia de segurança absoluta nem uma auditoria independente. São necessários manutenção, revisão periódica de acessos, recuperação de contas, backups e monitoramento para operação contínua. Um serviço estático com tokens acessíveis ao JavaScript conserva os riscos dessa arquitetura. As políticas não protegem contra administradores autorizados do projeto ou comprometimento dos dispositivos dos usuários.

## Banco

`supabase/schema.sql` instala o esquema completo em um projeto novo, uma vez. As migrações em `supabase/migrations/` preservam dados e atualizam instalações anteriores. Não execute o schema completo para atualizar um banco existente. O esquema usa sessões ativas para isolar os dados por usuário.

| Estrutura | Conteúdo |
| --- | --- |
| `auth.users` / `auth.sessions` | Identidades e sessões gerenciadas pelo Supabase |
| `public.profiles` | Nome do próprio usuário |
| `public.finance_data` | Estado financeiro pessoal e empresarial, revisão e atualização |
| `public.alva_notices` | Histórico de avisos privado por conta |
| `public.agent_usage` | Controle interno de uso, sem acesso direto do cliente |
| `private.*` | Validação de sessão, validação de documentos e operações atômicas |

O negócio é separado do pessoal dentro do estado financeiro do mesmo usuário. Nomes em metadados são apenas dados de apresentação; não concedem permissões.

## Interface e funcionalidades

Login e cadastro têm vidro translúcido, luz ambiente, fundo em grade, cartão ilustrativo flutuante, transições e feedback de senha. A visão geral mantém cards, gráficos, lançamentos, objetivos, dívidas, investimentos e o espaço Meu negócio. A gaveta e a navegação inferior atendem telas pequenas, com campos de 16 px e áreas de toque adequadas. Animações respeitam `prefers-reduced-motion` e podem ser desativadas nas configurações; há fallback de transparência.

Meu negócio atende MEIs, microempresas e autônomos: perfil, caixa, vendas, clientes/fornecedores, contas a receber/pagar, tributos informados e retirada vinculada ao pessoal. Vendas contam na data do registro; caixa muda na baixa. Não há pagamento bancário, emissão fiscal ou apuração de tributos.

A Alva usa os dados da conta e o período selecionado para responder. O modo em nuvem requer `OPENAI_API_KEY` em **Supabase → Edge Functions → Secrets** e a versão atual da função `financial-agent`. A função verifica a sessão e a cota antes de encaminhar o áudio. Na conversa, envia ao provedor totais e um recorte dos registros, sem enviar os campos de contato do perfil nem o CNPJ. Mantenha a chave fora do código e do navegador.

O assistente pode gravar até 60 segundos ou receber um arquivo de áudio de até 2 MB. Quando a gravação em nuvem está disponível, a Alva usa o formato suportado pelo aparelho. O ditado do navegador depende das permissões e do suporte local. A transcrição abre para edição e a conta só é atualizada após confirmar a prévia.

O simulador de investimentos usa uma taxa hipotética, sem garantia de retorno, impostos, taxas ou inflação. Nenhuma ação financeira é executada pela conversa.

## Importação e alertas

A importação abre uma prévia para confirmar o destino, a origem e os registros selecionados. O mesmo arquivo e os identificadores bancários OFX já registrados no destino são descartados. Correspondências incertas ficam desmarcadas até a revisão. Em Negócio, as entradas importadas atualizam o caixa e podem ser classificadas como venda para compor o faturamento.

Abra **Importações** em Lançamentos ou Meu negócio para consultar os últimos 30 lotes e desfazer um lote intacto. Se houve edição, exclusão ou vínculo depois da importação, revise os registros individualmente. A conta de origem serve para identificar os lançamentos importados.

Os avisos de limites aparecem no painel. Para envio externo, a função valida sessão, regra de gasto e cota antes de chamar um provedor. O destinatário precisa estar confirmado e autorizado em `app_metadata.alva_verified_alerts`, escrito pelo servidor administrativo após a confirmação do contato. Use `email` e `whatsapp` nessa estrutura, e mantenha a preferência correspondente no perfil do usuário. Um endereço cadastrado sem confirmação de e-mail não equivale a um contato verificado.

O e-mail requer `RESEND_API_KEY` e `ALVA_ALERT_FROM` na função. O WhatsApp requer `WHATSAPP_WEBHOOK_URL` HTTPS e pode usar `ALVA_WHATSAPP_WEBHOOK_TOKEN`. O webhook deve deduplicar pelo `idempotency_key` recebido. Publique a versão revisada de `financial-agent` junto com a interface para usar o envio externo. Os testes dessa função usam provedores simulados e Node.js 22.13 ou mais recente.

## Referências

- [Autenticação por senha](https://supabase.com/docs/guides/auth/passwords)
- [Segurança das senhas](https://supabase.com/docs/guides/auth/password-security)
- [Sessões e revogação](https://supabase.com/docs/guides/auth/sessions)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

A [Central de avisos](CENTRAL-DE-AVISOS.md) reúne vencimentos, limites e histórico. Veja o guia para publicar a migração e habilitar o envio por e-mail.

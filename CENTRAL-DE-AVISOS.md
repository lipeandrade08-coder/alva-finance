# Central de avisos da Alva

A Central prioriza vencimentos pessoais e do negócio e limites de gastos. O banco registra o primeiro aviso de 80% ou 100% por limite, faixa e mês em São Paulo. O painel funciona mesmo sem e-mail. A função de e-mail só usa o endereço da conta, confirmado com um código de 10 minutos, e o usuário pode desligar o canal. O e-mail tem apenas uma chamada para abrir a Alva, sem incluir valores ou categorias.

O cadastro por senha continua sem confirmação. A verificação aqui ativa somente o canal de avisos.

## Publicar no ambiente da Alva

1. Aplique a migração `20261109151145_alva_notice_center.sql` ao projeto Supabase existente. Para um projeto novo, use o esquema completo.
2. Publique `notification-center` com a verificação de JWT do gateway desligada. A função valida o token no Auth **e** a sessão no banco. O worker usa um segredo próprio. Publique também a atualização de `financial-agent` antes do front para que o caminho legado de WhatsApp não dispare um segundo e-mail.
3. Publique `dist/` na hospedagem da Alva.

## Habilitar envio por e-mail

1. Valide um domínio de envio no Resend. Use uma chave da API com permissão de envio e, quando disponível, limitada ao domínio validado.
2. Em **Edge Functions → Secrets** no Supabase, configure `RESEND_API_KEY` e `ALVA_ALERT_FROM` (por exemplo, `Alva <avisos@seudominio.com.br>`). Não coloque esses valores no navegador, no GitHub nem no chat. O [MCP do Resend](https://resend.com/mcp) serve para administrar a conta do Resend com ferramentas compatíveis. A Alva envia pela API do Resend.
3. Para processar a fila mesmo sem usuários no app, defina `ALVA_NOTICE_WORKER_SECRET` com um valor aleatório de pelo menos 32 caracteres. Configure o [Supabase Cron](https://supabase.com/docs/guides/functions/schedule-functions) para fazer POST em `/functions/v1/notification-center` a cada 5 minutos. Passe o segredo em `x-alva-worker-key` a partir do Vault. Não escreva o valor do segredo na definição do job. Sem o Cron, a Alva aciona a fila ao registrar um novo aviso ou abrir a Central com o canal confirmado.
4. Use uma conta de teste com um endereço sob seu controle. Confirme o código, alcance um limite, confira o histórico e desative o canal para validar o fluxo. “Aceito para envio” significa que o Resend aceitou a solicitação; não confirma que a caixa de entrada recebeu o e-mail.

São enviados até três novos avisos de limite por conta a cada 24 horas. Os demais ficam no painel. As tentativas usam a mesma chave de idempotência para cada aviso. O processo verifica o consentimento e o endereço atual antes de pegar mensagens da fila; um envio já iniciado pode terminar depois de desligar o canal. O WhatsApp continua separado.

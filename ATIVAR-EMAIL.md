# E-mail na Alva 1.4

O acesso atual usa **e-mail e senha, sem confirmação por e-mail**, conforme solicitado. O cadastro funciona no plano gratuito sem SMTP próprio. Não altere essa escolha ao configurar envio, a menos que queira exigir confirmação novamente.

Sem verificação, o cadastro não prova que o usuário possui o endereço informado. O isolamento usa o UUID da sessão Supabase, nunca o endereço como permissão.

## Recuperação de senha: próxima integração

A recuperação automática ainda não está disponível na interface. Para oferecê-la, configure um provedor SMTP e um remetente de domínio validado no Supabase. Isso é separado do plano de banco; o provedor pode ter limites/custos próprios.

1. Cadastre e valide seu domínio no provedor de e-mail e configure os registros DNS exigidos.
2. No painel Supabase, configure Custom SMTP em Authentication. Credenciais devem ficar apenas no servidor/painel, nunca em `dist/`.
3. Mantenha **Confirm email desativado** se quiser preservar o cadastro direto atual.
4. Configure o template e a rota de recuperação de senha, com redirecionamento somente para a origem publicada da Alva. A rota deve validar a troca de token e só então permitir nova senha. A Alva atual não aceita tokens de URL como login.
5. Teste envio, link expirado/reutilizado, sessão e limites antes de habilitar o botão de recuperação.

Os arquivos `supabase/templates/email-otp.html` e `supabase/smtp-templates.toml` são preparados para o antigo fluxo de OTP, não são usados pelo cadastro atual e não devem ser aplicados automaticamente. Nunca envie segredos ou senhas por este chat.

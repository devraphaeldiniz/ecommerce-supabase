\# 🚀 Guia Rápido de Instalação



Este guia irá te ajudar a configurar o projeto em \*\*menos de 10 minutos\*\*.



---



\## ✅ Checklist Rápido



\- \[ ] Node.js 20+ instalado

\- \[ ] Conta no Supabase criada

\- \[ ] Git instalado



---



\## 📦 Passo 1: Clone e Instale (2 min)

```bash

\# Clone o repositório

git clone https://github.com/devraphaeldiniz/ecommerce-supabase.git

cd ecommerce-supabase



\# Instale as dependências

npm install

```



---



\## 🔑 Passo 2: Configure o Supabase (5 min)



\### 2.1 Crie um projeto no Supabase



1\. Acesse: https://app.supabase.com

2\. Clique em "New Project"

3\. Preencha:

&nbsp;  - Nome: `ecommerce-backend`

&nbsp;  - Senha: Escolha uma senha forte

&nbsp;  - Região: South America (São Paulo)

4\. Aguarde 2-3 minutos



\### 2.2 Obtenha as credenciais



No painel do projeto, vá em \*\*Settings > API\*\*:



\- \*\*Project URL\*\*: `https://xxx.supabase.co`

\- \*\*Project Reference ID\*\*: encontrado na URL

\- \*\*anon public\*\*: chave pública

\- \*\*service\_role\*\*: chave secreta ⚠️



\### 2.3 Configure o .env

```bash

cp .env.example .env

\# Edite com suas credenciais

```



\*\*Arquivo `.env`:\*\*

```env

SUPABASE\_URL=https://seu-projeto.supabase.co

SUPABASE\_PROJECT\_REF=seu-ref-id

SUPABASE\_ANON\_KEY=sua-anon-key

SUPABASE\_SERVICE\_ROLE\_KEY=sua-service-role-key

SUPABASE\_DB\_PASSWORD=sua-senha

SUPABASE\_ACCESS\_TOKEN=seu-token

```



\*\*Para gerar o Access Token:\*\*

1\. https://app.supabase.com/account/tokens

2\. "Generate new token"

3\. Copie e cole no .env



---



\## 🗄️ Passo 3: Configure o Banco (2 min)

```bash

\# Vincular ao projeto

npm run link



\# Aplicar migrations (criar tabelas)

npm run db:push



\# Popular com dados de teste

npm run seed

```



\*\*Resultado esperado:\*\*

```

✅ 3 perfis criados!

✅ 5 produtos criados!

✅ 2 pedidos criados!

```



---



\## ⚡ Passo 4: Deploy Edge Functions (2 min)

```bash

npm run functions:deploy

```



---



\## ✅ Passo 5: Validar (1 min)

```bash

npm run validate

```



\*\*Deve mostrar:\*\*

```

✅ TUDO PRONTO! SETUP OK!

```



---



\## 🎉 Pronto!



Agora você pode:



\### Acessar o Supabase Studio

```

https://app.supabase.com/project/seu-ref-id

```



\### Testar a API REST

```bash

curl "https://seu-projeto.supabase.co/rest/v1/products?select=\*" \\

&nbsp; -H "apikey: sua-anon-key"

```



---



\## 🐛 Problemas Comuns



\### "Permission denied"

\*\*Solução:\*\* Faça `npm run link` novamente



\### "Function deployment failed"

\*\*Solução:\*\* Verifique sua internet e tente com `--debug`



\### Testes falhando

\*\*Solução:\*\* Verifique se o `.env` está preenchido



---



\## 📚 Próximos Passos



1\. Ler \[ARCHITECTURE.md](ARCHITECTURE.md)

2\. Configurar GitHub Actions

3\. Personalizar o schema



---



\*\*Tempo total: ~10 minutos\*\* ⚡


# Guia Rápido de Instalação

Este guia irá te ajudar a configurar o projeto em menos de 10 minutos.

---

## Checklist Rápido

- [ ] Node.js 20+ instalado
- [ ] Conta no Supabase criada
- [ ] Git instalado

---

## Passo 1: Clone e Instale (2 min)
```bash
# Clone o repositório
git clone https://github.com/devraphaeldiniz/ecommerce-supabase.git
cd ecommerce-supabase

# Instale as dependências
npm install
```

---

## Passo 2: Configure o Supabase (5 min)

### 2.1 Crie um projeto no Supabase

1. Acesse: https://app.supabase.com
2. Clique em "New Project"
3. Preencha:
   - Nome: `ecommerce-backend`
   - Senha: Escolha uma senha forte
   - Região: South America (São Paulo)
4. Aguarde 2-3 minutos

### 2.2 Obtenha as credenciais

No painel do projeto, vá em **Settings > API**:

- **Project URL**: `https://xxx.supabase.co`
- **Project Reference ID**: encontrado na URL
- **anon public**: chave pública
- **service_role**: chave secreta

### 2.3 Configure o .env
```bash
cp .env.example .env
# Edite com suas credenciais
```

**Arquivo `.env`:**
```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PROJECT_REF=seu-ref-id
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
SUPABASE_DB_PASSWORD=sua-senha
SUPABASE_ACCESS_TOKEN=seu-token
```

**Para gerar o Access Token:**
1. https://app.supabase.com/account/tokens
2. "Generate new token"
3. Copie e cole no .env

---

## Passo 3: Configure o Banco (2 min)
```bash
# Vincular ao projeto
npm run link

# Aplicar migrations (criar tabelas, views, índices)
npm run db:push
```

**Resultado esperado:**
```
Applying migration 20240101000001_init.sql...
Applying migration 20240101000002_5_compatibility.sql...
Applying migration 20240101000003_rls.sql...
Applying migration 20240101000004_functions_triggers.sql...
Applying migration 20240101000005_seed_data.sql...
Applying migration 20240101000006_create_views.sql...
Applying migration 20240101000007_create_materialized_views.sql...
Applying migration 20240101000008_add_rbac.sql...
Applying migration 20240101000009_audit_and_delete_policies.sql...
Applying migration 20240101000010_advanced_indexes.sql...
```

---

## Passo 4: Deploy Edge Functions (2 min)
```bash
npm run functions:deploy
```

---

## Passo 5: Validar (1 min)
```bash
# Validação completa
npm run validate:complete

# Testes automatizados
npm test
```

**Deve mostrar:**
```
Total checks: 24
Passed: 23+
Success rate: 95%+

Test Files  2 passed (2)
     Tests  27 passed (27)
```

---

## Pronto!

Agora você pode:

### Acessar o Supabase Studio
```
https://app.supabase.com/project/seu-ref-id
```

### Testar a API REST
```bash
curl "https://seu-projeto.supabase.co/rest/v1/products?select=*" \
  -H "apikey: sua-anon-key"
```

### Ver as Views criadas
No Supabase Studio > Table Editor, você verá:
- 8 tabelas
- 6 views normais
- 3 materialized views

---

## Problemas Comuns

### "Permission denied"
**Solução:** Faça `npm run link` novamente

### "Function deployment failed"
**Solução:** Verifique sua internet e tente com `--debug`

### Testes falhando
**Solução:** Verifique se o `.env` está preenchido corretamente

### "Migration already applied"
**Solução:** Normal se já aplicou antes. Use `npx supabase db reset --linked` para resetar.

---

## Próximos Passos

1. Ler [ARCHITECTURE.md](ARCHITECTURE.md)
2. Explorar as views no Supabase Studio
3. Testar as Edge Functions
4. Configurar GitHub Actions

---

**Tempo total: ~10 minutos**
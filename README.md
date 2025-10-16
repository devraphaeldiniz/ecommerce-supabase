# 🛒 E-commerce Backend - Supabase

Backend completo para e-commerce desenvolvido com Supabase, incluindo banco de dados PostgreSQL, Row Level Security (RLS), Edge Functions e pipeline CI/CD automatizado.

## 📋 Índice

- [Características](#características)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Configuração](#configuração)
- [Deploy](#deploy)
- [API e Endpoints](#api-e-endpoints)
- [Testes](#testes)
- [Segurança](#segurança)
- [Contribuindo](#contribuindo)

## ✨ Características

### 🗄️ Banco de Dados
- **Schema completo** com relacionamentos
  - Perfis de usuários
  - Catálogo de produtos
  - Pedidos e itens
  - Log de eventos/auditoria
- **Triggers automáticos**
  - Cálculo de totais
  - Atualização de timestamps
  - Registro de eventos
- **Views otimizadas** para consultas frequentes
- **Índices estratégicos** para performance

### 🔐 Segurança
- **Row Level Security (RLS)** configurado em todas as tabelas
- Políticas de acesso baseadas em roles (cliente/admin)
- Proteção contra SQL injection
- Auditoria completa de ações

### ⚡ Edge Functions
- **send-order-email**: Envio de emails transacionais
  - Confirmação de pedido
  - Atualização de status
  - Notificações de envio/entrega
- **export-order-csv**: Exportação de dados
  - Formato simples ou detalhado
  - Geração sob demanda

### 🚀 CI/CD
- Deploy automático via GitHub Actions
- Validação de código
- Testes de integração
- Versionamento automático

## 📦 Pré-requisitos

- Node.js 20+ e npm
- Conta no [Supabase](https://supabase.com)
- Conta no [SendGrid](https://sendgrid.com) (para emails)
- Git e GitHub (para CI/CD)

## 🔧 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/ecommerce-supabase.git
cd ecommerce-supabase
```

### 2. Instale o Supabase CLI

```bash
npm install -g supabase
```

### 3. Instale as dependências

```bash
npm install
```

### 4. Configure o Supabase CLI

```bash
supabase login
```

### 5. Crie um projeto no Supabase

Acesse [app.supabase.com](https://app.supabase.com) e crie um novo projeto.

### 6. Conecte ao projeto

```bash
supabase link --project-ref seu-project-ref
```

## 📁 Estrutura do Projeto

```
ecommerce-supabase/
├── supabase/
│   ├── migrations/
│   │   ├── 001_init.sql          # Schema, functions, triggers
│   │   └── 002_rls.sql           # Row Level Security
│   └── functions/
│       ├── send-order-email/
│       │   └── index.ts
│       └── export-order-csv/
│           └── index.ts
├── tests/
│   └── integration.test.js       # Testes de integração
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD Pipeline
├── .env.example                  # Exemplo de variáveis
├── package.json
└── README.md
```

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
SUPABASE_PROJECT_REF=seu-project-ref
SUPABASE_ACCESS_TOKEN=seu-access-token
SUPABASE_DB_PASSWORD=sua-db-password

# Email (SendGrid)
SENDGRID_API_KEY=sua-sendgrid-api-key
FROM_EMAIL=noreply@seusite.com.br

# Frontend
SITE_URL=https://seusite.com.br
```

### 2. GitHub Secrets

Configure os seguintes secrets no GitHub:
- `SUPABASE_URL`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_PASSWORD`
- `SENDGRID_API_KEY`
- `FROM_EMAIL`
- `SITE_URL`

## 🚀 Deploy

### Deploy Local

#### 1. Aplicar Migrations

```bash
# Revisar migrations
supabase db diff

# Aplicar migrations
supabase db push
```

#### 2. Deploy Edge Functions

```bash
# Deploy todas as funções
cd supabase/functions

supabase functions deploy send-order-email
supabase functions deploy export-order-csv

# Configurar secrets
supabase secrets set SENDGRID_API_KEY=sua-key FROM_EMAIL=seu-email
```

### Deploy Automático (CI/CD)

Simplesmente faça push para a branch `main`:

```bash
git add .
git commit -m "feat: adicionar nova funcionalidade"
git push origin main
```

O GitHub Actions irá automaticamente:
1. Validar o código
2. Executar testes
3. Aplicar migrations
4. Fazer deploy das Edge Functions
5. Criar release (se production)

## 📚 API e Endpoints

### REST API (Supabase)

Base URL: `https://seu-projeto.supabase.co/rest/v1/`

#### Produtos

```http
# Listar produtos
GET /products?select=*

# Buscar produto por ID
GET /products?id=eq.{uuid}

# Produtos em estoque
GET /vw_product_stock?select=*
```

#### Pedidos

```http
# Criar pedido
POST /orders
Content-Type: application/json
Authorization: Bearer {token}

{
  "customer_id": "uuid",
  "shipping_address": { ... },
  "billing_address": { ... }
}

# Listar pedidos do cliente
GET /vw_customer_orders?customer_id=eq.{uuid}

# Detalhes do pedido
GET /vw_order_details?order_id=eq.{uuid}
```

#### Itens do Pedido

```http
# Adicionar item
POST /order_items
Content-Type: application/json

{
  "order_id": "uuid",
  "product_id": "uuid",
  "unit_price": 100.00,
  "quantity": 2
}
```

### Edge Functions

Base URL: `https://seu-projeto.supabase.co/functions/v1/`

#### Enviar Email

```http
POST /send-order-email
Content-Type: application/json
Authorization: Bearer {service_role_key}

{
  "order_id": "uuid",
  "email_type": "confirmation"
}
```

**Tipos de email:**
- `confirmation` - Confirmação de pedido
- `status_update` - Atualização de status
- `shipped` - Pedido enviado
- `delivered` - Pedido entregue

#### Exportar CSV

```http
GET /export-order-csv?order_id={uuid}&format=detailed
Authorization: Bearer {service_role_key}
```

**Formatos:**
- `simple` - Apenas itens e totais
- `detailed` - Dados completos do pedido

## 🧪 Testes

### Configurar Ambiente de Testes

```bash
# Instalar dependências
npm install --save-dev vitest @supabase/supabase-js

# Configurar variáveis de teste
cp .env.example .env.test
```

### Executar Testes

```bash
# Todos os testes
npm test

# Testes específicos
npm test -- integration.test.js

# Com coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Testes Incluídos

- ✅ Gerenciamento de perfis (CRUD)
- ✅ Gerenciamento de produtos
- ✅ Criação e atualização de pedidos
- ✅ Cálculo automático de totais
- ✅ Views e consultas otimizadas
- ✅ Edge Functions
- ✅ Performance de queries
- ✅ Políticas RLS

## 🔒 Segurança

### Row Level Security (RLS)

O projeto implementa RLS em todas as tabelas:

#### Profiles
- ✅ Usuários veem apenas seu próprio perfil
- ✅ Admins veem todos os perfis
- ✅ Usuários podem atualizar apenas seus dados

#### Products
- ✅ Todos podem visualizar produtos ativos
- ✅ Apenas admins podem criar/editar/deletar

#### Orders
- ✅ Clientes veem apenas seus pedidos
- ✅ Clientes só editam pedidos em rascunho
- ✅ Admins têm acesso completo

#### Order Items
- ✅ Acesso baseado na propriedade do pedido
- ✅ Modificações apenas em pedidos draft

### Boas Práticas

1. **Nunca exponha service_role_key no frontend**
2. **Use Edge Functions** para operações sensíveis
3. **Valide todas as entradas** no banco e nas functions
4. **Implemente rate limiting** nas Edge Functions
5. **Faça backups regulares** do banco de dados
6. **Monitore logs** de eventos suspeitos
7. **Atualize dependências** regularmente

### Auditoria

Todas as ações importantes são registradas em `order_events`:
- Criação/atualização de itens
- Mudanças de status
- Envio de emails
- Exportações de dados

## 📖 Exemplos de Uso

### Criar um pedido completo

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 1. Login do usuário
const { data: { user } } = await supabase.auth.signInWithPassword({
  email: 'cliente@email.com',
  password: 'senha123'
})

// 2. Buscar perfil
const { data: profile } = await supabase
  .from('profiles')
  .select()
  .eq('auth_uid', user.id)
  .single()

// 3. Criar pedido
const { data: order } = await supabase
  .from('orders')
  .insert({
    customer_id: profile.id,
    shipping_address: {
      street: 'Rua Exemplo',
      number: '123',
      city: 'São Paulo',
      state: 'SP',
      zipcode: '01234-567'
    }
  })
  .select()
  .single()

// 4. Adicionar itens
await supabase
  .from('order_items')
  .insert([
    {
      order_id: order.id,
      product_id: 'uuid-produto-1',
      unit_price: 100.00,
      quantity: 2
    },
    {
      order_id: order.id,
      product_id: 'uuid-produto-2',
      unit_price: 50.00,
      quantity: 1
    }
  ])

// 5. Finalizar pedido
await supabase.rpc('set_order_status', {
  p_order_id: order.id,
  p_status: 'placed'
})

// 6. Enviar email (via service_role)
await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
  },
  body: JSON.stringify({
    order_id: order.id,
    email_type: 'confirmation'
  })
})
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👥 Autores

- Seu Nome - [@seu-usuario](https://github.com/seu-usuario)

## 🙏 Agradecimentos

- [Supabase](https://supabase.com) - Plataforma backend
- [SendGrid](https://sendgrid.com) - Serviço de email
- Comunidade Open Source

---

## 📞 Suporte

Para suporte, envie um email para raphaelaloisiodiniz@gmail.com ou abra uma issue no GitHub.

## 🗺️ Roadmap

- [ ] Implementar pagamentos (Stripe/Mercado Pago)
- [ ] Sistema de cupons de desconto
- [ ] Avaliações e reviews de produtos
- [ ] Wishlist (lista de desejos)
- [ ] Notificações push
- [ ] Dashboard administrativo
- [ ] Relatórios e analytics
- [ ] Integração com ERPs

---

**Desenvolvido com ❤️ usando Supabase**
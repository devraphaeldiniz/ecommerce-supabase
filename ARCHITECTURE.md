# Arquitetura e Decisões Técnicas

---

## Visão Geral

Backend completo para e-commerce usando Supabase como plataforma principal.

### Stack Tecnológica
```
┌─────────────────────────────────────────┐
│           FRONTEND/CLIENTE              │
└──────────────┬──────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────┐
│          SUPABASE PLATFORM              │
├─────────────────────────────────────────┤
│  • REST API (PostgREST)                 │
│  • Edge Functions (Deno)                │
│  • PostgreSQL 15                        │
│  • Row Level Security                   │
│  • RBAC System                          │
└─────────────────────────────────────────┘
```

---

## Modelo de Dados

### Diagrama ER
```
profiles (usuários)
    ↓
user_roles (RBAC) → orders (pedidos)
    ↓                   ↓
order_items (itens) → products (produtos)
    ↓
order_events (auditoria)

access_logs (logs de acesso)
security_violations (violações)
```

### Tabelas Core

**profiles** - Dados dos usuários
- auth_uid (referência ao Supabase Auth)
- full_name, email, cpf, phone
- address (JSONB)

**products** - Catálogo
- sku (único)
- name, description, price, stock
- category, is_active

**orders** - Pedidos
- customer_id → profiles
- status (ENUM: draft, placed, paid, processing, shipped, delivered, completed, cancelled, refunded)
- total (calculado automaticamente)

**order_items** - Itens
- order_id → orders
- product_id → products
- product_snapshot (JSONB - cópia do produto)
- line_total (calculado: unit_price × quantity)

### Tabelas de Segurança

**user_roles** - RBAC
- user_id → auth.users
- role (ENUM: customer, staff, admin, super_admin)
- granted_by, granted_at, expires_at
- is_active

**access_logs** - Auditoria de acessos
- user_id, user_email, user_role
- action, table_name, record_id
- was_successful, error_message
- metadata (JSONB)

**security_violations** - Tentativas não autorizadas
- user_id, violation_type
- severity (low, medium, high, critical)
- attempted_action, description

---

## Segurança

### Row Level Security (RLS)

Todas as tabelas possuem RLS habilitado.

**Princípios:**
1. Usuários só acessam seus próprios dados
2. Staff tem acesso de leitura ampliado
3. Admins têm acesso total
4. Produtos são públicos (leitura)

**Helper Functions:**
```sql
get_user_role(user_id) → user_role
is_admin() → boolean
is_staff_or_admin() → boolean
```

### RBAC - Role Based Access Control

**Hierarquia de roles:**
```
super_admin (pode promover usuários)
    ↓
admin (acesso total, não pode promover)
    ↓
staff (gerenciar produtos, ver pedidos)
    ↓
customer (próprios dados)
```

**Políticas por Tabela:**

**profiles:**
- Customer vê/edita apenas seu perfil
- Admin vê/edita todos

**orders:**
- Customer vê/edita apenas seus pedidos em draft
- Staff/Admin gerenciam todos

**products:**
- Todos podem ler (se active = true)
- Staff/Admin modificam

**user_roles:**
- Usuário vê apenas seu próprio role
- Admin vê todos os roles
- Super_admin gerencia roles

---

## Performance

### Índices Criados (35+)

**Índices básicos:**
```sql
idx_products_sku              -- Busca por SKU
idx_products_category         -- Filtro por categoria
idx_orders_customer           -- Pedidos por cliente
idx_order_items_order         -- Itens por pedido
```

**Índices compostos:**
```sql
idx_orders_customer_status    -- Cliente + Status
idx_orders_date_status        -- Data + Status
idx_products_price_active     -- Preço + Ativo
```

**Índices parciais:**
```sql
idx_orders_active             -- Apenas pedidos ativos
idx_products_available        -- Apenas disponíveis
idx_products_low_stock_alert  -- Estoque < 20
```

**Full-text search:**
```sql
idx_products_fts              -- Busca em nome/descrição
idx_profiles_fts              -- Busca em usuários
```

### Triggers Automáticos

1. **calculate_order_totals**: Calcula total do pedido
2. **update_product_stock**: Atualiza estoque
3. **create_customer_on_signup**: Cria perfil ao registrar
4. **audit_sensitive_operations**: Log de operações sensíveis

### Views Normais (6)

- **customer_orders_summary**: Resumo de pedidos por cliente
- **products_low_stock**: Alertas de estoque baixo
- **recent_orders_details**: Pedidos dos últimos 30 dias
- **top_selling_products**: Mais vendidos (90 dias)
- **orders_status_overview**: Overview por status
- **inactive_customers**: Sem pedidos há 60+ dias

### Materialized Views (3)

- **daily_sales_stats**: Estatísticas diárias (1 ano)
- **product_performance_stats**: Performance de produtos
- **customer_rfm_segments**: Segmentação RFM (Recency, Frequency, Monetary)

**Atualização:** Função `refresh_all_materialized_views()` pode ser chamada manualmente ou via cron.

---

## Decisões Técnicas

### Por que Supabase?

| Decisão | Alternativa | Justificativa |
|---------|-------------|---------------|
| **Supabase** | Firebase | PostgreSQL completo, RLS nativo, Open source |
| **PostgreSQL** | MongoDB | ACID, Relacionamentos, JSONB nativo, Views |
| **Edge Functions** | AWS Lambda | TypeScript nativo, Deploy integrado, Sem cold start |
| **RLS** | App-level auth | Segurança no banco, Impossível bypassar |

### Por que SQL direto?

1. **Performance** - SQL otimizado manualmente
2. **Controle total** - Acesso a features avançadas (RLS, triggers, views)
3. **RLS** - Funciona melhor com queries diretas
4. **Simplicidade** - Menos camadas de abstração
5. **Views e Materialized Views** - Não disponíveis via ORM

### Por que Materialized Views?

1. **Performance** - 100x mais rápidas que views normais
2. **Queries complexas** - Pré-calculadas
3. **Analytics** - Dashboards instantâneos
4. **Custo** - Reduz carga no banco

---

## Escalabilidade

### Limites Atuais (Free Tier)

- Database: 500 MB
- Storage: 1 GB
- Edge Functions: 500K invocações/mês
- Bandwidth: 5 GB

### Estratégias de Escala

1. **Caching**: Redis para queries frequentes
2. **Read Replicas**: Supabase Pro
3. **CDN**: Para assets estáticos
4. **Rate Limiting**: Já implementado nas Edge Functions
5. **Partitioning**: Para tabelas grandes (logs)
6. **Materialized Views**: Reduzem carga em queries pesadas

---

## Auditoria e Compliance

### Sistema de Logs

**access_logs**: Registra toda ação no sistema
- Quem fez
- O que fez
- Quando fez
- Se teve sucesso

**security_violations**: Registra tentativas não autorizadas
- Tipo de violação
- Severidade
- Descrição do que foi tentado

**order_events**: Histórico completo de pedidos
- Mudanças de status
- Modificações
- Quem fez a alteração

### Views de Auditoria

- **suspicious_activities**: Atividades suspeitas (últimos 7 dias)
- **user_activity_summary**: Resumo de ações por usuário (30 dias)

---

## Fluxo de Deploy
```
Developer Commit
     ↓
GitHub Push
     ↓
GitHub Actions
     ↓
├─ Apply Migrations (10 arquivos SQL)
├─ Deploy Functions (2 Edge Functions)
└─ Run Tests (27 testes)
     ↓
Production (Supabase)
```

---

## Referências

- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgREST](https://postgrest.org/)
- [Materialized Views](https://www.postgresql.org/docs/current/sql-creatematerializedview.html)

---

**Versão:** 2.0.0
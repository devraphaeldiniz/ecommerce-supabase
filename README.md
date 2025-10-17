# E-commerce Backend - Supabase

Backend completo para e-commerce desenvolvido com Supabase, incluindo banco de dados PostgreSQL, Row Level Security (RLS), RBAC, auditoria, Edge Functions e pipeline CI/CD automatizado.

## Características

### Banco de Dados
- Schema com 8 tabelas relacionadas
- 6 views para consultas otimizadas
- 3 materialized views para analytics
- 35+ índices estratégicos para performance
- Triggers automáticos para cálculos e auditoria

### Segurança
- Row Level Security em todas as tabelas
- RBAC com 4 níveis (customer, staff, admin, super_admin)
- Sistema completo de auditoria (access_logs, security_violations)
- Políticas granulares de acesso

### Edge Functions
- **send-order-email**: Envio de emails transacionais
- **export-order-csv**: Exportação de pedidos em CSV

### Qualidade
- 27 testes automatizados
- Validação completa de setup
- CI/CD com GitHub Actions

---

## Pré-requisitos

- Node.js 20+
- Conta no [Supabase](https://supabase.com)
- Git

---

## Instalação Rápida

### 1. Clone o repositório
```bash
git clone https://github.com/devraphaeldiniz/ecommerce-supabase.git
cd ecommerce-supabase
```

### 2. Instale dependências
```bash
npm install
```

### 3. Configure variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com suas credenciais do Supabase
```

### 4. Aplique migrations
```bash
npm run db:push
```

### 5. Validar setup
```bash
npm run validate:complete
npm test
```

---

## Documentação Completa

- **[QUICKSTART.md](QUICKSTART.md)** - Guia de instalação em 10 minutos
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Decisões técnicas e arquitetura
- **[ENTREGA.md](ENTREGA.md)** - Documento de entrega do projeto

---

## Scripts Disponíveis
```bash
npm run validate          # Validar configuração básica
npm run validate:complete # Validar todas as features
npm test                  # Executar 27 testes automatizados
npm run db:push           # Aplicar migrations
npm run functions:deploy  # Deploy das Edge Functions
```

---

## Estrutura do Banco

### Tabelas Principais
```
profiles (usuários)
├── id, auth_uid, full_name, email, cpf, phone, address

products (produtos)
├── id, sku, name, description, price, stock, category

orders (pedidos)
├── id, customer_id, status, total, shipping_address

order_items (itens do pedido)
├── id, order_id, product_id, quantity, unit_price, line_total

order_events (auditoria de pedidos)
├── id, order_id, event_type, description, metadata
```

### Tabelas de Segurança
```
user_roles (controle de acesso)
├── id, user_id, role, granted_by, granted_at, is_active

access_logs (log de acessos)
├── id, user_id, action, table_name, was_successful

security_violations (tentativas não autorizadas)
├── id, user_id, violation_type, severity, description
```

### Views e Materialized Views
```
Views normais (6):
- customer_orders_summary
- products_low_stock
- recent_orders_details
- top_selling_products
- orders_status_overview
- inactive_customers

Materialized Views (3):
- daily_sales_stats
- product_performance_stats
- customer_rfm_segments
```

---

## Segurança (RLS)

| Tabela | Anônimo | Customer | Staff | Admin |
|--------|---------|----------|-------|-------|
| **profiles** | ❌ | ✅ Próprio | ✅ Leitura | ✅ Todos |
| **products** | ✅ Leitura | ✅ Leitura | ✅ Gerenciar | ✅ Todos |
| **orders** | ❌ | ✅ Próprios | ✅ Ver todos | ✅ Todos |
| **user_roles** | ❌ | ✅ Ver próprio | ❌ | ✅ Gerenciar |
| **access_logs** | ❌ | ✅ Ver próprio | ❌ | ✅ Ver todos |

---

## API Endpoints

**Base URL:** `https://byjwgtztyafzgxxzvnge.supabase.co/rest/v1/`

### Produtos
```bash
GET  /products                    # Listar produtos
GET  /products_low_stock          # Produtos com baixo estoque
GET  /top_selling_products        # Mais vendidos
```

### Pedidos
```bash
GET  /customer_orders_summary     # Resumo de pedidos
GET  /recent_orders_details       # Pedidos recentes
POST /orders                      # Criar pedido
```

### Analytics
```bash
GET  /daily_sales_stats           # Estatísticas diárias
GET  /product_performance_stats   # Performance de produtos
GET  /customer_rfm_segments       # Segmentação de clientes
```

### Edge Functions
```bash
POST /functions/v1/send-order-email   # Enviar email
POST /functions/v1/export-order-csv   # Exportar CSV
```

---

## Testes
```bash
npm test                  # 27 testes automatizados
npm run validate:complete # Validação completa do setup
```

**Cobertura de testes:**
- Database setup (12 testes)
- Views e Materialized Views (7 testes)
- RBAC (2 testes)
- Auditoria (2 testes)
- Performance (2 testes)
- DELETE Policies (2 testes)

---

## Deploy

Deploy automático configurado via GitHub Actions.

Push para `main` dispara:
1. Aplicação de migrations
2. Deploy das Edge Functions
3. Execução de testes
4. Configuração de secrets

---

## Suporte

- GitHub Issues: https://github.com/devraphaeldiniz/ecommerce-supabase/issues
- Documentação Supabase: https://supabase.com/docs

---

## Licença

MIT

---

**Desenvolvido por Raphael Aloisio Diniz**  
Backend completo com PostgreSQL, RLS, RBAC e auditoria
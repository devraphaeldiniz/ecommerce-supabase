# 🛒 E-commerce Backend - Supabase

Backend completo para e-commerce desenvolvido com Supabase, incluindo banco de dados PostgreSQL, Row Level Security (RLS), Edge Functions e pipeline CI/CD automatizado.

## 🚀 Características

### 🗄️ Banco de Dados
- Schema completo com 5 tabelas relacionadas
- Triggers automáticos para cálculos
- Views otimizadas para consultas
- Índices estratégicos para performance

### 🔐 Segurança
- Row Level Security em todas as tabelas
- Políticas de acesso por role (cliente/admin)
- Auditoria completa com logs

### ⚡ Edge Functions
- **send-order-email**: Envio de emails transacionais
- **export-order-csv**: Exportação de dados em CSV

### 🚀 CI/CD
- Deploy automático via GitHub Actions
- Testes automatizados
- Versionamento de migrations

---

## 📋 Pré-requisitos

- Node.js 20+
- Conta no [Supabase](https://supabase.com)
- Git e GitHub

---

## 🔧 Instalação Rápida

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

### 5. Popular dados de teste
```bash
npm run seed
```

### 6. Validar setup
```bash
npm run validate
```

---

## 📚 Documentação Completa

- **[QUICKSTART.md](QUICKSTART.md)** - Guia de instalação em 10 minutos
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Decisões técnicas e arquitetura
- **[ENTREGA.md](ENTREGA.md)** - Documento de entrega do projeto

---

## 🎯 Scripts Disponíveis
```bash
npm run seed              # Popular banco com dados de teste
npm run validate          # Validar configuração
npm run db:push           # Aplicar migrations
npm run functions:deploy  # Deploy das Edge Functions
```

---

## 📊 Estrutura do Banco
```
profiles (usuários)
├── id, auth_uid, full_name, email, cpf, phone, address

products (produtos)
├── id, sku, name, description, price, stock, category

orders (pedidos)
├── id, customer_id, status, total, shipping_address

order_items (itens do pedido)
├── id, order_id, product_id, quantity, unit_price, line_total

order_events (auditoria)
├── id, order_id, event_type, description, metadata
```

---

## 🔒 Segurança (RLS)

| Tabela | Anônimo | Usuário | Admin |
|--------|---------|---------|-------|
| **profiles** | ❌ | ✅ Próprio | ✅ Todos |
| **products** | ✅ Leitura | ✅ Leitura | ✅ Todos |
| **orders** | ❌ | ✅ Próprios | ✅ Todos |
| **order_items** | ❌ | ✅ Próprios | ✅ Todos |

---

## 📡 API Endpoints

**Base URL:** `https://byjwgtztyafzgxxzvnge.supabase.co/rest/v1/`

### Produtos
```bash
GET  /products           # Listar produtos
GET  /vw_product_stock   # Produtos em estoque
```

### Pedidos
```bash
GET  /vw_customer_orders     # Meus pedidos
POST /orders                 # Criar pedido
POST /order_items            # Adicionar item
```

### Edge Functions
```bash
POST /functions/v1/send-order-email      # Enviar email
GET  /functions/v1/export-order-csv      # Exportar CSV
```

---

## 🧪 Testes
```bash
npm run validate   # Validar setup completo
```

---

## 🚀 Deploy

Deploy automático configurado via GitHub Actions.

Push para `main` dispara:
1. Aplicação de migrations
2. Deploy das Edge Functions
3. Configuração de secrets

---

## 📞 Suporte

- GitHub Issues: https://github.com/devraphaeldiniz/ecommerce-supabase/issues
- Documentação Supabase: https://supabase.com/docs

---

## 📝 Licença

MIT

---

**Desenvolvido com ❤️ usando Supabase**
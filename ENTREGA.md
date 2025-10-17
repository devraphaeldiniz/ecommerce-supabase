# Entrega do Projeto - E-commerce Backend

**Desenvolvedor:** Raphael Aloisio Diniz  
**Email:** raphaelaloisiodiniz@gmail.com  
**LinkedIn:** https://www.linkedin.com/in/devraphaeldiniz/  
**GitHub:** https://github.com/devraphaeldiniz  
**Data:** 17/10/2024

---

## Links do Projeto

- **Repositório:** https://github.com/devraphaeldiniz/ecommerce-supabase
- **Supabase Studio:** https://app.supabase.com/project/byjwgtztyafzgxxzvnge
- **API Base:** https://byjwgtztyafzgxxzvnge.supabase.co/rest/v1/

---

## Funcionalidades Implementadas

### Banco de Dados PostgreSQL
- 5 tabelas relacionadas (profiles, products, orders, order_items, order_events)
- Triggers automáticos para cálculos de totais
- Índices para otimização de queries
- 3 Views para consultas complexas

### Segurança
- Row Level Security (RLS) em todas as tabelas
- Políticas de acesso por role (cliente/admin)
- Autenticação via JWT
- Sistema de auditoria com logs de eventos

### Edge Functions
- **send-order-email**: Envio de notificações por email
- **export-order-csv**: Exportação de dados para análise

### API REST
- Endpoints auto-gerados pelo PostgREST
- Suporte a filtros, ordenação e paginação
- Documentação via Postman Collection

### CI/CD
- GitHub Actions para deploy automático
- Pipeline completo de migrations e functions
- Configuração de secrets automatizada

---

## Dados de Teste

O banco foi populado com dados de exemplo:
- 1 perfil de cliente
- 3 produtos em diferentes categorias
- 1 pedido completo com itens
- Eventos de auditoria registrados

---

## Como Testar

### Visualizar no Supabase Studio
Acesse: https://app.supabase.com/project/byjwgtztyafzgxxzvnge/editor

### Testar API REST

**Listar produtos:**
```bash
curl "https://byjwgtztyafzgxxzvnge.supabase.co/rest/v1/products?select=*" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5andndHp0eWFmemd4eHp2bmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Mjk3NzAsImV4cCI6MjA3NjIwNTc3MH0.L2SU0NDLFLZiIldyTlYuGBLVNcwVZbYA6TmiXmxGsYw"
```

**Ou acesse no navegador:**
```
https://byjwgtztyafzgxxzvnge.supabase.co/rest/v1/products?select=*&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5andndHp0eWFmemd4eHp2bmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Mjk3NzAsImV4cCI6MjA3NjIwNTc3MH0.L2SU0NDLFLZiIldyTlYuGBLVNcwVZbYA6TmiXmxGsYw
```

---

## Arquitetura
```
Cliente (Frontend)
      ↓
Supabase API Gateway
      ↓
PostgreSQL + RLS
      ↓
Edge Functions (Deno)
```

---

## Estrutura do Código
```
ecommerce-supabase/
├── supabase/
│   ├── migrations/          # SQL migrations
│   └── functions/           # Edge Functions
├── scripts/                 # Utilitários
├── .github/workflows/       # CI/CD
└── docs/                    # Documentação
```

---

## Diferenciais

- Segurança robusta com RLS
- Edge Functions serverless
- CI/CD totalmente automatizado
- Documentação completa
- Código limpo e bem estruturado
- Pronto para produção

---

## Execução Local
```bash
git clone https://github.com/devraphaeldiniz/ecommerce-supabase.git
cd ecommerce-supabase
npm install
npm run db:push
npm run seed
npm run validate
```

---

## Contato

**Raphael Aloisio Diniz**  
Email: raphaelaloisiodiniz@gmail.com  
LinkedIn: https://www.linkedin.com/in/devraphaeldiniz/  
GitHub: https://github.com/devraphaeldiniz  
Telefone: (31) 99440-2252

---

*Desenvolvido com Supabase, PostgreSQL e TypeScript*
\# 🏗️ Arquitetura e Decisões Técnicas



---



\## 🎯 Visão Geral



Backend completo para e-commerce usando \*\*Supabase\*\* como plataforma principal.



\### Stack Tecnológica

```

┌─────────────────────────────────────────┐

│           FRONTEND/CLIENTE              │

└──────────────┬──────────────────────────┘

&nbsp;              │ HTTPS

&nbsp;              ▼

┌─────────────────────────────────────────┐

│          SUPABASE PLATFORM              │

├─────────────────────────────────────────┤

│  • REST API (PostgREST)                 │

│  • Edge Functions (Deno)                │

│  • PostgreSQL 15                        │

│  • Row Level Security                   │

└─────────────────────────────────────────┘

```



---



\## 📊 Modelo de Dados



\### Diagrama ER

```

profiles (usuários)

&nbsp;   ↓

orders (pedidos)

&nbsp;   ↓

order\_items (itens) → products (produtos)

&nbsp;   ↓

order\_events (auditoria)

```



\### Tabelas Principais



\*\*profiles\*\* - Dados dos usuários

\- auth\_uid (referência ao Supabase Auth)

\- full\_name, email, cpf, phone

\- address (JSONB)



\*\*products\*\* - Catálogo

\- sku (único)

\- name, description, price, stock

\- category, is\_active



\*\*orders\*\* - Pedidos

\- customer\_id → profiles

\- status (ENUM)

\- total (calculado automaticamente)



\*\*order\_items\*\* - Itens

\- order\_id → orders

\- product\_id → products

\- product\_snapshot (JSONB - cópia do produto)

\- line\_total (calculado: unit\_price × quantity)



---



\## 🔐 Segurança



\### Row Level Security (RLS)



Todas as tabelas possuem RLS habilitado:



\*\*Princípios:\*\*

1\. Usuários só acessam seus próprios dados

2\. Admins têm acesso total

3\. Produtos são públicos (leitura)



\*\*Helper Functions:\*\*

```sql

is\_admin() → boolean

current\_user\_id() → uuid

```



\### Políticas por Tabela



\*\*profiles:\*\*

\- Usuário vê/edita apenas seu perfil

\- Admin vê todos



\*\*orders:\*\*

\- Cliente vê/edita apenas seus pedidos em draft

\- Admin gerencia todos



\*\*products:\*\*

\- Todos podem ler (se active = true)

\- Apenas admin modifica



---



\## ⚡ Performance



\### Índices Criados

```sql

idx\_products\_sku        -- Busca por SKU

idx\_products\_category   -- Filtro por categoria

idx\_orders\_customer     -- Pedidos por cliente

idx\_order\_items\_order   -- Itens por pedido

```



\### Triggers Automáticos



1\. \*\*order\_item\_compute\*\*: Calcula `line\_total`

2\. \*\*order\_item\_after\_change\*\*: Recalcula total do pedido

3\. \*\*set\_updated\_at\*\*: Atualiza timestamps



\### Views Otimizadas



\- \*\*vw\_customer\_orders\*\*: Pedidos com dados do cliente

\- \*\*vw\_product\_stock\*\*: Produtos disponíveis

\- \*\*vw\_order\_details\*\*: Detalhes completos do pedido



---



\## 🤔 Decisões Técnicas



\### Por que Supabase?



| Decisão | Alternativa | Justificativa |

|---------|-------------|---------------|

| \*\*Supabase\*\* | Firebase | ✅ PostgreSQL completo<br>✅ RLS nativo<br>✅ Open source |

| \*\*PostgreSQL\*\* | MongoDB | ✅ ACID<br>✅ Relacionamentos<br>✅ JSONB nativo |

| \*\*Edge Functions\*\* | AWS Lambda | ✅ TypeScript nativo<br>✅ Deploy integrado<br>✅ Sem cold start |



\### Por que SQL direto (sem ORM)?



1\. \*\*Performance\*\* - SQL otimizado manualmente

2\. \*\*Controle total\*\* - Acesso a features avançadas

3\. \*\*RLS\*\* - Funciona melhor com queries diretas

4\. \*\*Simplicidade\*\* - Menos camadas de abstração



---



\## 📈 Escalabilidade



\### Limites Atuais (Free Tier)



\- Database: 500 MB

\- Storage: 1 GB

\- Edge Functions: 500K invocações/mês



\### Estratégias de Escala



1\. \*\*Caching\*\*: Implementar Redis

2\. \*\*Read Replicas\*\*: Supabase Pro

3\. \*\*CDN\*\*: Para assets estáticos

4\. \*\*Rate Limiting\*\*: Nas Edge Functions



---



\## 🔄 Fluxo de Deploy

```

Developer Commit

&nbsp;     ↓

GitHub Push

&nbsp;     ↓

GitHub Actions

&nbsp;     ↓

├─ Apply Migrations

├─ Deploy Functions

└─ Run Tests

&nbsp;     ↓

Production (Supabase)

```



---



\## 📚 Referências



\- \[Supabase Docs](https://supabase.com/docs)

\- \[PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

\- \[PostgREST](https://postgrest.org/)



---



\*\*Versão:\*\* 1.0.0  

\*\*Última atualização:\*\* 2024


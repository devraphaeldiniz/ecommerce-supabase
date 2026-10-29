# E-commerce Backend - Supabase

[![CI/CD](https://github.com/devraphaeldiniz/ecommerce-supabase/actions/workflows/main.yml/badge.svg)](https://github.com/devraphaeldiniz/ecommerce-supabase/actions)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![Supabase](https://img.shields.io/badge/Supabase-Enabled-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

Infraestrutura de backend e dados para e-commerce construída sobre PostgreSQL e Supabase. O projeto soluciona o desafio de segurança e governança de dados em sistemas multi-usuário diretamente na camada de banco de dados, utilizando Row Level Security (RLS) granular, RBAC em 4 níveis e triggers automáticos de auditoria.

---

## 🏗️ Arquitetura do Sistema

```mermaid
flowchart TD
    Client[Cliente / Frontend] -->|HTTPS REST / RPC| PostgREST[PostgREST Gateway]
    Client -->|Autenticação| Auth[Supabase GoTrue Auth]
    
    subgraph PostgreSQL 15+ Core
        direction TB
        RLS[Row Level Security & RBAC]
        PostgREST --> RLS
        
        subgraph Tabelas e Regras de Negócio
            Profiles[(profiles)]
            Products[(products)]
            Orders[(orders & order_items)]
            Roles[(user_roles)]
        end
        
        RLS --> Profiles
        RLS --> Products
        RLS --> Orders
        RLS --> Roles
        
        subgraph Auditoria Automatica
            Triggers[Triggers em tempo de escrita]
            AccessLogs[(access_logs)]
            Violations[(security_violations)]
        end
        
        Orders --> Triggers
        Roles --> Triggers
        Triggers --> AccessLogs
        Triggers --> Violations
        
        subgraph Analytics & Otimizacao
            Views[6 Views de Negócio]
            MatViews[3 Materialized Views: RFM e Vendas]
        end
        
        Orders --> Views
        Orders --> MatViews
    end
    
    Client -->|Edge Requests| EdgeFn[Deno Edge Functions: send-order-email, export-order-csv]
    EdgeFn --> PostgREST
```

---

## ✨ Funcionalidades Principais

- **Segurança Nativa no Banco (RLS Granular):** Políticas de Row Level Security em 100% das tabelas, garantindo que usuários comuns acessem estritamente seus próprios pedidos e perfis, sem depender de validações manuais na camada de aplicação.
- **RBAC Hierárquico em 4 Níveis:** Papéis (`customer`, `staff`, `admin`, `super_admin`) mapeados na tabela `user_roles` e validados via funções PL/pgSQL.
- **Trilha de Auditoria em Tempo Real:** Registro automático de tentativas de acesso, modificações críticas e violações de segurança em `access_logs` e `security_violations`.
- **Analytics com Materialized Views:** Processamento pré-computado de métricas de vendas diárias e segmentação RFM (Recência, Frequência, Valor Monetário) para clientes.
- **Edge Functions Desacopladas:** Disparo de e-mails transacionais e geração de relatórios de pedidos em CSV via Deno runtime.
- **35+ Índices Estratégicos:** Cobertura de índices B-Tree e compostos para chaves estrangeiras, status de pedidos e filtros frequentes de catálogo.

---

## 🛠️ Stack Tecnológica & Decisões Técnicas

| Componente | Tecnologia | Decisão Técnica |
| :--- | :--- | :--- |
| **Banco de Dados** | PostgreSQL 15+ | Motor relacional robusto com suporte nativo a RLS, triggers procedurais em PL/pgSQL e materialized views com atualização concorrente. |
| **BaaS / Gateway** | Supabase (PostgREST + GoTrue) | Elimina boilerplate de CRUD gerando APIs REST seguras e tipadas diretamente a partir do esquema relacional com JWT nativo. |
| **Serverless** | Supabase Edge Functions (Deno) | Baixa latência e isolamento para tarefas assíncronas que requerem chamadas a serviços externos (envio de e-mails e exportação). |
| **Testes & Scripts** | TypeScript + Vitest | Validação automatizada de regras de integridade do banco e execução de suíte de testes de RLS. |

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) ou conta ativa na nuvem Supabase

### 1. Clonar e instalar dependências
```bash
git clone https://github.com/devraphaeldiniz/ecommerce-supabase.git
cd ecommerce-supabase
npm install
```

### 2. Configurar variáveis de ambiente
Copie o template de ambiente:
```bash
cp .env.example .env
```
Preencha `.env` com a URL do seu projeto e suas chaves Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). *Atenção: nunca compartilhe ou versione a service role key.*

### 3. Aplicar migrações ao banco
```bash
npm run db:push
```

### 4. Validar instalação
```bash
npm run validate:complete
```

---

## 🧪 Como Rodar os Testes

Execute a suíte com 27 testes automatizados de validação de esquema, RLS, permissões e integridade:
```bash
npm test
```

A suíte cobre:
- Setup e integridade estrutural do banco (12 testes)
- Resolução e consultas de Views e Materialized Views (7 testes)
- Regras de controle de acesso RBAC (2 testes)
- Triggers e logs de auditoria (2 testes)
- Desempenho e planos de execução (2 testes)
- Restrições de deleção via DELETE Policies (2 testes)

---

## 📊 Resultados e Métricas

- **Cobertura de Políticas de Segurança:** 100% das tabelas protegidas por RLS validado por suíte automatizada de testes.
- **Otimização de Consultas:** 35+ índices criados e validados contra *sequential table scans* em tabelas de alto volume.

---

## ⚠️ Limitações e Próximos Passos

- [ ] Medir o tempo de `REFRESH MATERIALIZED VIEW` com mais de 100.000 pedidos.
- [ ] Medir a latência p95/p99 das consultas autenticadas via PostgREST.
- [ ] Configurar job agendado (pg_cron) para atualização periódica das materialized views de analytics.
- [ ] Implementar política de expiração / retenção de dados históricos na tabela `access_logs`.
- [ ] Adicionar suporte a webhook para notificações de pagamento de gateways locais.

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte [LICENSE](LICENSE) para mais detalhes.

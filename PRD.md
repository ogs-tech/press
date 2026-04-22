# 📄 PRD — Next in Site (cms-scaffold-cli)

> **Status:** Draft · **Versão:** 0.1 · **Data:** 2026-04-19
> **Nome interno:** cms-scaffold-cli · **Nome público:** Next in Site
> **Stack:** Next.js · Strapi · Monorepo (Turborepo/pnpm) · TypeScript
> **Licença:** MIT (open-source)

## Sumário

- [1. Visão Geral](#1-visão-geral)
- [2. Objetivos](#2-objetivos)
- [3. Usuários](#3-usuários)
- [4. Funcionalidades do MVP](#4-funcionalidades-do-mvp)
- [5. Fluxos Principais](#5-fluxos-principais)
- [6. Requisitos Não-Funcionais](#6-requisitos-não-funcionais)
- [7. Integrações e Dependências](#7-integrações-e-dependências)
- [8. Riscos e Premissas](#8-riscos-e-premissas)
- [9. Roadmap de Alto Nível](#9-roadmap-de-alto-nível)
- [10. Decisões em Aberto](#10-decisões-em-aberto)

---

## 1. Visão Geral

**Next in Site** é um framework full-stack *opinionated* para devs construírem sites e plataformas de conteúdo modernas — um scaffold pronto que une **Next.js + Strapi + monorepo** com convenções, tipos compartilhados, sistema de blocos e deploy configurados *out of the box*.

### Problema

Iniciar um projeto web content-driven hoje exige dias de setup: escolher CMS, integrar com o front, sincronizar tipos, configurar i18n, definir estrutura de blocos, documentar deploy. Alternativas como WordPress são legadas; soluções modernas (Payload, Sanity, Contentful) resolvem partes, mas o dev ainda monta o quebra-cabeça.

### Solução

Um único comando — `npx create-next-in-site` — gera um monorepo production-ready com Next.js no front, Strapi no CMS, tipos compartilhados automaticamente, sistema de blocos dinâmicos, i18n e scripts de deploy. O dev foca em modelar conteúdo e construir páginas, não em plumbing.

### Por que agora

- Next.js 15 + App Router consolidaram SSR/ISR como commodity
- Strapi 5 amadureceu como headless CMS self-hosted
- Ecossistema de monorepos (Turborepo/pnpm) virou padrão de mercado
- Janela aberta entre "WordPress legado" e "stacks modernas fragmentadas"

---

## 2. Objetivos

### 🎯 Objetivos de negócio

- Estabelecer o Next in Site como **stack de referência open-source** para devs que constroem sites content-driven
- Validar o *opinionated scaffold* como proposta de valor antes de investir na camada cloud (pós-MVP agency)
- Construir comunidade engajada que valide decisões técnicas via uso real

### 📊 Métricas de sucesso (MVP — 3 meses)

Foco em **engajamento dev** e **qualidade técnica**.

| Categoria | Métrica | Meta MVP |
|---|---|---|
| Engajamento | Issues/PRs externos abertos | ≥ 20 PRs da comunidade |
| Engajamento | Tempo médio `create` → primeiro deploy | ≤ 30 minutos |
| Engajamento | DX feedback (survey/NPS dev) | NPS ≥ 30 |
| Qualidade | Cobertura de testes (packages core) | ≥ 80% |
| Qualidade | Core Web Vitals dos sites gerados | LCP < 2.5s, CLS < 0.1 |
| Qualidade | Releases sem regressão crítica | 100% com changelog + testes |

### 🚫 Non-goals (MVP)

- **Camada cloud / SaaS** — fica para pós-MVP (roadmap agency)
- **Editor visual WYSIWYG no Strapi** — blocos são definidos em código, renderizados via schema
- **Marketplace de temas/plugins** — pós-MVP
- **Autenticação custom / RBAC avançado** — usar o que o Strapi já entrega
- **SEO técnico completo** — estrutura básica sim, features dedicadas pós-MVP
- **Design system pronto** — dev traz o seu (Tailwind configurado, sem tokens opinativos)
- **Suporte a múltiplos frameworks front** — Next.js only no MVP

---

## 3. Usuários

### Persona primária — Dev Full-Stack (Lia)

- Constrói sites/plataformas de conteúdo para clientes próprios ou como freelancer
- Conhece Next.js, TypeScript, Docker; não quer montar stack do zero a cada projeto
- Valoriza DX, tipos, convenções e autonomia para estender

**Necessidades:**
- Scaffold confiável que não trava em decisões arquiteturais
- Integração Strapi ↔ Next.js sem boilerplate manual
- Docs claras de como estender e fazer deploy

### Persona secundária — Tech Lead de Agência (Rafael)

- Lidera time pequeno entregando sites para clientes B2B
- Precisa padronizar stack entre projetos e devs
- Olha o Next in Site como base para produtividade do time

**Necessidades:**
- Convenções compartilháveis entre projetos
- Onboarding rápido de novos devs
- Caminho claro para deploy reproduzível

### Jobs to be done

- *"Quando eu começo um projeto de site content-driven, eu quero um scaffold production-ready, para que eu gaste tempo modelando conteúdo — não montando stack."*
- *"Quando o cliente pede uma nova seção da página, eu quero adicionar um novo bloco em minutos, para que o time de conteúdo publique sem esperar deploy de código toda hora."*
- *"Quando eu abro um projeto antigo, eu quero reconhecer a estrutura imediatamente, para que a manutenção não exija rearqueologia."*

---

## 4. Funcionalidades do MVP

### 📦 F1 — CLI `create-next-in-site`

**Descrição:** Comando único que gera o monorepo configurado e pronto para `pnpm dev`.

**Critérios de aceite:**
- `npx create-next-in-site my-app` cria um monorepo funcional em < 2 minutos
- CLI pergunta nome do projeto, package manager (pnpm padrão), e locales iniciais
- Projeto gerado sobe `apps/web` (Next.js) e `apps/cms` (Strapi) com um único `pnpm dev`
- Saída final do CLI mostra próximos passos e URLs locais (front + admin Strapi)

**Prioridade:** Must Have

---

### 🧱 F2 — Monorepo configurado (Turborepo + pnpm workspaces)

**Descrição:** Estrutura de monorepo com apps, packages e scripts unificados.

**Critérios de aceite:**
- `apps/web` (Next.js 15 + App Router) e `apps/cms` (Strapi 5) convivem no mesmo repo
- `packages/` contém pelo menos `types`, `config` e `ui` (placeholder) compartilhados
- Turborepo orquestra `build`, `dev`, `lint`, `test` com cache
- `pnpm install` na raiz instala todas as dependências; scripts raiz funcionam

**Prioridade:** Must Have

---

### 🔗 F3 — Tipos compartilhados Strapi ↔ Next.js

**Descrição:** Schema do Strapi gera tipos TypeScript consumidos automaticamente pelo Next.js.

**Critérios de aceite:**
- Geração de tipos roda via script (`pnpm types:generate`) e em watch mode no dev
- Tipos cobrem content-types, components e relacionamentos do Strapi
- Tipos ficam em `packages/types` e são importados via alias (`@next-in-site/types`)
- Alteração de schema no Strapi reflete no Next.js sem restart completo

**Prioridade:** Must Have

---

### 🧩 F4 — Sistema de blocos dinâmicos

**Descrição:** Páginas no Strapi são montadas por blocos (Dynamic Zones) renderizados no Next.js via mapa `blockName → Component`.

**Critérios de aceite:**
- Pelo menos 3 blocos de exemplo incluídos (ex: Hero, RichText, CTA)
- Renderer central (`<BlockRenderer />`) recebe array de blocos e renderiza com type-safety
- Dev adiciona novo bloco criando (1) component no Strapi, (2) componente React, (3) registro no mapa
- Documentação cobre o fluxo completo de criação de um bloco novo

**Prioridade:** Must Have

---

### 🌍 F5 — i18n configurado

**Descrição:** Internacionalização pronta tanto no Strapi quanto no Next.js, com roteamento localizado.

**Critérios de aceite:**
- CLI aceita lista de locales iniciais (ex: `pt-BR,en`)
- Strapi com plugin i18n habilitado e locales pré-configurados
- Next.js com roteamento localizado (`/pt-BR/...`, `/en/...`) e fallback
- Blocos respeitam locale ativo automaticamente (conteúdo traduzido)

**Prioridade:** Must Have

---

### 🚀 F6 — Documentação de deploy

**Descrição:** Docs e scripts que cobrem ao menos dois caminhos de deploy.

**Critérios de aceite:**
- Guia para **Vercel (web) + Strapi Cloud (CMS)** com variáveis de ambiente documentadas
- Guia para **Docker Compose self-hosted** (web + cms + postgres)
- `.env.example` em cada app com todas as variáveis necessárias
- Troubleshooting com erros comuns (CORS, URL do CMS em build, migrations)

**Prioridade:** Must Have

---

### 🔐 F7 — Autenticação administrativa (Strapi default)

**Descrição:** Usar o admin nativo do Strapi para gestão de conteúdo — sem custom auth no MVP.

**Critérios de aceite:**
- Admin do Strapi acessível em `/admin` da `apps/cms`
- Docs cobrem criação do primeiro admin e configuração de roles padrão
- Nenhuma autenticação adicional exigida para o MVP

**Prioridade:** Should Have *(entregue via Strapi, sem esforço custom)*

---

### 🔍 F8 — SEO técnico básico

**Descrição:** Metatags essenciais e estrutura mínima de SEO saindo por padrão.

**Critérios de aceite:**
- Cada página renderiza metatags básicas (title, description, og:image) vindas do Strapi
- Sitemap estático/ISR disponível em `/sitemap.xml`
- `robots.txt` configurável por ambiente

**Prioridade:** Should Have

---

### 🎨 F9 — Base de estilos (Tailwind configurado)

**Descrição:** Tailwind instalado e configurado, sem design system opinativo.

**Critérios de aceite:**
- Tailwind funcionando em `apps/web` com config compartilhada
- Blocos de exemplo usam classes Tailwind
- Dev traz seu próprio design system sem conflito

**Prioridade:** Should Have

---

### ✨ F10 — Telemetria opt-in (DX analytics)

**Descrição:** Coleta anônima opt-in de eventos do CLI e do dev server para entender uso.

**Critérios de aceite:**
- Opt-in explícito na primeira execução do CLI
- Eventos: `create`, `dev:start`, `build`, `types:generate`
- Docs de privacidade claras, opt-out em 1 comando

**Prioridade:** Nice to Have

---

### 📋 Resumo por prioridade

| Prioridade | Features |
|---|---|
| **Must Have** | F1 CLI · F2 Monorepo · F3 Tipos compartilhados · F4 Blocos · F5 i18n · F6 Deploy docs |
| **Should Have** | F7 Auth Strapi · F8 SEO básico · F9 Tailwind base |
| **Nice to Have** | F10 Telemetria |

---

## 5. Fluxos Principais

### 🌱 Fluxo 1 — Bootstrap de projeto (dev novo)

1. Dev roda `npx create-next-in-site my-site`
2. CLI pergunta: nome, package manager, locales iniciais, opt-in de telemetria
3. CLI cria monorepo, instala dependências, gera `.env` com defaults de dev
4. Dev entra no diretório e roda `pnpm dev`
5. Turborepo sobe `apps/web` (localhost:3000) e `apps/cms` (localhost:1337)
6. Dev acessa `/admin` do Strapi, cria primeiro admin, vê content-types e blocos de exemplo já populados
7. Front renderiza página inicial com blocos consumidos do Strapi local

**Critério de sucesso:** do `npx` até ver o site renderizado — ≤ 30 minutos.

---

### 🧩 Fluxo 2 — Criar novo bloco dinâmico

1. Dev cria um Component no Strapi (ex: `blocks.testimonial`) via admin ou via código
2. Roda `pnpm types:generate` (ou deixa o watch gerar automaticamente)
3. Cria `apps/web/components/blocks/Testimonial.tsx` consumindo o tipo gerado
4. Registra o bloco no mapa central: `{ "blocks.testimonial": Testimonial }`
5. No Strapi, adiciona o bloco à Dynamic Zone da página
6. Front renderiza o novo bloco com type-safety total

---

### 📝 Fluxo 3 — Publicação de conteúdo

1. Editor acessa o admin do Strapi
2. Cria/edita página montando blocos da Dynamic Zone
3. Preenche campos com conteúdo e tradução por locale (i18n)
4. Publica → Strapi dispara webhook (docs cobrem configuração)
5. Next.js revalida via ISR (`revalidatePath` / `revalidateTag`)
6. Visitante vê conteúdo atualizado sem redeploy

---

### 🚀 Fluxo 4 — Deploy inicial (Vercel + Strapi Cloud)

1. Dev segue docs: cria projeto no Strapi Cloud, configura banco
2. Importa schema do Strapi local via migration
3. Conecta repositório à Vercel, apontando `apps/web`
4. Configura variáveis de ambiente (STRAPI_URL, STRAPI_TOKEN, etc.)
5. Primeiro deploy publica o site; webhook Strapi→Vercel configurado para ISR
6. Docs listam troubleshooting de erros comuns

---

## 6. Requisitos Não-Funcionais

### ⚡ Performance

- Site gerado deve atingir **Core Web Vitals "Good"** em páginas-template padrão (LCP < 2.5s, INP < 200ms, CLS < 0.1)
- Build do monorepo completo em `ci` ≤ 5 minutos (cache frio); ≤ 1 minuto (cache quente via Turborepo)
- Dev server com HMR respondendo em ≤ 1s para mudanças típicas de bloco

### 🔒 Segurança

- Sem segredos no repo gerado; `.env.example` com todas as variáveis, `.env` no `.gitignore`
- Dependências auditadas via `pnpm audit` no CI; vulnerabilidades críticas bloqueiam merge
- CORS e CSP com defaults sensatos e documentados
- Strapi admin com rate-limit ativo nas configs default

### ♿ Acessibilidade

- Blocos de exemplo seguem **WCAG 2.1 AA**: contraste, foco visível, landmarks, alt em imagens
- Docs incluem checklist de a11y para criação de novos blocos

### 🔍 SEO

- Metatags server-rendered (title, description, og:image, canonical)
- Structured data (JSON-LD) em blocos aplicáveis (Article, Breadcrumb) — *Should Have*
- Sitemap e robots.txt gerados por default

### 📈 Escalabilidade

- Arquitetura suporta adicionar novos apps (ex: `apps/blog`, `apps/docs`) sem refactor
- Strapi pode ser trocado por outro CMS futuramente (adapter-based, via `packages/types`)
- ISR + cache HTTP cobrem picos de tráfego típicos de sites content-driven

---

## 7. Integrações e Dependências

### 🔌 Dependências técnicas críticas

| Dependência | Versão-alvo | Criticidade |
|---|---|---|
| Next.js | 15.x | Alta — base do front |
| Strapi | 5.x | Alta — base do CMS |
| TypeScript | 5.x | Alta — tipos compartilhados |
| Turborepo | 2.x | Média — orquestração monorepo |
| pnpm | 9.x | Média — package manager default |
| Tailwind CSS | 4.x | Média — base de estilos |

### 🌐 Serviços externos (deploy — opcional para o usuário)

- **Vercel** — deploy de `apps/web`
- **Strapi Cloud** — deploy de `apps/cms`
- **PostgreSQL** — DB do Strapi em produção (Neon, Supabase, RDS, etc.)
- **Docker Compose** — alternativa self-hosted

### 📦 APIs de terceiros

Nenhuma no MVP. Integrações opcionais (analytics, formulários, imagens) ficam a cargo do dev final.

---

## 8. Riscos e Premissas

### ⚠️ Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Acoplamento forte a Strapi limita adoção por quem usa outro CMS | Alto | Documentar boundary via `packages/types` e preparar adapter pós-MVP |
| Breaking changes em Next.js 15 / Strapi 5 durante o desenvolvimento | Médio | Pinar versões, testes de integração no CI, upgrade guide em cada release |
| DX abaixo do esperado (setup lento, docs confusas) afasta devs | Alto | Métrica de tempo `create → deploy`; survey DX a cada release |
| Concorrência com soluções maduras (Payload, Astro Starter) | Médio | Diferenciar pelo *opinionated full-stack* e docs em pt-BR/en |
| Time pequeno (2 devs) não cobre suporte + evolução | Alto | Escopo MVP reduzido, comunidade convidada a contribuir desde v0.1 |
| Geração de tipos Strapi com edge-cases não-cobertos | Médio | Testar contra schema real de exemplo; documentar limitações |

### ✅ Premissas

- Público-alvo do MVP é **dev**, não criador não-técnico
- **Open-source MIT** desde o v0.1 (confirmar com mantenedor antes do release)
- Monorepo com **pnpm + Turborepo** é padrão aceito pela comunidade Next.js
- Strapi 5 é estável o suficiente para produção no horizonte do MVP
- Deploy Vercel + Strapi Cloud cobre 80% dos casos de uso iniciais
- Time de 2 devs full-time; sem designer dedicado no MVP

---

## 9. Roadmap de Alto Nível

### 🎯 MVP — 3 meses (v0.1)

Foco: **scaffold production-ready para dev full-stack**.

- F1 CLI `create-next-in-site`
- F2 Monorepo Turborepo + pnpm
- F3 Tipos compartilhados Strapi ↔ Next.js
- F4 Sistema de blocos dinâmicos (3 blocos de exemplo)
- F5 i18n configurado
- F6 Docs de deploy (Vercel + Docker Compose)
- F8 SEO básico
- F9 Tailwind base
- Documentação pública (site de docs mínimo)
- Release open-source no GitHub + npm

### 🔜 Pós-MVP — v1.1 / v1.2

- **Design system opcional** (`packages/ui` com tokens e componentes headless)
- **Mais blocos oficiais** (FAQ, Pricing, Testimonials, Gallery)
- **Templates de partida** (site institucional, blog, landing page, docs)
- **SEO técnico completo** (OG images dinâmicas, JSON-LD avançado)
- **Plugin system** (hooks oficiais para estender o scaffold)
- **Adapters de CMS alternativos** (Payload, Sanity) — desacoplar do Strapi

### ☁️ Roadmap Cloud (Agency-friendly) — horizonte 6-12 meses

- **Next in Site Cloud** — SaaS para agências com multi-tenant, projetos por cliente
- Editor visual de conteúdo acima do Strapi
- Deploy gerenciado (1-clique)
- Billing, team management, audit log
- **Target:** agências digitais e freelancers que querem produtividade sem ops

---

## 10. Decisões em Aberto

Perguntas que precisam de resposta antes ou durante o desenvolvimento do MVP:

1. **Licença** — confirmar MIT vs Apache 2.0 (qual padrão o mantenedor prefere?)
2. **Nome do pacote npm** — `next-in-site`, `@next-in-site/cli`, outro?
3. **Domínio do site de docs** — já existe? Hospedagem (Vercel próprio)?
4. **Política de versionamento** — semver estrito? Release cadence (semanal, quinzenal)?
5. **Telemetria no CLI** — implementar no MVP (F10 Nice to Have) ou deixar para v1.1?
6. **Governança open-source** — como aceitar contribuições? CODEOWNERS, RFC process, CLA?
7. **Teste E2E do scaffold gerado** — quais cenários entram no CI (ex: `create` + `build` + `lighthouse`)?
8. **Comunicação e comunidade** — Discord? GitHub Discussions? Twitter/X oficial?
9. **Branding** — quem define logo, landing page, identidade visual do Next in Site?
10. **Roadmap público** — usar GitHub Projects aberto para transparência de prioridades?

---

> **Próximos passos sugeridos:**
> 1. Revisar este PRD com o time (2 devs) e resolver as 10 decisões em aberto
> 2. Quebrar Must Haves em épicos/tickets (GitHub Projects)
> 3. Abrir repositório público e publicar v0.1-alpha para feedback inicial

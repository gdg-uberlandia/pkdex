# Documentação do DevFest Triângulo Pokedex

Esta pasta contém a documentação funcional, técnica e arquitetural do projeto.

O objetivo é centralizar as decisões, padrões, fluxos e requisitos necessários para desenvolver e manter a aplicação.

## Escopo e regras de produto

- [Escopo, fases concluídas e próximas entregas](./project/06-roadmap.md)
- [Contratos de dados e regras de domínio](./backend/01-firestore.md)

## Projeto

- [Visão geral](./project/01-project-overview.md)
- [Stack e bibliotecas](./project/02-stack.md)
- [Arquitetura do projeto](./project/03-project-architecture.md)
- [Padrões de código](./project/04-code-standards.md)
- [Variáveis de ambiente](./project/05-environment.md)
- [Roadmap](./project/06-roadmap.md)
- [Fluxo de desenvolvimento](./project/07-development-workflow.md)
- [Scripts de reset e seed do Firestore](./project/08-database-maintenance-scripts.md)

- [Validação de desempenho](./project/09-performance-validation.md)
- [Planejamento de brindes e tickets](./project/10-reward-planning.md)

## Frontend

- [Design System](./frontend/01-design-system.md)
- [Componentes](./frontend/02-components.md)
- [Páginas](./frontend/03-pages.md)
- [Navegação](./frontend/04-navigation.md)

## Backend

- [Firestore](./backend/01-firestore.md)
- [Autenticação](./backend/02-authentication.md)
- [Sistema de QR Code](./backend/03-qr-code.md)
- [Segurança](./backend/04-security.md)
- [Firestore Rules](./backend/05-firestore-rules.md)
- [Server Actions](./backend/06-server-actions.md)
- [Deployment](./backend/07-deployment.md)

## Como utilizar esta documentação

Antes de iniciar uma nova funcionalidade:

1. Consulte o roadmap.
2. Consulte os padrões de arquitetura e código.
3. Leia os documentos de frontend e backend relacionados à funcionalidade.
4. Atualize a documentação ao alterar fluxos, contratos ou decisões importantes.

A documentação deve evoluir junto com o código. Mudanças estruturais ou funcionais não devem ser consideradas concluídas enquanto os documentos relacionados estiverem desatualizados.

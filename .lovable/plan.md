
# Reorganizacao do Menu e Telas por Servico

## Situacao Atual

O menu atual tem 15 itens em uma lista plana, sem agrupamento logico. As telas misturam cadastro de termos/processos com visualizacao dos dados recebidos. A tela "Termos de Busca" e generica para todos os tipos de termos, e a tela "Distribuicoes" mistura cadastro de nomes com listagem de distribuicoes recebidas.

## Nova Estrutura do Menu

O menu sera reorganizado em grupos logicos com submenus para cada servico:

```text
--- Principal ---
  Dashboard

--- Servicos ---
  Publicacoes
    > Termos             (CRUD de termos de publicacao)
    > Recortes           (dados recebidos via sync)
  Distribuicoes
    > Nomes Monitorados  (CRUD de nomes/termos de distribuicao)
    > Distribuicoes      (dados recebidos via sync)
  Processos
    > Processos CNJ      (CRUD de numeros de processos)
    > Andamentos         (dados de movimentacoes recebidos)

--- Integracao ---
  Status Tribunais
  Reversao Confirmacoes
  Logs de Sincronizacao

--- Cadastros ---
  Parceiros
  Clientes

--- Sistema ---
  Monitoramento de API
  Playground de API
  Relatorios
  Configuracoes
  Ajuda
```

## Paginas a Criar

### 1. Termos de Publicacao (`/publications/terms`)
- Reutiliza a logica atual do `SearchTerms.tsx`, filtrando apenas termos com `term_type` em ("name", "office")
- CRUD completo: cadastrar, editar, ativar/desativar, excluir termos
- Coluna de clientes vinculados (via `client_search_terms`)
- Botao de sincronizar termos com parceiro (SOAP)
- Filtros por tipo (nome/escritorio), status, busca textual

### 2. Nomes Monitorados de Distribuicao (`/distributions/terms`)
- Reutiliza a logica de cadastro de nomes que hoje esta embutida na tela `Distributions.tsx`
- CRUD: cadastrar nomes, ativar/desativar, excluir
- Coluna de clientes vinculados
- Filtros e busca

### 3. Andamentos de Processos (`/processes/movements`)
- Nova tela que lista todas as movimentacoes/andamentos recebidos via sincronizacao
- Dados das tabelas `process_movements`, com join em `processes`
- Filtros por processo, tipo de andamento, periodo
- Informacao de documentos associados

## Paginas a Ajustar

### 4. Publicacoes (`/publications`) - ja existe
- Permanece como esta, mostrando os recortes de diarios oficiais recebidos
- Breadcrumb atualizado

### 5. Distribuicoes (`/distributions`) - refatorar
- Remover o dialog de cadastro de nomes (movido para `/distributions/terms`)
- Manter apenas a listagem de distribuicoes recebidas via sync
- Adicionar mais detalhes e filtros

### 6. Processos (`/processes`) - ja existe
- Permanece como tela de CRUD de numeros CNJ
- Coluna de clientes vinculados ja implementada

## Mudancas no Codigo

### Arquivos novos:
- `src/pages/PublicationTerms.tsx` - CRUD de termos de publicacao
- `src/pages/DistributionTerms.tsx` - CRUD de nomes de distribuicao
- `src/pages/ProcessMovements.tsx` - Listagem de andamentos

### Arquivos a editar:
- `src/components/layout/AppSidebar.tsx` - Nova estrutura de menu com grupos e submenus usando `Collapsible` dentro de `SidebarGroup`
- `src/App.tsx` - Adicionar novas rotas (`/publications/terms`, `/distributions/terms`, `/processes/movements`)
- `src/pages/Distributions.tsx` - Remover dialog de cadastro de nomes, manter apenas listagem de dados recebidos
- Remover `src/pages/SearchTerms.tsx` da navegacao (funcionalidade sera dividida entre PublicationTerms e DistributionTerms)

### Detalhes tecnicos:

**AppSidebar.tsx** usara `SidebarGroup` com `SidebarGroupLabel` para cada grupo, e `Collapsible` para os submenus dos 3 servicos. Cada servico tera um item colapsavel com dois subitens (Cadastro e Dados).

**PublicationTerms.tsx** filtrara `search_terms` com `term_type IN ('name', 'office')` e `partner_services.service_type = 'terms'` ou `'publications'`. Tera os mesmos componentes de CRUD que o SearchTerms atual.

**DistributionTerms.tsx** filtrara `search_terms` com `term_type = 'distribution'` e usara o `manage-distribution-terms` Edge Function para operacoes CRUD.

**ProcessMovements.tsx** consultara `process_movements` com join em `processes` para mostrar numero do processo, e tera filtros por periodo, tipo de andamento e busca textual.

A rota `/search-terms` sera mantida como redirect ou removida do menu, ja que sua funcionalidade sera coberta pelas novas telas especificas.


# Reestruturacao do Modulo de Processos - Dois Macro Processos

## Problema Atual

O sistema trata "Processos CNJ" e "Andamentos" como partes de um unico fluxo, mas na realidade sao **dois macro processos distintos** com endpoints separados na API Solucionare. Alem disso, o `sync-process-updates` usa endpoints **errados** (sem `PorEscritorio`) que retornam dados de todos os escritorios.

## Conceito Correto

### Macro Processo 1: Processos CNJ (Cadastro e Validacao)
Gerencia o ciclo de vida do cadastro de processos. O processo passa por validacao na Solucionare antes de ficar disponivel para monitoramento.

**Endpoints (da documentacao - Print 1):**

| Endpoint | Metodo | Uso |
|----------|--------|-----|
| `CadastraNovoProcesso` | POST | Cadastrar novo processo (ja implementado) |
| `CadastrarProcessosEmLote` | POST | Cadastrar processos em lote |
| `ExcluirProcesso` | POST | Excluir processo (ja implementado) |
| `ExcluirListaProcesso` | POST | Excluir lista de processos |
| `BuscaStatusProcesso` | GET | Verificar status de validacao (ja implementado) |
| `BuscaProcessos` (endpoint 17) | GET | Buscar lista de processos cadastrados filtrado por `codEscritorio` |

**Tela atual `/processes`**: Correta conceitualmente, mas o botao "Sincronizar" chama `sync-process-updates` (macro processo 2) o que e errado. Deveria chamar `BuscaProcessos` para atualizar a lista e `BuscaStatusProcesso` para atualizar os status.

---

### Macro Processo 2: Andamentos (Dados dos Processos Cadastrados)
Somente para processos com status **CADASTRADO** (status_code=4). Captura dados completos vindos do monitoramento.

**Endpoints (da documentacao - Prints 2 a 6):**

| Grupo | GET (Busca) | Filtro | POST (Confirmacao) |
|-------|-------------|--------|---------------------|
| **Capas** (Print 2) | `BuscaDadosCapaEStatusVariosProcessos` | por codProcesso | `ConfirmaRecebimentoProcessosComCapaAtualizada` |
| **Capas** (Print 2) | `BuscaProcessosComCapaAtualizada` | `codEscritorio` | - |
| **Andamentos** (Print 3) | `BuscaNovosAndamentosPorEscritorio` | `codEscritorio` | `ConfirmaRecebimentoAndamento` |
| **Andamentos** (Print 3) | `BuscaQuantidadeAndamentosDisponiveis` | `codEscritorio` | - |
| **Documentos** (Print 4) | `BuscaNovosDocumentosPorEscritorio` | `codEscritorio` | `ConfirmaRecebimentoDocumento` |
| **Documentos** (Print 4) | `BuscaQtdNovosDocumentosPorEscritorio` | `codEscritorio` | - |
| **Agrupadores** (Print 5) | `BuscaAgrupadoresPorEscritorio` | `codEscritorio` | `ConfirmaRecebimentoAgrupador` |
| **Dependencias** (Print 6) | `BuscaDependenciasPorEscritorio` | `codEscritorio` | `ConfirmaRecebimentoDependencia` |

**ERRO CRITICO ATUAL**: O `sync-process-updates` usa endpoints **sem** `PorEscritorio` (ex: `BuscaNovosAndamentos` em vez de `BuscaNovosAndamentosPorEscritorio`), e depois faz filtragem local. Isso e incorreto e explica os 28 processos em vez de 10 -- a filtragem local pode falhar se os dados nao contem `codEscritorio` no payload.

---

## Plano de Implementacao

### 1. Corrigir endpoints no `sync-process-updates` (Edge Function)

Trocar todos os endpoints para as versoes `PorEscritorio` que filtram na origem:

- `BuscaNovosAgrupadores` -> `BuscaAgrupadoresPorEscritorio?codEscritorio={code}`
- `BuscaNovasDependencias` -> `BuscaDependenciasPorEscritorio?codEscritorio={code}`
- `BuscaNovosAndamentos` -> `BuscaNovosAndamentosPorEscritorio?codEscritorio={code}`
- `BuscaNovosDocumentos` -> `BuscaNovosDocumentosPorEscritorio?codEscritorio={code}`
- `BuscaProcessosComCapaAtualizada` -> `BuscaProcessosComCapaAtualizada?codEscritorio={code}` (ja usa)

Remover toda logica de filtragem local (ja que a API filtra na origem). Tornar `office_code` obrigatorio.

### 2. Criar sincronizacao para "Processos CNJ" no `sync-process-management`

Adicionar nova action `sync` que:
- Chama `BuscaProcessos?codEscritorio={code}` para buscar todos os processos cadastrados
- Atualiza a tabela `processes` local com os dados retornados (status, codProcesso, etc.)
- Opcionalmente chama `BuscaStatusProcesso` para cada processo pendente

### 3. Ajustar a pagina `/processes` (Processos CNJ)

- Mudar o botao "Sincronizar" para chamar a nova action `sync` do `sync-process-management` (buscar lista de processos e status)
- Manter funcionalidades existentes: cadastrar, excluir, verificar status
- Descricao: "Cadastro e acompanhamento de validacao de processos CNJ"

### 4. Ajustar a pagina `/processes/movements` (Andamentos)

- Adicionar botao "Sincronizar" que chama `sync-process-updates` (este sim captura andamentos, documentos, capas, etc.)
- Adicionar stats de quantidade disponivel usando `BuscaQuantidadeAndamentosDisponiveis` e `BuscaQtdNovosDocumentosPorEscritorio`
- Descricao: "Dados completos dos processos com status Cadastrado"

### 5. Limpar dados e re-sincronizar

- Apagar todos os registros atuais de processos e tabelas vinculadas (mesma limpeza feita anteriormente)
- Executar nova sincronizacao com os endpoints corretos

---

## Detalhes Tecnicos

### Arquivos a modificar:

1. **`supabase/functions/sync-process-updates/index.ts`** -- Corrigir todos os 5 endpoints para versoes `PorEscritorio`, passando `codEscritorio` como query param. Remover filtragem local.

2. **`supabase/functions/sync-process-management/index.ts`** -- Adicionar action `sync` com chamada a `BuscaProcessos?codEscritorio={code}` para sincronizar lista de processos cadastrados e seus status.

3. **`src/pages/Processes.tsx`** -- Alterar `handleSync` para chamar `sync-process-management` com `action: 'sync'`. Atualizar textos descritivos.

4. **`src/pages/ProcessMovements.tsx`** -- Adicionar botao "Sincronizar" que chama `sync-process-updates`. Adicionar cards de quantidade disponivel.

5. **`src/components/layout/AppSidebar.tsx`** -- Sem alteracao (menu ja esta correto com "Processos CNJ" e "Andamentos").

### Mapeamento de endpoints atual vs correto:

```text
ATUAL (errado)                          CORRETO (com filtro por escritorio)
--------------------------------------  -----------------------------------------------
GET /BuscaNovosAgrupadores              GET /BuscaAgrupadoresPorEscritorio?codEscritorio=41
GET /BuscaNovasDependencias             GET /BuscaDependenciasPorEscritorio?codEscritorio=41
GET /BuscaNovosAndamentos               GET /BuscaNovosAndamentosPorEscritorio?codEscritorio=41
GET /BuscaNovosDocumentos               GET /BuscaNovosDocumentosPorEscritorio?codEscritorio=41
```

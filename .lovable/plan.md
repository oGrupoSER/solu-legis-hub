

## Plano: Expandir tabela `publications` com todos os campos da API REST V2

### 1. Migração: Adicionar colunas à tabela `publications`

Colunas novas baseadas no JSON da API:

| Coluna | Tipo | Mapeamento JSON |
|--------|------|-----------------|
| hash_publicacao | text | hashPublicaco |
| cod_escritorio | integer | codEscritorio |
| data_vsap | timestamptz | dataVSap |
| data_disponibilizacao | timestamptz | dataDisponibilizacao |
| vara | text | vara |
| comarca | text | comarca |
| orgao | text | orgao |
| nome_caderno | text | nomeCaderno |
| sigla_diario | text | siglaDiario |
| esfera_diario | text | esferaDiario |
| num_edicao | text | numEdicao |
| num_processo | text | numProcesso |
| id_nome | integer | idNome |
| cod_mapa_diario | integer | codMapaDiario |
| nome_pesquisado | text | nomePesquisado |
| termo_pesquisado | text | termoPesquisado |
| oab | text | oab |
| estado | text | estado |
| uf | varchar(2) | uf |
| area | integer | area |
| perfil_contratante | text | perfilContratante |
| outros_termos | text | outrosTermosDePesquisaEncontrados |
| controle_pg | integer | controlePg |
| complemento | boolean | complemento |
| tipo_fonte_conteudo | integer | tipoFonteConteudo |

Todas nullable com default null.

### 2. Atualizar `sync-search-terms/index.ts`

Na seção de processamento de publicações (linhas 223-258), mapear todos os novos campos do JSON para as colunas correspondentes no insert.

O campo `content` será mapeado de `conteudoPublicacao` e `matched_terms` de `[nomePesquisado]`.

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar ~25 colunas à tabela `publications` |
| `supabase/functions/sync-search-terms/index.ts` | Mapear todos os campos no insert de publicações |


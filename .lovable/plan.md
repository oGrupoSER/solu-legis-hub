
# Plano: Wizard de Cadastro/Edicao de Processos CNJ com Todos os Parametros da API

## Contexto

A documentacao da API V3 Andamentos (secao 2.1.1 - CadastraNovoProcesso) define os seguintes parametros:

| Parametro | Tipo | Status Atual |
|-----------|------|-------------|
| numProcesso | varchar(50) - Obrigatorio | Implementado |
| codEscritorio | int - Obrigatorio | Implementado (automatico) |
| UF | varchar(2) - Opcional | Implementado |
| Instancia | int - Obrigatorio | Implementado |
| codTribunal | int - Opcional | **Faltando** |
| Comarca | varchar(500) - Opcional | **Faltando** |
| Autor | varchar(1000) - Opcional | **Faltando** |
| Reu | varchar(1000) - Opcional | **Faltando** |

Alem disso, o dialogo atual e um formulario simples sem abas, diferente do padrao wizard ja estabelecido nos modulos de Publicacoes e Distribuicoes.

## O Que Sera Feito

### 1. Refatorar ProcessDialog para Wizard de 3 Etapas

Seguindo o padrao do `SearchTermDialog` (Publicacoes) e `DistributionTerms`:

**Etapa 1 - Dados Basicos:**
- Numero do Processo (CNJ) com formatacao automatica e verificacao de duplicidade
- Servico (quando houver mais de um)
- Clientes vinculados (ClientSelector)
- Codigo do Escritorio (exibicao automatica, somente leitura)

**Etapa 2 - Localizacao e Instancia:**
- UF (select com todas as UFs + opcao "TS" para Tribunais Superiores)
- Codigo do Tribunal (campo numerico opcional) - **NOVO**
- Comarca (campo texto opcional) - **NOVO**
- Instancia (select: 1a, 2a, 3a/Superiores, Todas)

**Etapa 3 - Partes do Processo:**
- Autor (campo texto opcional) - **NOVO**
- Reu (campo texto opcional) - **NOVO**
- Nota explicativa: "Informar autor e reu pode acelerar a validacao do processo junto ao tribunal"

### 2. Refatorar EditProcessDialog para Mesmo Layout

- Mesmo wizard de 3 etapas
- Carregar dados existentes do processo (incluindo novos campos de metadata)
- Manter logica de re-validacao quando o numero CNJ muda

### 3. Atualizar Edge Function (sync-process-management)

- Action `register`: Enviar os novos campos opcionais (`codTribunal`, `Comarca`, `Autor`, `Reu`) para a API
- Action `send-pending`: Incluir os mesmos campos ao reenviar processos pendentes
- Salvar os novos campos no `metadata` ou em `raw_data` para persistencia

### 4. Armazenamento dos Novos Campos

Os campos `codTribunal`, `Comarca`, `Autor` e `Reu` nao possuem colunas dedicadas na tabela `processes`. Serao armazenados no campo `raw_data` (JSONB) que ja existe, sem necessidade de migracoes de banco de dados.

---

## Detalhes Tecnicos

### Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/processes/ProcessDialog.tsx` | Refatorar para wizard 3 etapas com stepper visual, adicionar campos codTribunal, Comarca, Autor, Reu |
| `src/components/processes/EditProcessDialog.tsx` | Mesmo wizard, carregar dados existentes do raw_data |
| `supabase/functions/sync-process-management/index.ts` | Enviar novos campos na action register e send-pending |

### Padrao Visual do Wizard

Reutilizar o mesmo padrao de stepper das Publicacoes:
- Indicador de etapas com numeros e labels no topo
- Botoes "Voltar" / "Proximo" / "Cadastrar" no rodape
- Validacao por etapa antes de avancar
- Dialog com largura maior (sm:max-w-[600px]) para acomodar o conteudo

### Logica de Envio para API

```text
POST /CadastraNovoProcesso
{
  numProcesso: "...",
  codEscritorio: 123,
  UF: "SP",
  instancia: 1,
  codTribunal: 8,        // novo - opcional
  Comarca: "São Paulo",  // novo - opcional
  Autor: "João Silva",   // novo - opcional
  Reu: "Empresa XYZ"     // novo - opcional
}
```

Campos vazios ou nulos nao serao enviados no body da requisicao.



## Plano: Ajustes no Dialog de Cadastro de Termos de Publicação

### Alterações em `src/components/terms/SearchTermDialog.tsx`

**1. Tipo bloqueado com valor default "Nome de Pesquisa"**
- Alterar `term_type` default de `"office"` para `"name"` no estado inicial
- Tornar o Select de tipo `disabled` (readonly visual)

**2. Parceiro e Serviço pré-selecionados**
- Após `fetchPartners`, auto-selecionar o primeiro parceiro da lista
- Após `fetchServices`, auto-selecionar o primeiro serviço do parceiro
- Usuário pode alterar se quiser

**3. Cliente "infojudiciais" pré-marcado**
- Ao abrir o dialog para novo termo, buscar o client com nome contendo "infojudiciais" na tabela `client_systems`
- Pré-selecionar seu ID em `selectedClients`

**4. Aba Abrangências: flag "Todas" fixa**
- Substituir todo o conteúdo da etapa 3 (diários) por uma simples flag "Todas" marcada e desabilitada
- Remover o carregamento de diários (`handleFetchAbrangencias`) e o useEffect que o dispara
- No submit, enviar `metadata.abrangencias = ["TODAS"]` (ou valor equivalente)

### Arquivos a modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/terms/SearchTermDialog.tsx` | Todas as 4 alterações acima |


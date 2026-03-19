

## Plano: Exportar Código dos Componentes de Detalhamento de Processo

### Objetivo
Gerar um pacote de arquivos `.tsx` com todo o código dos componentes de detalhamento de processo (Capa, Andamentos, Partes, Documentos e página principal) para que o time do Infojudiciais possa replicar a interface.

### O que será exportado
Serão gerados 5 arquivos em `/mnt/documents/process-details-export/`:

1. **ProcessDetails.tsx** — Página principal com header, cards de resumo e sistema de abas
2. **ProcessCoverTab.tsx** — Aba Capa (identificação, localização, classificação, magistrado, sistema, datas, valor, link de consulta, JSON raw)
3. **ProcessMovementsTab.tsx** — Aba Andamentos (timeline com filtro por documentos, documentos inline com destaque azul, paginação além de 1000 registros)
4. **ProcessPartiesTab.tsx** — Aba Partes (Polo Ativo/Passivo/Terceiros com advogados vinculados)
5. **ProcessDocumentsTab.tsx** — Aba Documentos avulsos (filtro disponível/expirado, badges de status, links diretos)
6. **README.md** — Instruções de uso, dependências necessárias (shadcn/ui, lucide-react, Tailwind CSS) e estrutura de dados esperada de cada tabela

Os arquivos serão limpos de imports específicos do Supabase e terão comentários indicando onde o Infojudiciais deve plugar sua própria fonte de dados.

### Formato
Arquivos `.tsx` prontos para copiar, com um README explicando as dependências e a estrutura de dados.


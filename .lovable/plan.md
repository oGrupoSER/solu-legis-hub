

## Plano: Corrigir métodos GET e remover prefixos "Dis -" e "Pub -"

### Alterações em `src/pages/ApiTesting.tsx`

**1. Distribuições — mudar método para GET (linhas 228, 238):**
- `dis-buscar-distribuicoes`: `method: "POST"` → `method: "GET"`
- `dis-buscar-nomes`: `method: "POST"` → `method: "GET"`

**2. Distribuições — remover prefixo "Dis - " dos labels (linhas 176, 185, 196, 206, 218, 228, 238):**
- `"Dis - Autenticação"` → `"Autenticação"`
- `"Dis - Cadastrar Escritório"` → `"Cadastrar Escritório"`
- `"Dis - Ativar Escritório"` → `"Ativar Escritório"`
- `"Dis - Cadastrar Termo"` → `"Cadastrar Termo"`
- `"Dis - Desativar Termo"` → `"Desativar Termo"`
- `"Dis - Buscar Distribuições"` → `"Buscar Distribuições"`
- `"Dis - Buscar Nomes Cadastrados"` → `"Buscar Nomes Cadastrados"`

**3. Publicações — remover prefixo "Pub - " dos labels (linhas 278, 287, 298, 308, 319, 332, 343, 355, 366, 377, 386):**
- `"Pub - Autenticação"` → `"Autenticação"`
- `"Pub - Cadastrar Nome"` → `"Cadastrar Nome"`
- `"Pub - Excluir Nome"` → `"Excluir Nome"`
- `"Pub - Consultar Nomes"` → `"Consultar Nomes"`
- `"Pub - Cadastrar OAB"` → `"Cadastrar OAB"`
- `"Pub - Consultar OAB"` → `"Consultar OAB"`
- `"Pub - Cadastrar Variação"` → `"Cadastrar Variação"`
- `"Pub - Cadastrar TermoValidação"` → `"Cadastrar TermoValidação"`
- `"Pub - Cadastrar Abrangência"` → `"Cadastrar Abrangência"`
- `"Pub - Buscar Catálogo"` → `"Buscar Catálogo"`
- `"Pub - Buscar Publicações"` → `"Buscar Publicações"`

**4. Publicações — mudar método para GET (linhas 308, 332, 377, 386):**
- `rest-consultar-nomes` (Consultar Nomes): `POST` → `GET`
- `rest-consultar-oab` (Consultar OAB): `POST` → `GET`
- `rest-buscar-catalogo` (Buscar Catálogo): `POST` → `GET`
- `rest-buscar-publicacoes` (Buscar Publicações): `POST` → `GET`

### Nota
Os endpoints continuam chamando o mesmo backend function via POST internamente — a mudança de `method` afeta apenas o badge visual (GET/POST) exibido no Playground. A lógica de chamada não muda.


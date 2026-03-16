

## Plano: Trocar logo e padronizar nome "HUB Jurídico"

### 1. Copiar logo para o projeto
- Copiar `user-uploads://ChatGPT_Image_15_de_mar._de_2025_18_49_19.png` para `src/assets/logo-orbo.png`

### 2. Substituir ícones Scale+Shield pela logo em 3 locais

**`src/components/layout/AppSidebar.tsx`** (linhas 119-122):
- Trocar `<Scale>` + `<Shield>` por `<img src={logo} />` com tamanho adequado (~28px)
- Texto "Hub Jurídico" ja esta correto, manter

**`src/components/dashboard/DashboardHeader.tsx`** (linhas 24-27):
- Trocar `<Scale>` + `<Shield>` por `<img src={logo} />` (~32px)

**`src/pages/Auth.tsx`** (linhas 67-70):
- Trocar `<Scale>` + `<Shield>` por `<img src={logo} />` (~48px)

### 3. Padronizar nome para "HUB Jurídico"
Atualizar em todos os 7 arquivos onde aparece "Hub Jurídico" para "HUB Jurídico":
- `index.html` — title e meta tags
- `src/components/layout/AppSidebar.tsx`
- `src/components/dashboard/DashboardHeader.tsx`
- `src/pages/Auth.tsx`
- `src/pages/Clients.tsx`
- `src/lib/postman-collection.ts`
- `src/lib/playground-export.ts`

### Arquivos alterados
- `src/assets/logo-orbo.png` (novo — cópia da imagem)
- `src/components/layout/AppSidebar.tsx`
- `src/components/dashboard/DashboardHeader.tsx`
- `src/pages/Auth.tsx`
- `index.html`
- `src/pages/Clients.tsx`
- `src/lib/postman-collection.ts`
- `src/lib/playground-export.ts`

